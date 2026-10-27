const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const BrochureLead = require('../Models/BrochureLead');
const DownloadEvent = require('../Models/DownloadEvent');
const Product = require('../Models/Product');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');
const { leadLimiter, downloadLimiter } = require('../src/middleware/rateLimiter');
const { uploadSingleBrochure } = require('../Middleware/uploadMiddleware');
const { sendBrochureLeadEmails } = require('../src/services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'tatva_inox_jwt_super_secret_key_2026_healthcare';
const BROCHURES_DIR = path.resolve(__dirname, '..', 'storage', 'brochures');
const MASTER_CATALOGUE_NAME = 'tatva-inox-product-catalogue.pdf';

// Ensure brochures dir exists
if (!fs.existsSync(BROCHURES_DIR)) {
  fs.mkdirSync(BROCHURES_DIR, { recursive: true });
}

// ==================== 1. POST /api/brochures/request (Public) ====================
// Submit form to validate & record lead, and generate authorized download token
router.post('/request', leadLimiter, async (req, res) => {
  try {
    const {
      name,
      company,
      email,
      phone,
      productId,
      productName,
      message,
      consent,
      source
    } = req.body;

    // Server-side validation
    const errors = {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.name = 'Full name is required (minimum 2 characters)';
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(String(email).trim())) {
      errors.email = 'Valid corporate or personal email is required';
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (!cleanPhone || cleanPhone.length < 7) {
      errors.phone = 'Valid phone or WhatsApp number is required (minimum 7 digits)';
    }

    if (consent === false || consent === 'false') {
      errors.consent = 'Consent is required to receive product documentation';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required fields correctly.',
        errors
      });
    }

    // Determine target brochure file
    let targetBrochureFileName = MASTER_CATALOGUE_NAME;
    let targetProductName = productName || 'Tatva Inox Healthcare Equipment Catalogue';
    let targetProductId = productId || '';

    if (productId) {
      // Find product by id or slug
      const isObjectId = productId.match(/^[0-9a-fA-F]{24}$/);
      const productDoc = await Product.findOne(
        isObjectId ? { $or: [{ _id: productId }, { slug: productId }] } : { slug: productId }
      );

      if (productDoc) {
        targetProductName = productDoc.name;
        targetProductId = productDoc.slug || productDoc._id.toString();
        if (productDoc.brochureFileName && fs.existsSync(path.join(BROCHURES_DIR, productDoc.brochureFileName))) {
          targetBrochureFileName = productDoc.brochureFileName;
        }
      }
    }

    // Generate unique Lead ID (e.g. LEAD-2026-84920)
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const leadId = `LEAD-2026-${randomSuffix}`;

    // Generate signed, short-lived download token (15 minutes validity)
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const tokenPayload = {
      leadId,
      brochureName: targetBrochureFileName,
      productName: targetProductName,
      email: email.trim().toLowerCase(),
      exp: Math.floor(tokenExpiresAt.getTime() / 1000)
    };
    const downloadToken = jwt.sign(tokenPayload, JWT_SECRET);

    // Save lead in MongoDB
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const newLead = new BrochureLead({
      leadId,
      name: name.trim(),
      company: company ? company.trim() : '',
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      productId: targetProductId,
      productName: targetProductName,
      brochureName: targetBrochureFileName,
      message: message ? message.trim() : '',
      consent: Boolean(consent),
      leadSource: source || 'product_brochure_modal',
      downloadStatus: 'pending',
      downloadToken,
      tokenExpiresAt,
      ipAddress: String(clientIp).slice(0, 50),
      userAgent: String(userAgent).slice(0, 200),
      notes: [
        {
          id: `note-${Date.now()}`,
          text: `Brochure request submitted for "${targetProductName}". Download token generated.`,
          author: 'System',
          date: new Date()
        }
      ]
    });

    await newLead.save();

    // Prepare authorized download URL
    const downloadUrl = `/api/brochures/download?token=${downloadToken}`;
    const fullDownloadUrl = `${req.protocol}://${req.get('host')}${downloadUrl}`;

    // Dispatch confirmation and admin alert emails asynchronously
    sendBrochureLeadEmails(newLead, fullDownloadUrl).catch((err) => {
      console.warn('Asynchronous email delivery warning:', err.message);
    });

    return res.status(200).json({
      success: true,
      leadId,
      downloadToken,
      downloadUrl,
      fileName: targetBrochureFileName,
      message: `Thank you, ${name.trim()}! Your download has been authorized.`
    });
  } catch (err) {
    console.error('Error processing brochure request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process brochure request. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 2. GET /api/brochures/download (Gated Download) ====================
// Only authorized users with a valid, non-expired token can download the brochure
router.get('/download', downloadLimiter, async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Missing brochure authorization token. Please submit the brochure request form first.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired download link. Brochure access tokens expire after 15 minutes. Please request again.'
    });
  }

  const { leadId, brochureName, productName } = decoded;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  // Prevent path traversal by strictly resolving canonical path within BROCHURES_DIR
  const safeFilename = path.basename(brochureName || MASTER_CATALOGUE_NAME);
  let resolvedFilePath = path.join(BROCHURES_DIR, safeFilename);

  // If specific product brochure was requested but is missing, fallback to master catalogue
  if (!fs.existsSync(resolvedFilePath)) {
    const fallbackPath = path.join(BROCHURES_DIR, MASTER_CATALOGUE_NAME);
    if (fs.existsSync(fallbackPath)) {
      resolvedFilePath = fallbackPath;
    } else {
      // Record download failure event
      await DownloadEvent.create({
        leadId: leadId || 'UNKNOWN',
        brochureName: safeFilename,
        productName: productName || 'Catalogue',
        ipAddress: String(clientIp).slice(0, 50),
        userAgent: String(userAgent).slice(0, 200),
        success: false,
        error: `File not found: ${safeFilename}`
      });

      return res.status(404).json({
        success: false,
        message: 'The requested brochure file is currently undergoing technical revision. Our healthcare desk has been notified and will email you the updated document.'
      });
    }
  }

  // Ensure path is strictly inside BROCHURES_DIR (defense against path traversal)
  if (!resolvedFilePath.startsWith(BROCHURES_DIR)) {
    return res.status(403).json({ success: false, message: 'Forbidden file path.' });
  }

  try {
    // Update BrochureLead record
    if (leadId) {
      await BrochureLead.findOneAndUpdate(
        { leadId },
        {
          $set: {
            downloadStatus: 'downloaded',
            downloadTimestamp: new Date()
          },
          $inc: { downloadCount: 1 }
        }
      );
    }

    // Record successful DownloadEvent
    await DownloadEvent.create({
      leadId: leadId || 'UNKNOWN',
      brochureName: safeFilename,
      productName: productName || 'Catalogue',
      ipAddress: String(clientIp).slice(0, 50),
      userAgent: String(userAgent).slice(0, 200),
      success: true
    });

    // Determine clean friendly download filename
    const downloadDisplayName = safeFilename.startsWith('tatva-inox')
      ? safeFilename
      : `tatva-inox-${safeFilename}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadDisplayName}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return res.sendFile(resolvedFilePath);
  } catch (err) {
    console.error('Error during brochure download streaming:', err);
    return res.status(500).json({ success: false, message: 'Server error while downloading brochure.' });
  }
});

// ==================== 3. POST /api/brochures/upload (Admin Protected) ====================
// Upload product-specific brochure PDF or master catalogue
router.post('/upload', authenticateAdmin, (req, res) => {
  uploadSingleBrochure(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a PDF brochure file to upload.' });
    }

    try {
      const brochureUrl = `/storage/brochures/${req.file.filename}`;
      const fileSize = req.file.size;

      // Log activity
      await AuditLog.create({
        action: 'Brochure Uploaded',
        module: 'Brochures',
        details: `Uploaded brochure PDF "${req.file.originalname}" (${Math.round(fileSize / 1024)} KB)`,
        userName: req.user?.name || 'Administrator',
        userId: req.user?.id || 'admin',
        severity: 'info'
      });

      return res.status(201).json({
        success: true,
        message: 'Brochure uploaded successfully',
        brochureUrl,
        brochureFileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize
      });
    } catch (saveErr) {
      return res.status(500).json({ success: false, message: 'Failed to process brochure upload', error: saveErr.message });
    }
  });
});

module.exports = router;

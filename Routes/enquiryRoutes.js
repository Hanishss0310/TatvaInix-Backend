const express = require('express');
const router = express.Router();

const Enquiry = require('../Models/Enquiry');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');
const { enquiryLimiter } = require('../src/middleware/rateLimiter');
const { sendEnquiryEmails, sendEnquiryReply } = require('../src/services/emailService');

// ==================== 1. POST /api/enquiries (Public Submission) ====================
// Captures Contact Us, Request Quote (RFQ), Customization, and Product Enquiry submissions
router.post('/', enquiryLimiter, async (req, res) => {
  try {
    const {
      type = 'general',
      customerName,
      name,
      company,
      organization,
      email,
      phone,
      subject,
      message,
      productId,
      productName,
      quantity,
      queryType,
      priority,
      assignedTo,
      source
    } = req.body;

    const resolvedName = customerName || name;
    const resolvedOrg = organization || company;

    // Validation
    const errors = {};
    if (!resolvedName || !resolvedName.trim()) {
      errors.name = 'Full name is required';
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(String(email).trim())) {
      errors.email = 'Valid corporate or hospital email is required';
    }

    if (!message || !message.trim()) {
      errors.message = 'Please provide details or requirements for your enquiry';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, message: 'Please correct the highlighted fields', errors });
    }

    // Generate unique ID: ENQ-2026-XXX
    const randomCode = Math.floor(100 + Math.random() * 900);
    const enquiryId = `ENQ-2026-${randomCode}`;

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    const newEnquiry = new Enquiry({
      id: enquiryId,
      type: type || 'general',
      customerName: resolvedName.trim(),
      organization: resolvedOrg ? resolvedOrg.trim() : '',
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      subject: subject ? subject.trim() : `Commercial Enquiry for ${productName || 'Healthcare Equipment'}`,
      message: message.trim(),
      productId: productId || '',
      productName: productName || '',
      quantity: quantity ? parseInt(quantity, 10) || 1 : 1,
      queryType: queryType || '',
      status: 'new',
      priority: priority || 'medium',
      assignedTo: assignedTo || 'Vikram Mehta',
      source: source || 'website_form',
      ipAddress: String(clientIp).slice(0, 50),
      notes: [
        {
          id: `note-${Date.now()}`,
          text: `Enquiry submitted through website portal (${type || 'general'})`,
          author: 'System',
          date: new Date()
        }
      ]
    });

    await newEnquiry.save();

    // Send emails asynchronously
    sendEnquiryEmails(newEnquiry).catch((err) => {
      console.warn('Enquiry notification email dispatch warning:', err.message);
    });

    return res.status(201).json({
      success: true,
      enquiryId: enquiryId,
      referenceId: enquiryId,
      id: enquiryId,
      enquiry: newEnquiry,
      message: `Thank you! Your enquiry has been received (Reference: ${enquiryId}). Our technical desk will contact you within 24 hours.`
    });
  } catch (err) {
    console.error('Error creating enquiry:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to record your enquiry. Please contact us directly at office@tatvainox.in.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== ADMIN PROTECTED ROUTES ====================

// GET /api/enquiries - Retrieve all enquiries from MongoDB
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { status, type, priority, search } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;
    if (priority && priority !== 'all') filter.priority = priority;

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { customerName: regex },
        { organization: regex },
        { email: regex },
        { phone: regex },
        { subject: regex },
        { id: regex }
      ];
    }

    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (err) {
    console.error('Error retrieving enquiries:', err);
    res.status(500).json({ message: 'Failed to fetch enquiries', error: err.message });
  }
});

// GET /api/enquiries/:id - Single enquiry details
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving enquiry', error: err.message });
  }
});

// PATCH /api/enquiries/:id/status - Update status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ['new', 'in_review', 'awaiting_customer', 'resolved', 'archived'];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: `Invalid status '${status}'` });
    }

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    item.status = status;
    item.notes.unshift({
      id: `note-${Date.now()}`,
      text: `Status changed to "${status}" by ${req.user?.name || 'Administrator'}`,
      author: req.user?.name || 'Admin',
      date: new Date()
    });

    await item.save();

    await AuditLog.create({
      action: 'Enquiry Status Updated',
      module: 'Enquiries',
      details: `Enquiry ${item.id} status changed to "${status}"`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update enquiry status', error: err.message });
  }
});

// PATCH /api/enquiries/:id/assign - Assign to team member
router.patch('/:id/assign', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    item.assignedTo = assignedTo || 'Unassigned';
    item.notes.unshift({
      id: `note-${Date.now()}`,
      text: `Assigned to ${assignedTo} by ${req.user?.name || 'Administrator'}`,
      author: req.user?.name || 'Admin',
      date: new Date()
    });

    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Failed to assign enquiry', error: err.message });
  }
});

// PATCH /api/enquiries/:id/priority - Update priority
router.patch('/:id/priority', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const valid = ['low', 'medium', 'high'];
    if (!valid.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority' });
    }

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    item.priority = priority;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update priority', error: err.message });
  }
});

// POST /api/enquiries/:id/notes - Add note
router.post('/:id/notes', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, author } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    const newNote = {
      id: `note-${Date.now()}`,
      text: text.trim(),
      author: author || req.user?.name || 'Admin',
      date: new Date()
    };

    item.notes.unshift(newNote);
    await item.save();

    res.json(newNote);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add note', error: err.message });
  }
});

// POST /api/enquiries/:id/reply - Send email reply to customer
router.post('/:id/reply', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { to, subject, message } = req.body;

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    // Send email
    await sendEnquiryReply(item, { to: to || item.email, subject, message });

    item.status = 'awaiting_customer';
    item.notes.unshift({
      id: `reply-${Date.now()}`,
      text: `Replied via email: "${subject}"`,
      author: req.user?.name || 'Admin',
      date: new Date()
    });

    await item.save();

    res.json({ success: true, message: `Email reply dispatched to ${to || item.email}` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send reply', error: err.message });
  }
});

// DELETE /api/enquiries/:id - Delete enquiry
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const item = await Enquiry.findOneAndDelete(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );
    if (!item) return res.status(404).json({ message: 'Enquiry not found' });

    await AuditLog.create({
      action: 'Enquiry Deleted',
      module: 'Enquiries',
      details: `Deleted enquiry ${item.id} (${item.customerName})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'warning'
    });

    res.json({ success: true, message: `Enquiry ${item.id} deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete enquiry', error: err.message });
  }
});

module.exports = router;

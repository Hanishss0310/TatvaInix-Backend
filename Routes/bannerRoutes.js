const express = require('express');
const router = express.Router();
const Banner = require('../Models/Banner');
const AuditLog = require('../Models/AuditLog');
const { uploadBannerImage, removeUploadedFile } = require('../Middleware/uploadMiddleware');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// ==================== GET /api/banners (Public) ====================
// Retrieve active banners in display order for public homepage hero carousel
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'active' }).sort({ displayOrder: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching public banners:', err);
    res.status(500).json({ message: 'Failed to retrieve homepage banners', error: err.message });
  }
});

// ==================== GET /api/banners/admin ====================
// Retrieve all banners (active and inactive) for admin console
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching admin banners:', err);
    res.status(500).json({ message: 'Failed to retrieve banners', error: err.message });
  }
});

// ==================== GET /api/banners/:id ====================
// Retrieve single banner
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: `Banner '${id}' not found` });
    }
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving banner', error: err.message });
  }
});

// ==================== POST /api/banners ====================
// Create new banner (Admin protected, supports multipart file upload or JSON)
router.post(
  '/',
  authenticateAdmin,
  (req, res, next) => {
    uploadBannerImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const {
        title,
        subtitle,
        description,
        ctaText,
        ctaLink,
        badge,
        displayOrder,
        status,
        intervalSeconds,
        existingImage
      } = req.body;

      if (!title || !title.trim()) {
        if (req.file) removeUploadedFile(`/uploads/banners/${req.file.filename}`);
        return res.status(400).json({ message: 'Banner title is required' });
      }

      let imagePath = '';
      if (req.file) {
        imagePath = `/uploads/banners/${req.file.filename}`;
      } else if (existingImage && existingImage.trim()) {
        imagePath = existingImage.trim();
      } else if (req.body.image && req.body.image.trim()) {
        imagePath = req.body.image.trim();
      } else {
        return res.status(400).json({ message: 'Banner image is required (upload file or provide image path)' });
      }

      // Calculate next display order if not specified
      let order = parseInt(displayOrder, 10);
      if (isNaN(order)) {
        const highest = await Banner.findOne().sort({ displayOrder: -1 });
        order = highest ? (highest.displayOrder || 0) + 1 : 1;
      }

      const newBanner = new Banner({
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : '',
        description: description ? description.trim() : '',
        image: imagePath,
        ctaText: ctaText && ctaText.trim() ? ctaText.trim() : 'View Details',
        ctaLink: ctaLink && ctaLink.trim() ? ctaLink.trim() : '/products',
        badge: badge && badge.trim() ? badge.trim() : 'Featured Innovation',
        displayOrder: order,
        status: status === 'inactive' ? 'inactive' : 'active',
        intervalSeconds: intervalSeconds ? parseInt(intervalSeconds, 10) || 5 : 5
      });

      const saved = await newBanner.save();

      try {
        await AuditLog.create({
          action: 'Create Banner',
          module: 'Homepage Banners',
          details: `Created hero banner "${saved.title}" (order: ${saved.displayOrder})`,
          userId: req.user?._id || req.user?.id || 'admin',
          userName: req.user?.name || 'Administrator',
          severity: 'info'
        });
      } catch {
        // ignore audit log error
      }

      res.status(201).json(saved);
    } catch (err) {
      console.error('Error creating banner:', err);
      if (req.file) removeUploadedFile(`/uploads/banners/${req.file.filename}`);
      res.status(500).json({ message: 'Failed to create banner', error: err.message });
    }
  }
);

// ==================== PUT /api/banners/:id ====================
// Update banner details & optional image replacement
router.put(
  '/:id',
  authenticateAdmin,
  (req, res, next) => {
    uploadBannerImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findById(id);
      if (!banner) {
        if (req.file) removeUploadedFile(`/uploads/banners/${req.file.filename}`);
        return res.status(404).json({ message: `Banner '${id}' not found` });
      }

      const {
        title,
        subtitle,
        description,
        ctaText,
        ctaLink,
        badge,
        displayOrder,
        status,
        intervalSeconds,
        image: bodyImage
      } = req.body;

      if (title && title.trim()) banner.title = title.trim();
      if (subtitle !== undefined) banner.subtitle = subtitle.trim();
      if (description !== undefined) banner.description = description.trim();
      if (ctaText !== undefined) banner.ctaText = ctaText.trim();
      if (ctaLink !== undefined) banner.ctaLink = ctaLink.trim();
      if (badge !== undefined) banner.badge = badge.trim();
      if (displayOrder !== undefined) banner.displayOrder = parseInt(displayOrder, 10) || 0;
      if (status !== undefined) banner.status = status;
      if (intervalSeconds !== undefined) banner.intervalSeconds = parseInt(intervalSeconds, 10) || 5;

      // Handle new uploaded image
      if (req.file) {
        const oldImage = banner.image;
        banner.image = `/uploads/banners/${req.file.filename}`;
        if (oldImage && oldImage.startsWith('/uploads/banners/')) {
          removeUploadedFile(oldImage);
        }
      } else if (bodyImage && bodyImage.trim() && bodyImage !== banner.image) {
        banner.image = bodyImage.trim();
      }

      const updated = await banner.save();

      try {
        await AuditLog.create({
          action: 'Update Banner',
          module: 'Homepage Banners',
          details: `Updated hero banner "${updated.title}"`,
          userId: req.user?._id || req.user?.id || 'admin',
          userName: req.user?.name || 'Administrator',
          severity: 'info'
        });
      } catch {
        // ignore
      }

      res.json(updated);
    } catch (err) {
      console.error('Error updating banner:', err);
      if (req.file) removeUploadedFile(`/uploads/banners/${req.file.filename}`);
      res.status(500).json({ message: 'Failed to update banner', error: err.message });
    }
  }
);

// ==================== PATCH /api/banners/reorder ====================
// Reorder banners in bulk
router.patch('/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { banners, order } = req.body;

    if (Array.isArray(banners)) {
      await Promise.all(
        banners.map(async (item) => {
          if (item.id && item.displayOrder !== undefined) {
            await Banner.findByIdAndUpdate(item.id, { displayOrder: item.displayOrder });
          }
        })
      );
    } else if (Array.isArray(order)) {
      await Promise.all(
        order.map(async (id, idx) => {
          await Banner.findByIdAndUpdate(id, { displayOrder: idx + 1 });
        })
      );
    } else {
      return res.status(400).json({ message: 'Expected array of banners or ordered ids' });
    }

    const updated = await Banner.find().sort({ displayOrder: 1 });
    res.json(updated);
  } catch (err) {
    console.error('Error reordering banners:', err);
    res.status(500).json({ message: 'Failed to reorder banners', error: err.message });
  }
});

// ==================== PATCH /api/banners/:id/status ====================
// Toggle active / inactive status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: "Status must be either 'active' or 'inactive'" });
    }

    const banner = await Banner.findByIdAndUpdate(id, { status }, { new: true });
    if (!banner) {
      return res.status(404).json({ message: `Banner '${id}' not found` });
    }

    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update banner status', error: err.message });
  }
});

// ==================== DELETE /api/banners/:id ====================
// Delete banner and its uploaded image
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: `Banner '${id}' not found` });
    }

    const imagePath = banner.image;
    await Banner.findByIdAndDelete(id);

    if (imagePath && imagePath.startsWith('/uploads/banners/')) {
      removeUploadedFile(imagePath);
    }

    try {
      await AuditLog.create({
        action: 'Delete Banner',
        module: 'Homepage Banners',
        details: `Deleted hero banner "${banner.title}" (ID: ${id})`,
        userId: req.user?._id || req.user?.id || 'admin',
        userName: req.user?.name || 'Administrator',
        severity: 'warning'
      });
    } catch {
      // ignore
    }

    res.json({ success: true, message: `Banner "${banner.title}" deleted successfully` });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
});

module.exports = router;

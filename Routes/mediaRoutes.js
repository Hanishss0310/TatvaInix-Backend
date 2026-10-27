const express = require('express');
const router = express.Router();
const Media = require('../Models/Media');
const Product = require('../Models/Product');
const { uploadMediaImages, removeUploadedFile } = require('../Middleware/uploadMiddleware');

// ==================== GET /api/media ====================
// List all media library items with usage checks
router.get('/', async (req, res) => {
  try {
    const mediaItems = await Media.find().sort({ createdAt: -1 });

    // Update usedIn dynamically from live products
    const enrichedMedia = await Promise.all(
      mediaItems.map(async (m) => {
        const matchingProducts = await Product.find(
          { images: m.url },
          { name: 1, _id: 1 }
        );
        const obj = m.toJSON();
        obj.usedIn = matchingProducts.map((p) => p.name);
        return obj;
      })
    );

    res.json(enrichedMedia);
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ message: 'Failed to retrieve media library', error: err.message });
  }
});

// Common handler for uploading media assets
const handleMediaUpload = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0 && !req.file && !req.body.url) {
      return res.status(400).json({ message: 'No media files provided for upload.' });
    }

    const createdAssets = [];

    // If single or multiple files were uploaded via Multer
    const allFiles = files.length > 0 ? files : (req.file ? [req.file] : []);

    for (const f of allFiles) {
      const assetUrl = `/uploads/media/${f.filename}`;
      const sizeKB = `${Math.round(f.size / 1024)} KB`;

      const mediaDoc = new Media({
        name: f.originalname,
        filename: f.filename,
        originalName: f.originalname,
        url: assetUrl,
        mimeType: f.mimetype,
        size: sizeKB,
        sizeBytes: f.size,
        dimensions: '1200 x 900',
        category: req.body.category || 'Products',
        usedIn: []
      });

      const saved = await mediaDoc.save();
      createdAssets.push(saved);
    }

    // If file was passed as JSON with existing URL
    if (allFiles.length === 0 && req.body.url) {
      const mediaDoc = new Media({
        name: req.body.name || req.body.url.split('/').pop(),
        filename: req.body.url.split('/').pop(),
        originalName: req.body.name || req.body.url.split('/').pop(),
        url: req.body.url,
        mimeType: req.body.type || 'image/jpeg',
        size: req.body.size || '220 KB',
        dimensions: req.body.dimensions || '1200 x 900',
        category: req.body.category || 'Products',
        usedIn: []
      });
      const saved = await mediaDoc.save();
      createdAssets.push(saved);
    }

    if (createdAssets.length === 1) {
      res.status(201).json(createdAssets[0]);
    } else {
      res.status(201).json(createdAssets);
    }
  } catch (err) {
    console.error('Error uploading media:', err);
    res.status(500).json({ message: 'Failed to upload media asset', error: err.message });
  }
};

// ==================== POST /api/media and POST /api/media/upload ====================
router.post('/', (req, res, next) => {
  uploadMediaImages(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, handleMediaUpload);

router.post('/upload', (req, res, next) => {
  uploadMediaImages(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, handleMediaUpload);

// ==================== DELETE /api/media/:id ====================
// Delete media record and its file safely
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let media = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      media = await Media.findById(id);
    }
    if (!media) {
      media = await Media.findOne({ filename: id });
    }

    if (!media) {
      return res.status(404).json({ message: 'Media asset not found' });
    }

    // Check if any product is actively using this media asset
    const activeProducts = await Product.find({ images: media.url });
    if (activeProducts.length > 0) {
      const names = activeProducts.map((p) => p.name).join(', ');
      return res.status(400).json({
        message: `Cannot delete "${media.name}": It is currently used in products: ${names}.`
      });
    }

    if (media.url && media.url.startsWith('/uploads/media/')) {
      removeUploadedFile(media.url);
    }

    await Media.findByIdAndDelete(media._id);

    res.json({ success: true, message: `Media asset "${media.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting media asset:', err);
    res.status(500).json({ message: 'Failed to delete media asset', error: err.message });
  }
});

module.exports = router;

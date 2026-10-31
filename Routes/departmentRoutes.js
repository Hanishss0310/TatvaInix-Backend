const express = require('express');
const router = express.Router();
const Department = require('../Models/Department');
const Product = require('../Models/Product');
const AuditLog = require('../Models/AuditLog');
const { uploadDepartmentAssets, removeUploadedFile } = require('../Middleware/uploadMiddleware');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// Helper to slugify string
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

// ==================== GET /api/departments (Public) ====================
// Retrieve active departments with live product counts
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({
      status: { $in: ['active', 'published'] }
    }).sort({ displayOrder: 1, name: 1 });

    const withCount = await Promise.all(
      departments.map(async (dept) => {
        const count = await Product.countDocuments({
          $or: [
            { department: dept._id },
            { departmentSlug: dept.slug },
            { category: dept.slug }
          ],
          status: 'published'
        });
        const obj = dept.toJSON();
        obj.productCount = count;
        obj.count = count;
        return obj;
      })
    );

    res.json(withCount);
  } catch (err) {
    console.error('Error fetching public departments:', err);
    res.status(500).json({ message: 'Failed to retrieve departments', error: err.message });
  }
});

// ==================== GET /api/departments/admin ====================
// Retrieve all departments for admin console
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const departments = await Department.find().sort({ displayOrder: 1, createdAt: -1 });

    const withCount = await Promise.all(
      departments.map(async (dept) => {
        const count = await Product.countDocuments({
          $or: [
            { department: dept._id },
            { departmentSlug: dept.slug },
            { category: dept.slug }
          ]
        });
        const obj = dept.toJSON();
        obj.productCount = count;
        obj.count = count;
        return obj;
      })
    );

    res.json(withCount);
  } catch (err) {
    console.error('Error fetching admin departments:', err);
    res.status(500).json({ message: 'Failed to retrieve departments', error: err.message });
  }
});

// ==================== GET /api/departments/:slug ====================
// Retrieve single department by slug or ID with live product count
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let dept = null;

    if (slug.match(/^[0-9a-fA-F]{24}$/)) {
      dept = await Department.findById(slug);
    }
    if (!dept) {
      dept = await Department.findOne({ slug: slug.toLowerCase() });
    }

    if (!dept) {
      return res.status(404).json({ message: `Department '${slug}' not found` });
    }

    const count = await Product.countDocuments({
      $or: [
        { department: dept._id },
        { departmentSlug: dept.slug },
        { category: dept.slug }
      ],
      status: 'published'
    });

    const result = dept.toJSON();
    result.productCount = count;
    result.count = count;

    res.json(result);
  } catch (err) {
    console.error('Error retrieving department:', err);
    res.status(500).json({ message: 'Error retrieving department', error: err.message });
  }
});

// ==================== POST /api/departments ====================
// Create new department with image uploads
router.post(
  '/',
  authenticateAdmin,
  (req, res, next) => {
    uploadDepartmentAssets(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const uploadedImage = req.files?.image?.[0];
    const uploadedBanner = req.files?.bannerImage?.[0];

    try {
      const {
        name,
        slug,
        description,
        shortDescription,
        subtitle,
        displayOrder,
        status,
        featured,
        existingImage,
        existingBannerImage,
        highlights
      } = req.body;

      if (!name || !name.trim()) {
        if (uploadedImage) removeUploadedFile(`/uploads/departments/${uploadedImage.filename}`);
        if (uploadedBanner) removeUploadedFile(`/uploads/departments/${uploadedBanner.filename}`);
        return res.status(400).json({ message: 'Department name is required' });
      }

      const cleanSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

      // Verify uniqueness
      const existing = await Department.findOne({ slug: cleanSlug });
      if (existing) {
        if (uploadedImage) removeUploadedFile(`/uploads/departments/${uploadedImage.filename}`);
        if (uploadedBanner) removeUploadedFile(`/uploads/departments/${uploadedBanner.filename}`);
        return res.status(400).json({ message: `A department with slug '${cleanSlug}' already exists` });
      }

      let imagePath = '/images/products/hospital-bed.jpg';
      if (uploadedImage) {
        imagePath = `/uploads/departments/${uploadedImage.filename}`;
      } else if (existingImage && existingImage.trim()) {
        imagePath = existingImage.trim();
      } else if (req.body.image && req.body.image.trim()) {
        imagePath = req.body.image.trim();
      }

      let bannerPath = '';
      if (uploadedBanner) {
        bannerPath = `/uploads/departments/${uploadedBanner.filename}`;
      } else if (existingBannerImage && existingBannerImage.trim()) {
        bannerPath = existingBannerImage.trim();
      } else if (req.body.bannerImage && req.body.bannerImage.trim()) {
        bannerPath = req.body.bannerImage.trim();
      }

      let order = parseInt(displayOrder, 10);
      if (isNaN(order)) {
        const highest = await Department.findOne().sort({ displayOrder: -1 });
        order = highest ? (highest.displayOrder || 0) + 1 : 1;
      }

      let parsedHighlights = [];
      if (Array.isArray(highlights)) parsedHighlights = highlights;
      else if (typeof highlights === 'string') {
        try {
          parsedHighlights = JSON.parse(highlights);
        } catch {
          parsedHighlights = highlights.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      const newDept = new Department({
        name: name.trim(),
        slug: cleanSlug,
        description: (description || shortDescription || '').trim(),
        shortDescription: (shortDescription || description || '').trim(),
        subtitle: subtitle ? subtitle.trim() : '',
        image: imagePath,
        bannerImage: bannerPath,
        highlights: parsedHighlights,
        displayOrder: order,
        status: status || 'active',
        featured: featured === true || featured === 'true'
      });

      const saved = await newDept.save();

      try {
        await AuditLog.create({
          action: 'Create Department',
          module: 'Departments',
          details: `Created department "${saved.name}" (Slug: ${saved.slug})`,
          userId: req.user?._id || req.user?.id || 'admin',
          userName: req.user?.name || 'Administrator',
          severity: 'info'
        });
      } catch {
        // ignore
      }

      const result = saved.toJSON();
      result.productCount = 0;
      result.count = 0;

      res.status(201).json(result);
    } catch (err) {
      console.error('Error creating department:', err);
      if (uploadedImage) removeUploadedFile(`/uploads/departments/${uploadedImage.filename}`);
      if (uploadedBanner) removeUploadedFile(`/uploads/departments/${uploadedBanner.filename}`);
      res.status(500).json({ message: 'Failed to create department', error: err.message });
    }
  }
);

// ==================== PUT /api/departments/:id ====================
// Update department details
router.put(
  '/:id',
  authenticateAdmin,
  (req, res, next) => {
    uploadDepartmentAssets(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const uploadedImage = req.files?.image?.[0];
    const uploadedBanner = req.files?.bannerImage?.[0];

    try {
      const { id } = req.params;
      const dept = await Department.findById(id);
      if (!dept) {
        if (uploadedImage) removeUploadedFile(`/uploads/departments/${uploadedImage.filename}`);
        if (uploadedBanner) removeUploadedFile(`/uploads/departments/${uploadedBanner.filename}`);
        return res.status(404).json({ message: `Department '${id}' not found` });
      }

      const {
        name,
        slug,
        description,
        shortDescription,
        subtitle,
        displayOrder,
        status,
        featured,
        highlights,
        image: bodyImage,
        bannerImage: bodyBanner
      } = req.body;

      if (name && name.trim()) dept.name = name.trim();
      if (description !== undefined) dept.description = description.trim();
      if (shortDescription !== undefined) dept.shortDescription = shortDescription.trim();
      if (subtitle !== undefined) dept.subtitle = subtitle.trim();
      if (displayOrder !== undefined) dept.displayOrder = parseInt(displayOrder, 10) || 0;
      if (status !== undefined) dept.status = status;
      if (featured !== undefined) dept.featured = featured === true || featured === 'true';

      if (slug && slug.trim()) {
        const cleanSlug = slugify(slug);
        if (cleanSlug !== dept.slug) {
          const exists = await Department.findOne({ slug: cleanSlug, _id: { $ne: id } });
          if (exists) {
            return res.status(400).json({ message: `Slug '${cleanSlug}' is already taken` });
          }
          const oldSlug = dept.slug;
          dept.slug = cleanSlug;

          // Cascade update products using old slug
          await Product.updateMany(
            { $or: [{ departmentSlug: oldSlug }, { category: oldSlug }] },
            { departmentSlug: cleanSlug, category: cleanSlug, departmentName: dept.name }
          );
        }
      }

      if (uploadedImage) {
        const old = dept.image;
        dept.image = `/uploads/departments/${uploadedImage.filename}`;
        if (old && old.startsWith('/uploads/departments/')) removeUploadedFile(old);
      } else if (bodyImage && bodyImage.trim() && bodyImage !== dept.image) {
        dept.image = bodyImage.trim();
      }

      if (uploadedBanner) {
        const oldBanner = dept.bannerImage;
        dept.bannerImage = `/uploads/departments/${uploadedBanner.filename}`;
        if (oldBanner && oldBanner.startsWith('/uploads/departments/')) removeUploadedFile(oldBanner);
      } else if (bodyBanner !== undefined) {
        dept.bannerImage = bodyBanner.trim();
      }

      if (highlights !== undefined) {
        if (Array.isArray(highlights)) dept.highlights = highlights;
        else if (typeof highlights === 'string') {
          try {
            dept.highlights = JSON.parse(highlights);
          } catch {
            dept.highlights = highlights.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }
      }

      const updated = await dept.save();

      // Sync departmentName in products if name changed
      if (name && name.trim()) {
        await Product.updateMany(
          { $or: [{ department: dept._id }, { departmentSlug: dept.slug }] },
          { departmentName: dept.name, categoryName: dept.name }
        );
      }

      const count = await Product.countDocuments({
        $or: [{ department: dept._id }, { departmentSlug: dept.slug }, { category: dept.slug }]
      });

      const result = updated.toJSON();
      result.productCount = count;
      result.count = count;

      try {
        await AuditLog.create({
          action: 'Update Department',
          module: 'Departments',
          details: `Updated department "${updated.name}" (${updated.slug})`,
          userId: req.user?._id || req.user?.id || 'admin',
          userName: req.user?.name || 'Administrator',
          severity: 'info'
        });
      } catch {
        // ignore
      }

      res.json(result);
    } catch (err) {
      console.error('Error updating department:', err);
      if (uploadedImage) removeUploadedFile(`/uploads/departments/${uploadedImage.filename}`);
      if (uploadedBanner) removeUploadedFile(`/uploads/departments/${uploadedBanner.filename}`);
      res.status(500).json({ message: 'Failed to update department', error: err.message });
    }
  }
);

// ==================== PATCH /api/departments/:id/status ====================
// Toggle active / inactive status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'published', 'draft'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const dept = await Department.findByIdAndUpdate(id, { status }, { new: true });
    if (!dept) {
      return res.status(404).json({ message: `Department '${id}' not found` });
    }

    res.json(dept);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update department status', error: err.message });
  }
});

// ==================== PATCH /api/departments/reorder ====================
// Reorder departments
router.patch('/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { departments, order } = req.body;

    if (Array.isArray(departments)) {
      await Promise.all(
        departments.map(async (item) => {
          if (item.id && item.displayOrder !== undefined) {
            await Department.findByIdAndUpdate(item.id, { displayOrder: item.displayOrder });
          }
        })
      );
    } else if (Array.isArray(order)) {
      await Promise.all(
        order.map(async (id, idx) => {
          await Department.findByIdAndUpdate(id, { displayOrder: idx + 1 });
        })
      );
    } else {
      return res.status(400).json({ message: 'Expected array of departments or ordered ids' });
    }

    const updated = await Department.find().sort({ displayOrder: 1 });
    res.json(updated);
  } catch (err) {
    console.error('Error reordering departments:', err);
    res.status(500).json({ message: 'Failed to reorder departments', error: err.message });
  }
});

// ==================== DELETE /api/departments/:id ====================
// Delete department with product constraint verification
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: `Department '${id}' not found` });
    }

    const assignedCount = await Product.countDocuments({
      $or: [
        { department: dept._id },
        { departmentSlug: dept.slug },
        { category: dept.slug }
      ]
    });

    if (assignedCount > 0) {
      return res.status(400).json({
        message: `Cannot delete department "${dept.name}": ${assignedCount} products are currently assigned to this department. Please reassign them to another department first.`
      });
    }

    const imagePath = dept.image;
    const bannerPath = dept.bannerImage;

    await Department.findByIdAndDelete(id);

    if (imagePath && imagePath.startsWith('/uploads/departments/')) removeUploadedFile(imagePath);
    if (bannerPath && bannerPath.startsWith('/uploads/departments/')) removeUploadedFile(bannerPath);

    try {
      await AuditLog.create({
        action: 'Delete Department',
        module: 'Departments',
        details: `Deleted department "${dept.name}" (ID: ${id})`,
        userId: req.user?._id || req.user?.id || 'admin',
        userName: req.user?.name || 'Administrator',
        severity: 'warning'
      });
    } catch {
      // ignore
    }

    res.json({ success: true, message: `Department "${dept.name}" deleted successfully` });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ message: 'Failed to delete department', error: err.message });
  }
});

module.exports = router;

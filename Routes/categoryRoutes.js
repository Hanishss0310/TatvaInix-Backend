const express = require('express');
const router = express.Router();
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const { uploadCategoryImage, removeUploadedFile } = require('../Middleware/uploadMiddleware');
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

// ==================== GET /api/categories (Public) ====================
// Retrieve active published categories with product count
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({
      status: { $in: ['active', 'published'] }
    }).sort({ displayOrder: 1, name: 1 });

    // Compute live productCount for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          category: { $in: [cat.slug, cat._id.toString()] },
          status: 'published'
        });
        const catObj = cat.toJSON();
        catObj.productCount = count;
        catObj.count = count;
        return catObj;
      })
    );

    res.json(categoriesWithCount);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Failed to retrieve categories', error: err.message });
  }
});

// ==================== GET /api/categories/admin ====================
// Retrieve all categories for admin console
router.get('/admin', async (req, res) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, createdAt: -1 });

    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          category: { $in: [cat.slug, cat._id.toString()] }
        });
        const catObj = cat.toJSON();
        catObj.productCount = count;
        catObj.count = count;
        return catObj;
      })
    );

    res.json(categoriesWithCount);
  } catch (err) {
    console.error('Error fetching admin categories:', err);
    res.status(500).json({ message: 'Failed to retrieve categories', error: err.message });
  }
});

// ==================== GET /api/categories/:id ====================
// Retrieve single category by ID or slug
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let category = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase() });
    }

    if (!category) {
      return res.status(404).json({ message: `Category '${id}' not found` });
    }

    const count = await Product.countDocuments({
      category: { $in: [category.slug, category._id.toString()] }
    });

    const result = category.toJSON();
    result.productCount = count;
    result.count = count;

    res.json(result);
  } catch (err) {
    console.error('Error fetching category:', err);
    res.status(500).json({ message: 'Error retrieving category', error: err.message });
  }
});

// ==================== POST /api/categories ====================
// Create a new category with optional image upload
router.post('/', authenticateAdmin, (req, res, next) => {
  uploadCategoryImage(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const {
      name,
      slug,
      shortDescription,
      subtitle,
      cardContent,
      tagline,
      description,
      displayOrder,
      status,
      featured,
      highlights
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const generatedSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    // Check for duplicate slug
    const existing = await Category.findOne({ slug: generatedSlug });
    if (existing) {
      // If image was uploaded during failed creation, clean it up
      if (req.file) {
        removeUploadedFile(`/uploads/categories/${req.file.filename}`);
      }
      return res.status(400).json({
        message: `A category with slug '${generatedSlug}' already exists. Please choose a unique name or slug.`
      });
    }

    // Determine category image
    let imagePath = '/images/products/hospital-bed.jpg';
    if (req.file) {
      imagePath = `/uploads/categories/${req.file.filename}`;
    } else if (req.body.image && req.body.image.trim()) {
      imagePath = req.body.image.trim();
    }

    // Process highlights if passed as JSON string
    let parsedHighlights = [];
    if (highlights) {
      if (Array.isArray(highlights)) {
        parsedHighlights = highlights;
      } else if (typeof highlights === 'string') {
        try {
          parsedHighlights = JSON.parse(highlights);
        } catch {
          parsedHighlights = highlights.split(',').map((h) => h.trim());
        }
      }
    }

    const newCategory = new Category({
      name: name.trim(),
      slug: generatedSlug,
      image: imagePath,
      shortDescription: shortDescription || description || tagline || '',
      subtitle: subtitle || tagline || '',
      cardContent: cardContent || shortDescription || description || '',
      tagline: tagline || subtitle || '',
      description: description || shortDescription || '',
      highlights: parsedHighlights,
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      status: status || 'active',
      featured: featured === true || featured === 'true'
    });

    const saved = await newCategory.save();
    const result = saved.toJSON();
    result.productCount = 0;
    result.count = 0;

    res.status(201).json(result);
  } catch (err) {
    if (req.file) {
      removeUploadedFile(`/uploads/categories/${req.file.filename}`);
    }
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Failed to create category', error: err.message });
  }
});

// ==================== PUT /api/categories/:id ====================
// Update category details and image
router.put('/:id', authenticateAdmin, (req, res, next) => {
  uploadCategoryImage(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    let category = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase() });
    }

    if (!category) {
      if (req.file) {
        removeUploadedFile(`/uploads/categories/${req.file.filename}`);
      }
      return res.status(404).json({ message: 'Category not found' });
    }

    const {
      name,
      slug,
      shortDescription,
      subtitle,
      cardContent,
      tagline,
      description,
      displayOrder,
      status,
      featured,
      highlights,
      image
    } = req.body;

    if (name) category.name = name.trim();

    // Check slug uniqueness if changing
    if (slug && slug.trim()) {
      const newSlug = slugify(slug);
      if (newSlug !== category.slug) {
        const slugConflict = await Category.findOne({ slug: newSlug });
        if (slugConflict) {
          if (req.file) {
            removeUploadedFile(`/uploads/categories/${req.file.filename}`);
          }
          return res.status(400).json({ message: `Slug '${newSlug}' is already in use.` });
        }
        // Update products referencing old slug
        await Product.updateMany({ category: category.slug }, { category: newSlug });
        category.slug = newSlug;
      }
    }

    // Handle image replacement
    if (req.file) {
      const oldImage = category.image;
      category.image = `/uploads/categories/${req.file.filename}`;
      if (oldImage && oldImage.startsWith('/uploads/categories/')) {
        removeUploadedFile(oldImage);
      }
    } else if (image && image.trim()) {
      category.image = image.trim();
    }

    if (shortDescription !== undefined) category.shortDescription = shortDescription;
    if (subtitle !== undefined) category.subtitle = subtitle;
    if (cardContent !== undefined) category.cardContent = cardContent;
    if (tagline !== undefined) category.tagline = tagline;
    if (description !== undefined) category.description = description;
    if (displayOrder !== undefined) category.displayOrder = Number(displayOrder);
    if (status !== undefined) category.status = status;
    if (featured !== undefined) category.featured = featured === true || featured === 'true';

    if (highlights) {
      if (Array.isArray(highlights)) {
        category.highlights = highlights;
      } else if (typeof highlights === 'string') {
        try {
          category.highlights = JSON.parse(highlights);
        } catch {
          category.highlights = highlights.split(',').map((h) => h.trim());
        }
      }
    }

    const updated = await category.save();
    const count = await Product.countDocuments({
      category: { $in: [updated.slug, updated._id.toString()] }
    });

    const result = updated.toJSON();
    result.productCount = count;
    result.count = count;

    res.json(result);
  } catch (err) {
    if (req.file) {
      removeUploadedFile(`/uploads/categories/${req.file.filename}`);
    }
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Failed to update category', error: err.message });
  }
});

// ==================== PATCH /api/categories/:id/status ====================
// Activate or deactivate a category
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    let category = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase() });
    }

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    category.status = status;
    await category.save();

    res.json(category.toJSON());
  } catch (err) {
    console.error('Error toggling category status:', err);
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
});

// ==================== DELETE /api/categories/:id ====================
// Delete category only if no products are assigned
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let category = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase() });
    }

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if products still reference this category
    const assignedProductsCount = await Product.countDocuments({
      category: { $in: [category.slug, category._id.toString()] }
    });

    if (assignedProductsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete "${category.name}": ${assignedProductsCount} products are currently assigned to this category. Please reassign or delete them first.`
      });
    }

    // Safe to delete: remove uploaded image if local
    if (category.image && category.image.startsWith('/uploads/categories/')) {
      removeUploadedFile(category.image);
    }

    await Category.findByIdAndDelete(category._id);

    res.json({ success: true, message: `Category "${category.name}" was deleted successfully.` });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Failed to delete category', error: err.message });
  }
});

module.exports = router;

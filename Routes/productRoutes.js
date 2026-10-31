const express = require('express');
const router = express.Router();
const Product = require('../Models/Product');
const Department = require('../Models/Department');
const Category = require('../Models/Category');
const Media = require('../Models/Media');
const AuditLog = require('../Models/AuditLog');
const { uploadProductAssets, removeUploadedFile } = require('../Middleware/uploadMiddleware');
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

// Safe parser for JSON fields received from multipart FormData
const parseJsonField = (field, fallback = []) => {
  if (!field) return fallback;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return fallback;
    }
  }
  return field;
};

// Helper to safely clean up product images if not used elsewhere
const safeCleanProductImages = async (imageUrls) => {
  if (!imageUrls || !Array.isArray(imageUrls)) return;
  for (const url of imageUrls) {
    if (url && url.startsWith('/uploads/products/')) {
      const otherProduct = await Product.findOne({ images: url });
      const mediaItem = await Media.findOne({ url: url });
      if (!otherProduct && !mediaItem) {
        removeUploadedFile(url);
      }
    }
  }
};

// ==================== GET /api/products (Public) ====================
// Retrieve published products for public catalogue
router.get('/', async (req, res) => {
  try {
    const { category, department, search, grade, sort } = req.query;
    const filter = { status: 'published' };

    // Department / Category filter
    const targetDept = department || category;
    if (targetDept && targetDept !== 'all') {
      const orConditions = [
        { departmentSlug: targetDept },
        { category: targetDept }
      ];
      if (targetDept.match(/^[0-9a-fA-F]{24}$/)) {
        orConditions.push({ department: targetDept });
      }
      filter.$or = orConditions;
    }

    // Material grade filter
    if (grade && grade !== 'all') {
      filter.materialGrade = { $regex: new RegExp(grade, 'i') };
    }

    // Search query across name, description, SKU, materialGrade
    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { name: { $regex: q, $options: 'i' } },
        { shortDescription: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { materialGrade: { $regex: q, $options: 'i' } }
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Sorting
    let sortOption = { featured: -1, createdAt: -1 };
    if (sort === 'name_asc') sortOption = { name: 1 };
    else if (sort === 'name_desc') sortOption = { name: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'price_asc') sortOption = { basePrice: 1 };
    else if (sort === 'price_desc') sortOption = { basePrice: -1 };

    const products = await Product.find(filter).populate('department').sort(sortOption);
    res.json(products);
  } catch (err) {
    console.error('Error fetching public products:', err);
    res.status(500).json({ message: 'Failed to retrieve products', error: err.message });
  }
});

// ==================== GET /api/products/admin ====================
// Retrieve all products (published, draft, archived) for admin panel
router.get('/admin', async (req, res) => {
  try {
    const { department, category } = req.query;
    const filter = {};
    const targetDept = department || category;
    if (targetDept && targetDept !== 'all') {
      const orConditions = [
        { departmentSlug: targetDept },
        { category: targetDept }
      ];
      if (targetDept.match(/^[0-9a-fA-F]{24}$/)) {
        orConditions.push({ department: targetDept });
      }
      filter.$or = orConditions;
    }

    const products = await Product.find(filter).populate('department').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ message: 'Failed to retrieve products for admin', error: err.message });
  }
});

// ==================== GET /api/products/slug/:slug ====================
// Retrieve single product by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug.toLowerCase() });
    if (!product) {
      return res.status(404).json({ message: `Product with slug '${req.params.slug}' not found` });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product by slug:', err);
    res.status(500).json({ message: 'Error retrieving product', error: err.message });
  }
});

// ==================== GET /api/products/:id ====================
// Retrieve single product by ID or slug
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id.toLowerCase() });
    }

    if (!product) {
      return res.status(404).json({ message: `Product '${id}' not found` });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Error retrieving product', error: err.message });
  }
});

// ==================== POST /api/products ====================
// Create a new product with multiple image uploads and optional brochure PDF
router.post('/', authenticateAdmin, (req, res, next) => {
  uploadProductAssets(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  const uploadedImages = req.files?.images || (Array.isArray(req.files) ? req.files : []);
  const uploadedBrochure = req.files?.brochure?.[0];

  try {
    const {
      name,
      slug,
      sku,
      department,
      departmentId,
      category,
      categoryName,
      shortDescription,
      description,
      materialGrade,
      finish,
      gauge,
      dimensions,
      loadCapacity,
      hygieneStandard,
      basePrice,
      specs,
      features,
      status,
      featured,
      customizable,
      existingImages,
      brochureFileName
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    if (!sku || !sku.trim()) {
      return res.status(400).json({ message: 'Product SKU is required' });
    }

    const targetDeptRef = (department || departmentId || category || '').toString().trim();
    if (!targetDeptRef) {
      return res.status(400).json({ message: 'Department is required' });
    }

    const cleanSlug = slug && slug.trim() ? slugify(slug) : slugify(name);
    const cleanSku = sku.trim().toUpperCase();

    // Verify duplicate slug or SKU
    const slugExists = await Product.findOne({ slug: cleanSlug });
    if (slugExists) {
      uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
      if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
      return res.status(400).json({ message: `A product with slug '${cleanSlug}' already exists.` });
    }

    const skuExists = await Product.findOne({ sku: cleanSku });
    if (skuExists) {
      uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
      if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
      return res.status(400).json({ message: `A product with SKU '${cleanSku}' already exists.` });
    }

    // Resolve department document
    let deptDoc = null;
    if (targetDeptRef.match(/^[0-9a-fA-F]{24}$/)) {
      deptDoc = await Department.findById(targetDeptRef);
    }
    if (!deptDoc) {
      deptDoc = await Department.findOne({ slug: targetDeptRef.toLowerCase() });
    }
    if (!deptDoc) {
      const catDoc = await Category.findOne({
        $or: [{ slug: targetDeptRef }, { _id: targetDeptRef.match(/^[0-9a-fA-F]{24}$/) ? targetDeptRef : null }]
      });
      if (catDoc) {
        deptDoc = await Department.findOne({ slug: catDoc.slug });
      }
    }

    const finalDeptId = deptDoc?._id || (targetDeptRef.match(/^[0-9a-fA-F]{24}$/) ? targetDeptRef : null);
    const finalDeptSlug = deptDoc?.slug || targetDeptRef.toLowerCase();
    const finalDeptName = deptDoc?.name || categoryName || targetDeptRef;

    // Assemble image array
    const newImageUrls = uploadedImages.map(f => `/uploads/products/${f.filename}`);
    let initialImages = parseJsonField(existingImages, []);
    if (typeof req.body.images === 'string') {
      initialImages = initialImages.concat(parseJsonField(req.body.images, []));
    } else if (Array.isArray(req.body.images)) {
      initialImages = initialImages.concat(req.body.images);
    }

    const combinedImages = [...initialImages, ...newImageUrls];
    const finalImages = combinedImages.length > 0 ? combinedImages : ['/images/products/hospital-bed.jpg'];

    const parsedSpecs = parseJsonField(specs, []);
    const parsedFeatures = parseJsonField(features, []);

    // Brochure handling
    let finalBrochureUrl = '';
    let finalBrochureFileName = brochureFileName || '';
    let finalBrochureFileSize = 0;
    let finalBrochureUpdatedAt = null;

    if (uploadedBrochure) {
      finalBrochureUrl = `/storage/brochures/${uploadedBrochure.filename}`;
      finalBrochureFileName = uploadedBrochure.filename;
      finalBrochureFileSize = uploadedBrochure.size;
      finalBrochureUpdatedAt = new Date();
    } else if (brochureFileName) {
      finalBrochureUrl = req.body.brochureUrl || `/api/brochures/download?product=${cleanSlug}`;
      finalBrochureFileSize = Number(req.body.brochureFileSize) || 0;
      finalBrochureUpdatedAt = new Date();
    }

    const newProduct = new Product({
      name: name.trim(),
      slug: cleanSlug,
      sku: cleanSku,
      department: finalDeptId,
      departmentSlug: finalDeptSlug,
      departmentName: finalDeptName,
      category: finalDeptSlug,
      categoryName: finalDeptName,
      shortDescription: shortDescription || '',
      description: description || '',
      materialGrade: materialGrade || 'AISI 304 Surgical Grade Stainless Steel',
      finish: finish || 'No. 4 Satin Brush',
      gauge: gauge || '',
      dimensions: dimensions || '',
      loadCapacity: loadCapacity || '',
      hygieneStandard: hygieneStandard || 'Sanitary Argon Back-Purged TIG Welds',
      basePrice: basePrice !== undefined ? Number(basePrice) : 0,
      images: finalImages,
      brochureUrl: finalBrochureUrl,
      brochureFileName: finalBrochureFileName,
      brochureFileSize: finalBrochureFileSize,
      brochureUpdatedAt: finalBrochureUpdatedAt,
      specs: parsedSpecs,
      features: parsedFeatures,
      status: status || 'published',
      featured: featured === true || featured === 'true',
      customizable: customizable === undefined ? true : (customizable === true || customizable === 'true')
    });

    const saved = await newProduct.save();

    await AuditLog.create({
      action: 'Product Created',
      module: 'Products',
      details: `Created product "${saved.name}" (SKU: ${saved.sku})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'success'
    });

    res.status(201).json(saved);
  } catch (err) {
    uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
    if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Failed to create product', error: err.message });
  }
});

// ==================== PUT /api/products/:id ====================
// Update product details, images, and brochure
router.put('/:id', authenticateAdmin, (req, res, next) => {
  uploadProductAssets(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  const uploadedImages = req.files?.images || (Array.isArray(req.files) ? req.files : []);
  const uploadedBrochure = req.files?.brochure?.[0];

  try {
    const { id } = req.params;
    let product = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id.toLowerCase() });
    }

    if (!product) {
      uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
      if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
      return res.status(404).json({ message: 'Product not found' });
    }

    const {
      name,
      slug,
      sku,
      department,
      departmentId,
      category,
      categoryName,
      shortDescription,
      description,
      materialGrade,
      finish,
      gauge,
      dimensions,
      loadCapacity,
      hygieneStandard,
      basePrice,
      specs,
      features,
      status,
      featured,
      customizable,
      images,
      existingImages,
      brochureFileName,
      removeBrochure
    } = req.body;

    // Check slug uniqueness if changed
    if (slug && slug.trim()) {
      const cleanSlug = slugify(slug);
      if (cleanSlug !== product.slug) {
        const slugExists = await Product.findOne({ slug: cleanSlug });
        if (slugExists) {
          uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
          if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
          return res.status(400).json({ message: `Slug '${cleanSlug}' is already taken by another product.` });
        }
        product.slug = cleanSlug;
      }
    }

    // Check SKU uniqueness if changed
    if (sku && sku.trim()) {
      const cleanSku = sku.trim().toUpperCase();
      if (cleanSku !== product.sku) {
        const skuExists = await Product.findOne({ sku: cleanSku });
        if (skuExists) {
          uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
          if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
          return res.status(400).json({ message: `SKU '${cleanSku}' is already taken by another product.` });
        }
        product.sku = cleanSku;
      }
    }

    if (name) product.name = name.trim();

    const targetDeptRef = (department || departmentId || category || '').toString().trim();
    if (targetDeptRef) {
      let deptDoc = null;
      if (targetDeptRef.match(/^[0-9a-fA-F]{24}$/)) {
        deptDoc = await Department.findById(targetDeptRef);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({ slug: targetDeptRef.toLowerCase() });
      }
      if (!deptDoc) {
        const catDoc = await Category.findOne({
          $or: [{ slug: targetDeptRef }, { _id: targetDeptRef.match(/^[0-9a-fA-F]{24}$/) ? targetDeptRef : null }]
        });
        if (catDoc) {
          deptDoc = await Department.findOne({ slug: catDoc.slug });
        }
      }

      if (deptDoc) {
        product.department = deptDoc._id;
        product.departmentSlug = deptDoc.slug;
        product.departmentName = deptDoc.name;
        product.category = deptDoc.slug;
        product.categoryName = deptDoc.name;
      } else {
        product.departmentSlug = targetDeptRef.toLowerCase();
        product.departmentName = categoryName || targetDeptRef;
        product.category = targetDeptRef.toLowerCase();
        product.categoryName = categoryName || targetDeptRef;
      }
    }

    if (shortDescription !== undefined) product.shortDescription = shortDescription;
    if (description !== undefined) product.description = description;
    if (materialGrade !== undefined) product.materialGrade = materialGrade;
    if (finish !== undefined) product.finish = finish;
    if (gauge !== undefined) product.gauge = gauge;
    if (dimensions !== undefined) product.dimensions = dimensions;
    if (loadCapacity !== undefined) product.loadCapacity = loadCapacity;
    if (hygieneStandard !== undefined) product.hygieneStandard = hygieneStandard;
    if (basePrice !== undefined) product.basePrice = Number(basePrice);
    if (status !== undefined) product.status = status;
    if (featured !== undefined) product.featured = featured === true || featured === 'true';
    if (customizable !== undefined) product.customizable = customizable === true || customizable === 'true';

    if (specs !== undefined) product.specs = parseJsonField(specs, product.specs);
    if (features !== undefined) product.features = parseJsonField(features, product.features);

    // Image handling
    const oldImages = [...product.images];
    let keptImages = [];

    if (images) {
      keptImages = parseJsonField(images, []);
    } else if (existingImages) {
      keptImages = parseJsonField(existingImages, []);
    } else {
      keptImages = oldImages;
    }

    const newUploadedUrls = uploadedImages.map(f => `/uploads/products/${f.filename}`);
    const updatedImages = [...keptImages, ...newUploadedUrls];

    if (updatedImages.length > 0) {
      product.images = updatedImages;
    }

    // Clean up images that were removed
    const removedImages = oldImages.filter(img => !updatedImages.includes(img));
    await safeCleanProductImages(removedImages);

    // Brochure handling
    if (uploadedBrochure) {
      if (product.brochureUrl && product.brochureUrl !== `/storage/brochures/${uploadedBrochure.filename}`) {
        removeUploadedFile(product.brochureUrl);
      }
      product.brochureUrl = `/storage/brochures/${uploadedBrochure.filename}`;
      product.brochureFileName = uploadedBrochure.filename;
      product.brochureFileSize = uploadedBrochure.size;
      product.brochureUpdatedAt = new Date();
    } else if (removeBrochure === 'true' || removeBrochure === true) {
      if (product.brochureUrl) removeUploadedFile(product.brochureUrl);
      product.brochureUrl = '';
      product.brochureFileName = '';
      product.brochureFileSize = 0;
      product.brochureUpdatedAt = null;
    } else if (brochureFileName !== undefined) {
      product.brochureFileName = brochureFileName;
    }

    const saved = await product.save();

    await AuditLog.create({
      action: 'Product Updated',
      module: 'Products',
      details: `Updated product "${saved.name}" (${saved.sku})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.json(saved);
  } catch (err) {
    uploadedImages.forEach(f => removeUploadedFile(`/uploads/products/${f.filename}`));
    if (uploadedBrochure) removeUploadedFile(`/storage/brochures/${uploadedBrochure.filename}`);
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
});

// ==================== PATCH /api/products/:id/status ====================
// Change product publication status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['published', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Allowed: 'published', 'draft', 'archived'" });
    }

    let product = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id.toLowerCase() });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.status = status;
    await product.save();

    res.json(product);
  } catch (err) {
    console.error('Error updating product status:', err);
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
});

// ==================== DELETE /api/products/:id ====================
// Delete single product and clean up its unused uploaded images
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id.toLowerCase() });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const imagesToClean = [...product.images];
    if (product.brochureUrl) {
      removeUploadedFile(product.brochureUrl);
    }

    await Product.findByIdAndDelete(product._id);
    await safeCleanProductImages(imagesToClean);

    await AuditLog.create({
      action: 'Product Deleted',
      module: 'Products',
      details: `Deleted product "${product.name}" (${product.sku})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'warning'
    });

    res.json({ success: true, message: `Product "${product.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

// ==================== POST /api/products/bulk-delete ====================
router.post('/bulk-delete', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of product IDs to delete.' });
    }

    const products = await Product.find({
      $or: [
        { _id: { $in: ids.filter(i => String(i).match(/^[0-9a-fA-F]{24}$/)) } },
        { slug: { $in: ids } }
      ]
    });

    const deletedIds = [];
    const allImagesToClean = [];

    for (const p of products) {
      allImagesToClean.push(...p.images);
      if (p.brochureUrl) removeUploadedFile(p.brochureUrl);
      await Product.findByIdAndDelete(p._id);
      deletedIds.push(p.id);
    }

    await safeCleanProductImages(allImagesToClean);

    res.json({
      success: true,
      deletedCount: deletedIds.length,
      deletedIds,
      message: `Successfully deleted ${deletedIds.length} products.`
    });
  } catch (err) {
    console.error('Error bulk deleting products:', err);
    res.status(500).json({ message: 'Failed to bulk delete products', error: err.message });
  }
});

module.exports = router;

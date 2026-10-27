const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure base upload & private storage directories exist
const uploadDirs = {
  products: path.join(__dirname, '..', 'uploads', 'products'),
  categories: path.join(__dirname, '..', 'uploads', 'categories'),
  media: path.join(__dirname, '..', 'uploads', 'media'),
  brochures: path.join(__dirname, '..', 'storage', 'brochures')
};

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure unified disk storage
const unifiedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'brochure') {
      cb(null, uploadDirs.brochures);
    } else if (file.fieldname === 'category' || file.fieldname === 'image') {
      cb(null, uploadDirs.categories);
    } else if (file.fieldname === 'files') {
      cb(null, uploadDirs.media);
    } else {
      cb(null, uploadDirs.products);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Universal file filter
const unifiedFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // If brochure upload
  if (file.fieldname === 'brochure') {
    if (ext === '.pdf' && (file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf')) {
      return cb(null, true);
    }
    return cb(new Error('Invalid brochure file format. Only PDF files (.pdf) are allowed.'));
  }

  // Image upload
  const allowedExts = /jpeg|jpg|png|webp|avif|gif|svg/;
  const allowedMimes = /^image\/(jpeg|png|webp|avif|gif|svg\+xml)$/;

  if (allowedExts.test(ext) && allowedMimes.test(file.mimetype)) {
    return cb(null, true);
  }

  cb(
    new Error(
      `Unsupported file type (${ext}). Allowed formats: JPG, PNG, WebP, AVIF, GIF, SVG.`
    )
  );
};

// Multer configurations
const imageLimits = { fileSize: 10 * 1024 * 1024 }; // 10 MB per image
const brochureLimits = { fileSize: 25 * 1024 * 1024 }; // 25 MB for PDF

const uploadProductImages = multer({
  storage: unifiedStorage,
  fileFilter: unifiedFileFilter,
  limits: imageLimits
}).array('images', 10);

const uploadProductAssets = multer({
  storage: unifiedStorage,
  fileFilter: unifiedFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'brochure', maxCount: 1 }
]);

const uploadCategoryImage = multer({
  storage: unifiedStorage,
  fileFilter: unifiedFileFilter,
  limits: imageLimits
}).single('image');

const uploadMediaImages = multer({
  storage: unifiedStorage,
  fileFilter: unifiedFileFilter,
  limits: imageLimits
}).array('files', 10);

const uploadSingleBrochure = multer({
  storage: unifiedStorage,
  fileFilter: unifiedFileFilter,
  limits: brochureLimits
}).single('brochure');

// Safely remove a file from uploads or storage
const removeUploadedFile = (filePath) => {
  if (!filePath) return false;
  try {
    let fullPath;
    if (filePath.startsWith('/uploads/')) {
      fullPath = path.join(__dirname, '..', filePath.replace(/^\//, ''));
    } else if (filePath.startsWith('storage/') || filePath.startsWith('/storage/')) {
      fullPath = path.join(__dirname, '..', filePath.replace(/^\//, ''));
    } else {
      fullPath = path.resolve(filePath);
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (err) {
    console.error(`Error deleting file ${filePath}:`, err.message);
  }
  return false;
};

module.exports = {
  uploadProductImages,
  uploadProductAssets,
  uploadCategoryImage,
  uploadMediaImages,
  uploadSingleBrochure,
  removeUploadedFile,
  uploadDirs
};

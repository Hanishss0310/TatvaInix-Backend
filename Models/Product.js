const mongoose = require('mongoose');

const specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      index: true
    },
    categoryName: {
      type: String,
      trim: true,
      default: ''
    },
    shortDescription: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    materialGrade: {
      type: String,
      trim: true,
      default: 'AISI 304 Surgical Grade Stainless Steel'
    },
    finish: {
      type: String,
      trim: true,
      default: 'No. 4 Satin Brush'
    },
    gauge: {
      type: String,
      trim: true,
      default: ''
    },
    dimensions: {
      type: String,
      trim: true,
      default: ''
    },
    loadCapacity: {
      type: String,
      trim: true,
      default: ''
    },
    hygieneStandard: {
      type: String,
      trim: true,
      default: 'Sanitary Argon Back-Purged TIG Welds'
    },
    basePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    images: {
      type: [String],
      default: ['/images/products/hospital-bed.jpg']
    },
    brochureUrl: {
      type: String,
      default: ''
    },
    brochureFileName: {
      type: String,
      default: ''
    },
    brochureFileSize: {
      type: Number,
      default: 0
    },
    brochureUpdatedAt: {
      type: Date
    },
    specs: {
      type: [specSchema],
      default: []
    },
    features: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published',
      index: true
    },
    featured: {
      type: Boolean,
      default: false,
      index: true
    },
    customizable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Helpful text search index for name, sku, shortDescription
productSchema.index({ name: 'text', sku: 'text', shortDescription: 'text', materialGrade: 'text' });

module.exports = mongoose.model('Product', productSchema);

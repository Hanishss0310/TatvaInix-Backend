const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    image: {
      type: String,
      default: '/images/products/hospital-bed.jpg',
      trim: true
    },
    shortDescription: {
      type: String,
      trim: true,
      default: ''
    },
    subtitle: {
      type: String,
      trim: true,
      default: ''
    },
    cardContent: {
      type: String,
      trim: true,
      default: ''
    },
    // Aliases to maintain full backward compatibility with legacy frontend data
    tagline: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    highlights: {
      type: [String],
      default: []
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'published', 'draft'],
      default: 'active'
    },
    featured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        // Normalize tagline & subtitle, description & shortDescription
        if (!ret.subtitle && ret.tagline) ret.subtitle = ret.tagline;
        if (!ret.tagline && ret.subtitle) ret.tagline = ret.subtitle;
        if (!ret.shortDescription && ret.description) ret.shortDescription = ret.description;
        if (!ret.description && ret.shortDescription) ret.description = ret.shortDescription;
        if (!ret.cardContent) ret.cardContent = ret.shortDescription || ret.description || '';
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model('Category', categorySchema);

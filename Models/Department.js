const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Department slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
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
    image: {
      type: String,
      default: '/images/products/hospital-bed.jpg',
      trim: true
    },
    bannerImage: {
      type: String,
      default: '',
      trim: true
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
      default: 'active',
      index: true
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
        if (!ret.shortDescription && ret.description) {
          ret.shortDescription = ret.description;
        }
        if (!ret.description && ret.shortDescription) {
          ret.description = ret.shortDescription;
        }
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

departmentSchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('Department', departmentSchema);

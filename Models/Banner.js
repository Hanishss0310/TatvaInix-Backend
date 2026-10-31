const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true
    },
    subtitle: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    image: {
      type: String,
      required: [true, 'Banner image is required'],
      trim: true
    },
    ctaText: {
      type: String,
      trim: true,
      default: 'View Details'
    },
    ctaLink: {
      type: String,
      trim: true,
      default: '/products'
    },
    badge: {
      type: String,
      trim: true,
      default: 'Featured Innovation'
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    intervalSeconds: {
      type: Number,
      default: 5,
      min: 2,
      max: 30
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

// Indexes
bannerSchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('Banner', bannerSchema);

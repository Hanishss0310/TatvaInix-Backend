const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    originalName: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      default: 'image/jpeg'
    },
    size: {
      type: String,
      default: '0 KB'
    },
    sizeBytes: {
      type: Number,
      default: 0
    },
    dimensions: {
      type: String,
      default: '1200 x 900'
    },
    category: {
      type: String,
      default: 'Products',
      trim: true
    },
    usedIn: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        // Ensure name is present for legacy admin components
        if (!ret.name) ret.name = ret.originalName || ret.filename;
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model('Media', mediaSchema);

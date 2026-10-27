const mongoose = require('mongoose');

const downloadEventSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      required: true,
      index: true
    },
    leadName: {
      type: String,
      default: ''
    },
    leadEmail: {
      type: String,
      default: ''
    },
    brochureName: {
      type: String,
      required: true
    },
    productId: {
      type: String,
      default: ''
    },
    productName: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    success: {
      type: Boolean,
      default: true
    },
    error: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
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

downloadEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('DownloadEvent', downloadEventSchema);

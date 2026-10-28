const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `note-${Date.now()}`
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      default: 'Admin'
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const brochureLeadSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    company: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true
    },
    productId: {
      type: String,
      trim: true,
      default: ''
    },
    productName: {
      type: String,
      trim: true,
      default: 'General Healthcare Equipment Catalogue'
    },
    brochureName: {
      type: String,
      trim: true,
      default: 'TatvaInox.pdf'
    },
    brochurePath: {
      type: String,
      trim: true,
      default: ''
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    consent: {
      type: Boolean,
      default: true
    },
    leadSource: {
      type: String,
      default: 'website_brochure_modal'
    },
    downloadStatus: {
      type: String,
      enum: ['pending', 'downloaded', 'failed'],
      default: 'pending',
      index: true
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    downloadTimestamp: {
      type: Date
    },
    downloadToken: {
      type: String,
      index: true
    },
    tokenExpiresAt: {
      type: Date
    },
    leadStatus: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
      default: 'New',
      index: true
    },
    notes: {
      type: [noteSchema],
      default: []
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
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

// Indexes for search and dashboard filtering
brochureLeadSchema.index({ name: 'text', email: 'text', company: 'text', phone: 'text', leadId: 'text' });
brochureLeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BrochureLead', brochureLeadSchema);

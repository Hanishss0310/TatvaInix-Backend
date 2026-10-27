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

const enquirySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['contact', 'quote', 'quote_request', 'custom_fabrication', 'bulk_hospital', 'product_quote', 'general'],
      default: 'general',
      index: true
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    organization: {
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
      trim: true,
      default: ''
    },
    subject: {
      type: String,
      trim: true,
      default: ''
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true
    },
    productId: {
      type: String,
      trim: true,
      default: ''
    },
    productName: {
      type: String,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      default: 1
    },
    queryType: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'awaiting_customer', 'resolved', 'archived'],
      default: 'new',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    assignedTo: {
      type: String,
      default: 'Vikram Mehta'
    },
    notes: {
      type: [noteSchema],
      default: []
    },
    attachmentUrl: {
      type: String,
      default: ''
    },
    source: {
      type: String,
      default: 'website_form'
    },
    ipAddress: {
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

enquirySchema.index({ customerName: 'text', organization: 'text', email: 'text', phone: 'text', subject: 'text' });
enquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Enquiry', enquirySchema);

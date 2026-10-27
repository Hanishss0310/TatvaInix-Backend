const mongoose = require('mongoose');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const NewsletterSubscriberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address']
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed', 'bounced'],
      default: 'active',
      index: true
    },
    source: {
      type: String,
      trim: true,
      default: 'Website Footer'
    },
    consent: {
      type: Boolean,
      required: true,
      default: true
    },
    consentedAt: {
      type: Date,
      default: Date.now
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date,
      default: null
    },
    unsubscribeReason: {
      type: String,
      trim: true,
      default: ''
    },
    bounceCount: {
      type: Number,
      default: 0
    },
    lastBouncedAt: {
      type: Date,
      default: null
    },
    tags: [{
      type: String,
      trim: true
    }],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
    }
  }
);

// Compound index for querying campaign eligible recipients quickly
NewsletterSubscriberSchema.index({ status: 1, consent: 1 });
NewsletterSubscriberSchema.index({ createdAt: -1 });

// Helper method: is this subscriber eligible for marketing campaigns?
NewsletterSubscriberSchema.methods.isEligibleForMarketing = function () {
  return this.status === 'active' && this.consent === true;
};

// Static helper to normalize email
NewsletterSubscriberSchema.statics.normalizeEmail = function (email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', NewsletterSubscriberSchema);

module.exports = NewsletterSubscriber;

const mongoose = require('mongoose');

const NewsletterCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true
    },
    previewText: {
      type: String,
      trim: true,
      default: ''
    },
    heading: {
      type: String,
      trim: true,
      default: ''
    },
    contentHtml: {
      type: String,
      required: [true, 'Campaign email content is required']
    },
    ctaButtonText: {
      type: String,
      trim: true,
      default: ''
    },
    ctaButtonUrl: {
      type: String,
      trim: true,
      default: ''
    },
    bannerImageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    senderName: {
      type: String,
      trim: true,
      default: 'Tatva Inox'
    },
    senderEmail: {
      type: String,
      trim: true,
      default: 'donotreply.tatvainox@gmail.com'
    },
    replyTo: {
      type: String,
      trim: true,
      default: 'office@tatvainox.in'
    },
    targetAudience: {
      type: {
        type: String,
        enum: ['all', 'selected', 'filtered'],
        default: 'all'
      },
      selectedSubscriberIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NewsletterSubscriber'
      }],
      selectedEmails: [{
        type: String,
        trim: true,
        lowercase: true
      }],
      filter: {
        status: { type: String, default: 'active' },
        source: { type: String, default: 'all' }
      }
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'queued', 'sending', 'completed', 'partially_failed', 'failed', 'cancelled'],
      default: 'draft'
    },
    scheduledFor: {
      type: Date,
      default: null
    },
    sentAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    recipientsCount: {
      type: Number,
      default: 0
    },
    attemptedCount: {
      type: Number,
      default: 0
    },
    acceptedCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    skippedCount: {
      type: Number,
      default: 0
    },
    openRate: {
      type: Number,
      default: 0
    },
    clickRate: {
      type: Number,
      default: 0
    },
    deliveryErrors: [
      {
        email: String,
        error: String,
        timestamp: { type: Date, default: Date.now }
      }
    ],
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

NewsletterCampaignSchema.index({ createdAt: -1 });
NewsletterCampaignSchema.index({ status: 1 });

const NewsletterCampaign = mongoose.model('NewsletterCampaign', NewsletterCampaignSchema);

module.exports = NewsletterCampaign;

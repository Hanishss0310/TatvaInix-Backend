const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Article slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    category: {
      type: String,
      default: 'Technical Article',
      trim: true
    },
    date: {
      type: String,
      default: () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    },
    readTime: {
      type: String,
      default: '5 min read'
    },
    excerpt: {
      type: String,
      trim: true,
      default: ''
    },
    content: {
      type: String,
      trim: true,
      default: ''
    },
    image: {
      type: String,
      default: '/images/products/scrub-sink.jpg'
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published',
      index: true
    },
    views: {
      type: Number,
      default: 0
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

articleSchema.index({ title: 'text', excerpt: 'text', category: 'text' });

module.exports = mongoose.model('Article', articleSchema);

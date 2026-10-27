const express = require('express');
const router = express.Router();

const Article = require('../Models/Article');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// Helper to slugify
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

// GET /api/articles (Public: published articles, Admin: all)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? (status === 'all' ? {} : { status }) : { status: 'published' };
    const articles = await Article.find(filter).sort({ createdAt: -1 });
    res.json(articles);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve articles', error: err.message });
  }
});

// GET /api/articles/:slugOrId (Public)
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const article = await Article.findOne({
      $or: [{ id: idOrSlug }, { slug: idOrSlug.toLowerCase() }]
    });

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Increment views asynchronously
    Article.findByIdAndUpdate(article._id, { $inc: { views: 1 } }).catch(() => {});

    res.json(article);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving article', error: err.message });
  }
});

// POST /api/articles (Admin protected)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { title, slug, category, readTime, excerpt, content, image, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Article title is required' });
    }

    const cleanSlug = slug && slug.trim() ? slugify(slug) : slugify(title);
    const id = `art-${Date.now()}`;

    const newArticle = new Article({
      id,
      title: title.trim(),
      slug: cleanSlug,
      category: category || 'Technical Metallurgy',
      readTime: readTime || '5 min read',
      excerpt: excerpt || '',
      content: content || '',
      image: image || '/images/products/scrub-sink.jpg',
      status: status || 'published'
    });

    await newArticle.save();

    await AuditLog.create({
      action: 'Article Created',
      module: 'News & Articles',
      details: `Created article "${newArticle.title}"`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.status(201).json(newArticle);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create article', error: err.message });
  }
});

// PUT /api/articles/:id (Admin protected)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const article = await Article.findOne(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    Object.assign(article, req.body);
    await article.save();

    await AuditLog.create({
      action: 'Article Updated',
      module: 'News & Articles',
      details: `Updated article "${article.title}"`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.json(article);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update article', error: err.message });
  }
});

// DELETE /api/articles/:id (Admin protected)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const article = await Article.findOneAndDelete(
      isObjectId ? { $or: [{ _id: id }, { id }] } : { id }
    );

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    await AuditLog.create({
      action: 'Article Deleted',
      module: 'News & Articles',
      details: `Deleted article "${article.title}"`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'warning'
    });

    res.json({ success: true, message: `Article ${article.title} deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete article', error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

const Product = require('../Models/Product');
const Department = require('../Models/Department');
const Banner = require('../Models/Banner');
const Category = require('../Models/Category');
const BrochureLead = require('../Models/BrochureLead');
const DownloadEvent = require('../Models/DownloadEvent');
const Enquiry = require('../Models/Enquiry');
const NewsletterSubscriber = require('../src/models/NewsletterSubscriber');
const Article = require('../Models/Article');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// Admin protected
router.use(authenticateAdmin);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalProducts,
      publishedProducts,
      draftProducts,
      totalDepartments,
      activeDepartments,
      totalBanners,
      activeBanners,
      totalCategories,
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      totalDownloads,
      totalSubscribers,
      activeSubscribers,
      totalEnquiries,
      newEnquiries,
      inReviewEnquiries,
      resolvedEnquiries,
      customEnquiries,
      totalArticles,
      recentLogs,
      recentLeads,
      recentEnquiries,
      recentProducts
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'published' }),
      Product.countDocuments({ status: 'draft' }),
      Department.countDocuments(),
      Department.countDocuments({ status: { $in: ['active', 'published'] } }),
      Banner.countDocuments(),
      Banner.countDocuments({ status: 'active' }),
      Category.countDocuments(),
      BrochureLead.countDocuments(),
      BrochureLead.countDocuments({ leadStatus: 'New' }),
      BrochureLead.countDocuments({ leadStatus: 'Contacted' }),
      BrochureLead.countDocuments({ leadStatus: 'Qualified' }),
      BrochureLead.countDocuments({ leadStatus: 'Converted' }),
      DownloadEvent.countDocuments({ success: true }),
      NewsletterSubscriber.countDocuments(),
      NewsletterSubscriber.countDocuments({ status: 'active' }),
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ status: 'new' }),
      Enquiry.countDocuments({ status: 'in_review' }),
      Enquiry.countDocuments({ status: 'resolved' }),
      Enquiry.countDocuments({ type: 'custom_fabrication' }),
      Article.countDocuments(),
      AuditLog.find().sort({ timestamp: -1 }).limit(10),
      BrochureLead.find().sort({ createdAt: -1 }).limit(5),
      Enquiry.find().sort({ createdAt: -1 }).limit(5),
      Product.find().sort({ createdAt: -1 }).limit(5)
    ]);

    // Lead status distribution
    const leadStatusDistribution = {
      New: newLeads,
      Contacted: contactedLeads,
      Qualified: qualifiedLeads,
      Converted: convertedLeads
    };

    // Lead conversion rate
    const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

    res.json({
      totalProducts,
      totalDepartments,
      activeDepartments,
      totalBanners,
      activeBanners,
      totalCategories,
      totalBrochureLeads: totalLeads,
      totalDownloads,
      totalEnquiries,
      totalSubscribers,
      products: {
        total: totalProducts,
        published: publishedProducts,
        draft: draftProducts,
        recent: recentProducts
      },
      departments: {
        total: totalDepartments,
        active: activeDepartments
      },
      banners: {
        total: totalBanners,
        active: activeBanners
      },
      categories: {
        total: totalCategories
      },
      leads: {
        total: totalLeads,
        new: newLeads,
        contacted: contactedLeads,
        qualified: qualifiedLeads,
        converted: convertedLeads,
        conversionRate,
        statusDistribution: leadStatusDistribution,
        recent: recentLeads
      },
      downloads: {
        total: totalDownloads
      },
      newsletter: {
        total: totalSubscribers,
        active: activeSubscribers
      },
      enquiries: {
        total: totalEnquiries,
        new: newEnquiries,
        inReview: inReviewEnquiries,
        resolved: resolvedEnquiries,
        customFabrication: customEnquiries,
        recent: recentEnquiries
      },
      articles: {
        total: totalArticles
      },
      recentProducts,
      recentEnquiries,
      activityLogs: recentLogs
    });
  } catch (err) {
    console.error('Error compiling dashboard stats:', err);
    res.status(500).json({ message: 'Failed to retrieve dashboard statistics', error: err.message });
  }
});

module.exports = router;

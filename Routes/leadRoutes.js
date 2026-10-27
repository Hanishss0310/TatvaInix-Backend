const express = require('express');
const router = express.Router();

const BrochureLead = require('../Models/BrochureLead');
const DownloadEvent = require('../Models/DownloadEvent');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// All lead routes require admin authentication
router.use(authenticateAdmin);

// ==================== 1. GET /api/leads ====================
// Paginated, filtered, searchable list of leads
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      downloadStatus = 'all',
      product = 'all',
      startDate,
      endDate,
      sort = 'newest'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.leadStatus = status;
    }

    // Download status filter
    if (downloadStatus && downloadStatus !== 'all') {
      filter.downloadStatus = downloadStatus;
    }

    // Product filter
    if (product && product !== 'all') {
      filter.$or = [
        { productId: product },
        { productName: { $regex: product, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { company: regex },
        { leadId: regex },
        { productName: regex }
      ];
    }

    // Sort order
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    else if (sort === 'name_asc') sortOption = { name: 1 };
    else if (sort === 'name_desc') sortOption = { name: -1 };

    const [total, leads] = await Promise.all([
      BrochureLead.countDocuments(filter),
      BrochureLead.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
    ]);

    res.json({
      leads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ message: 'Failed to retrieve leads', error: err.message });
  }
});

// ==================== 2. GET /api/leads/stats ====================
// Lead conversion and download statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      totalDownloads,
      recentLeads
    ] = await Promise.all([
      BrochureLead.countDocuments(),
      BrochureLead.countDocuments({ leadStatus: 'New' }),
      BrochureLead.countDocuments({ leadStatus: 'Contacted' }),
      BrochureLead.countDocuments({ leadStatus: 'Qualified' }),
      BrochureLead.countDocuments({ leadStatus: 'Converted' }),
      DownloadEvent.countDocuments({ success: true }),
      BrochureLead.find().sort({ createdAt: -1 }).limit(5)
    ]);

    const downloadedLeadsCount = await BrochureLead.countDocuments({ downloadStatus: 'downloaded' });
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
    const downloadRate = totalLeads > 0 ? ((downloadedLeadsCount / totalLeads) * 100).toFixed(1) : 0;

    res.json({
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      totalDownloads,
      downloadedLeadsCount,
      conversionRate: Number(conversionRate),
      downloadRate: Number(downloadRate),
      recentLeads
    });
  } catch (err) {
    console.error('Error fetching lead statistics:', err);
    res.status(500).json({ message: 'Failed to retrieve lead statistics', error: err.message });
  }
});

// ==================== 3. GET /api/leads/export/csv ====================
// Export leads to CSV with authorization
router.get('/export/csv', async (req, res) => {
  try {
    const leads = await BrochureLead.find().sort({ createdAt: -1 });

    const csvHeaders = [
      'Lead ID',
      'Full Name',
      'Company/Hospital',
      'Email',
      'Phone',
      'Target Product',
      'Brochure Name',
      'Download Status',
      'Download Count',
      'Download Date',
      'Lead Status',
      'Submission Date',
      'Enquiry Message'
    ];

    const escapeCsv = (str) => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = leads.map((lead) => [
      escapeCsv(lead.leadId),
      escapeCsv(lead.name),
      escapeCsv(lead.company),
      escapeCsv(lead.email),
      escapeCsv(lead.phone),
      escapeCsv(lead.productName),
      escapeCsv(lead.brochureName),
      escapeCsv(lead.downloadStatus),
      lead.downloadCount || 0,
      escapeCsv(lead.downloadTimestamp ? new Date(lead.downloadTimestamp).toISOString() : 'N/A'),
      escapeCsv(lead.leadStatus),
      escapeCsv(new Date(lead.createdAt).toISOString()),
      escapeCsv(lead.message)
    ]);

    const csvContent = [csvHeaders.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tatva-inox-brochure-leads-${new Date().toISOString().split('T')[0]}.csv"`
    );

    await AuditLog.create({
      action: 'Leads Exported',
      module: 'Lead Management',
      details: `Admin exported ${leads.length} leads to CSV`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    return res.send(csvContent);
  } catch (err) {
    console.error('Error generating leads CSV export:', err);
    res.status(500).json({ message: 'Failed to export leads', error: err.message });
  }
});

// ==================== 4. GET /api/leads/:id ====================
// Single lead detail view with download logs
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const lead = await BrochureLead.findOne(
      isObjectId ? { $or: [{ _id: id }, { leadId: id }] } : { leadId: id }
    );

    if (!lead) {
      return res.status(404).json({ message: `Lead '${id}' not found` });
    }

    const downloadEvents = await DownloadEvent.find({ leadId: lead.leadId }).sort({ timestamp: -1 });

    res.json({
      lead,
      downloadEvents
    });
  } catch (err) {
    console.error('Error fetching lead details:', err);
    res.status(500).json({ message: 'Failed to fetch lead details', error: err.message });
  }
});

// ==================== 5. PATCH /api/leads/:id/status ====================
// Update lead status: New, Contacted, Qualified, Converted, Lost
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid lead status '${status}'. Allowed values: ${validStatuses.join(', ')}`
      });
    }

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const lead = await BrochureLead.findOne(
      isObjectId ? { $or: [{ _id: id }, { leadId: id }] } : { leadId: id }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const prevStatus = lead.leadStatus;
    lead.leadStatus = status;
    lead.notes.unshift({
      id: `note-${Date.now()}`,
      text: `Status updated from "${prevStatus}" to "${status}" by ${req.user?.name || 'Administrator'}`,
      author: req.user?.name || 'Admin',
      date: new Date()
    });

    await lead.save();

    await AuditLog.create({
      action: 'Lead Status Updated',
      module: 'Lead Management',
      details: `Updated lead ${lead.leadId} status to "${status}"`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.json(lead);
  } catch (err) {
    console.error('Error updating lead status:', err);
    res.status(500).json({ message: 'Failed to update lead status', error: err.message });
  }
});

// ==================== 6. POST /api/leads/:id/notes ====================
// Add internal note to lead
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const lead = await BrochureLead.findOne(
      isObjectId ? { $or: [{ _id: id }, { leadId: id }] } : { leadId: id }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const newNote = {
      id: `note-${Date.now()}`,
      text: text.trim(),
      author: req.user?.name || req.body.author || 'Admin',
      date: new Date()
    };

    lead.notes.unshift(newNote);
    await lead.save();

    res.json(lead);
  } catch (err) {
    console.error('Error adding lead note:', err);
    res.status(500).json({ message: 'Failed to add note to lead', error: err.message });
  }
});

// ==================== 7. DELETE /api/leads/:id ====================
// Authorized lead deletion
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const lead = await BrochureLead.findOneAndDelete(
      isObjectId ? { $or: [{ _id: id }, { leadId: id }] } : { leadId: id }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await AuditLog.create({
      action: 'Lead Deleted',
      module: 'Lead Management',
      details: `Deleted lead ${lead.leadId} (${lead.name})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'warning'
    });

    res.json({ success: true, message: `Lead '${lead.leadId}' deleted successfully` });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).json({ message: 'Failed to delete lead', error: err.message });
  }
});

module.exports = router;

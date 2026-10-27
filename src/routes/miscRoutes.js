const express = require('express');
const router = express.Router();

// In-memory / MongoDB-backed collections for admin portal resources
let enquiries = [
  {
    id: 'ENQ-2026-088',
    type: 'custom_fabrication',
    customerName: 'Dr. Vivek Saxena',
    email: 'director.procurement@fortishealthcare.com',
    phone: '+91 98450 11223',
    organization: 'Fortis Hospital Bannerghatta',
    subject: 'Bespoke 316 Stainless Steel OT Instrument Wash Station',
    message: 'We require 4 units of custom multi-bay surgical instrument washing sinks with hands-free knee-operated valves and integrated drying racks.',
    productId: 'ti-sink-01',
    productName: 'Touch-Free Sensor Surgical Scrub Sink',
    category: 'hospital-sinks-scrub-stations',
    status: 'new',
    priority: 'high',
    assignedTo: 'Vikram Mehta',
    createdAt: new Date().toISOString(),
    notes: []
  },
  {
    id: 'ENQ-2026-087',
    type: 'quote_request',
    customerName: 'Kavita Chawla',
    email: 'supplychain@maxhealthcare.com',
    phone: '+91 97110 33445',
    organization: 'Max Super Speciality Hospital, Saket',
    subject: 'Quotation for 25 Units 2-Tier Instrument Trolleys',
    message: 'Need institutional quotation for 25 units of AISI 304 2-tier surgical trolleys with 100mm antistatic castors for delivery to New Delhi facility.',
    productId: 'ti-trl-01',
    productName: '2-Tier Stainless Steel Instrument Trolley',
    category: 'instrument-trolleys',
    status: 'in_review',
    priority: 'medium',
    assignedTo: 'Ananya Verma',
    createdAt: new Date().toISOString(),
    notes: []
  }
];

let articles = [
  {
    id: 'art-01',
    title: 'AISI 304 vs AISI 316: Metallurgy and Corrosion Resistance in Hospital Furniture',
    slug: 'aisi-304-vs-316-hospital-stainless-steel',
    category: 'Material Science',
    date: 'February 10, 2026',
    readTime: '6 min read',
    excerpt: 'Detailed metallurgical analysis of austenitic stainless steels in surgical cleanrooms and resistance to aggressive hospital sterilants.',
    image: '/images/products/scrub-sink.jpg',
    status: 'published',
    views: 1420
  },
  {
    id: 'art-02',
    title: 'Zero-Crevice Sanitary Argon TIG Welding Standards for Clinical Equipment',
    slug: 'sanitary-argon-tig-welding-clinical-standards',
    category: 'Fabrication Engineering',
    date: 'January 28, 2026',
    readTime: '8 min read',
    excerpt: 'How crevice-free argon-purged TIG welds prevent bacterial biofilm formation and pass rigorous hospital hygiene protocols.',
    image: '/images/products/surgical-prep-table.jpg',
    status: 'published',
    views: 980
  }
];

let auditLogs = [
  {
    id: 'log-01',
    action: 'Admin Login',
    module: 'Authentication',
    details: 'Dr. Rajesh Sharma logged in to administrative console',
    severity: 'info',
    timestamp: new Date().toISOString()
  },
  {
    id: 'log-02',
    action: 'Newsletter System Initialized',
    module: 'Newsletter',
    details: 'Automated newsletter delivery and subscriber sync active',
    severity: 'info',
    timestamp: new Date().toISOString()
  }
];

// --- Enquiries Routes ---
router.get('/enquiries', (req, res) => res.json(enquiries));

router.patch('/enquiries/:id/status', (req, res) => {
  const item = enquiries.find((e) => e.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Enquiry not found' });
  item.status = req.body.status;
  res.json(item);
});

router.patch('/enquiries/:id/assign', (req, res) => {
  const item = enquiries.find((e) => e.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Enquiry not found' });
  item.assignedTo = req.body.assignedTo;
  res.json(item);
});

router.post('/enquiries/:id/notes', (req, res) => {
  const item = enquiries.find((e) => e.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Enquiry not found' });
  const note = {
    id: `note-${Date.now()}`,
    text: req.body.text,
    author: req.body.author || 'Admin',
    date: new Date().toISOString()
  };
  item.notes = item.notes || [];
  item.notes.push(note);
  res.json(note);
});

// --- Articles Routes ---
router.get('/articles', (req, res) => res.json(articles));

router.post('/articles', (req, res) => {
  const newArticle = {
    ...req.body,
    id: `art-${Date.now()}`,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    views: 0
  };
  articles.unshift(newArticle);
  res.status(201).json(newArticle);
});

router.put('/articles/:id', (req, res) => {
  const idx = articles.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Article not found' });
  articles[idx] = { ...articles[idx], ...req.body };
  res.json(articles[idx]);
});

router.delete('/articles/:id', (req, res) => {
  articles = articles.filter((a) => a.id !== req.params.id);
  res.json({ success: true });
});

// --- Audit Logs Routes ---
router.get('/audit-logs', (req, res) => res.json(auditLogs));
router.get('/logs', (req, res) => res.json(auditLogs));

module.exports = router;

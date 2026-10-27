const express = require('express');
const router = express.Router();

const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// Admin protected
router.use(authenticateAdmin);

// GET /api/audit-logs
router.get('/', async (req, res) => {
  try {
    const { module, severity, limit = 50 } = req.query;
    const filter = {};
    if (module && module !== 'all') filter.module = module;
    if (severity && severity !== 'all') filter.severity = severity;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10) || 50);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve audit logs', error: err.message });
  }
});

module.exports = router;

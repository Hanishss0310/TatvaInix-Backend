const subscriberService = require('../services/subscriberService');
const { verifySmtpConnection } = require('../config/mailer');
const { renderUnsubscribePage } = require('../templates/unsubscribePage');

const newsletterController = {
  /**
   * Public Subscription endpoint: POST /api/newsletter/subscribe
   */
  subscribe: async (req, res) => {
    try {
      const { name, email, consent } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid corporate or hospital email address.'
        });
      }

      const clientIp = req.ip || req.connection?.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await subscriberService.subscribe({
        name,
        email,
        consent: consent !== undefined ? Boolean(consent) : true,
        source: 'Website Footer',
        metadata: { clientIp, userAgent }
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[Public Subscribe Controller Error]', err.message);
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'An error occurred while processing your subscription. Please try again.'
      });
    }
  },

  /**
   * Admin: List subscribers (paginated or full)
   */
  getSubscribers: async (req, res) => {
    try {
      const { page, limit, search, status, source, sort } = req.query;
      const data = await subscriberService.getSubscribers({
        page,
        limit,
        search,
        status,
        source,
        sort
      });
      // If client expects flat array (e.g. legacy endpoint) when limit is not specified:
      if (req.query.flat === 'true') {
        return res.json(data.subscribers);
      }
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  /**
   * Admin: Get single subscriber
   */
  getSubscriberById: async (req, res) => {
    try {
      const subscriber = await subscriberService.getSubscriberById(req.params.id);
      return res.json(subscriber);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  /**
   * Admin: Add new subscriber manually
   */
  addSubscriber: async (req, res) => {
    try {
      const subscriber = await subscriberService.addSubscriber(req.body);
      return res.status(201).json(subscriber);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  /**
   * Admin: Update subscriber information
   */
  updateSubscriber: async (req, res) => {
    try {
      const updated = await subscriberService.updateSubscriber(req.params.id, req.body);
      return res.json(updated);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  /**
   * Admin: Update subscriber status (e.g. Suppress / Reactivate)
   */
  updateStatus: async (req, res) => {
    try {
      const { status, reason } = req.body;
      const updated = await subscriberService.updateStatus(req.params.id, status, reason);
      return res.json(updated);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  /**
   * Admin: Delete subscriber record
   */
  deleteSubscriber: async (req, res) => {
    try {
      const result = await subscriberService.deleteSubscriber(req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  /**
   * Admin: Bulk import CSV records
   */
  importSubscribers: async (req, res) => {
    try {
      const list = req.body.subscribers || req.body;
      if (!Array.isArray(list)) {
        return res.status(400).json({ message: 'Expected an array of subscriber records' });
      }
      const result = await subscriberService.importSubscribers(list, req.body.source || 'CSV Import');
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  /**
   * Admin: Subscriber statistics & KPIs
   */
  getStats: async (req, res) => {
    try {
      const stats = await subscriberService.getStats();
      return res.json(stats);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  /**
   * Public: Web Unsubscribe Link (GET /api/newsletter/unsubscribe?token=...)
   */
  handleUnsubscribeWeb: async (req, res) => {
    const { token, preview } = req.query;

    if (preview === 'true') {
      const html = renderUnsubscribePage({
        email: 'preview.admin@tatvainox.com',
        success: true,
        message: 'This was a test preview of the Tatva Inox one-click unsubscribe page.'
      });
      return res.send(html);
    }

    if (!token) {
      const html = renderUnsubscribePage({
        success: false,
        message: 'Missing or expired unsubscribe token. If you wish to unsubscribe, please click the link inside your newsletter email.'
      });
      return res.status(400).send(html);
    }

    try {
      const result = await subscriberService.unsubscribeByToken(token);
      const html = renderUnsubscribePage({
        email: result.email,
        success: true,
        message: 'You have been successfully removed from Tatva Inox healthcare equipment newsletters and technical bulletins.'
      });
      return res.send(html);
    } catch (err) {
      const html = renderUnsubscribePage({
        success: false,
        message: err.message || 'Invalid or expired unsubscribe token.'
      });
      return res.status(400).send(html);
    }
  },

  /**
   * Public: One-Click Unsubscribe (POST /api/newsletter/unsubscribe) RFC 8058
   */
  handleUnsubscribeApi: async (req, res) => {
    const token = req.query.token || req.body.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Unsubscribe token is required' });
    }

    try {
      const result = await subscriberService.unsubscribeByToken(token);
      return res.json({ success: true, message: 'Unsubscribed successfully', email: result.email });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Admin: Test SMTP connectivity
   */
  testSmtp: async (req, res) => {
    try {
      const result = await verifySmtpConnection();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ connected: false, message: err.message });
    }
  }
};

module.exports = newsletterController;

const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');
const authenticateAdmin = require('../middleware/authenticateAdmin');
const { subscribeLimiter } = require('../middleware/rateLimiter');

// Public Subscription Endpoints
router.post('/subscribe', subscribeLimiter, newsletterController.subscribe);
router.get('/unsubscribe', newsletterController.handleUnsubscribeWeb);
router.post('/unsubscribe', newsletterController.handleUnsubscribeApi);

// Admin-Protected Subscriber & Audience Endpoints
router.get('/stats', authenticateAdmin, newsletterController.getStats);
router.get('/subscribers', authenticateAdmin, newsletterController.getSubscribers);
router.get('/subscribers/:id', authenticateAdmin, newsletterController.getSubscriberById);
router.post('/subscribers', authenticateAdmin, newsletterController.addSubscriber);
router.patch('/subscribers/:id', authenticateAdmin, newsletterController.updateSubscriber);
router.put('/subscribers/:id', authenticateAdmin, newsletterController.updateSubscriber);
router.patch('/subscribers/:id/status', authenticateAdmin, newsletterController.updateStatus);
router.delete('/subscribers/:id', authenticateAdmin, newsletterController.deleteSubscriber);
router.post('/subscribers/import', authenticateAdmin, newsletterController.importSubscribers);

// Admin-Protected SMTP Testing
router.post('/admin/test-smtp', authenticateAdmin, newsletterController.testSmtp);

module.exports = router;

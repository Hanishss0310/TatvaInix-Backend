const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authenticateAdmin = require('../middleware/authenticateAdmin');

// All campaign management endpoints require administrator authorization
router.use(authenticateAdmin);

router.get('/', campaignController.getAll);
router.post('/', campaignController.create);
router.post('/audience', campaignController.calculateAudience);
router.get('/:id', campaignController.getById);
router.patch('/:id', campaignController.update);
router.put('/:id', campaignController.update);
router.delete('/:id', campaignController.delete);
router.post('/:id/test', campaignController.sendTest);
router.post('/:id/send', campaignController.sendCampaign);
router.post('/:id/cancel', campaignController.cancelCampaign);

module.exports = router;

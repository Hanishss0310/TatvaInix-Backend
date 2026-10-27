const campaignService = require('../services/campaignService');

const campaignController = {
  create: async (req, res) => {
    try {
      const campaign = await campaignService.createDraft(req.body);
      return res.status(201).json(campaign);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const campaigns = await campaignService.getAllCampaigns();
      return res.json(campaigns);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const campaign = await campaignService.getCampaignById(req.params.id);
      return res.json(campaign);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const updated = await campaignService.updateCampaign(req.params.id, req.body);
      return res.json(updated);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await campaignService.deleteCampaign(req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  calculateAudience: async (req, res) => {
    try {
      const targetAudience = req.body.targetAudience || {
        type: req.query.type || 'all',
        selectedSubscriberIds: req.body.selectedSubscriberIds
      };
      const result = await campaignService.calculateAudience(targetAudience);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  sendTest: async (req, res) => {
    try {
      const { email } = req.body;
      const result = await campaignService.sendTest(req.params.id, email);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  sendCampaign: async (req, res) => {
    try {
      const result = await campaignService.queueAndSend(req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  cancelCampaign: async (req, res) => {
    try {
      const result = await campaignService.cancelCampaign(req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
};

module.exports = campaignController;

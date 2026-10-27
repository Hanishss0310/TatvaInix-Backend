const NewsletterCampaign = require('../models/NewsletterCampaign');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendTestEmail, sanitizeEmailHtml } = require('./emailService');
const { enqueueCampaign } = require('../jobs/newsletterWorker');

const campaignService = {
  /**
   * Create a new campaign draft
   */
  createDraft: async (data) => {
    if (!data.name || !data.subject || !data.contentHtml) {
      const err = new Error('Campaign name, subject, and content are required');
      err.statusCode = 400;
      throw err;
    }

    const campaign = new NewsletterCampaign({
      name: data.name.trim(),
      subject: data.subject.trim(),
      previewText: data.previewText ? data.previewText.trim() : '',
      heading: data.heading ? data.heading.trim() : '',
      contentHtml: sanitizeEmailHtml(data.contentHtml),
      ctaButtonText: data.ctaButtonText ? data.ctaButtonText.trim() : '',
      ctaButtonUrl: data.ctaButtonUrl ? data.ctaButtonUrl.trim() : '',
      bannerImageUrl: data.bannerImageUrl ? data.bannerImageUrl.trim() : '',
      senderName: data.senderName || 'Tatva Inox',
      senderEmail: data.senderEmail || 'donotreply.tatvainox@gmail.com',
      replyTo: data.replyTo || 'office@tatvainox.in',
      targetAudience: data.targetAudience || { type: 'all' },
      status: data.status || 'draft'
    });

    await campaign.save();
    return campaign;
  },

  /**
   * Get all campaigns ordered by creation date
   */
  getAllCampaigns: async () => {
    return await NewsletterCampaign.find().sort({ createdAt: -1 });
  },

  /**
   * Get campaign by ID
   */
  getCampaignById: async (id) => {
    const campaign = await NewsletterCampaign.findById(id);
    if (!campaign) {
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }
    return campaign;
  },

  /**
   * Update an existing campaign (only allowed if not currently sending)
   */
  updateCampaign: async (id, data) => {
    const campaign = await NewsletterCampaign.findById(id);
    if (!campaign) {
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }

    if (campaign.status === 'sending') {
      const err = new Error('Cannot edit a campaign that is currently being dispatched');
      err.statusCode = 400;
      throw err;
    }

    if (data.name) campaign.name = data.name.trim();
    if (data.subject) campaign.subject = data.subject.trim();
    if (data.previewText !== undefined) campaign.previewText = data.previewText.trim();
    if (data.heading !== undefined) campaign.heading = data.heading.trim();
    if (data.contentHtml) campaign.contentHtml = sanitizeEmailHtml(data.contentHtml);
    if (data.ctaButtonText !== undefined) campaign.ctaButtonText = data.ctaButtonText.trim();
    if (data.ctaButtonUrl !== undefined) campaign.ctaButtonUrl = data.ctaButtonUrl.trim();
    if (data.bannerImageUrl !== undefined) campaign.bannerImageUrl = data.bannerImageUrl.trim();
    if (data.senderName) campaign.senderName = data.senderName;
    if (data.senderEmail) campaign.senderEmail = data.senderEmail;
    if (data.replyTo) campaign.replyTo = data.replyTo;
    if (data.targetAudience) campaign.targetAudience = data.targetAudience;
    if (data.scheduledFor !== undefined) campaign.scheduledFor = data.scheduledFor;

    await campaign.save();
    return campaign;
  },

  /**
   * Delete a campaign record
   */
  deleteCampaign: async (id) => {
    const campaign = await NewsletterCampaign.findByIdAndDelete(id);
    if (!campaign) {
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: `Campaign "${campaign.name}" removed` };
  },

  /**
   * Calculate live eligible audience for a campaign
   */
  calculateAudience: async (targetAudience = { type: 'all' }) => {
    const query = { status: 'active', consent: true };

    if (targetAudience.type === 'selected') {
      const selectedIds = (targetAudience.selectedSubscriberIds || []).filter(Boolean);
      const selectedEmails = (targetAudience.selectedEmails || []).map((e) => e.toLowerCase().trim()).filter(Boolean);

      const conditions = [];
      if (selectedIds.length > 0) {
        conditions.push({ _id: { $in: selectedIds } });
      }
      if (selectedEmails.length > 0) {
        conditions.push({ email: { $in: selectedEmails } });
      }

      if (conditions.length > 0) {
        query.$or = conditions;
      } else {
        return {
          eligibleCount: 0,
          targetType: 'selected',
          samplePreview: []
        };
      }
    } else if (targetAudience.type === 'filtered') {
      if (targetAudience.filter?.source && targetAudience.filter.source !== 'all') {
        query.source = targetAudience.filter.source;
      }
    }

    const count = await NewsletterSubscriber.countDocuments(query);
    const sample = await NewsletterSubscriber.find(query).limit(10).select('email name source');

    // Also account for custom selectedEmails that may not yet be in DB
    let extraEmailsCount = 0;
    if (targetAudience.type === 'selected' && targetAudience.selectedEmails?.length > 0) {
      const existingInDb = await NewsletterSubscriber.find({
        email: { $in: targetAudience.selectedEmails.map((e) => e.toLowerCase().trim()) }
      }).select('email');
      const existingEmails = new Set(existingInDb.map((s) => s.email.toLowerCase()));
      const newCustomEmails = targetAudience.selectedEmails.filter((e) => !existingEmails.has(e.toLowerCase().trim()));
      extraEmailsCount = newCustomEmails.length;
    }

    return {
      eligibleCount: count + extraEmailsCount,
      targetType: targetAudience.type || 'all',
      samplePreview: sample
    };
  },

  /**
   * Send test email for campaign to administrator
   */
  sendTest: async (campaignId, testEmail) => {
    if (!testEmail || !/^\S+@\S+\.\S+$/.test(testEmail)) {
      const err = new Error('Please enter a valid administrator email address for testing');
      err.statusCode = 400;
      throw err;
    }

    let campaign;
    if (campaignId && campaignId !== 'camp-draft' && campaignId.length === 24) {
      campaign = await NewsletterCampaign.findById(campaignId);
    }

    if (!campaign) {
      campaign = {
        name: 'Tatva Inox Campaign Draft',
        subject: 'Healthcare Stainless Steel Specifications & Hospital Equipment Update',
        contentHtml: '<p>This is a test preview of your Tatva Inox newsletter campaign.</p>'
      };
    }

    return await sendTestEmail(testEmail, campaign);
  },

  /**
   * Validate, queue, and dispatch a campaign via background queue
   */
  queueAndSend: async (campaignId) => {
    const campaign = await NewsletterCampaign.findById(campaignId);
    if (!campaign) {
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }

    if (['queued', 'sending', 'completed'].includes(campaign.status)) {
      const err = new Error(`Campaign cannot be dispatched because it is in '${campaign.status}' state`);
      err.statusCode = 400;
      throw err;
    }

    // Check audience size
    const audience = await campaignService.calculateAudience(campaign.targetAudience);
    if (audience.eligibleCount === 0) {
      const err = new Error('Cannot send campaign: no active, consented subscribers match the audience criteria.');
      err.statusCode = 400;
      throw err;
    }

    campaign.status = 'queued';
    campaign.recipientsCount = audience.eligibleCount;
    await campaign.save();

    // Trigger background queue execution
    await enqueueCampaign(campaign._id.toString());

    return {
      success: true,
      message: `Campaign "${campaign.name}" has been queued for background dispatch to ${audience.eligibleCount} recipients.`,
      campaign
    };
  },

  /**
   * Cancel a queued or sending campaign
   */
  cancelCampaign: async (campaignId) => {
    const campaign = await NewsletterCampaign.findById(campaignId);
    if (!campaign) {
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['queued', 'sending'].includes(campaign.status)) {
      const err = new Error(`Only queued or sending campaigns can be cancelled`);
      err.statusCode = 400;
      throw err;
    }

    campaign.status = 'cancelled';
    await campaign.save();
    return { success: true, message: 'Campaign has been marked as cancelled', campaign };
  }
};

module.exports = campaignService;

const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendWelcomeEmail, verifyUnsubscribeToken } = require('./emailService');

const subscriberService = {
  /**
   * Public subscription handler (with duplicate prevention, reactivation, and welcome email)
   */
  subscribe: async ({ email, name = '', consent = true, source = 'Website Footer', metadata = {} }) => {
    if (!email || typeof email !== 'string') {
      const err = new Error('A valid email address is required');
      err.statusCode = 400;
      throw err;
    }

    if (!consent) {
      const err = new Error('Marketing consent is required to subscribe to technical bulletins');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = NewsletterSubscriber.normalizeEmail(email);
    let subscriber = await NewsletterSubscriber.findOne({ email: normalizedEmail });

    if (subscriber) {
      if (subscriber.status === 'active') {
        // Refresh consent and update contact details if provided
        subscriber.consent = true;
        subscriber.consentedAt = new Date();
        if (name && name.trim()) subscriber.name = name.trim();
        if (metadata && Object.keys(metadata).length > 0) subscriber.metadata = metadata;
        await subscriber.save();

        // Always dispatch confirmation thank-you email so the subscriber receives the message
        let emailResult = { success: false };
        try {
          emailResult = await sendWelcomeEmail(subscriber);
        } catch (err) {
          console.error('[Welcome Email Delivery Failure]', err.message);
        }

        return {
          success: true,
          alreadySubscribed: true,
          message: emailResult.success
            ? 'Thank you for subscribing to Tatva Inox technical bulletins! A confirmation message has been sent to your email.'
            : String(emailResult.error || '').includes('550') || String(emailResult.error || '').includes('limit')
            ? 'Thank you for subscribing! Subscription is active. (Email delivery is temporarily delayed due to daily mail service quota).'
            : 'Thank you for subscribing to Tatva Inox technical bulletins!',
          emailSent: Boolean(emailResult.success),
          emailError: emailResult.error,
          emailNote: emailResult.simulated ? emailResult.note : undefined,
          subscriber
        };
      }

      if (subscriber.status === 'bounced') {
        return {
          success: false,
          bounced: true,
          message: 'This email address was previously flagged due to mail delivery failure. Please contact office@tatvainox.in to update your email.',
          subscriber
        };
      }

      // If previously unsubscribed, reactivate with fresh consent
      subscriber.status = 'active';
      subscriber.consent = true;
      subscriber.consentedAt = new Date();
      subscriber.unsubscribedAt = null;
      subscriber.source = `${source} (Reactivated)`;
      if (name && name.trim()) subscriber.name = name.trim();
      if (metadata && Object.keys(metadata).length > 0) subscriber.metadata = metadata;
      await subscriber.save();

      // Send fresh welcome confirmation email
      let emailResult = { success: false };
      try {
        emailResult = await sendWelcomeEmail(subscriber);
      } catch (err) {
        console.error('[Welcome Email Delivery Failure]', err.message);
      }

      return {
        success: true,
        reactivated: true,
        message: emailResult.success
          ? 'Thank you for subscribing! A confirmation message has been sent to your email.'
          : String(emailResult.error || '').includes('550') || String(emailResult.error || '').includes('limit')
          ? 'Thank you for subscribing! Subscription is active. (Email delivery is temporarily delayed due to daily mail service quota).'
          : 'Thank you for subscribing to Tatva Inox technical bulletins!',
        emailSent: Boolean(emailResult.success),
        emailError: emailResult.error,
        emailNote: emailResult.simulated ? emailResult.note : undefined,
        subscriber
      };
    }

    // New Subscriber
    subscriber = new NewsletterSubscriber({
      email: normalizedEmail,
      name: name ? name.trim() : '',
      status: 'active',
      source,
      consent: true,
      consentedAt: new Date(),
      subscribedAt: new Date(),
      metadata
    });

    await subscriber.save();

    // Trigger branded welcome email
    let emailResult = { success: false };
    try {
      emailResult = await sendWelcomeEmail(subscriber);
    } catch (err) {
      console.error('[Welcome Email Delivery Failure]', err.message);
    }

    return {
      success: true,
      message: emailResult.success
        ? 'Thank you for subscribing to Tatva Inox technical bulletins! A confirmation message has been sent to your email.'
        : String(emailResult.error || '').includes('550') || String(emailResult.error || '').includes('limit')
        ? 'Thank you for subscribing! Subscription is active. (Email delivery is temporarily delayed due to daily mail service quota).'
        : 'Thank you for subscribing to Tatva Inox technical bulletins!',
      emailSent: Boolean(emailResult.success),
      emailError: emailResult.error,
      emailNote: emailResult.simulated ? emailResult.note : undefined,
      subscriber
    };
  },

  /**
   * Retrieve subscribers with search, filters, and pagination
   */
  getSubscribers: async ({ page = 1, limit = 20, search = '', status = 'all', source = 'all', sort = '-createdAt' } = {}) => {
    const query = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ email: regex }, { name: regex }];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (source && source !== 'all') {
      query.source = source;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10);

    // If limit is 0 or NaN, return all matching records without pagination
    if (!limitNum || limitNum <= 0) {
      const subscribers = await NewsletterSubscriber.find(query).sort(sort);
      return {
        subscribers,
        total: subscribers.length,
        page: 1,
        totalPages: 1
      };
    }

    const skip = (pageNum - 1) * limitNum;
    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find(query).sort(sort).skip(skip).limit(limitNum),
      NewsletterSubscriber.countDocuments(query)
    ]);

    return {
      subscribers,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    };
  },

  /**
   * Retrieve a single subscriber by ID
   */
  getSubscriberById: async (id) => {
    const subscriber = await NewsletterSubscriber.findById(id);
    if (!subscriber) {
      const err = new Error('Subscriber not found');
      err.statusCode = 404;
      throw err;
    }
    return subscriber;
  },

  /**
   * Add a subscriber manually from Admin panel
   */
  addSubscriber: async (data) => {
    const normalizedEmail = NewsletterSubscriber.normalizeEmail(data.email);
    const existing = await NewsletterSubscriber.findOne({ email: normalizedEmail });

    if (existing) {
      const err = new Error(`A subscriber with email ${normalizedEmail} already exists in database.`);
      err.statusCode = 409;
      throw err;
    }

    const subscriber = new NewsletterSubscriber({
      email: normalizedEmail,
      name: data.name ? data.name.trim() : '',
      source: data.source || 'Direct Admin Entry',
      status: data.status || 'active',
      consent: data.consent !== undefined ? Boolean(data.consent) : true,
      consentedAt: new Date(),
      subscribedAt: data.subscribedAt ? new Date(data.subscribedAt) : new Date()
    });

    await subscriber.save();
    return subscriber;
  },

  /**
   * Update subscriber details
   */
  updateSubscriber: async (id, data) => {
    const subscriber = await NewsletterSubscriber.findById(id);
    if (!subscriber) {
      const err = new Error('Subscriber not found');
      err.statusCode = 404;
      throw err;
    }

    if (data.email) {
      const normalizedEmail = NewsletterSubscriber.normalizeEmail(data.email);
      if (normalizedEmail !== subscriber.email) {
        const conflict = await NewsletterSubscriber.findOne({ email: normalizedEmail, _id: { $ne: id } });
        if (conflict) {
          const err = new Error(`Email ${normalizedEmail} is already used by another subscriber.`);
          err.statusCode = 409;
          throw err;
        }
        subscriber.email = normalizedEmail;
      }
    }

    if (data.name !== undefined) subscriber.name = data.name.trim();
    if (data.source) subscriber.source = data.source;
    if (data.consent !== undefined) subscriber.consent = Boolean(data.consent);

    await subscriber.save();
    return subscriber;
  },

  /**
   * Update status (e.g. toggle suppression or reactivate)
   */
  updateStatus: async (id, status, reason = '') => {
    const subscriber = await NewsletterSubscriber.findById(id);
    if (!subscriber) {
      const err = new Error('Subscriber not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['active', 'unsubscribed', 'bounced'].includes(status)) {
      const err = new Error('Invalid status. Must be active, unsubscribed, or bounced');
      err.statusCode = 400;
      throw err;
    }

    subscriber.status = status;
    if (status === 'unsubscribed') {
      subscriber.unsubscribedAt = new Date();
      if (reason) subscriber.unsubscribeReason = reason;
    } else if (status === 'active') {
      subscriber.unsubscribedAt = null;
      subscriber.consent = true;
      subscriber.consentedAt = new Date();
    }

    await subscriber.save();
    return subscriber;
  },

  /**
   * Delete subscriber record
   */
  deleteSubscriber: async (id) => {
    const subscriber = await NewsletterSubscriber.findByIdAndDelete(id);
    if (!subscriber) {
      const err = new Error('Subscriber not found');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: `Subscriber ${subscriber.email} removed` };
  },

  /**
   * Import contacts from parsed CSV with duplicate skipping and consent validation
   */
  importSubscribers: async (list = [], defaultSource = 'CSV Import') => {
    if (!Array.isArray(list) || list.length === 0) {
      return { imported: 0, duplicates: 0, invalid: 0, total: await NewsletterSubscriber.countDocuments() };
    }

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const item of list) {
      const rawEmail = item.email || item.Email || item['Email Address'] || '';
      const email = NewsletterSubscriber.normalizeEmail(rawEmail);

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        invalid++;
        continue;
      }

      const existing = await NewsletterSubscriber.findOne({ email });
      if (existing) {
        duplicates++;
        continue;
      }

      const rawName = item.name || item.Name || item['Full Name'] || item['Contact Name'] || '';
      const rawSource = item.source || item.Source || defaultSource;
      const rawConsent = item.consent !== undefined ? item.consent : true;

      try {
        await NewsletterSubscriber.create({
          email,
          name: typeof rawName === 'string' ? rawName.trim() : '',
          source: rawSource,
          status: 'active',
          consent: Boolean(rawConsent),
          consentedAt: new Date(),
          subscribedAt: new Date()
        });
        imported++;
      } catch (err) {
        if (err.code === 11000) {
          duplicates++;
        } else {
          invalid++;
        }
      }
    }

    const total = await NewsletterSubscriber.countDocuments();
    return { imported, duplicates, invalid, total };
  },

  /**
   * Get KPI metrics and stats
   */
  getStats: async () => {
    const [total, active, unsubscribed, bounced, consented] = await Promise.all([
      NewsletterSubscriber.countDocuments(),
      NewsletterSubscriber.countDocuments({ status: 'active' }),
      NewsletterSubscriber.countDocuments({ status: 'unsubscribed' }),
      NewsletterSubscriber.countDocuments({ status: 'bounced' }),
      NewsletterSubscriber.countDocuments({ status: 'active', consent: true })
    ]);

    return {
      total,
      active,
      unsubscribed,
      bounced,
      eligibleForCampaigns: consented
    };
  },

  /**
   * Process unsubscribe request by secure token
   */
  unsubscribeByToken: async (token, reason = 'User requested via email link') => {
    const verified = verifyUnsubscribeToken(token);
    if (!verified.valid) {
      const err = new Error(verified.error || 'Invalid or expired unsubscribe token');
      err.statusCode = 400;
      throw err;
    }

    const subscriber = await NewsletterSubscriber.findOne({ email: verified.email });
    if (!subscriber) {
      // Safe idempotent return
      return { success: true, email: verified.email, alreadyUnsubscribed: true };
    }

    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.unsubscribeReason = reason;
    await subscriber.save();

    return {
      success: true,
      email: subscriber.email,
      unsubscribedAt: subscriber.unsubscribedAt
    };
  }
};

module.exports = subscriberService;

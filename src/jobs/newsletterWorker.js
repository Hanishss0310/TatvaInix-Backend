const NewsletterCampaign = require('../models/NewsletterCampaign');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendCampaignEmail } = require('../services/emailService');

// Batch and throttling configuration
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 250;

/**
 * Helper to pause execution between batches
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute delivery of a campaign in controlled batches
 */
const processCampaignDelivery = async (campaignId) => {
  console.log(`[Campaign Worker] Beginning batch dispatch for campaign ID: ${campaignId}`);

  const campaign = await NewsletterCampaign.findById(campaignId);
  if (!campaign) {
    console.error(`[Campaign Worker Error] Campaign ${campaignId} not found`);
    return { success: false, error: 'Campaign not found' };
  }

  if (['completed', 'sending'].includes(campaign.status)) {
    console.warn(`[Campaign Worker] Campaign ${campaignId} is already in state: ${campaign.status}. Skipping duplicate dispatch.`);
    return { success: false, reason: 'Already in progress or completed' };
  }

  // 1. Build Query for Eligible Audience
  const subscriberQuery = {
    status: 'active',
    consent: true
  };

  const targetType = campaign.targetAudience?.type || 'all';

  if (targetType === 'selected') {
    const selectedIds = (campaign.targetAudience.selectedSubscriberIds || []).filter(Boolean);
    const selectedEmails = (campaign.targetAudience.selectedEmails || []).map((e) => e.toLowerCase().trim()).filter(Boolean);

    const conditions = [];
    if (selectedIds.length > 0) {
      conditions.push({ _id: { $in: selectedIds } });
    }
    if (selectedEmails.length > 0) {
      conditions.push({ email: { $in: selectedEmails } });
    }

    if (conditions.length > 0) {
      subscriberQuery.$or = conditions;
    } else {
      subscriberQuery._id = { $in: [] };
    }
  } else if (targetType === 'filtered') {
    if (campaign.targetAudience.filter?.source && campaign.targetAudience.filter.source !== 'all') {
      subscriberQuery.source = campaign.targetAudience.filter.source;
    }
  }

  // Retrieve eligible audience
  let eligibleSubscribers = await NewsletterSubscriber.find(subscriberQuery);

  // If there are custom selected emails that are not in DB, auto-create them and include them
  if (targetType === 'selected' && campaign.targetAudience.selectedEmails?.length > 0) {
    const existingEmails = new Set(eligibleSubscribers.map((s) => s.email.toLowerCase()));
    for (const rawEmail of campaign.targetAudience.selectedEmails) {
      const cleanEmail = rawEmail.toLowerCase().trim();
      if (cleanEmail && !existingEmails.has(cleanEmail)) {
        try {
          const newSub = new NewsletterSubscriber({
            email: cleanEmail,
            status: 'active',
            consent: true,
            source: 'Direct Campaign Selection',
            subscribedAt: new Date()
          });
          await newSub.save();
          eligibleSubscribers.push(newSub);
          existingEmails.add(cleanEmail);
        } catch (e) {
          const found = await NewsletterSubscriber.findOne({ email: cleanEmail });
          if (found && found.status === 'active' && found.consent) {
            eligibleSubscribers.push(found);
            existingEmails.add(cleanEmail);
          }
        }
      }
    }
  }

  const totalAudience = eligibleSubscribers.length;

  campaign.status = 'sending';
  campaign.sentAt = new Date();
  campaign.recipientsCount = totalAudience;
  campaign.attemptedCount = 0;
  campaign.acceptedCount = 0;
  campaign.failedCount = 0;
  campaign.skippedCount = 0;
  campaign.deliveryErrors = [];
  await campaign.save();

  if (totalAudience === 0) {
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();
    console.log(`[Campaign Worker] Campaign ${campaign.name} had 0 eligible subscribers. Marked completed.`);
    return { success: true, recipientsCount: 0 };
  }

  console.log(`[Campaign Worker] Dispatching campaign "${campaign.name}" to ${totalAudience} eligible recipients.`);

  let attempted = 0;
  let accepted = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  // 2. Deliver concurrently in high-speed batches using connection pooling
  for (let i = 0; i < totalAudience; i += BATCH_SIZE) {
    // Check if campaign was cancelled mid-send
    const liveCheck = await NewsletterCampaign.findById(campaignId).select('status');
    if (liveCheck && liveCheck.status === 'cancelled') {
      console.warn(`[Campaign Worker] Campaign ${campaignId} was cancelled by administrator.`);
      break;
    }

    const batch = eligibleSubscribers.slice(i, i + BATCH_SIZE);
    const batchSubIds = batch.map((s) => s._id).filter(Boolean);

    // Bulk verify fresh status in a single query
    const freshSubs = await NewsletterSubscriber.find({
      _id: { $in: batchSubIds },
      status: 'active',
      consent: true
    }).select('status consent email name');

    const freshMap = new Map(freshSubs.map((s) => [s._id.toString(), s]));

    // Dispatch batch in parallel across pooled SMTP connections
    const sendPromises = batch.map(async (sub) => {
      const freshSub = sub._id ? freshMap.get(sub._id.toString()) : sub;
      if (!freshSub || freshSub.status !== 'active' || !freshSub.consent) {
        return { type: 'skipped', email: sub.email };
      }

      try {
        const result = await sendCampaignEmail(freshSub, campaign);
        if (result.success) {
          return { type: 'accepted', email: freshSub.email };
        } else {
          return {
            type: 'failed',
            email: freshSub.email,
            error: result.error || 'SMTP delivery rejected'
          };
        }
      } catch (err) {
        return {
          type: 'failed',
          email: freshSub.email,
          error: err.message
        };
      }
    });

    const results = await Promise.all(sendPromises);

    for (const r of results) {
      if (r.type === 'skipped') {
        skipped++;
      } else if (r.type === 'accepted') {
        attempted++;
        accepted++;
      } else {
        attempted++;
        failed++;
        errors.push({
          email: r.email,
          error: r.error,
          timestamp: new Date()
        });
      }
    }

    // Persist progress to MongoDB after each batch
    await NewsletterCampaign.findByIdAndUpdate(campaignId, {
      attemptedCount: attempted,
      acceptedCount: accepted,
      failedCount: failed,
      skippedCount: skipped,
      $push: { deliveryErrors: { $each: errors.slice(-10) } }
    });

    if (i + BATCH_SIZE < totalAudience) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // 3. Finalize Status
  const finalStatus =
    failed === 0 ? 'completed' : accepted > 0 ? 'partially_failed' : 'failed';

  await NewsletterCampaign.findByIdAndUpdate(campaignId, {
    status: finalStatus,
    completedAt: new Date(),
    attemptedCount: attempted,
    acceptedCount: accepted,
    failedCount: failed,
    skippedCount: skipped,
    deliveryErrors: errors
  });

  console.log(
    `[Campaign Worker Finished] Campaign "${campaign.name}" finalized with status: ${finalStatus}. ` +
    `(Attempted: ${attempted}, Accepted: ${accepted}, Failed: ${failed}, Skipped: ${skipped})`
  );

  return {
    success: true,
    status: finalStatus,
    attempted,
    accepted,
    failed,
    skipped
  };
};

// Queue state
let activeQueueHandler = null;

/**
 * Initialize Queue Handler.
 * Tries BullMQ if Redis is configured, or falls back to async persistent handler.
 */
const initQueue = async () => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    let connection = null;
    try {
      const { Queue, Worker } = require('bullmq');
      const IORedis = require('ioredis');

      connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 1500,
        retryStrategy: () => null, // Do not keep retrying if Redis is not running
        enableOfflineQueue: false,
        lazyConnect: true
      });

      connection.on('error', () => {
        // Suppress unhandled error event on connection failure
      });

      await connection.connect();

      console.log('[Queue] Redis BullMQ connection established successfully.');

      const campaignQueue = new Queue('newsletter-campaigns', { connection });
      const campaignWorker = new Worker(
        'newsletter-campaigns',
        async (job) => {
          return await processCampaignDelivery(job.data.campaignId);
        },
        { connection, concurrency: 1 }
      );

      campaignWorker.on('failed', (job, err) => {
        console.error(`[BullMQ Worker Error] Job ${job?.id} failed:`, err.message);
      });

      activeQueueHandler = {
        enqueue: async (campaignId) => {
          await campaignQueue.add('dispatch-campaign', { campaignId });
        }
      };

      return;
    } catch (err) {
      if (connection) {
        try { connection.disconnect(); } catch {}
      }
      console.warn(`[Queue Notice] Redis not running at ${redisUrl} (${err.message}). Using persistent MongoDB async batch queue worker.`);
    }
  }

  // Fallback: Persistent in-process queue
  activeQueueHandler = {
    enqueue: async (campaignId) => {
      // Async dispatch on next tick without blocking HTTP response
      setImmediate(async () => {
        try {
          await processCampaignDelivery(campaignId);
        } catch (err) {
          console.error('[Async Queue Error]', err.message);
        }
      });
    }
  };
};

// Auto-initialize queue
initQueue().catch((err) => console.error('[Queue Init Error]', err));

const enqueueCampaign = async (campaignId) => {
  if (!activeQueueHandler) {
    await initQueue();
  }
  return await activeQueueHandler.enqueue(campaignId);
};

module.exports = {
  processCampaignDelivery,
  enqueueCampaign
};

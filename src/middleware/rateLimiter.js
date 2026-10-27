const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Public subscription rate limiter
 */
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many subscription requests from this IP address. Please try again after 15 minutes.'
  }
});

/**
 * Admin login rate limiter
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

/**
 * Brochure lead submission limiter
 */
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many brochure requests from this IP. Please try again in 15 minutes.'
  }
});

/**
 * Brochure download limiter
 */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 300 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Download rate limit reached. Please wait a few moments before trying again.'
  }
});

/**
 * Public enquiry / RFQ form limiter
 */
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many enquiry submissions from this IP address. Please wait a few minutes before submitting again.'
  }
});

module.exports = {
  subscribeLimiter,
  authLimiter,
  leadLimiter,
  downloadLimiter,
  enquiryLimiter
};

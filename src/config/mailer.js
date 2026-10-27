const nodemailer = require('nodemailer');
const { EMAIL_IDENTITY } = require('./constants');

const isPlaceholder = (val) => {
  if (!val) return true;
  const lower = String(val).toLowerCase();
  return lower.includes('placeholder') || lower.includes('your_') || lower.includes('example');
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = (process.env.SMTP_USER || EMAIL_IDENTITY.fromEmail).trim();
  const rawPass = process.env.SMTP_PASS || '';
  const pass = rawPass.trim().replace(/\s+/g, '');

  const configured = Boolean(user && pass && !isPlaceholder(pass));

  return { host, port, secure, user, pass, configured };
};

let transporterInstance = null;

const createTransporter = () => {
  const config = getSmtpConfig();

  if (!config.configured) {
    console.warn(
      `[SMTP Notice] SMTP_PASS is not configured or using placeholder in .env. ` +
      `Emails will run in safe dev mode (logged to console) until valid SMTP credentials are provided.`
    );
  }

  const transporter = nodemailer.createTransport({
    pool: true, // Reuse pooled SMTP connections for blazing fast throughput
    maxConnections: 5, // Concurrent sockets for parallel dispatch
    maxMessages: 100, // Reuse socket up to 100 messages before refreshing
    rateDelta: 1000,
    rateLimit: 14, // Comply with SMTP delivery guidelines without throttling
    host: config.host,
    port: config.port,
    secure: config.secure, // false for port 587 (STARTTLS)
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  return transporter;
};

const getTransporter = () => {
  if (!transporterInstance) {
    transporterInstance = createTransporter();
  }
  return transporterInstance;
};

/**
 * Verify SMTP connection and return diagnostic result.
 */
const verifySmtpConnection = async () => {
  // Dynamically reload .env so edits to .env are picked up immediately without manual server restarts
  try {
    require('dotenv').config({ override: true });
    resetTransporter();
  } catch {}

  const config = getSmtpConfig();
  if (!config.configured) {
    return {
      connected: false,
      reason: 'MISSING_CREDENTIALS',
      message: 'SMTP credentials not configured. Please supply a valid Gmail App Password in SMTP_PASS in backend/.env',
      details: { host: config.host, port: config.port, user: config.user }
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return {
      connected: true,
      message: 'SMTP connection verified successfully with mail server',
      details: { host: config.host, port: config.port, user: config.user }
    };
  } catch (err) {
    console.error('[SMTP Verification Error]', err.message);
    return {
      connected: false,
      reason: 'AUTH_OR_NETWORK_ERROR',
      message: err.message,
      details: { host: config.host, port: config.port, user: config.user }
    };
  }
};

/**
 * Reset transporter instance (e.g. after updating env or credentials)
 */
const resetTransporter = () => {
  transporterInstance = null;
};

module.exports = {
  getTransporter,
  getSmtpConfig,
  verifySmtpConnection,
  resetTransporter
};

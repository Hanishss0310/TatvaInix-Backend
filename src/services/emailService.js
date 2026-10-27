const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const { getTransporter, getSmtpConfig, verifySmtpConnection } = require('../config/mailer');
const { EMAIL_IDENTITY, COMPANY, DEFAULTS } = require('../config/constants');
const { renderWelcomeEmail } = require('../templates/welcomeEmail');
const { renderCampaignEmail } = require('../templates/newsletterEmail');

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET || 'tatva_inox_unsub_secret_2026';
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.tatvainox.com/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'office@tatvainox.in';

/**
 * Generate a secure, recipient-specific HMAC/JWT unsubscribe token
 */
const generateUnsubscribeToken = (subscriber) => {
  const payload = {
    email: subscriber.email.toLowerCase().trim(),
    subId: subscriber._id ? subscriber._id.toString() : subscriber.id,
    purpose: 'unsubscribe'
  };
  return jwt.sign(payload, UNSUBSCRIBE_SECRET, {
    expiresIn: `${DEFAULTS.UNSUBSCRIBE_EXPIRY_DAYS}d`
  });
};

/**
 * Verify and decode an unsubscribe token
 */
const verifyUnsubscribeToken = (token) => {
  try {
    const decoded = jwt.verify(token, UNSUBSCRIBE_SECRET);
    if (decoded && decoded.email && decoded.purpose === 'unsubscribe') {
      return { valid: true, email: decoded.email, subId: decoded.subId };
    }
    return { valid: false, error: 'Invalid token payload' };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

/**
 * Build the full public unsubscribe URL for a subscriber
 */
const getUnsubscribeUrl = (subscriber) => {
  const token = generateUnsubscribeToken(subscriber);
  let baseUrl = process.env.PUBLIC_API_URL || API_BASE_URL;
  if (!baseUrl || baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
    baseUrl = 'https://api.tatvainox.com/api';
  }
  return `${baseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
};

/**
 * Sanitize rich text HTML to prevent XSS while preserving legitimate layout tags
 */
const sanitizeEmailHtml = (dirtyHtml) => {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
  return sanitizeHtml(dirtyHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'span', 'div'
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'cellpadding', 'cellspacing', 'border'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false
  });
};

/**
 * Base email layout wrapper matching Tatva Inox brand identity
 */
const renderBrandEmailLayout = ({ title, bodyHtml, ctaText, ctaUrl, footerNote }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; text-align: left; border-bottom: 3px solid #0284c7; }
    .brand-title { color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .brand-subtitle { color: #94a3b8; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 24px; background: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; margin: 20px 0; }
    .info-box { background: #f1f5f9; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; }
    .footer { background: #f8fafc; padding: 20px 32px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand-title">TATVA INOX</h1>
      <div class="brand-subtitle">Precision Stainless Steel Healthcare Solutions</div>
    </div>
    <div class="content">
      ${bodyHtml}
      ${ctaText && ctaUrl ? `<p style="text-align: center;"><a href="${ctaUrl}" class="btn">${ctaText}</a></p>` : ''}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Tatva Inox Fabrication Hub:</strong> Kamakshipalya, Bengaluru 560079, India</p>
      <p style="margin: 0 0 6px 0;">Phone: +91 73377 79357 | Email: office@tatvainox.in | Web: https://tatvainox.com</p>
      ${footerNote ? `<p style="margin: 8px 0 0 0; color: #94a3b8;">${footerNote}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Deliver Welcome Email to new subscriber
 */
const sendWelcomeEmail = async (subscriber) => {
  const unsubscribeUrl = getUnsubscribeUrl(subscriber);
  const { html, text } = renderWelcomeEmail({
    name: subscriber.name,
    email: subscriber.email,
    unsubscribeUrl
  });

  const smtpConfig = getSmtpConfig();
  const mailOptions = {
    from: EMAIL_IDENTITY.fromHeader,
    to: subscriber.email,
    replyTo: EMAIL_IDENTITY.replyTo,
    subject: DEFAULTS.SUBJECT_WELCOME,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${EMAIL_IDENTITY.replyTo}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID': `welcome-${subscriber.id || subscriber._id}`
    }
  };

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Welcome Email dispatched to: ${subscriber.email}`);
    return { success: true, simulated: true, messageId: `simulated-welcome-${Date.now()}` };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    console.error(`[SMTP Error] Failed to send welcome email to ${subscriber.email}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Deliver a single campaign email to an eligible subscriber
 */
const sendCampaignEmail = async (subscriber, campaign) => {
  const unsubscribeUrl = getUnsubscribeUrl(subscriber);
  const sanitizedContent = sanitizeEmailHtml(campaign.contentHtml);

  const { html, text } = renderCampaignEmail({
    subject: campaign.subject,
    previewText: campaign.previewText || '',
    heading: campaign.heading || '',
    contentHtml: sanitizedContent,
    ctaButtonText: campaign.ctaButtonText || '',
    ctaButtonUrl: campaign.ctaButtonUrl || '',
    recipientEmail: subscriber.email,
    recipientName: subscriber.name || '',
    unsubscribeUrl
  });

  const smtpConfig = getSmtpConfig();
  const mailOptions = {
    from: EMAIL_IDENTITY.fromHeader,
    to: subscriber.email,
    replyTo: EMAIL_IDENTITY.replyTo,
    subject: campaign.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${EMAIL_IDENTITY.replyTo}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Campaign-ID': campaign._id ? campaign._id.toString() : campaign.id
    }
  };

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Campaign "${campaign.name}" dispatched to: ${subscriber.email}`);
    return { success: true, simulated: true, messageId: `simulated-camp-${Date.now()}` };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Deliver a test email for campaign preview to an administrator
 */
const sendTestEmail = async (recipientEmail, campaign) => {
  const unsubscribeUrl = `${API_BASE_URL}/newsletter/unsubscribe?preview=true`;
  const sanitizedContent = sanitizeEmailHtml(campaign.contentHtml || '<p>No content provided</p>');

  const { html, text } = renderCampaignEmail({
    subject: `[TEST] ${campaign.subject || 'Tatva Inox Campaign Preview'}`,
    previewText: campaign.previewText || '',
    heading: campaign.heading || '',
    contentHtml: sanitizedContent,
    ctaButtonText: campaign.ctaButtonText || '',
    ctaButtonUrl: campaign.ctaButtonUrl || '',
    recipientEmail,
    recipientName: 'Administrator',
    unsubscribeUrl
  });

  const smtpConfig = getSmtpConfig();
  const mailOptions = {
    from: EMAIL_IDENTITY.fromHeader,
    to: recipientEmail,
    replyTo: EMAIL_IDENTITY.replyTo,
    subject: `[TEST] ${campaign.subject || 'Tatva Inox Bulletin'}`,
    html,
    text
  };

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Test Email dispatched to: ${recipientEmail}`);
    return {
      success: true,
      simulated: true,
      message: `Test email simulated in development mode for ${recipientEmail}`
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, message: `Test email sent to ${recipientEmail}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Deliver Brochure Request confirmation to visitor and notification to admin
 */
const sendBrochureLeadEmails = async (lead, downloadFullUrl) => {
  const smtpConfig = getSmtpConfig();

  // 1. Visitor confirmation email
  const visitorHtml = renderBrandEmailLayout({
    title: 'Your Tatva Inox Catalogue Download is Ready',
    bodyHtml: `
      <h2 style="color: #0f172a; margin-top: 0;">Hello ${lead.name},</h2>
      <p>Thank you for requesting technical specifications from <strong>Tatva Inox</strong>. Your verified download is ready.</p>
      <div class="info-box">
        <strong>Document Requested:</strong> ${lead.productName || lead.brochureName}<br>
        <strong>Lead Reference Code:</strong> ${lead.leadId}<br>
        <strong>Access Expiry:</strong> 15 Minutes (Secured Token)
      </div>
      <p>Click the secure link below to download the high-resolution engineering catalogue:</p>
    `,
    ctaText: 'Download Product Catalogue (PDF)',
    ctaUrl: downloadFullUrl,
    footerNote: 'This is an automated confirmation sent to authorized healthcare procurement partners.'
  });

  // 2. Admin notification email
  const adminHtml = renderBrandEmailLayout({
    title: `[NEW LEAD] Brochure Download: ${lead.name}`,
    bodyHtml: `
      <h2 style="color: #0f172a; margin-top: 0;">New Brochure Lead Captured</h2>
      <p>A new visitor has submitted a brochure request on the Tatva Inox website.</p>
      <div class="info-box">
        <strong>Lead ID:</strong> ${lead.leadId}<br>
        <strong>Full Name:</strong> ${lead.name}<br>
        <strong>Company / Hospital:</strong> ${lead.company || 'Not specified'}<br>
        <strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a><br>
        <strong>Phone / Mobile:</strong> ${lead.phone}<br>
        <strong>Target Product:</strong> ${lead.productName}<br>
        <strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN')}<br>
        ${lead.message ? `<strong>Enquiry Message:</strong> ${lead.message}<br>` : ''}
      </div>
      <p>This lead has been logged to the Admin Console under <em>Brochure Leads</em>.</p>
    `,
    ctaText: 'View Lead in Admin Console',
    ctaUrl: 'https://tatvainox.com/admin/leads'
  });

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Brochure Lead confirmation to visitor: ${lead.email}`);
    console.log(`[Dev Mailer] Simulated Brochure Lead notification to admin: ${ADMIN_EMAIL}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = getTransporter();
    // Send to visitor
    if (lead.email) {
      await transporter.sendMail({
        from: EMAIL_IDENTITY.fromHeader,
        to: lead.email,
        replyTo: EMAIL_IDENTITY.replyTo,
        subject: `Your Tatva Inox Product Catalogue Download [Ref: ${lead.leadId}]`,
        html: visitorHtml
      });
    }

    // Send to admin
    await transporter.sendMail({
      from: EMAIL_IDENTITY.fromHeader,
      to: ADMIN_EMAIL,
      replyTo: lead.email,
      subject: `[LEAD ALERT] ${lead.name} (${lead.company || 'Hospital Partner'}) downloaded ${lead.productName}`,
      html: adminHtml
    });

    return { success: true };
  } catch (err) {
    console.error('[SMTP Error] Failed to dispatch brochure lead emails:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Deliver Enquiry / RFQ / Customization confirmation to customer and notification to admin
 */
const sendEnquiryEmails = async (enquiry) => {
  const smtpConfig = getSmtpConfig();

  // 1. Customer acknowledgement email
  const customerHtml = renderBrandEmailLayout({
    title: 'We have received your enquiry — Tatva Inox',
    bodyHtml: `
      <h2 style="color: #0f172a; margin-top: 0;">Dear ${enquiry.customerName},</h2>
      <p>Thank you for contacting <strong>Tatva Inox</strong>. Our engineering and estimating desk has received your request and is currently reviewing the technical details.</p>
      <div class="info-box">
        <strong>Enquiry Reference ID:</strong> ${enquiry.id}<br>
        <strong>Enquiry Type:</strong> ${enquiry.type?.toUpperCase() || 'GENERAL'}<br>
        ${enquiry.productName ? `<strong>Product of Interest:</strong> ${enquiry.productName}<br>` : ''}
        ${enquiry.quantity ? `<strong>Estimated Quantity:</strong> ${enquiry.quantity} Units<br>` : ''}
        <strong>Submitted On:</strong> ${new Date().toLocaleString('en-IN')}<br>
      </div>
      <p>A technical specialist will review your specifications and contact you with a formal itemized quotation within <strong>24 business hours</strong>.</p>
    `,
    ctaText: 'Visit Tatva Inox Online',
    ctaUrl: 'https://tatvainox.com'
  });

  // 2. Admin notification email
  const adminHtml = renderBrandEmailLayout({
    title: `[NEW ENQUIRY] ${enquiry.id}: ${enquiry.customerName}`,
    bodyHtml: `
      <h2 style="color: #0f172a; margin-top: 0;">New Commercial Enquiry Received</h2>
      <div class="info-box">
        <strong>Enquiry ID:</strong> ${enquiry.id}<br>
        <strong>Type:</strong> ${enquiry.type}<br>
        <strong>Customer:</strong> ${enquiry.customerName}<br>
        <strong>Organization:</strong> ${enquiry.organization || 'N/A'}<br>
        <strong>Email:</strong> <a href="mailto:${enquiry.email}">${enquiry.email}</a><br>
        <strong>Phone:</strong> ${enquiry.phone || 'N/A'}<br>
        <strong>Subject:</strong> ${enquiry.subject || 'Standard Enquiry'}<br>
        <strong>Product:</strong> ${enquiry.productName || 'N/A'}<br>
        <strong>Quantity:</strong> ${enquiry.quantity || 1}<br>
      </div>
      <p><strong>Message / Requirements:</strong></p>
      <div style="background: #ffffff; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-style: italic;">
        "${enquiry.message}"
      </div>
    `,
    ctaText: 'Open in Admin Console',
    ctaUrl: 'https://tatvainox.com/admin/enquiries'
  });

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Enquiry acknowledgement to customer: ${enquiry.email}`);
    console.log(`[Dev Mailer] Simulated Enquiry notification to admin: ${ADMIN_EMAIL}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = getTransporter();
    if (enquiry.email) {
      await transporter.sendMail({
        from: EMAIL_IDENTITY.fromHeader,
        to: enquiry.email,
        replyTo: EMAIL_IDENTITY.replyTo,
        subject: `Enquiry Acknowledgement: ${enquiry.subject || 'Hospital Equipment Request'} [Ref: ${enquiry.id}]`,
        html: customerHtml
      });
    }

    await transporter.sendMail({
      from: EMAIL_IDENTITY.fromHeader,
      to: ADMIN_EMAIL,
      replyTo: enquiry.email,
      subject: `[ENQUIRY ALERT] ${enquiry.id} from ${enquiry.customerName} (${enquiry.organization || 'Customer'})`,
      html: adminHtml
    });

    return { success: true };
  } catch (err) {
    console.error('[SMTP Error] Failed to dispatch enquiry emails:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Deliver direct admin reply to customer
 */
const sendEnquiryReply = async (enquiry, replyData) => {
  const smtpConfig = getSmtpConfig();
  const replyHtml = renderBrandEmailLayout({
    title: replyData.subject || `Response regarding Enquiry ${enquiry.id}`,
    bodyHtml: `
      <h2 style="color: #0f172a; margin-top: 0;">Dear ${enquiry.customerName},</h2>
      <div>${sanitizeEmailHtml(replyData.message || replyData.text || '')}</div>
      <div class="info-box" style="margin-top: 24px;">
        <strong>Reference ID:</strong> ${enquiry.id}<br>
        <strong>Original Subject:</strong> ${enquiry.subject || 'Enquiry'}
      </div>
    `
  });

  if (!smtpConfig.configured) {
    console.log(`[Dev Mailer] Simulated Admin Reply to: ${replyData.to || enquiry.email}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: EMAIL_IDENTITY.fromHeader,
      to: replyData.to || enquiry.email,
      replyTo: EMAIL_IDENTITY.replyTo,
      subject: replyData.subject,
      html: replyHtml
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
  sanitizeEmailHtml,
  sendWelcomeEmail,
  sendCampaignEmail,
  sendTestEmail,
  sendBrochureLeadEmails,
  sendEnquiryEmails,
  sendEnquiryReply,
  verifySmtpConnection
};

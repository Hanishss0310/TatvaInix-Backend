const { COMPANY } = require('../config/constants');

/**
 * Renders a full branded HTML newsletter email around campaign content
 */
const renderCampaignEmail = ({
  subject,
  previewText = '',
  heading = '',
  contentHtml,
  ctaButtonText = '',
  ctaButtonUrl = '',
  recipientEmail,
  recipientName = '',
  unsubscribeUrl
}) => {
  const greeting = recipientName && recipientName.trim()
    ? `<p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0;">Dear ${recipientName.trim()},</p>`
    : '';

  const ctaButtonHtml = ctaButtonText && ctaButtonUrl
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0 24px 0;">
        <tr>
          <td align="center">
            <a href="${ctaButtonUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35); text-align: center;">
              ${ctaButtonText} &rarr;
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <!-- Preview Text (Preheader) -->
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">${previewText} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Branded Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 24px; text-align: center; border-bottom: 3px solid #0284c7;">
              <div style="display: inline-block; padding: 3px 10px; background-color: rgba(2, 132, 199, 0.15); border: 1px solid #0284c7; border-radius: 16px; margin-bottom: 6px;">
                <span style="color: #38bdf8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Hospital Stainless Steel</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 4px 0 0 0; letter-spacing: 1px;">TATVA INOX</h1>
              <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0; letter-spacing: 0.5px;">Precision Engineering & Sanitary Healthcare Solutions</p>
            </td>
          </tr>

          <!-- Optional Heading Banner -->
          ${heading ? `
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; border-bottom: 1px solid #e2e8f0;">
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.4;">${heading}</h2>
            </td>
          </tr>
          ` : ''}

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 28px 28px; background-color: #ffffff; font-size: 14px; line-height: 1.65; color: #334155;">
              ${greeting}
              ${contentHtml}
              ${ctaButtonHtml}
            </td>
          </tr>

          <!-- Contact Strip -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 28px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 12px; color: #475569; line-height: 1.6;">
                    <strong style="color: #0f172a;">Tatva Inox Technical Consultation:</strong><br>
                    Phone: <a href="tel:${COMPANY.phone}" style="color: #0284c7; text-decoration: none; font-weight: 600;">${COMPANY.phone}</a> | 
                    Email: <a href="mailto:${COMPANY.contactEmail}" style="color: #0284c7; text-decoration: none; font-weight: 600;">${COMPANY.contactEmail}</a><br>
                    Facility: ${COMPANY.address}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Anti-Spam & Unsubscribe Footer -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 28px; text-align: center;">
              <p style="font-size: 11px; line-height: 1.6; color: #94a3b8; margin: 0 0 10px 0;">
                You received this bulletin because <strong>${recipientEmail}</strong> is registered for Tatva Inox healthcare equipment bulletins.
              </p>
              <p style="font-size: 11px; margin: 0; color: #94a3b8;">
                <a href="${unsubscribeUrl}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Unsubscribe safely</a> 
                &nbsp;|&nbsp; 
                <a href="${COMPANY.website}" style="color: #64748b; text-decoration: underline;">tatvainox.com</a>
              </p>
              <p style="font-size: 10px; color: #cbd5e1; margin: 12px 0 0 0;">
                &copy; ${new Date().getFullYear()} ${COMPANY.legalName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Strip simple tags for plain text fallback
  const plainBody = contentHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const text = `
TATVA INOX — Healthcare Stainless Steel Bulletin
${subject}
==================================================

${recipientName ? `Dear ${recipientName},\n\n` : ''}${heading ? `${heading}\n\n` : ''}${plainBody}

${ctaButtonText && ctaButtonUrl ? `${ctaButtonText}: ${ctaButtonUrl}\n\n` : ''}
DIRECT DESK:
Phone: ${COMPANY.phone}
Email: ${COMPANY.contactEmail}
Website: ${COMPANY.website}

To unsubscribe from future bulletins:
${unsubscribeUrl}

© ${new Date().getFullYear()} ${COMPANY.legalName}. All rights reserved.
`.trim();

  return { html, text };
};

module.exports = { renderCampaignEmail };

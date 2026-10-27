const { COMPANY, EMAIL_IDENTITY } = require('../config/constants');

/**
 * Generate responsive HTML and plain text for Tatva Inox Welcome Email
 */
const renderWelcomeEmail = ({ name = '', email, unsubscribeUrl }) => {
  const recipientGreeting = name && name.trim() ? `Dear ${name.trim()},` : 'Dear Healthcare Colleague,';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Tatva Inox Technical Bulletins</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (max 600px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Branded Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px 28px; text-align: center; border-bottom: 3px solid #0284c7;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 4px 12px; background-color: rgba(2, 132, 199, 0.15); border: 1px solid #0284c7; border-radius: 20px; margin-bottom: 8px;">
                      <span style="color: #38bdf8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Stainless Steel Solutions</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 4px 0 0 0; letter-spacing: 1px;">TATVA INOX</h1>
                    <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0; font-weight: 400; letter-spacing: 0.5px;">Precision Hospital, Surgical & Cleanroom Equipment</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome Banner Accent -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 28px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; margin-right: 6px; vertical-align: middle;"></span>
                    <span style="color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Subscription Confirmed</span>
                  </td>
                  <td align="right">
                    <span style="color: #64748b; font-size: 12px;">Healthcare Engineering Digest</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px 28px; background-color: #ffffff;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                ${recipientGreeting}
              </p>
              
              <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 16px 0;">
                Thank you for subscribing to technical updates from <strong>Tatva Inox</strong>. Your subscription has been successfully registered for engineering specification bulletins, clinical furniture releases, and hospital sanitation standards.
              </p>

              <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 24px 0;">
                At Tatva Inox, we engineer medical furniture strictly adhering to modern infection-control guidelines, using certified <strong>AISI 304 and 316 hospital-grade stainless steel</strong> with zero-crevice sanitary argon-purged TIG welds.
              </p>

              <!-- Feature Highlights Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 4px; margin-bottom: 28px; border: 1px solid #e2e8f0; border-left-width: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                      What you will receive in our bulletins:
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                          ✓ <strong>Material Comparison Guides:</strong> Chemical resistance of AISI 304 vs 316 against hospital disinfectants
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                          ✓ <strong>Equipment Releases:</strong> Electric ICU beds, instrument trolleys, hands-free scrub sinks, and cleanroom pass boxes
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                          ✓ <strong>Sanitary Welding Standards:</strong> Crevice elimination, weld passivation, and biofilm prevention
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                          ✓ <strong>Tender Specifications:</strong> CAD dimensional blueprints and procurement schedules for hospital projects
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${COMPANY.website}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35); text-align: center;">
                      Explore Hospital Equipment Catalogue &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 8px 0;">
                Planning an upcoming hospital project or need custom dimensional adaptations? Our biomedical fabrication engineers in Bengaluru review architectural blueprints and supply hospitals nationwide.
              </p>
            </td>
          </tr>

          <!-- Contact Details Strip -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 28px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 12px; color: #475569; line-height: 1.6;">
                    <strong style="color: #0f172a;">Engineering & Direct Inquiry Desk:</strong><br>
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
                You received this email because <strong>${email}</strong> opted in to receive hospital furniture specification bulletins on <a href="${COMPANY.website}" style="color: #64748b; text-decoration: underline;">tatvainox.com</a>.
              </p>
              <p style="font-size: 11px; margin: 0; color: #94a3b8;">
                <a href="${unsubscribeUrl}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Unsubscribe safely</a> 
                &nbsp;|&nbsp; 
                <a href="${COMPANY.website}/contact" style="color: #64748b; text-decoration: underline;">Contact Engineering</a> 
                &nbsp;|&nbsp; 
                <a href="${COMPANY.website}" style="color: #64748b; text-decoration: underline;">Visit tatvainox.com</a>
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

  const text = `
TATVA INOX — Precision Stainless Steel Medical & Hospital Equipment
===================================================================

${recipientGreeting}

Thank you for subscribing to technical updates from Tatva Inox. Your subscription has been confirmed for hospital furniture specification sheets, material grade comparisons, and new sanitary equipment releases.

WHAT YOU WILL RECEIVE IN OUR BULLETINS:
- Material Comparison Guides: Chemical resistance of AISI 304 vs 316 against hospital disinfectants
- Equipment Releases: Electric ICU beds, instrument trolleys, scrub sinks, and cleanroom pass boxes
- Sanitary Welding Standards: Crevice elimination, weld passivation, and biofilm prevention
- Tender Specifications: CAD dimensional blueprints and procurement schedules

Explore our hospital catalogue: ${COMPANY.website}

ENGINEERING & DIRECT INQUIRY:
Phone: ${COMPANY.phone}
Email: ${COMPANY.contactEmail}
Facility: ${COMPANY.address}

Unsubscribe safely:
${unsubscribeUrl}

© ${new Date().getFullYear()} ${COMPANY.legalName}. All rights reserved.
`.trim();

  return { html, text };
};

module.exports = { renderWelcomeEmail };

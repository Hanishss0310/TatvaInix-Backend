const { COMPANY } = require('../config/constants');

const renderUnsubscribePage = ({ email, success = true, message }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Unsubscribe Error'} | Tatva Inox</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
      max-width: 480px;
      width: 90%;
      padding: 40px 32px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
      background: ${success ? '#ecfdf5' : '#fff1f2'};
      color: ${success ? '#047857' : '#be123c'};
      border: 1px solid ${success ? '#a7f3d0' : '#fecdd3'};
    }
    h1 {
      font-size: 22px;
      margin: 0 0 12px 0;
      font-weight: 800;
      color: #0f172a;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 24px 0;
    }
    .email-box {
      background: #f1f5f9;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      color: #334155;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .btn {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      padding: 12px 24px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #0369a1;
    }
    .footer-note {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${success ? 'Preferences Updated' : 'Notice'}</div>
    <h1>${success ? 'You Have Been Unsubscribed' : 'Unsubscribe Request'}</h1>
    ${email ? `<div class="email-box">${email}</div>` : ''}
    <p>
      ${message || 'You have been successfully removed from Tatva Inox healthcare equipment newsletters and technical bulletins. You will not receive future marketing dispatches.'}
    </p>
    <a href="${COMPANY.website}" class="btn">Return to Tatva Inox Homepage &rarr;</a>
    <div class="footer-note">
      Changed your mind? You can always resubscribe on <a href="${COMPANY.website}" style="color: #0284c7;">${COMPANY.website}</a> anytime.<br>
      ${COMPANY.legalName} &bull; ${COMPANY.phone}
    </div>
  </div>
</body>
</html>`;
};

module.exports = { renderUnsubscribePage };

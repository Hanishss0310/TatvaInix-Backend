// Tatva Inox — Company Information & Official Email Identity

module.exports = {
  COMPANY: {
    name: 'Tatva Inox',
    tagline: 'Precision Stainless Steel Medical & Hospital Equipment',
    legalName: 'Tatva Inox – Stainless Steel Solutions',
    address: 'Kamakshipalya, Bengaluru, Karnataka 560079, India',
    phone: '+91 7676209357',
    contactEmail: 'office@tatvainox.in',
    website: 'https://tatvainox.com',
    publicDomains: ['tatvainox.com', 'tatvainox.in']
  },

  EMAIL_IDENTITY: {
    senderName: process.env.MAIL_FROM_NAME || 'Tatva Inox',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'donotreply.tatvainox@gmail.com',
    replyTo: process.env.MAIL_REPLY_TO || 'office@tatvainox.in',
    get fromHeader() {
      return `"${this.senderName}" <${this.fromEmail}>`;
    }
  },

  DEFAULTS: {
    SUBJECT_WELCOME: 'Thank You for Subscribing | Tatva Inox Medical Equipment Updates',
    UNSUBSCRIBE_EXPIRY_DAYS: 365
  }
};

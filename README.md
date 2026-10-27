# Tatva Inox — Production Backend & API Architecture

A secure, scalable, enterprise-grade backend developed with Node.js, Express, and MongoDB for **Tatva Inox Healthcare Solutions**. Powers both the public clinical furniture catalogue website (`Tatva Inox`) and the administrative command centre (`tatva-inox-admin`).

---

## 1. System Architecture & Core Highlights

- **Mandatory Brochure Gating Workflow:** Direct downloads are strictly disallowed. Visitors must complete the lead capture form with verified contact and product information. Upon validation, the server generates a unique Lead ID (`LEAD-2026-XXXXX`), persists the lead into MongoDB, and issues a cryptographically signed, short-lived download token (15-minute expiration). The file is streamed from private, non-static storage (`backend/storage/brochures/`) with canonical path resolution to prevent directory traversal.
- **Enterprise Lead Management:** Full administrative tracking of all brochure leads, with filters (status, download state, product, date), search, detail drawers, status transitions (`New`, `Contacted`, `Qualified`, `Converted`, `Lost`), internal notes, and authorized CSV exports.
- **Dynamic Product & Category Management:** Real-time synchronization between the admin panel and public catalogue. Supports up to 10 high-resolution images per product, drag/reorder primary showcase, dynamic technical specifications, bullet highlights, and product-specific brochure attachments.
- **Full Form Integration:** Seamless MongoDB persistence for Request for Quote (RFQ), Custom Hospital Fabrication enquiries, and General Contact queries with automated customer acknowledgment and administrative notification emails.
- **Production-Grade Security:** Bcryptjs password hashing (12 rounds), JWT sessions with expiration, Helmet security headers, CORS origin whitelisting, express-rate-limit brute force and spam protection, and complete administrative audit logging.

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Runtime & Framework** | Node.js (v18+), Express.js (v4.21) |
| **Database & ODM** | MongoDB (v6.0+), Mongoose (v8.8) with indexing & strict schema validation |
| **Authentication & Encryption** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` password hashing |
| **File Storage & Uploads** | `multer` with MIME-type inspection, file size constraints, and automatic directory creation |
| **Private Brochure Vault** | Isolated non-public file storage at `backend/storage/brochures/` |
| **Rate Limiting & Security** | `express-rate-limit`, `helmet`, input sanitization |
| **Email & Delivery** | `nodemailer` with responsive HTML templates and failure logging |
| **Background Processing** | Queue architecture supporting both Redis/BullMQ and asynchronous MongoDB batch worker |

---

## 3. Directory Structure

```
backend/
├── Models/
│   ├── AdminUser.js           # Administrative user schema with bcrypt hashing & role verification
│   ├── Article.js             # Hospital news & clinical metallurgy articles
│   ├── AuditLog.js            # Immutable audit trail of administrative actions
│   ├── BrochureLead.js        # Gated brochure download leads & tracking
│   ├── Category.js            # Clinical furniture product categories
│   ├── DownloadEvent.js       # Audit log for every authorized brochure download
│   ├── Enquiry.js             # RFQ, Custom Fabrication & Contact submissions
│   ├── Media.js               # Central hospital media assets library
│   └── Product.js             # Surgical equipment catalogue products
├── Routes/
│   ├── articleRoutes.js       # News & clinical articles CRUD
│   ├── auditRoutes.js         # Administrative audit logs API
│   ├── brochureRoutes.js      # Gated brochure request & authorized streaming
│   ├── categoryRoutes.js      # Category listing & admin CRUD
│   ├── dashboardRoutes.js     # Live aggregated KPI metrics & analytics
│   ├── enquiryRoutes.js       # Public enquiry submission & admin management
│   ├── leadRoutes.js          # Brochure lead search, status, notes & CSV export
│   ├── mediaRoutes.js         # Media library upload & retrieval
│   ├── productRoutes.js       # Product CRUD with multi-image & brochure assets
│   └── userRoutes.js          # Admin users management & role controls
├── Middleware/
│   └── uploadMiddleware.js    # Multer configuration for images (10 max) & PDF brochures (25MB max)
├── src/
│   ├── middleware/
│   │   ├── authenticateAdmin.js # JWT verification & admin/editor role enforcement
│   │   └── rateLimiter.js     # Auth, lead submission, and download rate limiters
│   ├── models/
│   │   ├── NewsletterCampaign.js
│   │   └── NewsletterSubscriber.js
│   ├── routes/
│   │   ├── authRoutes.js      # Login, logout, session verification
│   │   ├── campaignRoutes.js  # Newsletter campaign management
│   │   └── newsletterRoutes.js# Public subscribe & admin subscriber management
│   ├── services/
│   │   └── emailService.js    # Automated email dispatch for leads, enquiries & newsletters
│   └── templates/
│       └── unsubscribePage.js # Branded unsubscribe confirmation UI
├── storage/
│   └── brochures/             # Private storage for master and product-specific brochures
├── uploads/                   # Public static directory (products, categories, media)
├── seeder.js                  # Database auto-seeder for admin, products, categories, leads
├── server.js                  # Express server entry point, middleware & route mounting
├── test-backend-suite.js      # Complete integration & security test suite (83 tests)
└── acceptance-tests.js        # Newsletter & email automation acceptance test suite (38 tests)
```

---

## 4. Getting Started

### Prerequisites

- Node.js v18.0.0 or higher
- MongoDB v6.0 or higher running locally or a remote MongoDB Atlas connection URI

### Installation

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
PORT=5000
NODE_ENV=development

# Frontend Origins
CLIENT_URL=https://tatvainox.com
API_BASE_URL=https://api.tatvainox.com/api

# MongoDB Connection
MONGODB_URI=mongodb://127.0.0.1:27017/tatva_inox

# Security Secrets
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
UNSUBSCRIBE_TOKEN_SECRET=your_unsubscribe_hmac_secret_key

# Default Administrator Credentials (used for initial seeding)
ADMIN_EMAIL=office@tatvainox.in
ADMIN_PASSWORD=admin123

# SMTP Email Configuration (Optional - emails will log warnings without crashing if omitted)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=donotreply.tatvainox@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM_NAME="Tatva Inox"
MAIL_FROM_EMAIL=donotreply.tatvainox@gmail.com
MAIL_REPLY_TO=office@tatvainox.in
```

### Starting the Server

```bash
# Start in production mode
npm start

# Start in development mode with automatic reload
npm run dev
```

Upon first startup, `seeder.js` automatically populates the database with:
- Initial administrator (`office@tatvainox.in` / `admin123`) and technical editor accounts.
- Master categories and hospital equipment products with AISI 304/316 metallurgy parameters.
- Sample brochure leads, inquiries, and newsletter subscribers.
- Copies the master catalogue PDF to the private storage directory `storage/brochures/tatva-inox-product-catalogue.pdf`.

---

## 5. API Reference

### Public Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health-check endpoint reporting server and database status |
| `GET` | `/api/products` | Retrieve published catalogue products (filters: category, grade, search) |
| `GET` | `/api/products/:slug` | Retrieve single product specifications and image galleries |
| `GET` | `/api/categories` | Retrieve all active categories with live product counts |
| `GET` | `/api/categories/:id` | Retrieve single category details |
| `POST` | `/api/brochures/request` | **Submit brochure lead form & obtain authorized download token** |
| `GET` | `/api/brochures/download` | **Stream authorized brochure PDF using short-lived download token** |
| `POST` | `/api/enquiries` | Submit Quote, Custom Fabrication, or Contact enquiry |
| `POST` | `/api/newsletter/subscribe`| Public newsletter subscription |
| `GET` | `/api/newsletter/unsubscribe`| One-click cryptographic unsubscribe |

### Administrative Protected Endpoints (Bearer JWT Required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login (rate-limited, returns signed JWT session) |
| `GET` | `/api/auth/me` | Verify active session & retrieve admin profile |
| `POST` | `/api/auth/logout` | Revoke session & clear audit trace |
| `GET` | `/api/dashboard/stats` | Live aggregated KPI metrics across all modules |
| `GET` | `/api/leads` | Paginated lead list with search, status, and download filters |
| `GET` | `/api/leads/stats` | Lead conversion and download analytics |
| `GET` | `/api/leads/export/csv` | Export all brochure leads as CSV format |
| `GET` | `/api/leads/:id` | Lead details drawer with full download history events |
| `PATCH`| `/api/leads/:id/status`| Transition lead status (`New`, `Contacted`, `Qualified`, etc.) |
| `POST` | `/api/leads/:id/notes` | Add internal clinical/sales follow-up notes |
| `DELETE`| `/api/leads/:id` | Delete lead with audit logging |
| `POST` | `/api/products` | Create product with up to 10 images and brochure PDF |
| `PUT` | `/api/products/:id` | Update product specifications, gallery order, and brochure |
| `DELETE`| `/api/products/:id` | Delete product and clean up unreferenced asset files |
| `POST` | `/api/categories` | Create new category with card content and image |
| `PUT` | `/api/categories/:id` | Update category details and image |
| `DELETE`| `/api/categories/:id` | Safe category deletion (blocked if products are assigned) |
| `GET` | `/api/enquiries` | List hospital procurement enquiries |
| `PATCH`| `/api/enquiries/:id/status` | Update enquiry triage status |
| `POST` | `/api/enquiries/:id/reply` | Send email reply directly to the customer |
| `GET` | `/api/newsletter/subscribers`| List subscribers with filtering and export |
| `POST` | `/api/newsletter/campaigns` | Create and dispatch email campaigns |
| `GET` | `/api/audit` | View immutable audit trail logs |

---

## 6. Gated Brochure Download Architecture

The brochure download flow implements a strict two-stage security protocol:

```
[ Visitor on Website ]
       │
       ▼ (Clicks "Download Brochure")
[ BrochureModal Dialog ] ── (Collects Name, Email, Phone, Company, Product)
       │
       ▼ POST /api/brochures/request
[ Server-Side Validation ] ── (Rejects missing/invalid fields with HTTP 400)
       │
       ▼ (Valid submission)
[ Lead Stored in MongoDB ] ── (Generates unique LEAD-2026-XXXXX)
       │
       ▼
[ JWT Download Token Created ] ── (Signed with secret, 15-minute expiration)
       │
       ▼ Returns { leadId, downloadToken, downloadUrl }
[ Browser Receives Token ]
       │
       ▼ Automatically triggers GET /api/brochures/download?token=...
[ Download Authorization Middleware ]
       ├── 1. Validates JWT signature & expiration timestamp
       ├── 2. Resolves canonical path inside backend/storage/brochures/
       ├── 3. Prevents path traversal (e.g., ../../)
       ├── 4. Increments lead download count in MongoDB
       ├── 5. Creates DownloadEvent audit record
       └── 6. Streams PDF binary with attachment headers
```

---

## 7. Automated Testing

The backend includes two automated test suites:

### 1. Comprehensive Backend & Security Integration Test Suite (83 Tests)

Validates all 17 requirements including authentication, authorization checks, product creation with multi-image & brochure, brochure request validation, token issuance, authorized PDF streaming, rejection of tampered/missing tokens, lead management, CSV export, enquiry system, and dashboard analytics.

```bash
npm run test
# OR
node test-backend-suite.js
```

### 2. Newsletter & Email Automation Acceptance Suite (38 Tests)

Validates public subscription, duplicate prevention, background queue delivery, email template rendering, and cryptographic unsubscribe.

```bash
npm run test:acceptance
```

---

## 8. Production Deployment Recommendations

1. **Database:** Deploy MongoDB on MongoDB Atlas with automated daily backups, IP access lists, and replica set configuration.
2. **File Storage:** In containerized or serverless hosting environments (e.g., AWS ECS, Render, Railway), configure persistent volume mounts for `backend/uploads/` and `backend/storage/` or configure an S3-compatible object storage provider.
3. **HTTPS & Security:** Ensure reverse proxy (Nginx, Cloudflare) enforces HTTPS and forwards `X-Forwarded-For` and `X-Forwarded-Proto` headers.
4. **Environment Secrets:** Store `JWT_SECRET`, `UNSUBSCRIBE_TOKEN_SECRET`, and `SMTP_PASS` in the cloud hosting provider's secret manager rather than committing to version control.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const productRoutes = require('./Routes/productRoutes');
const categoryRoutes = require('./Routes/categoryRoutes');
const departmentRoutes = require('./Routes/departmentRoutes');
const bannerRoutes = require('./Routes/bannerRoutes');
const mediaRoutes = require('./Routes/mediaRoutes');
const brochureRoutes = require('./Routes/brochureRoutes');
const leadRoutes = require('./Routes/leadRoutes');
const enquiryRoutes = require('./Routes/enquiryRoutes');
const dashboardRoutes = require('./Routes/dashboardRoutes');
const userRoutes = require('./Routes/userRoutes');
const auditRoutes = require('./Routes/auditRoutes');
const articleRoutes = require('./Routes/articleRoutes');

const authRoutes = require('./src/routes/authRoutes');
const newsletterRoutes = require('./src/routes/newsletterRoutes');
const campaignRoutes = require('./src/routes/campaignRoutes');
const { seedInitialDataIfEmpty } = require('./seeder');

// Configuration
const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tatva_inox';

// Initialize Express Application
const app = express();

// Security Headers (configured to allow cross-origin image & asset serving)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Disabled for embedded emails / admin preview flexibility
  })
);

// Cross-Origin Resource Sharing
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://tatvainox.com',
  'https://www.tatvainox.com',
  'https://tatvainox.in',
  'https://www.tatvainox.in',
  'https://api.tatvainox.com',
  'https://admin.tatvainox.com',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or email clients)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ensure upload folders & private storage folders exist
const uploadsPath = path.join(__dirname, 'uploads');
['products', 'categories', 'departments', 'banners', 'media'].forEach((sub) => {
  const p = path.join(uploadsPath, sub);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storagePath = path.join(__dirname, 'storage', 'brochures');
if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

// Serve uploaded public files statically (NOTE: brochures in storage/ are NOT served statically, access is gated through /api/brochures/download)
app.use('/uploads', express.static(uploadsPath));

// Health-check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    service: 'Tatva Inox Enterprise API',
    features: [
      'products',
      'departments',
      'banners',
      'categories',
      'brochures',
      'leads',
      'enquiries',
      'dashboard',
      'newsletter',
      'campaigns',
      'email-automation',
      'admin-users',
      'audit-logs'
    ]
  });
});

// Mount Resource Routes
app.use('/api/products', productRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);

// Brochure & Lead Management
app.use('/api/brochures', brochureRoutes);
app.use('/api/leads', leadRoutes);

// Enquiries (Contact, RFQ, Customization)
app.use('/api/enquiries', enquiryRoutes);

// Dashboard Statistics & Reports
app.use('/api/dashboard', dashboardRoutes);

// Admin Users & Audit Logs
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/logs', auditRoutes);

// News & Articles
app.use('/api/articles', articleRoutes);

// Newsletter & Campaign Routes
app.use('/api/newsletter/campaigns', campaignRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Backward-compatible Route Aliases for Admin Panel
app.use('/api/subscribers', newsletterRoutes);
app.use('/api/campaigns', campaignRoutes);

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: `API route '${req.originalUrl}' not found` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Connect to MongoDB Database and Start Server
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`[Database] MongoDB connected successfully to ${MONGO_URI}`);
    await seedInitialDataIfEmpty();
  })
  .catch((err) => {
    console.error('[Database Error] Failed to connect to MongoDB:', err.message);
  });

// Start HTTP Server on HOST (supports 0.0.0.0 or configured host)
const HOST = process.env.HOST || '0.0.0.0';
const server = app
  .listen(PORT, HOST, () => {
    console.log(`[Server] Tatva Inox Backend listening on http://${HOST}:${PORT}`);
    console.log(`[Health Check] Health endpoint: http://${HOST}:${PORT}/api/health`);
    console.log(`[Brochure API] Request endpoint: http://${HOST}:${PORT}/api/brochures/request`);
    console.log(`[Enquiries API] Enquiries endpoint: http://${HOST}:${PORT}/api/enquiries`);
    console.log(`[Uploads] Static file storage: http://${HOST}:${PORT}/uploads`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Port Error] Port ${PORT} on ${HOST} is already in use.`);
    } else {
      console.error(`[Server Error] Failed to start on port ${PORT}:`, err.message);
    }
  });

// Graceful Shutdown
const gracefulShutdown = () => {
  console.log('[Server] Gracefully shutting down Tatva Inox API...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('[Database] MongoDB connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, server };

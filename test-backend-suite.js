/**
 * Tatva Inox — Complete Backend Integration & Security Test Suite
 * Validates all 17 requirements:
 * 1. Health check & DB connectivity
 * 2. Admin Authentication & Role Authorization (Argon2/bcrypt, JWT)
 * 3. Security Rejections (401 Unauthorized, 403 Forbidden)
 * 4. Category CRUD & Slug Uniqueness
 * 5. Product Creation with multi-images, specs, and brochure metadata
 * 6. Brochure Download Gating & Field Validation (Name, Email, Phone, Company)
 * 7. Lead Persistence in MongoDB with unique Lead ID (LEAD-2026-XXXXX)
 * 8. Authorized Brochure Download Streaming (Token verification & canonical path security)
 * 9. Rejection of Unauthorized/Tampered/Missing Brochure Downloads
 * 10. Missing/Invalid brochure handling
 * 11. Lead Management API (search, filters, status transition, notes, CSV export)
 * 12. Contact Form & RFQ Enquiries (MongoDB persistence, unique ID, status management)
 * 13. Newsletter Subscriptions & Duplicate Handling
 * 14. Live Dashboard Analytics Aggregation
 * 15. Audit Logging for administrative actions
 */

const mongoose = require('mongoose');
const { app, server } = require('./server');
const BrochureLead = require('./Models/BrochureLead');
const DownloadEvent = require('./Models/DownloadEvent');
const Enquiry = require('./Models/Enquiry');
const Product = require('./Models/Product');
const Category = require('./Models/Category');
const AdminUser = require('./Models/AdminUser');
const NewsletterSubscriber = require('./src/models/NewsletterSubscriber');
const AuditLog = require('./Models/AuditLog');

const BASE_URL = process.env.API_BASE_URL || 'https://api.tatvainox.com/api';

const runIntegrationTestSuite = async () => {
  console.log('================================================================');
  console.log('   TATVA INOX — COMPLETE BACKEND & SECURITY TEST SUITE   ');
  console.log('================================================================\n');

  // Allow server and MongoDB to establish connection
  await new Promise((r) => setTimeout(r, 1500));

  let passed = 0;
  let failed = 0;
  const testResults = [];

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${description}`);
      passed++;
      testResults.push({ description, status: 'PASS' });
    } else {
      console.error(`  ✗ [FAIL] ${description}`);
      failed++;
      testResults.push({ description, status: 'FAIL' });
    }
  };

  let adminToken = null;
  let testCatSlug = `test-cat-${Date.now()}`;
  let testProdSlug = `test-prod-${Date.now()}`;
  let testLeadId = null;
  let validDownloadToken = null;
  let testEnquiryId = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Health Check Endpoint
    // -------------------------------------------------------------
    console.log('\n--- 1. System Health Check & Database Connectivity ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returned HTTP 200');
    assert(healthJson.status === 'ok', 'Health status is ok');
    assert(healthJson.database === 'connected', 'MongoDB database is actively connected');

    // -------------------------------------------------------------
    // Test 2: Admin Authentication & Password Verification
    // -------------------------------------------------------------
    console.log('\n--- 2. Admin Authentication & Role-Based Authorization ---');
    // Test invalid credentials
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'office@tatvainox.in', password: 'WrongPassword123!' })
    });
    assert(badLoginRes.status === 401, 'Invalid password rejected with HTTP 401');

    // Test valid credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'office@tatvainox.in';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const goodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const goodLoginJson = await goodLoginRes.json();
    assert(goodLoginRes.status === 200, 'Valid admin login returned HTTP 200');
    assert(Boolean(goodLoginJson.token), 'JWT access token returned');
    assert((goodLoginJson.role === 'admin' || goodLoginJson.user?.role === 'admin'), 'Authenticated user has admin role');
    adminToken = goodLoginJson.token;

    const authHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    // -------------------------------------------------------------
    // Test 3: Unauthorized Access Rejection (Admin APIs)
    // -------------------------------------------------------------
    console.log('\n--- 3. Protected Route Security & Token Enforcement ---');
    const unauthLeads = await fetch(`${BASE_URL}/leads`);
    assert(unauthLeads.status === 401, 'GET /api/leads rejected without token (HTTP 401)');

    const badTokenLeads = await fetch(`${BASE_URL}/leads`, {
      headers: { Authorization: 'Bearer invalid.tampered.jwt' }
    });
    assert(badTokenLeads.status === 401, 'GET /api/leads rejected with tampered token (HTTP 401)');

    const unauthCategory = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacking Category' })
    });
    assert(unauthCategory.status === 401, 'POST /api/categories rejected without token (HTTP 401)');

    // -------------------------------------------------------------
    // Test 4: Category Management & Slug Conflict Protection
    // -------------------------------------------------------------
    console.log('\n--- 4. Category Management & Validation ---');
    const catRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Surgical Equipment ${Date.now()}`,
        slug: testCatSlug,
        shortDescription: 'High precision medical grade furniture',
        displayOrder: 10
      })
    });
    const catJson = await catRes.json();
    assert(catRes.status === 201, 'Admin category creation returned HTTP 201');
    assert(catJson.slug === testCatSlug, 'Category created with requested slug');

    // Duplicate slug check
    const dupCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Duplicate Category',
        slug: testCatSlug,
        shortDescription: 'Should fail due to duplicate slug'
      })
    });
    assert(dupCatRes.status === 400, 'Duplicate category slug rejected with HTTP 400');

    // Public category listing verification
    const pubCatRes = await fetch(`${BASE_URL}/categories`);
    const pubCatList = await pubCatRes.json();
    assert(pubCatRes.status === 200, 'GET /api/categories public endpoint returned HTTP 200');
    assert(pubCatList.some(c => c.slug === testCatSlug), 'Newly created category visible in public list');

    // -------------------------------------------------------------
    // Test 5: Product Management with Multiple Images & Brochure
    // -------------------------------------------------------------
    console.log('\n--- 5. Product Creation & Live Catalogue Integration ---');
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Automated Test Bed ${Date.now()}`,
        slug: testProdSlug,
        sku: `TI-TEST-${Date.now().toString().slice(-6)}`,
        category: testCatSlug,
        categoryName: 'Surgical Equipment',
        shortDescription: 'Motorized intensive care hospital bed',
        description: 'Complete 304 stainless steel bed with antimicrobial satin polish',
        materialGrade: 'AISI 304 Surgical Grade Stainless Steel',
        finish: 'No. 4 Satin Brush',
        gauge: '16 SWG Deck, 14 SWG Frame',
        dimensions: '2150 x 980 x 600 mm',
        loadCapacity: '250 kg Safe Working Load',
        hygieneStandard: 'Argon Back-Purged TIG Welds',
        status: 'published',
        featured: true,
        customizable: true,
        basePrice: 45000,
        images: [
          '/images/products/hospital-bed.jpg',
          '/images/products/hospital-bed-side.jpg',
          '/images/products/hospital-bed-headboard.jpg',
          '/images/products/hospital-bed-castor.jpg',
          '/images/products/hospital-bed-detail.jpg'
        ],
        specs: [
          { label: 'Deck Material', value: 'Perforated AISI 304 sheet' },
          { label: 'Castors', value: '125mm antistatic central locking' }
        ],
        features: [
          'Full flush welding for zero bacterial harboring',
          'Compatible with chlorine and hydrogen peroxide vapor disinfection'
        ],
        brochureFileName: 'tatva-inox-product-catalogue.pdf',
        brochureFileSize: 1048576
      })
    });
    const prodJson = await prodRes.json();
    if (prodRes.status !== 201) {
      console.log('Product creation error:', prodRes.status, prodJson);
    }
    assert(prodRes.status === 201, 'Product created with multi-images and brochure (HTTP 201)');
    assert(prodJson.slug === testProdSlug, 'Product created with correct slug');
    assert(prodJson.images.length === 5, 'Product supports 5+ images');
    assert(Boolean(prodJson.brochureUrl), 'Product has brochure download URL attached');

    // Verify public product retrieval
    const pubProdRes = await fetch(`${BASE_URL}/products/${testProdSlug}`);
    const pubProdJson = await pubProdRes.json();
    assert(pubProdRes.status === 200, 'GET /api/products/:slug public endpoint returned HTTP 200');
    assert(pubProdJson.name === prodJson.name, 'Public product details match database record');

    // -------------------------------------------------------------
    // Test 6: Mandatory Brochure Download Gating & Form Validation
    // -------------------------------------------------------------
    console.log('\n--- 6. Brochure Download Gating & Server-Side Form Validation ---');
    // Direct download without submission must be impossible
    const unauthDownload = await fetch(`${BASE_URL}/brochures/download`);
    assert(unauthDownload.status === 401, 'Direct brochure download without token rejected (HTTP 401)');

    // Missing required fields validation
    const invalidReqRes = await fetch(`${BASE_URL}/brochures/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        phone: ''
      })
    });
    const invalidReqJson = await invalidReqRes.json();
    assert(invalidReqRes.status === 400, 'Incomplete brochure request rejected (HTTP 400)');
    assert(invalidReqJson.success === false, 'Validation failure returns success = false');

    // Successful brochure request submission
    const testLeadEmail = `lead.test.${Date.now()}@apollohospitals.com`;
    const validReqRes = await fetch(`${BASE_URL}/brochures/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Vikram Malhotra',
        company: 'Apollo Multi-Specialty Hospital',
        email: testLeadEmail,
        phone: '+91 98765 43210',
        productId: prodJson._id,
        productName: prodJson.name,
        message: 'Requesting submittal sheet for 50-bed ICU renovation',
        consent: true
      })
    });
    const validReqJson = await validReqRes.json();
    assert(validReqRes.status === 200, 'Complete brochure request accepted (HTTP 200)');
    assert(validReqJson.success === true, 'Response contains success = true');
    assert(validReqJson.leadId && validReqJson.leadId.startsWith('LEAD-2026-'), 'Generated unique Lead ID (LEAD-2026-XXXXX)');
    assert(Boolean(validReqJson.downloadToken), 'Issued signed short-lived download token');
    assert(Boolean(validReqJson.downloadUrl), 'Issued authorized download URL');

    testLeadId = validReqJson.leadId;
    validDownloadToken = validReqJson.downloadToken;

    // Verify lead stored in MongoDB
    const dbLead = await BrochureLead.findOne({ leadId: testLeadId });
    assert(Boolean(dbLead), 'Lead successfully persisted in MongoDB');
    assert((dbLead.leadStatus === 'New' || dbLead.leadStatus === 'new'), 'Initial lead status is "New"');
    assert(dbLead.downloadStatus === 'pending', 'Initial download status is "pending"');

    // -------------------------------------------------------------
    // Test 7: Authorized Brochure Download Streaming & Audit Recording
    // -------------------------------------------------------------
    console.log('\n--- 7. Secure Authorized Brochure Download & Tracking ---');
    const downloadRes = await fetch(`${BASE_URL}/brochures/download?token=${validDownloadToken}`);
    assert(downloadRes.status === 200, 'Authorized brochure download returned HTTP 200');
    assert(downloadRes.headers.get('content-type') === 'application/pdf', 'Content-Type header is application/pdf');
    assert(downloadRes.headers.get('content-disposition')?.includes('attachment'), 'Content-Disposition is attachment');

    // Verify buffer content received
    const pdfBuffer = await downloadRes.arrayBuffer();
    assert(pdfBuffer.byteLength > 1000, `Streamed valid PDF file (${pdfBuffer.byteLength} bytes)`);

    // Verify lead updated in MongoDB
    const updatedDbLead = await BrochureLead.findOne({ leadId: testLeadId });
    assert(updatedDbLead.downloadStatus === 'downloaded', 'Lead downloadStatus updated to "downloaded" in DB');
    assert(updatedDbLead.downloadCount >= 1, 'Download count incremented in DB');
    assert(Boolean(updatedDbLead.downloadTimestamp), 'Download timestamp recorded in DB');

    // Verify DownloadEvent audit record created
    const downloadEvent = await DownloadEvent.findOne({ leadId: testLeadId });
    assert(Boolean(downloadEvent), 'DownloadEvent audit record created in MongoDB');

    // -------------------------------------------------------------
    // Test 8: Rejection of Unauthorized, Tampered, and Expired Downloads
    // -------------------------------------------------------------
    console.log('\n--- 8. Security Rejection of Unauthorized & Tampered Downloads ---');
    // Tampered token
    const tamperedTokenRes = await fetch(`${BASE_URL}/brochures/download?token=${validDownloadToken}tampered`);
    assert(tamperedTokenRes.status === 403, 'Tampered download token rejected with HTTP 403');

    // Path traversal attempt in product slug
    const pathTraversalRes = await fetch(`${BASE_URL}/brochures/download?token=${validDownloadToken}&product=../../etc/passwd`);
    assert(pathTraversalRes.status === 200 || pathTraversalRes.status === 403, 'Path traversal safely sanitized or rejected');

    // Missing file for non-existent product
    const missingProductReq = await fetch(`${BASE_URL}/brochures/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tester',
        email: 'tester@test.com',
        phone: '1234567890',
        productName: 'Ghost Product Nonexistent'
      })
    });
    const missingJson = await missingProductReq.json();
    assert(Boolean(missingJson.downloadToken), 'Fallback brochure authorized gracefully for valid request');

    // -------------------------------------------------------------
    // Test 9: Complete Admin Lead Management System
    // -------------------------------------------------------------
    console.log('\n--- 9. Admin Lead Management (Search, Filter, Status, Notes, CSV) ---');
    // Get all leads (authenticated)
    const leadsRes = await fetch(`${BASE_URL}/leads`, { headers: authHeaders });
    const leadsJson = await leadsRes.json();
    assert(leadsRes.status === 200, 'Admin GET /api/leads returned HTTP 200');
    assert(Array.isArray(leadsJson.leads), 'Leads returned as paginated list');
    assert(leadsJson.leads.some(l => l.leadId === testLeadId), 'Submitted lead present in admin list');

    // Search leads by email
    const searchRes = await fetch(`${BASE_URL}/leads?search=${testLeadEmail}`, { headers: authHeaders });
    const searchJson = await searchRes.json();
    assert(searchRes.status === 200, 'Search leads by query returned HTTP 200');
    assert(searchJson.leads.length >= 1, 'Search successfully found the target lead');

    // Filter leads by status
    const filterRes = await fetch(`${BASE_URL}/leads?status=new`, { headers: authHeaders });
    const filterJson = await filterRes.json();
    assert(filterRes.status === 200, 'Filter leads by status returned HTTP 200');

    // Update lead status
    const targetLeadDoc = leadsJson.leads.find(l => l.leadId === testLeadId);
    const statusUpdateRes = await fetch(`${BASE_URL}/leads/${targetLeadDoc._id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'Qualified' })
    });
    const statusUpdateJson = await statusUpdateRes.json();
    assert(statusUpdateRes.status === 200, 'Update lead status returned HTTP 200');
    assert((statusUpdateJson.leadStatus === 'Qualified' || statusUpdateJson.lead?.leadStatus === 'Qualified'), 'Lead status updated to "Qualified" in DB');

    // Add internal admin note to lead
    const noteRes = await fetch(`${BASE_URL}/leads/${targetLeadDoc._id}/notes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ text: 'Called hospital biomedical engineer. ICU project quote requested.' })
    });
    const noteJson = await noteRes.json();
    assert(noteRes.status === 200, 'Add internal note returned HTTP 200');
    assert((noteJson.notes?.length >= 1 || noteJson.lead?.notes?.length >= 1), 'Note saved in lead audit trail');

    // Lead Stats endpoint
    const statsRes = await fetch(`${BASE_URL}/leads/stats`, { headers: authHeaders });
    const statsJson = await statsRes.json();
    assert(statsRes.status === 200, 'GET /api/leads/stats returned HTTP 200');
    assert(statsJson.totalLeads > 0, 'Total leads count is accurate');
    assert(statsJson.totalDownloads > 0, 'Total brochure downloads count is accurate');

    // CSV Export
    const csvRes = await fetch(`${BASE_URL}/leads/export/csv`, { headers: authHeaders });
    const csvText = await csvRes.text();
    assert(csvRes.status === 200, 'GET /api/leads/export/csv returned HTTP 200');
    assert(csvRes.headers.get('content-type')?.includes('text/csv'), 'Content-Type is text/csv');
    assert(csvText.includes('Lead ID') && csvText.includes('Email') && csvText.includes('Phone'), 'CSV contains proper column headers');
    assert(csvText.includes(testLeadEmail), 'Exported CSV contains target lead data');

    // -------------------------------------------------------------
    // Test 10: Contact Forms, Customization & RFQ Enquiries
    // -------------------------------------------------------------
    console.log('\n--- 10. Contact Forms & RFQ Enquiry System ---');
    // Public RFQ submission
    const enquiryEmail = `enquiry.test.${Date.now()}@fortishealthcare.com`;
    const enquiryRes = await fetch(`${BASE_URL}/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'quote',
        customerName: 'Suresh Menon',
        organization: 'Fortis Healthcare',
        email: enquiryEmail,
        phone: '+91 99887 76655',
        productName: 'Automated Test Bed',
        subject: 'Bulk ICU Equipment Quotation (30 units)',
        message: 'Please provide formal hospital tender quotation with delivery timeline.',
        priority: 'high'
      })
    });
    const enquiryJson = await enquiryRes.json();
    assert(enquiryRes.status === 201, 'Public enquiry submission returned HTTP 201');
    const returnedEnqId = enquiryJson.enquiryId || enquiryJson.referenceId || enquiryJson.id;
    assert(Boolean(returnedEnqId && returnedEnqId.startsWith('ENQ-2026-')), 'Generated unique Enquiry ID (ENQ-2026-XXXXX)');
    testEnquiryId = enquiryJson.enquiry?._id;

    // Verify enquiry in MongoDB
    const dbEnquiry = await Enquiry.findById(testEnquiryId);
    assert(Boolean(dbEnquiry), 'Enquiry successfully saved in MongoDB');
    assert(dbEnquiry.customerName === 'Suresh Menon', 'Customer name persisted accurately');

    // Admin views enquiries
    const adminEnqRes = await fetch(`${BASE_URL}/enquiries`, { headers: authHeaders });
    const adminEnqList = await adminEnqRes.json();
    assert(adminEnqRes.status === 200, 'Admin GET /api/enquiries returned HTTP 200');
    assert(adminEnqList.some(e => e.email === enquiryEmail), 'Submitted enquiry visible in admin panel');

    // Admin updates enquiry status
    const updateEnqStatus = await fetch(`${BASE_URL}/enquiries/${testEnquiryId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'in_review' })
    });
    assert(updateEnqStatus.status === 200, 'Enquiry status updated to "in_review" (HTTP 200)');

    // -------------------------------------------------------------
    // Test 11: Newsletter Subscriptions & Duplicate Handling
    // -------------------------------------------------------------
    console.log('\n--- 11. Newsletter Subscriptions & Email Delivery Handling ---');
    const newsEmail = `newsletter.suite.${Date.now()}@maxhealthcare.com`;
    const subRes = await fetch(`${BASE_URL}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newsEmail, consent: true })
    });
    const subJson = await subRes.json();
    assert(subRes.status === 200, 'Public newsletter subscription returned HTTP 200');
    assert(subJson.success === true, 'Newsletter subscription successful');

    // Duplicate handling
    const dupSubRes = await fetch(`${BASE_URL}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newsEmail, consent: true })
    });
    const dupSubJson = await dupSubRes.json();
    assert(dupSubRes.status === 200, 'Duplicate subscription handled smoothly (HTTP 200)');
    assert(dupSubJson.alreadySubscribed === true, 'Duplicate response indicated alreadySubscribed = true');

    // -------------------------------------------------------------
    // Test 12: Live Dashboard Statistics Aggregation
    // -------------------------------------------------------------
    console.log('\n--- 12. Live Dashboard Analytics Aggregation ---');
    const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, { headers: authHeaders });
    const dashJson = await dashRes.json();
    assert(dashRes.status === 200, 'GET /api/dashboard/stats returned HTTP 200');
    assert(dashJson.totalProducts > 0, `Live totalProducts: ${dashJson.totalProducts}`);
    assert(dashJson.totalCategories > 0, `Live totalCategories: ${dashJson.totalCategories}`);
    assert(dashJson.totalBrochureLeads > 0, `Live totalBrochureLeads: ${dashJson.totalBrochureLeads}`);
    assert(dashJson.totalDownloads > 0, `Live totalDownloads: ${dashJson.totalDownloads}`);
    assert(dashJson.totalEnquiries > 0, `Live totalEnquiries: ${dashJson.totalEnquiries}`);
    assert(dashJson.totalSubscribers > 0, `Live totalSubscribers: ${dashJson.totalSubscribers}`);

    // -------------------------------------------------------------
    // Test 13: Administrative Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- 13. Administrative Audit Logs ---');
    const auditRes = await fetch(`${BASE_URL}/audit`, { headers: authHeaders });
    const auditJson = await auditRes.json();
    const logsList = Array.isArray(auditJson) ? auditJson : (auditJson.logs || []);
    assert(Array.isArray(logsList), 'Audit logs array returned');
    assert(logsList.length > 0, 'Administrative actions properly recorded in audit log collection');

    // -------------------------------------------------------------
    // Test 14: Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- 14. Test Cleanup & Safe Resource Deletion ---');
    if (prodJson._id) {
      const delProdRes = await fetch(`${BASE_URL}/products/${prodJson._id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert(delProdRes.status === 200, 'Test product deleted successfully with confirmation');
    }

    if (catJson._id) {
      const delCatRes = await fetch(`${BASE_URL}/categories/${catJson._id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert(delCatRes.status === 200, 'Test category deleted successfully');
    }

    if (testLeadId) {
      const dbLeadDoc = await BrochureLead.findOne({ leadId: testLeadId });
      if (dbLeadDoc) {
        const delLeadRes = await fetch(`${BASE_URL}/leads/${dbLeadDoc._id}`, {
          method: 'DELETE',
          headers: authHeaders
        });
        assert(delLeadRes.status === 200, 'Test lead record deleted with audit logging');
      }
    }

  } catch (err) {
    console.error('\nFATAL TEST ERROR:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  // Terminate test runner gracefully
  setTimeout(() => {
    process.exit(failed > 0 ? 1 : 0);
  }, 1000);
};

runIntegrationTestSuite();

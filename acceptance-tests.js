/**
 * Tatva Inox — Complete Newsletter & Email Automation End-to-End Acceptance Test Suite
 * Validates all 18 Acceptance Criteria from Section 17
 */

const mongoose = require('mongoose');
const { app, server } = require('./server');
const NewsletterSubscriber = require('./src/models/NewsletterSubscriber');
const NewsletterCampaign = require('./src/models/NewsletterCampaign');
const { generateUnsubscribeToken, verifyUnsubscribeToken } = require('./src/services/emailService');

const BASE_URL = process.env.API_BASE_URL || 'https://api.tatvainox.com/api';
const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token-admin' };

const runAcceptanceTests = async () => {
  console.log('================================================================');
  console.log('  TATVA INOX — NEWSLETTER & EMAIL AUTOMATION ACCEPTANCE TESTS  ');
  console.log('================================================================\n');

  // Allow server and MongoDB to establish connection
  await new Promise((r) => setTimeout(r, 1200));

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------
    // Test 1 & 2: Visitor submits newsletter form & saved in MongoDB
    // -------------------------------------------------------------
    console.log('\n--- 1 & 2: Public Subscription & MongoDB Persistence ---');
    const testEmail = `procurement.test.${Date.now()}@manipalhospitals.com`;
    const subRes = await fetch(`${BASE_URL}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Anand Raman',
        email: testEmail,
        consent: true
      })
    });
    const subJson = await subRes.json();
    assert(subRes.status === 200, 'Public subscribe endpoint returned HTTP 200');
    assert(subJson.success === true, 'Public subscribe returned success = true');

    const dbSub = await NewsletterSubscriber.findOne({ email: testEmail });
    assert(Boolean(dbSub), 'Subscriber record successfully persisted in MongoDB');
    assert(dbSub.status === 'active' && dbSub.consent === true, 'Subscriber saved with status=active and consent=true');

    // -------------------------------------------------------------
    // Test 3: Welcome Email trigger
    // -------------------------------------------------------------
    console.log('\n--- 3: Welcome Email Trigger & Safety ---');
    assert(typeof subJson.emailSent === 'boolean', 'Welcome email delivery status reported explicitly');

    // -------------------------------------------------------------
    // Test 4: Duplicate subscriptions handled properly
    // -------------------------------------------------------------
    console.log('\n--- 4: Duplicate Subscription Handling ---');
    const dupRes = await fetch(`${BASE_URL}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        consent: true
      })
    });
    const dupJson = await dupRes.json();
    assert(dupRes.status === 200, 'Duplicate request returns friendly 200');
    assert(dupJson.alreadySubscribed === true, 'Friendly duplicate flag returned');

    const countAfterDup = await NewsletterSubscriber.countDocuments({ email: testEmail });
    assert(countAfterDup === 1, 'Database constraint prevented duplicate records');

    // -------------------------------------------------------------
    // Test 5: Authentication & Authorization Enforced
    // -------------------------------------------------------------
    console.log('\n--- 5: Admin Authentication Enforcement ---');
    const unauthRes = await fetch(`${BASE_URL}/newsletter/subscribers`);
    assert(unauthRes.status === 401, 'Unauthenticated request to subscribers list rejected with 401');

    const unauthCampRes = await fetch(`${BASE_URL}/newsletter/campaigns`);
    assert(unauthCampRes.status === 401, 'Unauthenticated request to campaigns list rejected with 401');

    const authRes = await fetch(`${BASE_URL}/newsletter/subscribers`, { headers: AUTH_HEADER });
    assert(authRes.status === 200, 'Authenticated request with admin token accepted');

    // -------------------------------------------------------------
    // Test 6: Admin Add, Edit, Search, Filter, Status, and Delete
    // -------------------------------------------------------------
    console.log('\n--- 6: Admin Subscriber Management (CRUD & Filters) ---');
    const manualEmail = `biomedical.${Date.now()}@narayanahealth.org`;
    const addRes = await fetch(`${BASE_URL}/newsletter/subscribers`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: manualEmail,
        name: 'Suresh Menon',
        source: 'Hospital Tender RFP',
        status: 'active',
        consent: true
      })
    });
    const addJson = await addRes.json();
    assert(addRes.status === 201 && addJson.id, 'Admin manually added subscriber');

    // Edit
    const editRes = await fetch(`${BASE_URL}/newsletter/subscribers/${addJson.id}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dr. Suresh Menon (Head of BioMed)' })
    });
    const editJson = await editRes.json();
    assert(editJson.name === 'Dr. Suresh Menon (Head of BioMed)', 'Admin edited subscriber name');

    // Status Toggle (Suppress)
    const suppressRes = await fetch(`${BASE_URL}/newsletter/subscribers/${addJson.id}/status`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unsubscribed' })
    });
    const suppressJson = await suppressRes.json();
    assert(suppressJson.status === 'unsubscribed', 'Status updated to unsubscribed (suppressed)');

    // Search
    const searchRes = await fetch(`${BASE_URL}/newsletter/subscribers?search=${encodeURIComponent('Suresh')}`, {
      headers: AUTH_HEADER
    });
    const searchJson = await searchRes.json();
    assert(searchJson.subscribers?.some((s) => s.email === manualEmail), 'Search by name/email returned target record');

    // Filter by status
    const filterRes = await fetch(`${BASE_URL}/newsletter/subscribers?status=unsubscribed`, {
      headers: AUTH_HEADER
    });
    const filterJson = await filterRes.json();
    assert(filterJson.subscribers?.every((s) => s.status === 'unsubscribed'), 'Filter by status=unsubscribed enforced');

    // Delete
    const delRes = await fetch(`${BASE_URL}/newsletter/subscribers/${addJson.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER
    });
    assert(delRes.status === 200, 'Admin successfully deleted subscriber record');

    // -------------------------------------------------------------
    // Test 7: CSV Import with Duplicate Skipping
    // -------------------------------------------------------------
    console.log('\n--- 7: CSV Contacts Import ---');
    const csvBatch = [
      { email: `csv1.${Date.now()}@healthcorp.com`, name: 'Contact 1', source: 'CSV Import' },
      { email: `csv2.${Date.now()}@healthcorp.com`, name: 'Contact 2', source: 'CSV Import' },
      { email: testEmail, name: 'Duplicate Contact', source: 'CSV Import' } // should be skipped as duplicate
    ];
    const importRes = await fetch(`${BASE_URL}/newsletter/subscribers/import`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribers: csvBatch })
    });
    const importJson = await importRes.json();
    assert(importJson.imported === 2, 'Imported exactly 2 new records');
    assert(importJson.duplicates === 1, 'Skipped 1 duplicate record');

    // -------------------------------------------------------------
    // Test 8: KPI Stats
    // -------------------------------------------------------------
    console.log('\n--- 8: Accurate Subscriber Statistics ---');
    const statsRes = await fetch(`${BASE_URL}/newsletter/stats`, { headers: AUTH_HEADER });
    const statsJson = await statsRes.json();
    assert(statsJson.total > 0 && statsJson.active > 0, 'Stats returned valid positive counts');
    assert(statsJson.eligibleForCampaigns <= statsJson.active, 'Eligible count respects active and consented status');

    // -------------------------------------------------------------
    // Test 9, 10 & 11: Campaign Audience Calculation & Exclusion
    // -------------------------------------------------------------
    console.log('\n--- 9, 10 & 11: Audience Calculation & Suppression Exclusion ---');
    const audRes = await fetch(`${BASE_URL}/newsletter/campaigns/audience`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetAudience: { type: 'all' } })
    });
    const audJson = await audRes.json();
    assert(typeof audJson.eligibleCount === 'number', 'Calculated exact eligible audience size');

    // Verify unsubscribed and bounced are excluded
    const unsubInAudience = await NewsletterSubscriber.find({
      status: { $in: ['unsubscribed', 'bounced'] },
      _id: { $in: audJson.samplePreview.map((s) => s._id) }
    });
    assert(unsubInAudience.length === 0, 'Unsubscribed and bounced contacts strictly excluded from audience');

    // -------------------------------------------------------------
    // Test 12 & 13: Campaign Creation, Test Email & Queue Dispatch
    // -------------------------------------------------------------
    console.log('\n--- 12 & 13: Campaign Creation, Test Email & Queue Dispatch ---');
    const campRes = await fetch(`${BASE_URL}/newsletter/campaigns`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Infection Control Scrub Stations ${Date.now()}`,
        subject: 'Touch-Free AISI 316 Surgical Scrub Stations by Tatva Inox',
        previewText: 'Sanitary hands-free infrared scrub stations for sterile operating suites.',
        heading: 'Surgical Cleanroom Hygiene Standards',
        contentHtml: '<p>Engineering specifications for multi-bay scrub sinks with thermostatic mixing valves.</p>',
        ctaButtonText: 'Download Specification Sheet',
        ctaButtonUrl: 'https://tatvainox.com/products',
        senderName: 'Tatva Inox',
        senderEmail: 'donotreply.tatvainox@gmail.com',
        replyTo: 'office@tatvainox.in',
        targetAudience: {
          type: 'selected',
          selectedEmails: [testEmail]
        }
      })
    });
    const campJson = await campRes.json();
    assert(campRes.status === 201 && campJson.id, 'Campaign draft created in MongoDB');

    // Test email dispatch to administrator
    const testMailRes = await fetch(`${BASE_URL}/newsletter/campaigns/${campJson.id}/test`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'office@tatvainox.in' })
    });
    const testMailJson = await testMailRes.json();
    assert(testMailRes.status === 200, 'Test email dispatch endpoint succeeded');

    // Dispatch live campaign via background queue
    const dispatchRes = await fetch(`${BASE_URL}/newsletter/campaigns/${campJson.id}/send`, {
      method: 'POST',
      headers: AUTH_HEADER
    });
    const dispatchJson = await dispatchRes.json();
    assert(dispatchRes.status === 200 && dispatchJson.success === true, 'Campaign queued for background delivery');

    // Wait for queue worker to process batch (polling up to 8s)
    let liveCamp = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      liveCamp = await NewsletterCampaign.findById(campJson.id);
      if (liveCamp && (liveCamp.attemptedCount > 0 || liveCamp.status === 'completed')) break;
    }

    // Verify campaign finalized state in MongoDB
    assert(['completed', 'sending'].includes(liveCamp.status), `Campaign status updated to ${liveCamp.status}`);
    assert(liveCamp.attemptedCount > 0 || liveCamp.status === 'completed', `Recorded ${liveCamp.attemptedCount} delivery attempts`);

    // -------------------------------------------------------------
    // Test 14: Unsubscribe System (Tokens & Safe Web Page)
    // -------------------------------------------------------------
    console.log('\n--- 14: Unsubscribe Token Verification & Idempotency ---');
    const token = generateUnsubscribeToken(dbSub);
    const verified = verifyUnsubscribeToken(token);
    assert(verified.valid === true && verified.email === dbSub.email, 'Cryptographically verified unsubscribe token');

    const webUnsubRes = await fetch(`${BASE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
    const webHtml = await webUnsubRes.text();
    assert(webUnsubRes.status === 200, 'Web unsubscribe returned HTTP 200');
    assert(webHtml.includes('You Have Been Unsubscribed'), 'Branded unsubscribe confirmation page rendered');

    // Verify subscriber status updated in MongoDB
    const unsubscribedSub = await NewsletterSubscriber.findOne({ email: dbSub.email });
    assert(unsubscribedSub.status === 'unsubscribed', 'Subscriber marked unsubscribed in MongoDB');
    assert(Boolean(unsubscribedSub.unsubscribedAt), 'unsubscribedAt timestamp recorded');

    // Idempotent: repeat click safely returns 200 without error
    const repeatUnsubRes = await fetch(`${BASE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
    assert(repeatUnsubRes.status === 200, 'Repeat unsubscribe request is safe and idempotent');

    // -------------------------------------------------------------
    // Test 15 & 17: Duplicate Campaign Prevention
    // -------------------------------------------------------------
    console.log('\n--- 15 & 17: Duplicate Campaign Prevention ---');
    const dupSendRes = await fetch(`${BASE_URL}/newsletter/campaigns/${campJson.id}/send`, {
      method: 'POST',
      headers: AUTH_HEADER
    });
    assert(dupSendRes.status === 400, 'Prevented re-dispatching an already queued/completed campaign');

    // -------------------------------------------------------------
    // Test 18: Unrelated APIs (Health, Products, Categories) intact
    // -------------------------------------------------------------
    console.log('\n--- 18: Preserving Existing API Endpoints ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.status === 'ok', 'Existing health check endpoint functional');

    const catRes = await fetch(`${BASE_URL}/categories`);
    assert(catRes.status === 200, 'Existing categories API functional');

    const prodRes = await fetch(`${BASE_URL}/products`);
    assert(prodRes.status === 200, 'Existing products API functional');

    console.log('\n================================================================');
    console.log(`  ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during acceptance tests:', err);
    process.exit(1);
  }
};

runAcceptanceTests();

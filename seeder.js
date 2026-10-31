const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const Category = require('./Models/Category');
const Department = require('./Models/Department');
const Banner = require('./Models/Banner');
const Product = require('./Models/Product');
const AdminUser = require('./Models/AdminUser');
const BrochureLead = require('./Models/BrochureLead');
const DownloadEvent = require('./Models/DownloadEvent');
const Enquiry = require('./Models/Enquiry');
const Article = require('./Models/Article');
const AuditLog = require('./Models/AuditLog');
const NewsletterSubscriber = require('./src/models/NewsletterSubscriber');
const NewsletterCampaign = require('./src/models/NewsletterCampaign');
const seedData = require('./seedData.json');

const initialSubscribers = [
  {
    email: 'office@tatvainox.in',
    name: 'Tatva Inox Desk',
    status: 'active',
    source: 'Direct Admin Entry',
    consent: true,
    consentedAt: new Date('2026-01-01'),
    subscribedAt: new Date('2026-01-01')
  },
  {
    email: 'gowdahanish183@gmail.com',
    name: 'Hanish',
    status: 'active',
    source: 'Website Footer',
    consent: true,
    consentedAt: new Date('2026-01-01'),
    subscribedAt: new Date('2026-01-01')
  },
  {
    email: 'director.procurement@fortishealthcare.com',
    name: 'Dr. Vivek Saxena',
    status: 'unsubscribed',
    source: 'Website Footer',
    consent: false,
    consentedAt: new Date('2025-12-01'),
    subscribedAt: new Date('2025-12-01')
  },
  {
    email: 'biomedical.head@aiims.edu',
    name: 'Prof. Anirudh Sen',
    status: 'unsubscribed',
    source: 'Product Enquiry',
    consent: false,
    consentedAt: new Date('2025-12-14'),
    subscribedAt: new Date('2025-12-14')
  },
  {
    email: 'facilities@columbiaasia.org',
    name: 'Naveen Joseph',
    status: 'unsubscribed',
    source: 'CSV Import',
    consent: false,
    consentedAt: new Date('2026-01-05'),
    subscribedAt: new Date('2026-01-05')
  }
];

const initialCampaigns = [
  {
    name: 'Q1 Healthcare Equipment Showcase & Price Freeze',
    subject: 'Tatva Inox: 2026 Surgical & Ward Stainless Steel Catalogue + Institutional Rates',
    previewText: 'Discover our certified AISI 304/316 medical furniture range engineered for infection control.',
    heading: '2026 Clinical Equipment Catalogue Announcement',
    contentHtml: `
      <p>Dear Healthcare Administrator & Clinical Partner,</p>
      <p>We are proud to present our comprehensive range of AISI 304 and 316 surgical furniture, designed strictly in accordance with modern hospital infection control guidelines.</p>
    `,
    ctaButtonText: 'Explore Hospital Catalogue',
    ctaButtonUrl: 'https://tatvainox.com/products',
    senderName: 'Tatva Inox Healthcare Solutions',
    senderEmail: 'donotreply.tatvainox@gmail.com',
    replyTo: 'office@tatvainox.in',
    targetAudience: { type: 'all' },
    status: 'completed',
    sentAt: new Date('2026-02-15T09:30:00Z'),
    completedAt: new Date('2026-02-15T09:35:00Z'),
    recipientsCount: 6,
    attemptedCount: 6,
    acceptedCount: 6,
    failedCount: 0,
    skippedCount: 0,
    openRate: 46.8,
    clickRate: 18.2
  }
];

const initialEnquiries = [
  {
    id: 'ENQ-2026-088',
    type: 'custom_fabrication',
    customerName: 'Dr. Vivek Saxena',
    email: 'director.procurement@fortishealthcare.com',
    phone: '+91 98450 11223',
    organization: 'Fortis Hospital Bannerghatta',
    subject: 'Bespoke 316 Stainless Steel OT Instrument Wash Station',
    message: 'We require 4 units of custom multi-bay surgical instrument washing sinks with hands-free knee-operated valves and integrated drying racks.',
    productId: 'touch-free-sensor-surgical-scrub-sink',
    productName: 'Touch-Free Sensor Surgical Scrub Sink',
    status: 'new',
    priority: 'high',
    assignedTo: 'Vikram Mehta',
    createdAt: new Date('2026-02-20T10:30:00Z'),
    notes: [
      {
        id: 'note-01',
        text: 'Initial procurement inquiry received for Fortis OT expansion project.',
        author: 'System',
        date: new Date('2026-02-20T10:30:00Z')
      }
    ]
  },
  {
    id: 'ENQ-2026-087',
    type: 'product_quote',
    customerName: 'Kavita Chawla',
    email: 'supplychain@maxhealthcare.com',
    phone: '+91 97110 33445',
    organization: 'Max Super Speciality Hospital, Saket',
    subject: 'Quotation for 25 Units 2-Tier Instrument Trolleys',
    message: 'Need institutional quotation for 25 units of AISI 304 2-tier surgical trolleys with 100mm antistatic castors for delivery to New Delhi facility.',
    productId: '2-tier-stainless-steel-instrument-trolley',
    productName: '2-Tier Stainless Steel Instrument Trolley',
    quantity: 25,
    status: 'in_review',
    priority: 'medium',
    assignedTo: 'Ananya Verma',
    createdAt: new Date('2026-02-18T14:15:00Z'),
    notes: []
  }
];

const initialArticles = [
  {
    id: 'art-01',
    title: 'AISI 304 vs AISI 316: Metallurgy and Corrosion Resistance in Hospital Furniture',
    slug: 'aisi-304-vs-316-hospital-stainless-steel',
    category: 'Material Science',
    date: 'February 10, 2026',
    readTime: '6 min read',
    excerpt: 'Detailed metallurgical analysis of austenitic stainless steels in surgical cleanrooms and resistance to aggressive hospital sterilants.',
    content: 'Austenitic stainless steels form the backbone of modern clinical infection prevention...',
    image: '/images/products/scrub-sink.jpg',
    status: 'published',
    views: 1420
  },
  {
    id: 'art-02',
    title: 'Zero-Crevice Sanitary Argon TIG Welding Standards for Clinical Equipment',
    slug: 'sanitary-argon-tig-welding-clinical-standards',
    category: 'Fabrication Engineering',
    date: 'January 28, 2026',
    readTime: '8 min read',
    excerpt: 'How crevice-free argon-purged TIG welds prevent bacterial biofilm formation and pass rigorous hospital hygiene protocols.',
    content: 'Microbial bio-burden in operating rooms often takes refuge in micro-crevices...',
    image: '/images/products/surgical-prep-table.jpg',
    status: 'published',
    views: 980
  }
];

const initialLeads = [
  {
    leadId: 'LEAD-2026-10492',
    name: 'Dr. Ramesh Kulkarni',
    company: 'Manipal Hospitals Whitefield',
    email: 'ramesh.kulkarni@manipalhospitals.com',
    phone: '+91 98450 77123',
    productId: 'touch-free-sensor-surgical-scrub-sink',
    productName: 'Touch-Free Sensor Surgical Scrub Sink',
    brochureName: 'tatva-inox-product-catalogue.pdf',
    message: 'Evaluating scrub stations for 6 new OT suites.',
    consent: true,
    leadSource: 'product_page',
    downloadStatus: 'downloaded',
    downloadCount: 2,
    downloadTimestamp: new Date('2026-02-22T11:05:00Z'),
    leadStatus: 'Qualified',
    notes: [
      {
        id: 'note-01',
        text: 'Customer downloaded scrub sink technical drawings. High intent buyer.',
        author: 'System',
        date: new Date('2026-02-22T11:05:00Z')
      }
    ],
    createdAt: new Date('2026-02-22T11:00:00Z')
  },
  {
    leadId: 'LEAD-2026-10491',
    name: 'Priya Sundaram',
    company: 'Apollo Cradle & Children Hospital',
    email: 'priya.sundaram@apollo.com',
    phone: '+91 99887 66554',
    productId: 'general',
    productName: 'Tatva Inox Hospital Furniture Master Catalogue',
    brochureName: 'tatva-inox-product-catalogue.pdf',
    message: 'Need catalogue for annual procurement planning.',
    consent: true,
    leadSource: 'website_brochure_modal',
    downloadStatus: 'downloaded',
    downloadCount: 1,
    downloadTimestamp: new Date('2026-02-21T09:12:00Z'),
    leadStatus: 'Contacted',
    notes: [],
    createdAt: new Date('2026-02-21T09:10:00Z')
  }
];

const initialBanners = [
  {
    title: 'AISI 304 ICU Electric Hospital Bed',
    subtitle: 'Critical Care Patient Engineering',
    description: 'Engineered with anti-microbial non-directional satin brush finish, zero fluid accumulation crevice-free TIG welds, and collapsible dual safety guardrails.',
    image: '/images/products/hospital-bed.jpg',
    badge: 'Featured Innovation',
    ctaText: 'View Details',
    ctaLink: '/products/ss-icu-patient-bed-hydraulic',
    displayOrder: 1,
    status: 'active',
    intervalSeconds: 5
  },
  {
    title: 'Modular Surgical Instrument Trolleys',
    subtitle: 'Sterile Operating Suite Mobility',
    description: 'Dual and triple-tier medical-grade AISI 304 stainless steel trolleys with 3-sided guard rails and anti-static noiseless swivel castors.',
    image: '/images/products/instrument-trolley.jpg',
    badge: 'Operation Theatre',
    ctaText: 'Explore Trolleys',
    ctaLink: '/products/ss-two-tier-instrument-trolley',
    displayOrder: 2,
    status: 'active',
    intervalSeconds: 5
  },
  {
    title: 'Touch-Free Dual-Bay Scrub Station',
    subtitle: 'Aseptic Infection Control & CSSD',
    description: 'Surgical scrub sinks featuring hands-free infrared optical sensors, thermostatic mixing valves, and seamless deep-drawn splashback basins.',
    image: '/images/products/scrub-sink.jpg',
    badge: 'Sanitary Excellence',
    ctaText: 'View Scrub Stations',
    ctaLink: '/products/ss-surgical-scrub-sink-two-bay',
    displayOrder: 3,
    status: 'active',
    intervalSeconds: 5
  },
  {
    title: 'Dynamic Cleanroom Pass-Through Box',
    subtitle: 'Sterile Corridor Transfer Systems',
    description: 'HEPA-filtered electromagnetic interlock transfer chambers preventing cross-contamination between sterile corridors and cleanroom environments.',
    image: '/images/products/custom-passbox.jpg',
    badge: 'Custom Fabrication',
    ctaText: 'Learn More',
    ctaLink: '/products/ss-dynamic-cleanroom-pass-box',
    displayOrder: 4,
    status: 'active',
    intervalSeconds: 5
  }
];

const seedInitialDataIfEmpty = async () => {
  try {
    // 1. Ensure private brochure storage exists
    const brochuresDir = path.join(__dirname, 'storage', 'brochures');
    if (!fs.existsSync(brochuresDir)) {
      fs.mkdirSync(brochuresDir, { recursive: true });
    }
    const targetPdfPath = path.join(brochuresDir, 'tatva-inox-product-catalogue.pdf');
    if (!fs.existsSync(targetPdfPath)) {
      const sourcePdf = path.join(__dirname, '..', 'Tatva Inox', 'public', 'tatva-inox-product-catalogue.pdf');
      if (fs.existsSync(sourcePdf)) {
        fs.copyFileSync(sourcePdf, targetPdfPath);
      }
    }

    // 2. Seed Admin Users if empty
    const adminUserCount = await AdminUser.countDocuments();
    if (adminUserCount === 0) {
      console.log('Seeding initial administrator user into MongoDB...');
      const defaultAdmin = new AdminUser({
        name: 'Dr. Rajesh Sharma',
        email: (process.env.ADMIN_EMAIL || 'office@tatvainox.in').toLowerCase().trim(),
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        title: 'Managing Director & Technical Head',
        status: 'active'
      });
      await defaultAdmin.save();

      // Also create an editor account for multi-role testing
      const editorUser = new AdminUser({
        name: 'Technical Editor',
        email: 'editor@tatvainox.com',
        password: 'editor123',
        role: 'editor',
        title: 'Clinical Documentation Lead',
        status: 'active'
      });
      await editorUser.save();
      console.log('Successfully seeded admin and editor users.');
    }

    // 3. Seed Categories (preserve existing categories)
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      console.log('Seeding initial categories into MongoDB...');
      await Category.insertMany(seedData.categories);
      console.log(`Successfully seeded ${seedData.categories.length} categories.`);
    }

    // 4. Seed / Migrate Departments from Categories
    const departmentCount = await Department.countDocuments();
    if (departmentCount === 0) {
      console.log('Migrating categories to departments in MongoDB...');
      const categories = await Category.find();
      const departmentsToInsert = categories.map((cat, idx) => ({
        name: cat.name,
        slug: cat.slug,
        description: cat.description || cat.shortDescription || '',
        shortDescription: cat.shortDescription || cat.description || '',
        subtitle: cat.subtitle || cat.tagline || '',
        image: cat.image || '/images/products/hospital-bed.jpg',
        bannerImage: '',
        highlights: cat.highlights || [],
        displayOrder: cat.displayOrder || idx + 1,
        status: cat.status || 'active',
        featured: cat.featured || false
      }));

      if (departmentsToInsert.length > 0) {
        await Department.insertMany(departmentsToInsert);
        console.log(`Successfully migrated ${departmentsToInsert.length} departments.`);
      }
    }

    // 5. Seed Products
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('Seeding initial products into MongoDB...');
      await Product.insertMany(seedData.products);
      console.log(`Successfully seeded ${seedData.products.length} products.`);
    }

    // Safe migration: Link products to their respective department
    const departments = await Department.find();
    const deptMap = new Map();
    departments.forEach((d) => {
      deptMap.set(d.slug, d);
    });

    const unmappedProducts = await Product.find({
      $or: [{ department: { $exists: false } }, { department: null }]
    });

    if (unmappedProducts.length > 0) {
      console.log(`Mapping ${unmappedProducts.length} products to their respective departments...`);
      for (const prod of unmappedProducts) {
        const matchingDept = deptMap.get(prod.category) || deptMap.get(prod.departmentSlug);
        if (matchingDept) {
          prod.department = matchingDept._id;
          prod.departmentSlug = matchingDept.slug;
          prod.departmentName = matchingDept.name;
          if (!prod.category) prod.category = matchingDept.slug;
          if (!prod.categoryName) prod.categoryName = matchingDept.name;
          await prod.save();
        }
      }
      console.log('Successfully completed product department mapping.');
    }

    // 6. Seed Homepage Banners
    const bannerCount = await Banner.countDocuments();
    if (bannerCount === 0) {
      console.log('Seeding initial 4 homepage banners into MongoDB...');
      await Banner.insertMany(initialBanners);
      console.log(`Successfully seeded ${initialBanners.length} homepage promotional banners.`);
    }

    // 5. Seed Brochure Leads
    const leadCount = await BrochureLead.countDocuments();
    if (leadCount === 0) {
      console.log('Seeding initial brochure leads into MongoDB...');
      await BrochureLead.insertMany(initialLeads);
      // Seed corresponding download events
      await DownloadEvent.create({
        leadId: 'LEAD-2026-10492',
        leadName: 'Dr. Ramesh Kulkarni',
        leadEmail: 'ramesh.kulkarni@manipalhospitals.com',
        brochureName: 'tatva-inox-product-catalogue.pdf',
        productName: 'Touch-Free Sensor Surgical Scrub Sink',
        success: true,
        timestamp: new Date('2026-02-22T11:05:00Z')
      });
      console.log('Successfully seeded initial brochure leads and download events.');
    }

    // 6. Seed Enquiries
    const enquiryCount = await Enquiry.countDocuments();
    if (enquiryCount === 0) {
      console.log('Seeding initial enquiries into MongoDB...');
      await Enquiry.insertMany(initialEnquiries);
      console.log('Successfully seeded initial enquiries.');
    }

    // 7. Seed Articles
    const articleCount = await Article.countDocuments();
    if (articleCount === 0) {
      console.log('Seeding initial articles into MongoDB...');
      await Article.insertMany(initialArticles);
      console.log('Successfully seeded initial articles.');
    }

    // 8. Seed Newsletter Subscribers
    const subscriberCount = await NewsletterSubscriber.countDocuments();
    if (subscriberCount === 0) {
      console.log('Seeding initial newsletter subscribers into MongoDB...');
      await NewsletterSubscriber.insertMany(initialSubscribers);
      console.log(`Successfully seeded ${initialSubscribers.length} newsletter subscribers.`);
    }

    // 9. Seed Newsletter Campaigns
    const campaignCount = await NewsletterCampaign.countDocuments();
    if (campaignCount === 0) {
      console.log('Seeding initial newsletter campaigns into MongoDB...');
      await NewsletterCampaign.insertMany(initialCampaigns);
      console.log(`Successfully seeded ${initialCampaigns.length} newsletter campaigns.`);
    }

    // 10. Seed Initial Audit Log
    const logCount = await AuditLog.countDocuments();
    if (logCount === 0) {
      await AuditLog.create({
        action: 'System Initialized',
        module: 'Core System',
        details: 'Tatva Inox Enterprise API database initialized with verified schemas',
        userName: 'System Administrator',
        severity: 'info'
      });
    }
  } catch (err) {
    console.error('Error during database auto-seeding:', err.message);
  }
};

module.exports = { seedInitialDataIfEmpty };

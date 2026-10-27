const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'https://api.tatvainox.com/api';

// Helper to make multipart request using built-in FormData or manual boundary
async function runTests() {
  console.log('=== STARTING TATVA INOX BACKEND INTEGRATION TESTS ===\n');

  // 1. Create 5 dummy test image files in scratch folder
  const scratchDir = path.join(__dirname, 'test-assets');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir);

  const imageFiles = [];
  for (let i = 1; i <= 5; i++) {
    const filePath = path.join(scratchDir, `test-image-${i}.png`);
    // Minimal valid 1x1 PNG
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(filePath, pngBuffer);
    imageFiles.push(filePath);
  }
  console.log('✓ Created 5 test image files');

  // 2. Test Category Creation with Image Upload
  console.log('\n--- 2. Testing Category Creation with Image Upload ---');
  const catFormData = new FormData();
  catFormData.append('name', 'Intensive Care Surgical Units');
  catFormData.append('slug', 'intensive-care-surgical-units');
  catFormData.append('subtitle', 'Specialized Cleanroom ICU Suites');
  catFormData.append('shortDescription', 'Engineered for intensive clinical wards and acute care theaters.');
  catFormData.append('cardContent', 'High-spec stainless steel structures designed for sterile care.');
  catFormData.append('displayOrder', '11');
  catFormData.append('status', 'active');
  catFormData.append('featured', 'true');

  const catImageBlob = new Blob([fs.readFileSync(imageFiles[0])], { type: 'image/png' });
  catFormData.append('image', catImageBlob, 'cat-hero.png');

  const catRes = await fetch(`${BASE_URL}/categories`, {
    method: 'POST',
    body: catFormData
  });
  const catData = await catRes.json();
  console.log('Category create response status:', catRes.status);
  console.log('Created category ID:', catData.id, '| Slug:', catData.slug, '| Image:', catData.image);
  if (!catRes.ok || !catData.id) throw new Error('Category creation failed');

  // 3. Verify category in public categories list
  console.log('\n--- 3. Verifying Category in Public Categories ---');
  const getCatRes = await fetch(`${BASE_URL}/categories`);
  const allCats = await getCatRes.json();
  const foundCat = allCats.find(c => c.slug === 'intensive-care-surgical-units');
  if (!foundCat) throw new Error('Created category not found in public list');
  console.log('✓ Found created category in public list with name:', foundCat.name);

  // 4. Test Product Creation with 5 Images
  console.log('\n--- 4. Testing Product Creation with 5 Images ---');
  const prodFormData = new FormData();
  prodFormData.append('name', 'Automated Surgical Passbox Chamber');
  prodFormData.append('slug', 'automated-surgical-passbox-chamber');
  prodFormData.append('sku', 'TI-AUTO-PB-99');
  prodFormData.append('category', catData.slug);
  prodFormData.append('categoryName', catData.name);
  prodFormData.append('shortDescription', 'Double-door interlocked cleanroom dynamic passbox for OT specimen transfer.');
  prodFormData.append('description', 'Fabricated with AISI 316 surgical stainless steel with HEPA airflow and UV germicidal lamp.');
  prodFormData.append('materialGrade', 'AISI 316 Surgical Grade');
  prodFormData.append('finish', 'No. 4 Satin Brush');
  prodFormData.append('gauge', '14 SWG Body, 16 SWG Doors');
  prodFormData.append('dimensions', '750 x 750 x 750 mm');
  prodFormData.append('loadCapacity', '100 kg');
  prodFormData.append('hygieneStandard', 'Class 100 / ISO 5 Cleanroom');
  prodFormData.append('basePrice', '85000');
  prodFormData.append('status', 'published');
  prodFormData.append('featured', 'true');
  prodFormData.append('customizable', 'true');
  prodFormData.append('specs', JSON.stringify([
    { label: 'Interlock', value: 'Electromagnetic fail-safe interlock' },
    { label: 'Filtration', value: 'H14 HEPA 99.997% efficiency' }
  ]));
  prodFormData.append('features', JSON.stringify([
    'Touchless sensor door switches',
    'Integrated UV-C sterilization timer'
  ]));

  // Append 5 image files
  for (let i = 0; i < 5; i++) {
    const fileBlob = new Blob([fs.readFileSync(imageFiles[i])], { type: 'image/png' });
    prodFormData.append('images', fileBlob, `passbox-view-${i + 1}.png`);
  }

  const prodRes = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    body: prodFormData
  });
  const prodData = await prodRes.json();
  console.log('Product create response status:', prodRes.status);
  console.log('Created product ID:', prodData.id, '| SKU:', prodData.sku, '| Images count:', prodData.images?.length);
  if (!prodRes.ok || !prodData.id || prodData.images?.length !== 5) {
    throw new Error('Product creation with 5 images failed');
  }
  console.log('✓ Product images stored:', prodData.images);

  // 5. Verify image files actually exist on disk in backend/uploads/products
  for (const imgPath of prodData.images) {
    const fullPath = path.join(__dirname, imgPath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Uploaded file not found on disk: ${fullPath}`);
    }
  }
  console.log('✓ All 5 uploaded image files verified on disk in backend/uploads/products');

  // 6. Test Product Retrieval via Slug
  console.log('\n--- 6. Testing Product Retrieval by Slug ---');
  const getProdRes = await fetch(`${BASE_URL}/products/slug/automated-surgical-passbox-chamber`);
  const retrievedProd = await getProdRes.json();
  if (!retrievedProd || retrievedProd.name !== 'Automated Surgical Passbox Chamber') {
    throw new Error('Failed to retrieve product by slug');
  }
  console.log('✓ Retrieved product by slug:', retrievedProd.name, '| Material:', retrievedProd.materialGrade);

  // 7. Test Image Reordering and Status Update
  console.log('\n--- 7. Testing Product Update & Image Reordering ---');
  const reorderedImages = [...prodData.images].reverse();
  const updatePayload = {
    images: reorderedImages,
    status: 'draft',
    shortDescription: 'Updated description: Status changed to draft and images reversed.'
  };

  const updateRes = await fetch(`${BASE_URL}/products/${prodData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload)
  });
  const updatedProd = await updateRes.json();
  if (updatedProd.images[0] !== reorderedImages[0] || updatedProd.status !== 'draft') {
    throw new Error('Product update or image reordering failed');
  }
  console.log('✓ Primary image updated to index 0:', updatedProd.images[0]);
  console.log('✓ Status updated to:', updatedProd.status);

  // 8. Confirm draft product does NOT appear on public /api/products
  console.log('\n--- 8. Verifying Draft Product is Hidden from Public Catalogue ---');
  const publicProdsRes = await fetch(`${BASE_URL}/products`);
  const publicProds = await publicProdsRes.json();
  const isFoundPublic = publicProds.some(p => p.id === prodData.id || p.slug === prodData.slug);
  if (isFoundPublic) {
    throw new Error('Draft product should NOT be in public /api/products');
  }
  console.log('✓ Draft product successfully hidden from public website');

  // 9. Test Category Deletion Guard (Must fail because product is assigned)
  console.log('\n--- 9. Testing Category Deletion Guard ---');
  const delCatRes = await fetch(`${BASE_URL}/categories/${catData.id}`, {
    method: 'DELETE'
  });
  const delCatData = await delCatRes.json();
  console.log('Category delete attempt status:', delCatRes.status, '| Response:', delCatData.message);
  if (delCatRes.status !== 400 || !delCatData.message.includes('assigned')) {
    throw new Error('Category deletion guard failed to prevent deletion');
  }
  console.log('✓ Category deletion blocked as expected when products are assigned');

  // 10. Delete the product
  console.log('\n--- 10. Testing Product Deletion & Safe File Cleanup ---');
  const delProdRes = await fetch(`${BASE_URL}/products/${prodData.id}`, {
    method: 'DELETE'
  });
  const delProdData = await delProdRes.json();
  console.log('Product delete response:', delProdData);
  if (!delProdRes.ok) throw new Error('Product deletion failed');

  // Verify product no longer exists
  const checkProdRes = await fetch(`${BASE_URL}/products/${prodData.id}`);
  if (checkProdRes.status !== 404) throw new Error('Product still exists after delete');
  console.log('✓ Product deleted from MongoDB');

  // 11. Now delete the category (should succeed now that 0 products are assigned)
  console.log('\n--- 11. Testing Category Deletion After Product Removed ---');
  const delCatRes2 = await fetch(`${BASE_URL}/categories/${catData.id}`, {
    method: 'DELETE'
  });
  const delCatData2 = await delCatRes2.json();
  console.log('Category delete status:', delCatRes2.status, '| Response:', delCatData2.message);
  if (!delCatRes2.ok) throw new Error('Category deletion failed after product was removed');
  console.log('✓ Category successfully deleted');

  // Clean up scratch test assets
  fs.rmSync(scratchDir, { recursive: true, force: true });

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});

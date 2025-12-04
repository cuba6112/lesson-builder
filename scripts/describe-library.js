#!/usr/bin/env node
/* global process */
/**
 * Image Library Description Generator
 *
 * Scans public/library/ for images and generates descriptions using a vision LLM.
 * Updates manifest.json with the results.
 *
 * Usage: node scripts/describe-library.js [--model llava:latest] [--force]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = path.join(__dirname, '../public/library');
const MANIFEST_PATH = path.join(LIBRARY_PATH, 'manifest.json');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Parse command line arguments
const args = process.argv.slice(2);
const modelIndex = args.indexOf('--model');
const MODEL = modelIndex !== -1 ? args[modelIndex + 1] : 'llava:latest';
const FORCE = args.includes('--force');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

/**
 * Read image as base64
 */
async function imageToBase64(imagePath) {
  const buffer = await fs.readFile(imagePath);
  return buffer.toString('base64');
}

/**
 * Call Ollama vision API
 */
async function describeImage(base64, model) {
  const prompt = `Describe this image in 1-2 sentences for an educational content library. Focus on what it depicts and what concepts it could illustrate. Also suggest 3-5 single-word tags.

Respond in this exact format:
DESCRIPTION: [your description]
TAGS: [comma-separated tags]`;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt, images: [base64] }],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.message?.content || '';

  // Parse response
  let description = '';
  let tags = [];

  const descMatch = content.match(/DESCRIPTION:\s*(.+?)(?=TAGS:|$)/is);
  const tagsMatch = content.match(/TAGS:\s*(.+)/i);

  if (descMatch) description = descMatch[1].trim();
  if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t);

  return { description, tags };
}

/**
 * Recursively find all images in directory
 */
async function findImages(dir, basePath = '') {
  const images = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      images.push(...await findImages(fullPath, relativePath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        images.push({
          fullPath,
          relativePath: relativePath.replace(/\\/g, '/'),
          name: path.basename(entry.name, ext),
          category: basePath || 'uncategorized',
        });
      }
    }
  }

  return images;
}

/**
 * Generate ID from filename
 */
function generateId(name, category) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return category !== 'uncategorized' ? `${category}-${base}` : base;
}

/**
 * Main function
 */
async function main() {
  console.log('🖼️  Image Library Description Generator');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Library: ${LIBRARY_PATH}`);
  console.log(`   Force: ${FORCE}`);
  console.log('');

  // Check Ollama connection
  try {
    const healthResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!healthResponse.ok) throw new Error('Not connected');
    console.log('✅ Ollama connected');
  } catch {
    console.error('❌ Cannot connect to Ollama at', OLLAMA_URL);
    console.error('   Make sure Ollama is running: ollama serve');
    process.exit(1);
  }

  // Load existing manifest
  let manifest = { version: 1, images: [], lastUpdated: null };
  try {
    const content = await fs.readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content);
    console.log(`📄 Loaded manifest with ${manifest.images.length} existing entries`);
  } catch {
    console.log('📄 Creating new manifest');
  }

  // Find all images
  const images = await findImages(LIBRARY_PATH);
  console.log(`🔍 Found ${images.length} images in library`);

  if (images.length === 0) {
    console.log('   No images to process. Add images to public/library/');
    return;
  }

  // Process images
  const existingIds = new Set(manifest.images.map(img => img.id));
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const image of images) {
    const id = generateId(image.name, image.category);

    // Skip if already exists (unless force)
    if (existingIds.has(id) && !FORCE) {
      skipped++;
      continue;
    }

    process.stdout.write(`   Processing ${image.relativePath}...`);

    try {
      const base64 = await imageToBase64(image.fullPath);
      const { description, tags } = await describeImage(base64, MODEL);

      const entry = {
        id,
        path: image.relativePath,
        name: image.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        tags,
        category: image.category,
      };

      // Update or add entry
      const existingIndex = manifest.images.findIndex(img => img.id === id);
      if (existingIndex !== -1) {
        manifest.images[existingIndex] = entry;
      } else {
        manifest.images.push(entry);
      }

      processed++;
      console.log(' ✅');
    } catch (error) {
      errors++;
      console.log(` ❌ ${error.message}`);
    }
  }

  // Save manifest
  manifest.lastUpdated = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('');
  console.log('📊 Summary:');
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in manifest: ${manifest.images.length}`);
  console.log('');
  console.log('✨ Done! Manifest updated at public/library/manifest.json');
}

main().catch(console.error);

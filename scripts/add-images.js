#!/usr/bin/env node
/* global process */
/**
 * Add Images to Library
 *
 * Copies images from a source folder to the library, generates descriptions
 * using a vision LLM, and updates the manifest automatically.
 *
 * Usage:
 *   npm run add-images -- /path/to/images
 *   npm run add-images -- /path/to/images --category icons
 *   npm run add-images -- /path/to/images --model llava:13b
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = path.join(__dirname, '../public/library');
const MANIFEST_PATH = path.join(LIBRARY_PATH, 'manifest.json');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Parse args
const args = process.argv.slice(2);
const sourcePath = args.find(a => !a.startsWith('--'));
const categoryIndex = args.indexOf('--category');
const CATEGORY = categoryIndex !== -1 ? args[categoryIndex + 1] : 'uploads';
const modelIndex = args.indexOf('--model');
const MODEL = modelIndex !== -1 ? args[modelIndex + 1] : 'llava:latest';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

async function imageToBase64(imagePath) {
  const buffer = await fs.readFile(imagePath);
  return buffer.toString('base64');
}

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

  if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);

  const data = await response.json();
  const content = data.message?.content || '';

  let description = '';
  let tags = [];

  const descMatch = content.match(/DESCRIPTION:\s*(.+?)(?=TAGS:|$)/is);
  const tagsMatch = content.match(/TAGS:\s*(.+)/i);

  if (descMatch) description = descMatch[1].trim();
  if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t);

  return { description, tags };
}

function generateId(name, category) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${category}-${base}`;
}

async function main() {
  if (!sourcePath) {
    console.log('Usage: npm run add-images -- /path/to/images [--category icons] [--model llava:latest]');
    console.log('');
    console.log('Options:');
    console.log('  --category  Target category folder (default: uploads)');
    console.log('  --model     Vision model to use (default: llava:latest)');
    process.exit(1);
  }

  console.log('📸 Add Images to Library');
  console.log(`   Source: ${sourcePath}`);
  console.log(`   Category: ${CATEGORY}`);
  console.log(`   Model: ${MODEL}`);
  console.log('');

  // Check source exists
  try {
    await fs.access(sourcePath);
  } catch {
    console.error(`❌ Source path not found: ${sourcePath}`);
    process.exit(1);
  }

  // Check Ollama
  try {
    const health = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!health.ok) throw new Error();
    console.log('✅ Ollama connected');
  } catch {
    console.error('❌ Cannot connect to Ollama. Run: ollama serve');
    process.exit(1);
  }

  // Ensure category folder exists
  const categoryPath = path.join(LIBRARY_PATH, CATEGORY);
  await fs.mkdir(categoryPath, { recursive: true });

  // Load manifest
  let manifest = { version: 1, images: [], lastUpdated: null };
  try {
    const content = await fs.readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content);
  } catch {
    console.log('📄 Creating new manifest');
  }

  // Find images in source
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  const imageFiles = entries.filter(e =>
    e.isFile() && IMAGE_EXTENSIONS.includes(path.extname(e.name).toLowerCase())
  );

  if (imageFiles.length === 0) {
    console.log('❌ No images found in source folder');
    process.exit(1);
  }

  console.log(`🔍 Found ${imageFiles.length} images`);
  console.log('');

  const existingIds = new Set(manifest.images.map(img => img.id));
  let added = 0;
  let skipped = 0;

  for (const file of imageFiles) {
    const srcFile = path.join(sourcePath, file.name);
    const destFile = path.join(categoryPath, file.name);
    const relativePath = `${CATEGORY}/${file.name}`;
    const baseName = path.basename(file.name, path.extname(file.name));
    const id = generateId(baseName, CATEGORY);

    // Skip if already exists
    if (existingIds.has(id)) {
      console.log(`   ⏭️  ${file.name} (already in library)`);
      skipped++;
      continue;
    }

    process.stdout.write(`   📷 ${file.name}...`);

    try {
      // Copy file
      await fs.copyFile(srcFile, destFile);

      // Generate description
      const base64 = await imageToBase64(destFile);
      const { description, tags } = await describeImage(base64, MODEL);

      // Add to manifest
      manifest.images.push({
        id,
        path: relativePath,
        name: baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        tags,
        category: CATEGORY,
      });

      added++;
      console.log(' ✅');
    } catch (error) {
      console.log(` ❌ ${error.message}`);
    }
  }

  // Save manifest
  manifest.lastUpdated = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('');
  console.log('📊 Summary:');
  console.log(`   Added: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total in library: ${manifest.images.length}`);
  console.log('');
  console.log('✨ Done!');
}

main().catch(console.error);

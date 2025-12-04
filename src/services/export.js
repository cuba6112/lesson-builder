import DOMPurify from 'dompurify';
import { saveFile } from './fileSaver';

// @ts-nocheck

// =============================================================================
// EXPORT SERVICE
// =============================================================================
// Handles exporting lessons to PDF and Markdown formats
// Note: html2pdf.js is lazy-loaded only when PDF export is needed

// =============================================================================
// MARKDOWN EXPORT
// =============================================================================

/**
 * Convert a single block to Markdown
 */
function blockToMarkdown(block) {
  switch (block.type) {
    case 'heading':
      return `# ${block.content || 'Untitled'}\n\n`;

    case 'text':
      return `${block.content || ''}\n\n`;

    case 'image': {
      const caption = block.caption ? ` "${block.caption}"` : '';
      return `![${block.caption || 'Image'}](${block.content})${caption ? `\n*${block.caption}*` : ''}\n\n`;
    }

    case 'video':
      return `🎬 **Video:** [Watch here](${block.content})\n\n`;

    case 'quiz': {
      let quizMd = `### ❓ Quiz: ${block.content || 'Question'}\n\n`;
      if (block.options && Array.isArray(block.options)) {
        block.options.forEach((option, i) => {
          const letter = String.fromCharCode(65 + i); // A, B, C, D...
          const isCorrect = i === block.correctAnswer;
          quizMd += `- **${letter})** ${option}${isCorrect ? ' ✓' : ''}\n`;
        });
      }
      return quizMd + '\n';
    }

    case 'html':
      // Convert HTML to simplified markdown
      return htmlToMarkdown(block.content) + '\n\n';

    case 'code': {
      const lang = block.language || '';
      const filename = block.filename ? `\n// ${block.filename}\n` : '';
      return `\`\`\`${lang}${filename}${block.content || ''}\n\`\`\`\n\n`;
    }

    default:
      return `${block.content || ''}\n\n`;
  }
}

/**
 * Convert HTML content to Markdown (simplified)
 */
function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // Remove style attributes but keep the content
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');

  // Paragraphs and line breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let counter = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, liContent) => {
      counter++;
      return `${counter}. ${liContent}\n`;
    }) + '\n';
  });

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');

  // Horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![Image]($1)');

  // Tables (basic support)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, content) => {
    let rows = [];
    const rowMatches = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    rowMatches.forEach((row, rowIndex) => {
      const cells = [];
      const cellMatches = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];

      cellMatches.forEach(cell => {
        const cellContent = cell.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, '$1').trim();
        cells.push(cellContent);
      });

      if (cells.length > 0) {
        rows.push('| ' + cells.join(' | ') + ' |');

        // Add header separator after first row
        if (rowIndex === 0) {
          rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        }
      }
    });

    return rows.join('\n') + '\n\n';
  });

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Clean up HTML entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

/**
 * Export lesson to Markdown
 */
export function exportToMarkdown(lesson) {
  const { title, icon, blocks } = lesson;

  let markdown = '';

  // Title
  markdown += `# ${icon} ${title || 'Untitled Lesson'}\n\n`;
  markdown += `---\n\n`;

  // Blocks
  blocks.forEach(block => {
    markdown += blockToMarkdown(block);
  });

  // Footer
  markdown += `\n---\n\n`;
  markdown += `*Exported from Lesson Builder on ${new Date().toLocaleDateString()}*\n`;

  return markdown;
}

/**
 * Download Markdown file
 */
export function downloadMarkdown(lesson) {
  const markdown = exportToMarkdown(lesson);
  return saveFile({
    data: markdown,
    filename: `${sanitizeFilename(lesson.title || 'lesson')}.md`,
    mimeType: 'text/markdown;charset=utf-8'
  });
}

// =============================================================================
// PDF EXPORT
// =============================================================================

/**
 * Generate HTML for PDF export with clean, professional formatting
 */
function generatePdfHtml(lesson) {
  const { title, icon, blocks } = lesson;

  const safeTitle = escapeHtml(title || 'Untitled Lesson');
  const safeIcon = icon || '📚';
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Reset and base */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 14px;
      line-height: 1.7;
      color: #333;
      background: white;
    }

    .pdf-container {
      max-width: 700px;
      margin: 0 auto;
      padding: 50px 40px;
    }

    /* Header */
    .pdf-header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid #2563eb;
    }
    .pdf-icon { font-size: 56px; margin-bottom: 15px; }
    .pdf-title {
      font-size: 32px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 10px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    .pdf-date {
      font-size: 12px;
      color: #666;
      font-style: italic;
    }

    /* Content blocks */
    .pdf-content {
      font-size: 14px;
    }
    .block-content {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    /* Typography for HTML content */
    .block-content h1, .block-content h2, .block-content h3 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      margin-top: 28px;
      margin-bottom: 14px;
      line-height: 1.3;
    }
    .block-content h1 { font-size: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .block-content h2 { font-size: 20px; }
    .block-content h3 { font-size: 17px; }

    .block-content p {
      margin-bottom: 14px;
      text-align: justify;
    }

    .block-content ul, .block-content ol {
      margin: 14px 0;
      padding-left: 28px;
    }
    .block-content li {
      margin-bottom: 8px;
    }

    .block-content strong, .block-content b { font-weight: 600; }
    .block-content em, .block-content i { font-style: italic; }

    .block-content a {
      color: #2563eb;
      text-decoration: none;
    }

    /* Tables */
    .block-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    .block-content th, .block-content td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      text-align: left;
    }
    .block-content th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .block-content tr:nth-child(even) td {
      background: #f9fafb;
    }

    /* Code blocks */
    .block-content pre, .block-content code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
    }
    .block-content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 16px 0;
    }
    .block-content code {
      background: #f1f5f9;
      color: #dc2626;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .block-content pre code {
      background: none;
      color: inherit;
      padding: 0;
    }

    /* Cards and boxes - fallback styles for AI-generated content */
    .block-content > div {
      margin: 16px 0;
    }

    /* Common AI-generated card patterns */
    .block-content > div > div {
      padding: 16px;
      margin: 12px 0;
      border-radius: 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }

    /* Nested content in cards */
    .block-content > div > div > div {
      margin: 8px 0;
    }

    /* Flex layouts (common in AI output) */
    .block-content [style*="display: flex"],
    .block-content [style*="display:flex"] {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Grid layouts */
    .block-content [style*="display: grid"],
    .block-content [style*="display:grid"] {
      display: grid;
      gap: 16px;
    }

    /* Info/alert boxes - match common AI patterns */
    .block-content > div[style*="background"] {
      padding: 16px 20px;
      border-radius: 8px;
      margin: 16px 0;
    }

    /* Icons and emojis in headings */
    .block-content h1 span,
    .block-content h2 span,
    .block-content h3 span {
      margin-right: 8px;
    }

    /* Blockquote enhancement */
    .block-content blockquote {
      border-left: 4px solid #2563eb;
      padding: 12px 20px;
      margin: 16px 0;
      background: #f8fafc;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #475569;
    }

    /* Figure and figcaption */
    .block-content figure {
      margin: 20px 0;
      text-align: center;
    }
    .block-content figcaption {
      font-size: 12px;
      color: #6b7280;
      margin-top: 8px;
      font-style: italic;
    }

    /* Horizontal rule */
    .block-content hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }

    /* Badge/tag styles (common in AI output) */
    .block-content span[style*="border-radius"] {
      display: inline-block;
      padding: 2px 8px;
      font-size: 12px;
      border-radius: 4px;
    }

    /* Ensure images in cards are responsive */
    .block-content div img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    /* Summary/details styling */
    .block-content details {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 12px 0;
    }
    .block-content summary {
      font-weight: 600;
      cursor: pointer;
      color: #1e40af;
    }

    /* Definition lists */
    .block-content dl {
      margin: 16px 0;
    }
    .block-content dt {
      font-weight: 600;
      color: #1f2937;
      margin-top: 12px;
    }
    .block-content dd {
      margin-left: 20px;
      color: #4b5563;
    }

    /* Quiz styling */
    .quiz-block {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 20px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
    }
    .quiz-question {
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 16px;
      font-size: 15px;
    }
    .quiz-option {
      background: white;
      border: 1px solid #d1d5db;
      padding: 10px 14px;
      border-radius: 6px;
      margin: 8px 0;
      font-size: 13px;
    }
    .quiz-option.correct {
      background: #dcfce7;
      border-color: #86efac;
    }

    /* Code block styling */
    .code-block {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin: 20px 0;
    }
    .code-header {
      background: #f3f4f6;
      padding: 8px 14px;
      font-size: 12px;
      font-family: monospace;
      color: #4b5563;
      border-bottom: 1px solid #e5e7eb;
    }
    .code-content {
      background: #1e293b;
      padding: 16px;
      color: #e2e8f0;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .code-footer {
      background: #334155;
      padding: 4px 14px;
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
      text-align: right;
    }

    /* Footer */
    .pdf-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .pdf-footer p {
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    <div class="pdf-header">
      <div class="pdf-icon">${safeIcon}</div>
      <h1 class="pdf-title">${safeTitle}</h1>
      <p class="pdf-date">Exported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="pdf-content">
`;

  safeBlocks.forEach(block => {
    html += `<div class="block-content">${blockToPdfHtml(block)}</div>`;
  });

  html += `
    </div>
    <div class="pdf-footer">
      <p>Created with Lesson Builder</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Convert a block to PDF-friendly HTML using CSS classes
 */
function blockToPdfHtml(block) {
  switch (block.type) {
    case 'heading':
      return `<h2>${escapeHtml(block.content || '')}</h2>`;

    case 'text': {
      // Convert newlines to paragraphs for text blocks
      const content = block.content || '';
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
      if (paragraphs.length > 1) {
        return paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
      }
      return `<p>${escapeHtml(content)}</p>`;
    }

    case 'image':
      return `
        <div style="text-align: center; margin: 24px 0;">
          <img src="${escapeHtml(block.content || '')}" style="max-width: 100%; border-radius: 8px;" />
          ${block.caption ? `<p style="font-size: 12px; color: #666; font-style: italic; margin-top: 8px;">${escapeHtml(block.caption)}</p>` : ''}
        </div>
      `;

    case 'video':
      return `
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>🎬 Video:</strong> <a href="${escapeHtml(block.content || '')}">${escapeHtml(block.content || '')}</a></p>
        </div>
      `;

    case 'quiz': {
      let quizHtml = `<div class="quiz-block"><p class="quiz-question">❓ ${escapeHtml(block.content || 'Quiz Question')}</p>`;
      if (block.options && Array.isArray(block.options)) {
        block.options.forEach((option, i) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = i === block.correctAnswer;
          quizHtml += `<div class="quiz-option${isCorrect ? ' correct' : ''}"><strong>${letter})</strong> ${escapeHtml(option)}${isCorrect ? ' ✓' : ''}</div>`;
        });
      }
      return quizHtml + '</div>';
    }

    case 'html': {
      // Clean up AI-generated HTML for PDF
      const safeHtml = cleanHtmlForPdf(block.content || '');
      return safeHtml;
    }

    case 'code': {
      return `
        <div class="code-block">
          ${block.filename ? `<div class="code-header">📄 ${escapeHtml(block.filename)}</div>` : ''}
          <div class="code-content">${escapeHtml(block.content || '')}</div>
          ${block.language ? `<div class="code-footer">${escapeHtml(block.language)}</div>` : ''}
        </div>
      `;
    }

    default:
      return `<p>${escapeHtml(block.content || '')}</p>`;
  }
}

/**
 * Clean HTML content for PDF export - preserves essential styles while removing problematic ones
 */
function cleanHtmlForPdf(html) {
  if (!html) return '';

  let cleaned = html;

  // Remove script tags and event handlers (security)
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');

  // Process inline styles - keep safe properties, remove problematic ones
  cleaned = cleaned.replace(/style="([^"]*)"/gi, (match, styleContent) => {
    const safeStyles = filterSafeStyles(styleContent);
    return safeStyles ? `style="${safeStyles}"` : '';
  });

  // Keep class attributes - our CSS uses them for styling
  // Only remove classes that start with js- or are framework-specific
  cleaned = cleaned.replace(/\s*class="([^"]*)"/gi, (match, classes) => {
    const filteredClasses = classes
      .split(/\s+/)
      .filter(cls => !cls.startsWith('js-') && !cls.startsWith('ng-') && !cls.startsWith('v-'))
      .join(' ')
      .trim();
    return filteredClasses ? `class="${filteredClasses}"` : '';
  });

  // Convert gradient backgrounds to solid colors
  cleaned = cleaned.replace(/linear-gradient\([^)]+\)/gi, '#f3f4f6');
  cleaned = cleaned.replace(/radial-gradient\([^)]+\)/gi, '#f3f4f6');

  // Normalize spacing - collapse multiple spaces but preserve single spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Ensure proper paragraph wrapping for loose text between divs
  cleaned = cleaned.replace(/<\/div>\s*([^<]+)\s*<div/gi, '</div><p>$1</p><div');

  // Sanitize the cleaned HTML
  return sanitizeHtmlContent(cleaned);
}

/**
 * Filter inline styles to keep only PDF-safe properties
 */
function filterSafeStyles(styleString) {
  if (!styleString) return '';

  // Properties that are safe and useful for PDF rendering
  const safeProperties = [
    'color',
    'background-color',
    'background',
    'font-size',
    'font-weight',
    'font-style',
    'font-family',
    'text-align',
    'text-decoration',
    'line-height',
    'letter-spacing',
    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'border',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-radius',
    'border-color',
    'border-width',
    'border-style',
    'width',
    'max-width',
    'min-width',
    'height',
    'max-height',
    'min-height',
    'display',
    'flex-direction',
    'justify-content',
    'align-items',
    'gap',
    'grid-template-columns',
    'grid-gap',
    'list-style',
    'list-style-type',
    'vertical-align',
    'white-space',
    'word-wrap',
    'word-break',
    'opacity',
    'box-shadow',
  ];

  // Properties to always remove (problematic for PDF/print)
  const unsafePatterns = [
    /position\s*:/i,
    /z-index\s*:/i,
    /overflow\s*:/i,
    /animation\s*:/i,
    /transition\s*:/i,
    /transform\s*:/i,
    /cursor\s*:/i,
    /pointer-events\s*:/i,
    /-webkit-/i,
    /-moz-/i,
    /-ms-/i,
    /linear-gradient/i,
    /radial-gradient/i,
    /url\s*\(/i,
    /fixed/i,
    /sticky/i,
    /absolute/i,
  ];

  const declarations = styleString.split(';').filter(d => d.trim());
  const safeDeclarations = [];

  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;

    // Skip if matches any unsafe pattern
    const isUnsafe = unsafePatterns.some(pattern => pattern.test(trimmed));
    if (isUnsafe) continue;

    // Extract property name
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const property = trimmed.substring(0, colonIndex).trim().toLowerCase();

    // Check if property is in safe list
    if (safeProperties.includes(property)) {
      safeDeclarations.push(trimmed);
    }
  }

  return safeDeclarations.join('; ');
}

/**
 * Export lesson to PDF
 * Uses dynamic import to lazy-load html2pdf.js (~740KB) only when needed
 */
export async function exportToPdf(lesson, options = {}) {
  let container = null;

  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('PDF export is only available in the browser');
    }

    // Lazy load html2pdf.js only when PDF export is triggered.
    // Prefer the bundled build to avoid peer dependency issues, with a CDN fallback.
    const html2pdf = await loadHtml2Pdf();

    const html = generatePdfHtml(lesson);

    // Create a temporary container for PDF rendering
    // html2canvas needs the element to be in the DOM and have layout, but it doesn't need to be visible
    container = document.createElement('div');
    container.innerHTML = html;
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 800px;
      background: white;
      z-index: -1;
    `;
    document.body.appendChild(container);

    // Force layout calculation
    container.offsetHeight;

    // Log container content for debugging
    console.log('html2pdf: Container innerHTML length:', container.innerHTML.length);
    console.log('html2pdf: Container children:', container.children.length);

    // Wait for any images to load
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails
          });
        })
      );
    }

    const filename = `${sanitizeFilename(lesson.title || 'lesson')}.pdf`;

    const defaultOptions = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,  // Changed to false for cleaner rendering
        logging: true,      // Enable logging for debugging
        backgroundColor: '#ffffff',
        width: 800,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Generate and save PDF - target the actual content inside container
    console.log('html2pdf: Starting PDF generation...');
    const contentElement = container.querySelector('.pdf-container') || container;
    console.log('html2pdf: Content element tag:', contentElement.tagName, 'children:', contentElement.children.length);

    const worker = html2pdf().set(mergedOptions).from(contentElement);

    // Use outputPdf to get the blob, then trigger download manually for reliability
    try {
      const pdfBlob = await worker.outputPdf('blob');
      console.log('html2pdf: PDF blob generated, size:', pdfBlob.size, 'bytes');

      await saveFile({
        data: pdfBlob,
        filename,
        mimeType: 'application/pdf',
        binary: true
      });

      console.log('html2pdf: PDF download triggered');
    } catch (workerError) {
      console.error('html2pdf: Worker error, trying .save() fallback:', workerError);
      // Fallback to .save() method
      await worker.save();
    }

    return { success: true, filename };
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error(`PDF export failed: ${error.message || 'Unknown error'}`);
  } finally {
    // Always clean up the container
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Download PDF file
 */
export async function downloadPdf(lesson, options = {}) {
  return exportToPdf(lesson, options);
}

// =============================================================================
// HTML2PDF LOADER
// =============================================================================

let html2pdfPromise = null;

async function loadHtml2Pdf() {
  // Return cached promise if already loading/loaded
  if (html2pdfPromise) return html2pdfPromise;

  html2pdfPromise = (async () => {
    // Check if already available on window (might be loaded by another script)
    if (typeof window.html2pdf === 'function') {
      console.log('html2pdf: Using existing window.html2pdf');
      return window.html2pdf;
    }

    // Try dynamic import first - UMD bundles set window.html2pdf
    try {
      console.log('html2pdf: Attempting dynamic import...');
      await import('html2pdf.js/dist/html2pdf.bundle.min.js');

      // UMD bundle sets window.html2pdf, check after import
      if (typeof window.html2pdf === 'function') {
        console.log('html2pdf: Successfully loaded via dynamic import');
        return window.html2pdf;
      }
    } catch (error) {
      console.warn('html2pdf: Dynamic import failed:', error.message);
    }

    // Fallback to CDN script tag
    console.log('html2pdf: Falling back to CDN...');
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2pdf.js@0.12.1/dist/html2pdf.bundle.min.js');

    // Wait a moment for script to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    if (typeof window.html2pdf !== 'function') {
      throw new Error('Failed to load html2pdf library - function not available after loading');
    }

    console.log('html2pdf: Successfully loaded via CDN');
    return window.html2pdf;
  })();

  return html2pdfPromise;
}

const loadedScripts = new Set();
function loadScriptOnce(src) {
  if (loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize HTML content for safe PDF rendering
 */
function sanitizeHtmlContent(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'br', 'hr', 'pre', 'code',
      'blockquote', 'figure', 'figcaption', 'section', 'article', 'header', 'footer'
    ],
    ALLOWED_ATTR: ['style', 'class', 'href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50) || 'lesson';
}

// =============================================================================
// EXPORT ALL
// =============================================================================

export default {
  exportToMarkdown,
  downloadMarkdown,
  exportToPdf,
  downloadPdf,
};

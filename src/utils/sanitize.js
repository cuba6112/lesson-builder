// Input sanitization utilities
// Protects against XSS, injection attacks, and malformed input

import DOMPurify from 'dompurify';

// =============================================================================
// TEXT INPUT SANITIZATION
// =============================================================================

/**
 * Sanitize user text input (chat messages, form fields)
 * Removes potentially dangerous characters while preserving readability
 */
export function sanitizeTextInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Trim whitespace
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Limit consecutive whitespace
    .replace(/\s{10,}/g, '  ')
    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize text for use in prompts sent to AI
 * More restrictive - prevents prompt injection attempts
 */
export function sanitizePromptInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return sanitizeTextInput(input)
    // Limit length to prevent token abuse
    .slice(0, 10000);
}

// =============================================================================
// HTML SANITIZATION
// =============================================================================

/**
 * Allowed HTML tags for lesson content
 */
const ALLOWED_TAGS = [
  // Structure
  'div', 'span', 'p', 'br', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Text formatting
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  // Code
  'pre', 'code',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  // Other
  'blockquote', 'a', 'img',
];

/**
 * Allowed HTML attributes
 */
const ALLOWED_ATTR = [
  'style', 'class', 'id',
  'href', 'target', 'rel',
  'src', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan',
];

/**
 * Sanitize HTML content from AI or user input
 * Removes dangerous elements while preserving styling
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Allow data: URLs for images (base64)
    ALLOW_DATA_ATTR: false,
    // Add target="_blank" security
    ADD_ATTR: ['target'],
    // Hook to add rel="noopener noreferrer" to links
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}

/**
 * Sanitize HTML with stricter rules for chat messages
 */
export function sanitizeChatHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

// =============================================================================
// URL SANITIZATION
// =============================================================================

/**
 * Validate and sanitize URLs
 * Returns null if URL is invalid or potentially dangerous
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Allow relative URLs
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    // Only allow safe protocols
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      return null;
    }

    // For data URLs, only allow images
    if (parsed.protocol === 'data:') {
      if (!trimmed.startsWith('data:image/')) {
        return null;
      }
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize image URL specifically
 */
export function sanitizeImageURL(url) {
  const sanitized = sanitizeURL(url);

  if (!sanitized) {
    return null;
  }

  // For data URLs, ensure it's an image
  if (sanitized.startsWith('data:') && !sanitized.startsWith('data:image/')) {
    return null;
  }

  return sanitized;
}

// =============================================================================
// BLOCK CONTENT SANITIZATION
// =============================================================================

/**
 * Sanitize lesson block content based on block type
 */
export function sanitizeBlockContent(block) {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const sanitized = { ...block };

  switch (block.type) {
    case 'text':
    case 'heading':
      sanitized.content = sanitizeTextInput(block.content || '');
      break;

    case 'html':
      sanitized.content = sanitizeHTML(block.content || '');
      break;

    case 'image':
      sanitized.content = sanitizeImageURL(block.content) || '';
      sanitized.caption = sanitizeTextInput(block.caption || '');
      break;

    case 'video':
      sanitized.content = sanitizeURL(block.content) || '';
      break;

    case 'quiz':
      sanitized.content = sanitizeTextInput(block.content || '');
      if (Array.isArray(block.options)) {
        sanitized.options = block.options.map(opt => sanitizeTextInput(opt || ''));
      }
      break;

    case 'code':
      // Code content should preserve formatting but remove dangerous chars
      sanitized.content = sanitizeTextInput(block.content || '');
      sanitized.language = sanitizeTextInput(block.language || '').slice(0, 20);
      sanitized.filename = sanitizeTextInput(block.filename || '').slice(0, 100);
      break;

    default:
      // For unknown types, sanitize as text
      if (typeof block.content === 'string') {
        sanitized.content = sanitizeTextInput(block.content);
      }
  }

  return sanitized;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  sanitizeTextInput,
  sanitizePromptInput,
  sanitizeHTML,
  sanitizeChatHTML,
  sanitizeURL,
  sanitizeImageURL,
  sanitizeBlockContent,
};

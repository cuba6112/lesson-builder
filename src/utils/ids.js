// Unique ID generation utilities

/**
 * Generate a unique block ID using crypto API
 * Falls back to timestamp + random for older browsers
 */
export function generateBlockId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random hex
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate a unique message ID for chat
 */
export function generateMessageId() {
  return `msg-${generateBlockId()}`;
}

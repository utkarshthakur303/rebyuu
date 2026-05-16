/**
 * Input sanitization utilities
 * Port from web app - prevents injection attacks
 */

export function sanitizeInput(input, maxLength = 10000) {
  if (typeof input !== 'string') return '';
  let sanitized = input.trim().slice(0, maxLength);
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return sanitized;
}

export function sanitizeComment(content) {
  return sanitizeInput(content, 5000);
}

export function sanitizeUsername(username) {
  return sanitizeInput(username, 50).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function sanitizeSearchQuery(query) {
  return sanitizeInput(query, 200);
}

export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

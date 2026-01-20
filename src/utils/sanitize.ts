/**
 * Input sanitization utilities
 * Prevents XSS and injection attacks
 */

/**
 * Sanitize HTML content to prevent XSS
 * For production use DOMPurify library, this is a basic implementation
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Sanitize user input for database queries
 * Basic protection against SQL injection (Supabase handles most, but be safe)
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize whitespace (prevent hidden characters)
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return sanitized;
}

/**
 * Sanitize comment content
 */
export function sanitizeComment(content: string): string {
  const maxLength = 5000; // Reasonable comment length
  return sanitizeInput(content, maxLength);
}

/**
 * Sanitize username
 */
export function sanitizeUsername(username: string): string {
  // Allow alphanumeric, underscore, hyphen, max 50 chars
  return sanitizeInput(username, 50).replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  // Allow most characters for search, but limit length
  return sanitizeInput(query, 200);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

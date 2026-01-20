/**
 * Centralized error handling and logging utility
 * Production-ready error management with structured logging
 */

type ErrorContext = {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Sanitize error messages before displaying to users
 * Prevents leaking sensitive information
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // In production, only show user-friendly messages
    if (import.meta.env.PROD) {
      // Check for known error types
      if (error.message.includes('JWT')) {
        return 'Authentication error. Please log in again.';
      }
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return 'Network error. Please check your connection.';
      }
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      // Generic fallback
      return 'Something went wrong. Please try again.';
    }
    // In development, show full error
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Log errors with context (structured logging)
 * In production, this should integrate with monitoring service (Sentry, etc.)
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
    env: import.meta.env.MODE,
  };

  // Only log to console in development
  if (!import.meta.env.PROD) {
    console.error('[Error]', errorInfo);
  }

  // In production, send to monitoring service
  // Example: Sentry.captureException(error, { extra: context });
}

/**
 * Wrap async functions with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return null;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Create timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

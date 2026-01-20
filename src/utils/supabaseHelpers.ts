/**
 * Enhanced Supabase query helpers
 * Adds timeout, retry, and error handling to queries
 */
import { supabase } from '@/services/supabase';
import { withTimeout, withRetry, logError, sanitizeErrorMessage } from './errorHandler';
import type { PostgrestError } from '@supabase/supabase-js';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 2;

/**
 * Safe Supabase query wrapper with timeout and retry
 */
export async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options?: {
    timeout?: number;
    retries?: number;
    context?: string;
  }
): Promise<{ data: T | null; error: string | null }> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_MAX_RETRIES, context } = options || {};

  try {
    const result = await withRetry(
      () => withTimeout(queryFn(), timeout),
      retries
    );

    if (result.error) {
      logError(result.error, { component: 'supabase', action: context });
      return {
        data: null,
        error: sanitizeErrorMessage(result.error),
      };
    }

    return {
      data: result.data,
      error: null,
    };
  } catch (error) {
    logError(error, { component: 'supabase', action: context });
    return {
      data: null,
      error: sanitizeErrorMessage(error),
    };
  }
}

/**
 * Check if Supabase is reachable
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      supabase.from('anime_index').select('id').limit(1),
      5000
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get Supabase query timeout based on operation type
 */
export function getQueryTimeout(operation: 'read' | 'write' | 'delete'): number {
  switch (operation) {
    case 'read':
      return 10000; // 10 seconds
    case 'write':
      return 15000; // 15 seconds
    case 'delete':
      return 10000; // 10 seconds
    default:
      return 10000;
  }
}

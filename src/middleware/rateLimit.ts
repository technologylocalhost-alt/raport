/**
 * Rate Limiting Middleware
 * Proteksi terhadap brute force dan DDoS attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (untuk production, gunakan Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired entries (run periodically)
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup setiap 1 menit
setInterval(cleanupExpiredEntries, 60 * 1000);

/**
 * Get identifier for rate limiting (IP address atau user ID)
 */
function getIdentifier(request: NextRequest): string {
  // Prioritas: User ID > IP Address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Jika ada auth token, extract userId untuk lebih specific limiting
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    return `user:${authHeader.substring(0, 20)}:${ip}`;
  }
  
  return `ip:${ip}`;
}

/**
 * Check rate limit untuk request
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Jika tidak ada entry atau sudah expired, create new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Jika sudah melebihi limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const identifier = getIdentifier(request);
    const result = checkRateLimit(identifier, config);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    };

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      logger.warn('Rate limit exceeded', {
        identifier,
        path: request.nextUrl.pathname,
        retryAfter,
      });

      return NextResponse.json(
        {
          success: false,
          error: config.message || 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // Request allowed, continue
    return null;
  };
}

/**
 * Preset rate limit configurations
 */
export const rateLimitPresets = {
  // Strict untuk login/auth endpoints
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.',
  },

  // Moderate untuk API endpoints
  moderate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  },

  // Relaxed untuk public endpoints
  relaxed: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300,
    message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  },

  // Very strict untuk sensitive operations
  veryStrict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 1 jam.',
  },
};

/**
 * Example usage:
 * 
 * In API route:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await rateLimit(rateLimitPresets.strict)(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // Continue with actual logic...
 * }
 * ```
 */

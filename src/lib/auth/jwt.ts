import jwt from 'jsonwebtoken';
import { TokenPayload } from '@/types';
import { serverError } from '@/lib/server-log';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is not set');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is not set');
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as jwt.Secret;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as jwt.Secret;

const JWT_ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '10h') as jwt.SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '7d') as jwt.SignOptions['expiresIn'];

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: TokenPayload): TokenResponse {
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
  });

  return { accessToken, refreshToken };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    serverError('[Token Verify Failed]', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Verify token (throws error if invalid)
 * Used by middleware
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
    return decoded;
  } catch {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Decode token without verification (for checking expiry and payload)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const expiresAt = decoded.exp * 1000; // Convert to milliseconds
  return Date.now() >= expiresAt;
}

/**
 * Get expiration time from token
 */
export function getTokenExpiresIn(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;

  const expiresAt = decoded.exp * 1000; // Convert to milliseconds
  return Math.max(0, expiresAt - Date.now());
}

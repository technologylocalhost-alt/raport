import jwt, { SignOptions } from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp?: number;
  iat?: number;
}

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

const JWT_ACCESS_SECRET: string = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;

// Debug logs
console.log('[JWT Config]', {
  access_secret_length: JWT_ACCESS_SECRET.length,
  access_secret_start: JWT_ACCESS_SECRET.substring(0, 10),
  refresh_secret_length: JWT_REFRESH_SECRET.length,
  refresh_secret_start: JWT_REFRESH_SECRET.substring(0, 10),
});
const JWT_ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '15m') as string;
const JWT_REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '7d') as string;

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: TokenPayload): TokenResponse {
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET as any, {
    expiresIn: JWT_ACCESS_EXPIRY as any,
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET as any, {
    expiresIn: JWT_REFRESH_EXPIRY as any,
  });

  return { accessToken, refreshToken };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    console.log('[Verify AccessToken]', {
      token_length: token.length,
      token_start: token.substring(0, 20),
      secret_length: JWT_ACCESS_SECRET.length,
      secret_start: JWT_ACCESS_SECRET.substring(0, 10),
    });
    
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET as any) as TokenPayload;
    console.log('[Token Verified OK]', { userId: decoded.userId, role: decoded.role });
    return decoded;
  } catch (error) {
    console.error('[Token Verify Failed]', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET as any) as TokenPayload;
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

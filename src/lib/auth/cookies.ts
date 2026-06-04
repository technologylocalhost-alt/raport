import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { NextResponse } from 'next/server';

const isProduction = process.env.NODE_ENV === 'production';

function getSecureCookieFlag() {
  return isProduction;
}

export function getAuthCookieOptions(maxAge: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: getSecureCookieFlag(),
    sameSite: 'lax',
    maxAge,
    path: '/',
  };
}

export function setAccessTokenCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set('accessToken', token, getAuthCookieOptions(maxAge));
}

export function setRefreshTokenCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set('refreshToken', token, getAuthCookieOptions(maxAge));
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set('accessToken', '', getAuthCookieOptions(0));
  response.cookies.set('refreshToken', '', getAuthCookieOptions(0));
}

export function setNoStoreHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
}

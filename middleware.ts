import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];

// Protected route prefixes that require authentication
const protectedPrefixes = ['/admin', '/teacher', '/wali-kelas', '/api/admin', '/api/teacher', '/api/wali-kelas'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('accessToken')?.value;

  // Skip middleware for static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    // If user already logged in and tries to access /login, redirect to their dashboard
    if (pathname === '/login' && accessToken) {
      // We can't verify the token here (Edge Runtime limitation)
      // So we just redirect to a default page and let the client handle role-based routing
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Check if route requires authentication
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  // Redirect to login if accessing protected route without token
  if (isProtectedRoute && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    // Add the original URL as redirect parameter
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect root path to login if not authenticated
  if (pathname === '/' && !accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect root path to dashboard if authenticated
  if (pathname === '/' && accessToken) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configure which routes to apply middleware
export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/teacher/:path*',
    '/wali-kelas/:path*',
    '/api/:path*',
    '/login',
  ],
};

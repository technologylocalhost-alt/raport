import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];

// Protected route prefixes that require authentication
const protectedPrefixes = ['/admin', '/teacher', '/wali-kelas', '/api/admin', '/api/teacher', '/api/wali-kelas'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('accessToken')?.value;

  // Skip middleware for static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  // Allow public routes - handle them without redirect logic for API endpoints
  if (publicRoutes.includes(pathname)) {
    // For API endpoints, always allow access without redirects
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }
    
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
    return NextResponse.redirect(loginUrl, { status: 307 });
  }

  // Don't redirect root if user is making an API call or RSC request
  if (pathname === '/' && !accessToken) {
    // Check if it's an API or RSC request - don't redirect those
    if (request.headers.get('next-router-state-tree') || request.headers.get('rsc')) {
      return NextResponse.next();
    }
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

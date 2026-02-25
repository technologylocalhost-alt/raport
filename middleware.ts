import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout', '/api/health', '/api/debug'];

// Protected route prefixes that require authentication
const protectedPrefixes = ['/admin', '/teacher', '/wali-kelas', '/api/admin', '/api/teacher', '/api/wali-kelas'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // Skip middleware for static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
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

  // Redirect to login if accessing protected route without tokens
  if (isProtectedRoute && !accessToken && !refreshToken) {
    console.log('[Middleware] No tokens found, redirecting to login:', pathname);
    
    // Don't redirect API calls - just return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No authentication tokens found' },
        { status: 401 }
      );
    }
    
    const loginUrl = new URL('/login', request.url);
    // Add the original URL as redirect parameter (but not for API routes)
    if (!pathname.startsWith('/api/')) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl, { status: 307 });
  }

  // If has refresh token but no access token, let it pass
  // The API will handle refreshing or returning 401
  if (isProtectedRoute && !accessToken && refreshToken) {
    console.log('[Middleware] Has refresh token but no access token, allowing through:', pathname);
    return NextResponse.next();
  }

  // Don't redirect root if user is making an API call or RSC request
  if (pathname === '/' && !accessToken && !refreshToken) {
    // Check if it's an API or RSC request - don't redirect those
    if (request.headers.get('next-router-state-tree') || request.headers.get('rsc')) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect root path to dashboard if authenticated
  if (pathname === '/' && (accessToken || refreshToken)) {
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

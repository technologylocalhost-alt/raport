import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractBearerToken } from '@/lib/auth/utils';

// Routes that don't require authentication
const publicRoutes = ['/api/auth/login', '/api/auth/register'];

// Routes that require specific roles
const roleBasedRoutes: Record<string, string[]> = {
  '/api/admin': ['ADMIN', 'PRINCIPAL'],
  '/api/teacher': ['TEACHER', 'PRINCIPAL'],
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for public routes and static files
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Check if route requires authentication
  const isProtectedRoute = pathname.startsWith('/api/');

  if (isProtectedRoute) {
    const token = extractBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check role-based access
    for (const [route, allowedRoles] of Object.entries(roleBasedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(payload.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Add user info to request headers for later use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-User-Id', payload.userId);
    requestHeaders.set('X-User-Email', payload.email);
    requestHeaders.set('X-User-Role', payload.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

// Configure which routes to apply middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for public routes and static files
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // NOTE: JWT verification happens in individual API routes, not in middleware
  // because middleware runs in Edge Runtime which doesn't support Node.js crypto module
  
  return NextResponse.next();
}

// Configure which routes to apply middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

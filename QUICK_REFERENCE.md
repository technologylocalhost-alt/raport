# 🚀 Quick Reference - New Infrastructure

Panduan cepat untuk menggunakan file-file baru yang telah dibuat.

## 📝 Table of Contents
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Logging](#logging)
- [Testing](#testing)
- [Types](#types)

---

## 🔐 Authentication

### Pattern 1: Using withAuth HOF (Recommended)

```typescript
import { withAuth } from '@/middleware/auth';
import { NextRequest, NextResponse } from 'next/server';

// Public endpoint - no auth required
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Public data' });
}

// Protected endpoint - auth required
export const POST = withAuth(async (request, user) => {
  // user is already authenticated
  console.log('User:', user.userId, user.email, user.role);
  
  return NextResponse.json({ 
    message: 'Protected data',
    userId: user.userId 
  });
});

// Role-based access
export const DELETE = withAuth(
  async (request, user) => {
    // Only ADMIN can access
    return NextResponse.json({ message: 'Admin only' });
  },
  { roles: ['ADMIN'] }
);
```

### Pattern 2: Manual Authentication

```typescript
import { authenticateRequest, checkRole } from '@/middleware/auth';

export async function PUT(request: NextRequest) {
  // Manually authenticate
  const user = await authenticateRequest(request);
  
  // Check specific role
  checkRole(user, ['ADMIN', 'TEACHER']);
  
  // Continue with logic
  return NextResponse.json({ user });
}
```

---

## ⚠️ Error Handling

### Pattern 1: Using asyncHandler (Recommended)

```typescript
import { asyncHandler } from '@/middleware/errorHandler';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const POST = asyncHandler(async (request) => {
  const body = await request.json();
  
  // Throw custom errors - will be handled automatically
  if (!body.email) {
    throw new ValidationError('Email is required');
  }
  
  const user = await prisma.user.findUnique({ 
    where: { email: body.email } 
  });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  return NextResponse.json({ success: true, data: user });
});
```

### Pattern 2: Manual Error Handling

```typescript
import { handleError } from '@/middleware/errorHandler';
import { ValidationError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.email) {
      throw new ValidationError('Email is required');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
```

### Available Error Classes

```typescript
import {
  ValidationError,      // 400 - Bad Request
  UnauthorizedError,    // 401 - Unauthorized
  ForbiddenError,       // 403 - Forbidden
  NotFoundError,        // 404 - Not Found
  ConflictError,        // 409 - Conflict
  TooManyRequestsError, // 429 - Too Many Requests
  DatabaseError,        // 500 - Database Error
} from '@/lib/errors';

// Usage
throw new ValidationError('Invalid input');
throw new NotFoundError('Resource not found');
throw new UnauthorizedError('Please login');
```

---

## 🚦 Rate Limiting

### Using Presets

```typescript
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';

// Login endpoint - strict limit
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(rateLimitPresets.strict)(request);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Continue with login logic
}
```

### Available Presets

```typescript
// 5 requests per 15 minutes
rateLimitPresets.strict

// 60 requests per minute  
rateLimitPresets.moderate

// 300 requests per minute
rateLimitPresets.relaxed

// 3 requests per hour
rateLimitPresets.veryStrict
```

### Custom Rate Limit

```typescript
import { rateLimit } from '@/middleware/rateLimit';

const customLimit = await rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,
  message: 'Too many requests',
})(request);

if (customLimit) return customLimit;
```

---

## 📊 Logging

### Basic Logging

```typescript
import { logger } from '@/lib/logger';

// Different log levels
logger.debug('Debug info', { variable: value });
logger.info('User action', { userId, action: 'login' });
logger.warn('Deprecated feature used', { feature: 'oldAPI' });
logger.error('Error occurred', error, { context: 'payment' });
```

### API Logging

```typescript
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Log request
  logger.apiRequest('POST', '/api/users', { userId });
  
  try {
    // Your logic here
    const result = await createUser();
    
    // Log response
    const duration = Date.now() - startTime;
    logger.apiResponse('POST', '/api/users', 200, duration);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    // Log error
    logger.apiError('POST', '/api/users', error as Error);
    throw error;
  }
}
```

### Specialized Logging

```typescript
// Authentication events
logger.authEvent('login_success', userId);
logger.authEvent('login_failed', undefined, { email, ip });

// Database queries (development only)
logger.dbQuery('SELECT * FROM users', 25);
```

---

## 🧪 Testing

### Writing Tests

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { cleanDatabase, createTestUser } from '../setup';

describe('User API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });
  
  test('should create user', async () => {
    // Arrange
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
    };
    
    // Act
    const user = await createUser(userData);
    
    // Assert
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test tests/api/auth.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

---

## 🏷️ Types

### Using Shared Types

```typescript
import type {
  ApiResponse,
  PaginatedResponse,
  TokenPayload,
  StudentData,
  GradeData,
} from '@/types';

// API Response
const response: ApiResponse<StudentData> = {
  success: true,
  data: student,
};

// Paginated Response
const paginatedResponse: PaginatedResponse<GradeData> = {
  success: true,
  data: grades,
  pagination: {
    page: 1,
    limit: 10,
    total: 100,
    totalPages: 10,
  },
};

// Token Payload
function handleUser(user: TokenPayload) {
  console.log(user.userId, user.email, user.role);
}
```

---

## 🎯 Complete Example

Combining everything:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import type { ApiResponse, StudentData } from '@/types';

export const POST = asyncHandler(async (request: NextRequest) => {
  const startTime = Date.now();
  
  // 1. Rate limiting
  const rateLimitResponse = await rateLimit(rateLimitPresets.moderate)(request);
  if (rateLimitResponse) return rateLimitResponse;
  
  // 2. Authentication
  const { authenticateRequest } = await import('@/middleware/auth');
  const user = await authenticateRequest(request);
  
  // 3. Logging
  logger.apiRequest('POST', '/api/students', { userId: user.userId });
  
  // 4. Validation
  const body = await request.json();
  if (!body.name || !body.email) {
    throw new ValidationError('Name and email are required');
  }
  
  // 5. Business logic
  const student = await prisma.student.create({
    data: {
      name: body.name,
      email: body.email,
      classId: body.classId,
    },
  });
  
  // 6. Response with proper typing
  const response: ApiResponse<StudentData> = {
    success: true,
    data: student,
  };
  
  // 7. Log response
  const duration = Date.now() - startTime;
  logger.apiResponse('POST', '/api/students', 201, duration);
  
  return NextResponse.json(response, { status: 201 });
});
```

---

## 🔧 Environment Variables

```env
# Required for new infrastructure
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="min-32-chars-random-string"
JWT_REFRESH_SECRET="different-32-chars-random-string"
NODE_ENV="production"
```

Generate secure secrets:
```bash
openssl rand -base64 32
```

---

## 📚 More Info

- **Full API Docs**: `docs/API.md`
- **Security Guide**: `docs/SECURITY.md`
- **Deployment**: `docs/DEPLOYMENT.md`
- **Testing Guide**: `tests/README.md`
- **Contributing**: `CONTRIBUTING.md`

---

## 🆘 Common Issues

### "Token is invalid"
- Check JWT_ACCESS_SECRET is set correctly
- Verify token is sent in Authorization header
- Check token hasn't expired (15 min default)

### "Rate limit exceeded"
- Wait for rate limit window to reset
- Check rate limit headers for reset time
- Adjust rate limit preset if needed

### "Database error"
- Verify DATABASE_URL is correct
- Check database is running
- Run `bun run prisma:generate`

### "Type errors"
- Import types from `@/types`
- Run `bunx tsc --noEmit` to check
- Ensure Prisma client is generated

---

**Quick Start**: Run `./setup-new-infrastructure.sh` to verify everything!

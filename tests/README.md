# Tests

Folder ini berisi semua test files untuk sistem raport.

## 🧪 Running Tests

### Run All Tests
```bash
bun test
```

### Run Specific Test File
```bash
bun test tests/api/auth.test.ts
```

### Run Tests in Watch Mode
```bash
bun test --watch
```

### Run Tests with Coverage
```bash
bun test --coverage
```

## 📁 Test Structure

```
tests/
├── setup.ts              # Test configuration & helpers
├── api/                  # API endpoint tests
│   ├── auth.test.ts     # Authentication tests
│   ├── users.test.ts    # User management tests
│   └── grades.test.ts   # Grades management tests
├── lib/                 # Library/utility tests
│   ├── auth.test.ts     # Auth utilities tests
│   └── logger.test.ts   # Logger tests
└── integration/         # Integration tests
    └── report.test.ts   # Report generation tests
```

## ✍️ Writing Tests

### Test File Template

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../setup';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('Feature Name', () => {
  describe('Function/Endpoint Name', () => {
    test('should do something', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## 🎯 Test Best Practices

### 1. Follow AAA Pattern
```typescript
test('should create user', async () => {
  // Arrange - Setup test data
  const userData = { name: 'Test', email: 'test@example.com' };
  
  // Act - Execute the function
  const user = await createUser(userData);
  
  // Assert - Verify the result
  expect(user.name).toBe('Test');
});
```

### 2. Use Descriptive Test Names
```typescript
// ❌ Bad
test('user test', () => { ... });

// ✅ Good
test('should create user with valid data', () => { ... });
test('should fail when email is invalid', () => { ... });
```

### 3. Clean Database Between Tests
```typescript
beforeEach(async () => {
  await cleanDatabase(); // Ensure clean state
});
```

### 4. Test Edge Cases
```typescript
describe('validateEmail', () => {
  test('should accept valid email', () => { ... });
  test('should reject invalid format', () => { ... });
  test('should reject empty string', () => { ... });
  test('should reject null', () => { ... });
  test('should trim whitespace', () => { ... });
});
```

### 5. Use Test Helpers
```typescript
import { createTestUser, generateTestToken } from '../setup';

test('should get user profile', async () => {
  const user = await createTestUser();
  const token = generateTestToken(user);
  
  // Use token for authenticated request
  const response = await fetch('/api/user/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  expect(response.status).toBe(200);
});
```

## 🔧 Test Configuration

### Environment Variables

Create `.env.test` for test-specific configuration:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/raport_test"
JWT_ACCESS_SECRET="test-secret-key-for-testing-only"
JWT_REFRESH_SECRET="test-refresh-secret-for-testing"
NODE_ENV="test"
```

### Test Database

Setup separate test database:

```bash
# Create test database
createdb raport_test

# Push schema
DATABASE_URL="postgresql://..." bunx prisma db push
```

## 📊 Coverage Goals

Aim for these coverage targets:

- **Overall**: 80%+
- **Critical paths** (auth, grades): 95%+
- **Business logic**: 90%+
- **Utilities**: 85%+

## 🐛 Debugging Tests

### Enable Debug Logs
```bash
DEBUG=* bun test
```

### Run Single Test
```typescript
test.only('should focus on this test', () => {
  // This will run only this test
});
```

### Skip Test
```typescript
test.skip('should skip this test', () => {
  // This test will be skipped
});
```

### Add Debug Statements
```typescript
test('should debug', () => {
  console.log('Debug info:', variable);
  debugger; // Use with --inspect flag
});
```

## 📚 Resources

- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Testing Best Practices](https://testingjavascript.com/)

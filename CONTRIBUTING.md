# Contributing Guide

Terima kasih atas kontribusi Anda untuk sistem raport ini! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

---

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Give constructive feedback
- Focus on what is best for the community

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork repository di GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/raport.git
cd raport

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/raport.git
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Setup Environment

```bash
cp .env.example .env.local
# Edit .env.local dengan konfigurasi Anda
```

### 4. Setup Database

```bash
# Create database
createdb raport_db

# Run migrations
bun run prisma:migrate

# Seed data (optional)
bun run seed
```

### 5. Run Development Server

```bash
bun run dev
```

---

## 🔄 Development Workflow

### 1. Create Branch

```bash
# Sync dengan upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/`: New features
- `fix/`: Bug fixes
- `docs/`: Documentation updates
- `refactor/`: Code refactoring
- `test/`: Adding tests
- `chore/`: Maintenance tasks

Examples:
- `feature/add-student-import`
- `fix/login-validation-error`
- `docs/update-api-documentation`

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run tests
bun test

# Check linting
bun run lint

# Build check
bun run build
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add student import feature"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 5. Push & Create PR

```bash
git push origin feature/your-feature-name
```

Then create Pull Request on GitHub.

---

## 📝 Coding Standards

### TypeScript

- Use TypeScript untuk semua file
- Define proper types (avoid `any`)
- Use interfaces untuk complex objects
- Export types yang reusable

```typescript
// ✅ Good
interface Student {
  id: string;
  name: string;
  email: string;
}

function createStudent(data: Student): Promise<Student> {
  // ...
}

// ❌ Bad
function createStudent(data: any): any {
  // ...
}
```

### File Organization

```
src/
├── app/                  # Next.js pages & API routes
├── lib/                  # Shared utilities
├── middleware/           # Middleware functions
├── types/                # TypeScript types
└── components/           # React components (if any)
```

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Components**: PascalCase (`UserCard.tsx`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Types/Interfaces**: PascalCase (`UserData`, `ApiResponse`)

### Code Style

```typescript
// Use const/let, not var
const name = 'John';
let count = 0;

// Use template literals
const message = `Hello, ${name}`;

// Use arrow functions
const add = (a: number, b: number) => a + b;

// Use async/await over promises
async function fetchUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user;
}

// Destructuring
const { id, name, email } = user;

// Spread operator
const updatedUser = { ...user, name: 'New Name' };
```

### Error Handling

```typescript
// Use custom error classes
import { NotFoundError, ValidationError } from '@/lib/errors';

if (!user) {
  throw new NotFoundError('User not found');
}

if (!email) {
  throw new ValidationError('Email is required');
}

// Use try-catch for async operations
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', error);
  throw error;
}
```

### Logging

```typescript
import { logger } from '@/lib/logger';

// Use appropriate log levels
logger.debug('Debug information', { value });
logger.info('User logged in', { userId });
logger.warn('Deprecated API used', { endpoint });
logger.error('Database error', error, { query });
```

---

## 📌 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(auth): add password reset functionality

- Add password reset endpoint
- Send reset email
- Add reset token validation

Closes #123

---

fix(grades): correct average calculation

The average was including zero scores which skewed results.
Now only counts actual scores.

Fixes #456

---

docs(api): update authentication documentation

Add examples for refresh token flow

---

refactor(database): optimize student queries

- Add database indexes
- Use select to limit returned fields
- Implement pagination
```

### Rules

- Use present tense ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Keep subject line under 72 characters
- Reference issues/PRs in footer

---

## 🔃 Pull Request Process

### Before Creating PR

- [ ] Tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Code follows style guidelines
- [ ] Documentation updated (if needed)
- [ ] Commits follow guidelines

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How did you test these changes?

## Screenshots (if applicable)

## Related Issues
Closes #123
```

### Review Process

1. Create PR with clear description
2. Wait for CI checks to pass
3. Request review from maintainers
4. Address review comments
5. Wait for approval
6. Maintainer will merge

---

## 🧪 Testing

### Writing Tests

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { cleanDatabase } from '../setup';

describe('User Service', () => {
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

# Run specific test
bun test tests/api/auth.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

### Test Coverage

Aim for:
- Overall: 80%+
- Critical paths: 95%+
- New features: 90%+

---

## ❓ Questions?

- Open an issue
- Ask in discussions
- Email: dev@yourproject.com

---

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!

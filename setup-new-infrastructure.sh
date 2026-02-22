#!/bin/bash
# Quick Start Script - Setup & Verify New Infrastructure

echo "🚀 Setting up new infrastructure..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun installed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
bun install

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
bun run prisma:generate

# Check TypeScript compilation
echo ""
echo "🔍 Checking TypeScript..."
bunx tsc --noEmit --pretty

if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed"
else
    echo "⚠️  TypeScript has some errors (you may need to fix them)"
fi

# Run linter
echo ""
echo "🔍 Running linter..."
bun run lint

# Create test database (optional)
echo ""
read -p "Do you want to setup test database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Setting up test database..."
    
    # Check if PostgreSQL is running
    if command -v psql &> /dev/null; then
        echo "Creating test database..."
        psql -c "CREATE DATABASE raport_test;" 2>/dev/null || echo "Database might already exist"
        
        # Run migrations to test database
        export DATABASE_URL="postgresql://postgres:password@localhost:5432/raport_test"
        bunx prisma db push --skip-generate
        
        echo "✅ Test database created"
    else
        echo "⚠️  PostgreSQL not found. Skipping test database setup."
    fi
fi

# Check if all new files exist
echo ""
echo "🔍 Verifying new files..."

files=(
    "src/lib/errors.ts"
    "src/lib/logger.ts"
    "src/types/index.ts"
    "src/middleware/auth.ts"
    "src/middleware/rateLimit.ts"
    "src/middleware/errorHandler.ts"
    "src/app/api/health/route.ts"
    "src/app/api/example/route.ts"
    "tests/setup.ts"
    "tests/api/auth.test.ts"
    "docs/API.md"
    "docs/SECURITY.md"
    "docs/DEPLOYMENT.md"
    ".github/workflows/ci.yml"
)

missing_files=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (MISSING)"
        missing_files=$((missing_files + 1))
    fi
done

echo ""
if [ $missing_files -eq 0 ]; then
    echo "✅ All files present!"
else
    echo "⚠️  $missing_files files missing"
fi

# Test health endpoint (if server is running)
echo ""
echo "🏥 Testing health endpoint..."
echo "   (Start dev server with 'bun run dev' first if not running)"
echo ""

if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Health endpoint is working!"
    curl -s http://localhost:3000/api/health | jq '.' 2>/dev/null || cat
else
    echo "⚠️  Server not running or health endpoint not accessible"
    echo "   Start server with: bun run dev"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Next Steps:"
echo ""
echo "1. Read documentation:"
echo "   - docs/API.md          → API endpoints"
echo "   - docs/SECURITY.md     → Security best practices"
echo "   - docs/DEPLOYMENT.md   → Deployment guide"
echo "   - CONTRIBUTING.md      → Development guide"
echo ""
echo "2. Update existing API routes:"
echo "   - Use withAuth() for authentication"
echo "   - Use asyncHandler() for error handling"
echo "   - Add rate limiting on sensitive endpoints"
echo ""
echo "3. Remove security issues:"
echo "   - Remove console.log in src/lib/auth/jwt.ts"
echo "   - Move hardcoded values to .env"
echo "   - Generate secure secrets"
echo ""
echo "4. Run tests:"
echo "   bun test"
echo ""
echo "5. Start development:"
echo "   bun run dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

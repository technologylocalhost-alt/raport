# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN npm install -g bun && bun install --frozen-lockfile

# Copy prisma schema
COPY prisma ./prisma

# Set environment variables for build-time (dummy values for code generation)
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
ENV JWT_ACCESS_SECRET="build-time-secret"
ENV JWT_REFRESH_SECRET="build-time-secret"
ENV JWT_ACCESS_EXPIRY="15m"
ENV JWT_REFRESH_EXPIRY="7d"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NODE_ENV="production"

# Generate Prisma client
RUN bun run prisma:generate

# Copy source code
COPY . .

# Build Next.js application
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN bun run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN npm install -g bun && bun install --frozen-lockfile --production

# Copy prisma
COPY prisma ./prisma

# Generate Prisma client for production
RUN bun run prisma:generate

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["bun", "run", "start"]

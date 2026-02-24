# ============================================
# Multi-stage Dockerfile for Next.js + Bun
# Optimized for Low-Resource VPS (1GB RAM, 20GB Storage)
# ============================================

# Stage 1: Builder (Alpine for smaller size)
FROM oven/bun:1-alpine AS builder

# Install CA certificates for registry access
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (regenerate lockfile for clean install)
# Increased timeout for slow VPS network
RUN bun install --network-timeout=300000

# Copy only necessary source files
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY next.config.ts tsconfig.json next-env.d.ts bunfig.toml ./
COPY middleware.ts ./
COPY eslint.config.mjs postcss.config.mjs prisma.config.ts ./

# Set dummy environment variables for build stage only
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV JWT_ACCESS_SECRET="dummy-build-secret-min-32-chars-long"
ENV JWT_REFRESH_SECRET="dummy-build-secret-min-32-chars-long"
ENV NEXTAUTH_SECRET="dummy-build-secret"

# Build the application with memory limit
RUN bun run prisma:generate && \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_OPTIONS="--max-old-space-size=512" \
    bun run build

# Remove dev dependencies and clean cache
RUN bun install --production && \
    rm -rf /app/.next/cache

# ============================================
# Stage 2: Runtime (Alpine - minimal size)
# ============================================
FROM oven/bun:1-alpine

WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache tini

# Copy from builder
COPY --from=builder /app/package.json /app/bun.lock* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/bunfig.toml ./

# Set environment variables for low memory
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=384"
ENV PATH="/app/node_modules/.bin:$PATH"

# Expose port
EXPOSE 3000

# Health check with longer intervals to reduce overhead
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/api/health').catch(() => process.exit(1))" || exit 1

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with Bun
CMD ["bun", "run", "start"]

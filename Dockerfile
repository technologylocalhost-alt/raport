# ============================================
# Multi-stage Dockerfile for Next.js + Bun
# Optimized for Low-Resource VPS (1GB RAM, 20GB Storage)
# ============================================

# Stage 1: Builder (Alpine for smaller size)
FROM oven/bun:1-alpine AS builder

# Install CA certificates for registry access
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy lockfile dan package.json dulu (layer ini jarang berubah = cache hit)
COPY package.json bun.lock ./

# Install dependencies menggunakan frozen lockfile (lebih cepat, deterministic)
RUN bun install --frozen-lockfile --network-timeout=300000

# Copy prisma schema dulu (layer terpisah, jarang berubah)
COPY prisma ./prisma

# Generate Prisma client (cache terpisah dari build)
RUN bun run prisma:generate

# Copy config files (jarang berubah)
COPY next.config.ts tsconfig.json bunfig.toml ./
COPY eslint.config.mjs postcss.config.mjs prisma.config.ts ./
COPY middleware.ts ./

# Copy source files terakhir (paling sering berubah)
COPY scripts ./scripts
COPY src ./src
COPY public ./public

# Set dummy environment variables for build stage only
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV JWT_ACCESS_SECRET="dummy-build-secret-min-32-chars-long"
ENV JWT_REFRESH_SECRET="dummy-build-secret-min-32-chars-long"
ENV NEXTAUTH_SECRET="dummy-build-secret"

# Build the application with memory limit
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_OPTIONS="--max-old-space-size=512" \
    bun run build

# Strip dev dependencies, keep production deps (termasuk puppeteer)
RUN bun install --production --network-timeout=300000

# Bersihkan cache Next.js yang tidak perlu di image
RUN rm -rf /app/.next/cache

# ============================================
# Stage 2: Runtime (Alpine - minimal size)
# ============================================
FROM oven/bun:1-alpine

WORKDIR /app

# Install runtime dependencies including Chromium for Puppeteer
RUN apk add --no-cache \
    tini \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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
ENV PORT=9876
ENV NODE_OPTIONS="--max-old-space-size=384"
ENV PATH="/app/node_modules/.bin:$PATH"

# Expose port
EXPOSE 9876

# Health check with longer intervals to reduce overhead
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD bun run -e "fetch('http://localhost:9876/api/health').catch(() => process.exit(1))" || exit 1

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with Bun
CMD ["bun", "run", "start"]

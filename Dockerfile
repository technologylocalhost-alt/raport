# ============================================
# Multi-stage Dockerfile for Next.js + Bun
# Production-ready image
# ============================================

# Stage 1: Builder
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --production=false

# Copy source code
COPY . .

# Build the application
RUN bun run prisma:generate && \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true bun run build

# ============================================
# Stage 2: Runtime (Bun)
# ============================================
FROM oven/bun:latest

WORKDIR /app

# Copy from builder
COPY --from=builder /app/package.json /app/bun.lock* ./
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/prisma /app/prisma

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/api/health').catch(() => process.exit(1))" || exit 1

# Start application with Bun
CMD ["bun", "run", "start"]

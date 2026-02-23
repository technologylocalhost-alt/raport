# Docker Deployment Guide

## Overview
Dockerfile untuk menjalankan aplikasi Raport Next.js dalam Docker dengan **Bun runtime**. Database sudah ada di external server (103.181.182.52:5432).

## Prerequisites
- Docker & Docker Compose installed
- `.env` file dengan konfigurasi yang benar
- External PostgreSQL sudah running di 103.181.182.52:5432

## Quick Start

### 1. Prepare Environment
```bash
# Ensure .env is configured
cat .env
# DATABASE_URL=postgresql://raport:raport_password_123@103.181.182.52:5432/raport_db
# NODE_ENV=production
# JWT_ACCESS_SECRET=...
# JWT_REFRESH_SECRET=...
```

### 2. Build & Run with Docker Compose
```bash
# Build image
docker compose build

# Start container
docker compose up -d

# View logs
docker compose logs -f app

# Stop container
docker compose down
```

### 3. Build & Run with Docker CLI
```bash
# Build image
docker build -t raport:latest .

# Run container
docker run -d \
  --name raport-app \
  -p 3000:3000 \
  --env-file .env \
  raport:latest

# Check logs
docker logs -f raport-app
```

## Configuration

### Environment Variables (in .env)
```env
# Required
DATABASE_URL=postgresql://raport:password@103.181.182.52:5432/raport_db
NODE_ENV=production

# JWT
JWT_ACCESS_SECRET=<your-secret-key>
JWT_REFRESH_SECRET=<your-secret-key>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Optional
APP_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-secret>
```

## Health Check
The container includes a health check that verifies the application is running:
```
GET http://localhost:3000/api/health
```

## Image Details
- **Base**: oven/bun:latest (lightweight + Bun runtime)
- **Runtime**: Bun (fast JavaScript runtime)
- **Size**: ~400-450MB (compact)
- **Build Time**: ~2-3 minutes
- **Runtime Port**: 3000

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 103.181.182.52:5432
```
**Solution**: Check if external PostgreSQL is running and DATABASE_URL is correct

### Build Fails
```
error: Puppeteer download failed
```
**Solution**: This is expected. Add `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` to .env

### Container Exits Immediately
```bash
# Check logs
docker logs raport-app

# Verify environment variables
docker inspect raport-app | grep -A 20 Env
```

## Production Deployment

### Using Docker Compose
```bash
# Build and start
docker compose -f docker-compose.yml up -d

# Update application
docker compose pull
docker compose up -d
```

### Manual Docker Commands
```bash
# Build production image
docker build -t your-registry/raport:1.0.0 .

# Push to registry
docker push your-registry/raport:1.0.0

# Run on server
docker run -d \
  --name raport-app \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  your-registry/raport:1.0.0
```

## Useful Commands

```bash
# View running containers
docker ps

# View image size
docker images raport

# Stop container
docker compose stop

# Remove container & image
docker compose down
docker rmi raport:latest

# Rebuild without cache
docker compose build --no-cache

# Execute command in container (with Bun)
docker compose exec app bun run db:seed

# Check container stats
docker stats raport-app

# Shell access
docker compose exec app bun shell
```

## Notes
- The `.next` and dependencies are cached in separate Docker layers for faster rebuilds
- Health checks are enabled to automatically restart unhealthy containers
- Multi-stage build keeps image size minimal
- Uses Bun runtime for faster startup and execution
- All environment variables must be set before running

## Bun-Specific Features
- ✅ Faster startup time than Node.js
- ✅ Better resource utilization
- ✅ Native TypeScript support
- ✅ Same API as Node.js

## Support
For issues, check:
1. Database connectivity: `docker compose exec app bun run -e "fetch('http://localhost:3000/api/health')"`
2. Environment variables: `docker compose config`
3. Logs: `docker compose logs -f app`

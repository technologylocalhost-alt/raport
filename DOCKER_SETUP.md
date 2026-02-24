# Docker Deployment Guide

## Overview
Dockerfile untuk menjalankan aplikasi Raport Next.js dalam Docker dengan **Bun runtime**. Database sudah ada di external server (103.181.182.52:5432).

**⚡ OPTIMIZED FOR LOW-RESOURCE VPS**: Docker setup ini telah dioptimalkan untuk VPS dengan spesifikasi rendah (1GB RAM, 20GB Storage).

## Prerequisites
- Docker & Docker Compose installed
- `.env` file dengan konfigurasi yang benar
- External PostgreSQL sudah running di 103.181.182.52:5432
- **Minimal VPS Requirements**: 1GB RAM, 20GB Storage (sudah dioptimalkan)

## 🚀 Low-Resource VPS Optimization

Setup ini telah dioptimalkan untuk VPS dengan resource terbatas:

### Resource Limits
- **Memory Limit**: 512MB (sudah dikonfigurasi di docker-compose.yml)
- **CPU Limit**: 0.75 CPU cores
- **Node.js Heap**: 384MB (NODE_OPTIONS sudah diset)
- **Image Size**: ~200-250MB (Alpine-based)

### Optimizations Applied
✅ Alpine-based images (lebih kecil)
✅ Multi-stage build yang efisien
✅ Memory limits untuk prevent OOM
✅ Reduced health check frequency
✅ Log rotation (max 30MB total)
✅ Production-only dependencies
✅ Cache cleanup otomatis

### Additional VPS Recommendations

#### 1. Enable Swap (Untuk VPS 1GB RAM)
```bash
# Create 1GB swap file
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

#### 2. Clean Docker System Regularly
```bash
# Remove unused images, containers, volumes
docker system prune -a --volumes -f

# Schedule weekly cleanup (crontab)
0 2 * * 0 docker system prune -a --volumes -f
```

#### 3. Monitor Resource Usage
```bash
# Check memory usage
docker stats raport-app

# Check disk usage
df -h
docker system df
```

#### 4. Build on VPS Tips
```bash
# Build with reduced parallelism to avoid OOM
docker compose build --no-cache

# If build fails with OOM, build locally and push to registry
# Then pull on VPS instead of building
```

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
- **Base**: oven/bun:1-alpine (ultra-lightweight + Bun runtime)
- **Runtime**: Bun (fast JavaScript runtime)
- **Size**: ~200-250MB (optimized with Alpine)
- **Build Time**: ~2-4 minutes (depending on VPS specs)
- **Runtime Port**: 3000
- **Memory Usage**: ~256-384MB at runtime
- **CPU Usage**: Low (efficient with Bun)

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

### Out of Memory (OOM) on VPS
```
Error: JavaScript heap out of memory
```
**Solution**:
```bash
# 1. Verify memory limits are applied
docker inspect raport-app | grep Memory

# 2. Enable swap if not already
sudo swapon --show

# 3. Reduce memory usage by building locally
# Build on local machine, push to registry, then pull on VPS
docker tag raport:latest yourusername/raport:latest
docker push yourusername/raport:latest

# On VPS:
docker pull yourusername/raport:latest
docker tag yourusername/raport:latest raport:latest
```

### Build Fails with "No space left on device"
**Solution**:
```bash
# Clean Docker system
docker system prune -a --volumes -f

# Check disk space
df -h

# Remove old images
docker images | grep "<none>" | awk '{print $3}' | xargs docker rmi -f
```

### Container is Slow/Unresponsive
**Solution**:
```bash
# Check resource usage
docker stats raport-app

# If using too much memory, restart container
docker compose restart app

# Check if swap is being used heavily (indicates OOM)
free -h
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

### 🔧 Low-Resource VPS Specific Notes
- **Memory limits** are enforced at container level (512MB max)
- **NODE_OPTIONS** set to limit heap size to 384MB
- **Log rotation** configured to prevent disk filling (max 30MB)
- **Alpine base image** reduces image size by ~50%
- **Health checks** run every 60s (reduced frequency)
- **Swap recommended** for 1GB RAM VPS to prevent OOM
- **Build locally** if VPS build fails due to memory constraints

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

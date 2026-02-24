# Docker Deployment Guide

## Overview
Dockerfile untuk menjalankan aplikasi Raport Next.js dalam Docker dengan **Bun runtime**. Database menggunakan **Supabase PostgreSQL** (managed cloud database).

**⚡ OPTIMIZED FOR LOW-RESOURCE VPS**: Docker setup ini telah dioptimalkan untuk VPS dengan spesifikasi rendah (1GB RAM, 20GB Storage).

## Prerequisites
- Docker & Docker Compose installed
- `.env` file dengan konfigurasi yang benar
- **Supabase Project** dengan PostgreSQL database (gratis tier available)
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

### 0. Setup Supabase Database (First Time Only)

#### A. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign up (free tier available)
2. Create a new project
3. Wait for database provisioning (~2 minutes)

#### B. Get Database Connection Strings
1. Go to **Project Settings** → **Database**
2. Scroll down to **Connection String** section
3. Copy both URLs:
   - **Connection Pooling** (for runtime) - Port 6543
   - **Direct Connection** (for migrations) - Port 5432

#### C. Run Database Migrations
```bash
# Copy example env and update with your Supabase credentials
cp .env.example .env

# Edit .env and replace [YOUR-PASSWORD] with your actual password
nano .env

# Run migrations (use DIRECT_URL for migrations)
bun run prisma:migrate:deploy

# Or if using npm
npm run prisma:migrate:deploy
```

#### D. (Optional) Seed Database
```bash
bun run db:seed
```

### 1. Prepare Environment
```bash
# Ensure .env is configured with Supabase credentials
cat .env

# Example .env content:
# DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
# DIRECT_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
# NODE_ENV=production
# JWT_ACCESS_SECRET=...
# JWT_REFRESH_SECRET=...
# NEXTAUTH_SECRET=...
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
# Required - Supabase Database
# Get from: https://supabase.com/dashboard/project/_/settings/database
DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

NODE_ENV=production

# JWT - Generate with: openssl rand -base64 32
JWT_ACCESS_SECRET=<your-secret-key-min-32-chars>
JWT_REFRESH_SECRET=<your-secret-key-min-32-chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# NextAuth - Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<your-secret-min-32-chars>
NEXTAUTH_URL=http://localhost:3000

# Optional
APP_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Configuration Notes
- **DATABASE_URL** (Port 6543): Uses connection pooling via pgbouncer - recommended for production
- **DIRECT_URL** (Port 5432): Direct connection - required for migrations only
- **Free Tier**: 500MB database, 50,000 monthly active users
- **Backup**: Automatic daily backups (7 days retention on free tier)
- **Security**: SSL enabled by default

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
Error: connect ECONNREFUSED
```
**Solution**: 
1. Check if DATABASE_URL is correctly set in `.env`
2. Verify Supabase project is active (not paused)
3. Check your password is correct (get from Supabase dashboard)
4. Ensure you're using the correct connection string format:
   ```
   postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

### Supabase Project Paused
**Issue**: Free tier projects pause after 1 week of inactivity
**Solution**: 
1. Go to Supabase dashboard
2. Click "Restore" on your project
3. Restart Docker container: `docker compose restart app`

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

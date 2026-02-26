# 🐳 Docker Deployment Guide

Dockerfile untuk menjalankan aplikasi Raport Next.js dalam Docker dengan **Bun runtime** dan **Supabase PostgreSQL**.

✨ **Dioptimalkan untuk VPS Low-Resource** (1GB RAM, 20GB Storage)

## Prerequisites
- Docker & Docker Compose
- `.env` file dengan konfigurasi Supabase
- Supabase Project (gratis tier available)
- VPS: min 1GB RAM, 20GB Storage

## 🚀 VPS Optimization

**Resource Limits:**
- Memory: 512MB | CPU: 0.75 cores | Node Heap: 384MB | Image Size: ~200-250MB

**Applied Optimizations:**
- Alpine-based images (lebih ringan)
- Multi-stage build yang efisien
- Memory limits untuk prevent OOM
- Health check setiap 60 detik
- Log rotation (max 30MB)
- Production-only dependencies

### Setup Awal VPS (1GB RAM)

**1. Enable Swap**
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h  # Verify
```

**2. Monitoring Commands**
```bash
docker stats raport-app         # Memory usage
df -h                           # Disk space
docker system df                # Docker resources
```

**3. Regular Cleanup**
```bash
# Manual cleanup
docker system prune -a --volumes -f

# Scheduled (crontab) - setiap minggu
0 2 * * 0 docker system prune -a --volumes -f
```

## ⚙️ Setup Database Supabase

### Step 1: Create Supabase Project
1. Kunjungi [https://supabase.com](https://supabase.com) dan sign up
2. Buat project baru
3. Tunggu database provisioning (~2 menit)

### Step 2: Get Connection Strings
1. Buka **Project Settings** → **Database**
2. Copy kedua connection URL:
   - `DATABASE_URL` (port 6543) - dengan pgbouncer pooling
   - `DIRECT_URL` (port 5432) - untuk migrations

### Step 3: Configure & Migrate
```bash
cp .env.example .env
nano .env  # Update dengan credentials Supabase

# Run migrations (gunakan DIRECT_URL)
bun run prisma:migrate:deploy

# Optional: Seed database
bun run db:seed
```

**Supabase Free Tier:** 500MB database, 50k monthly active users, auto-backup 7 hari

## 🚀 Quick Start

### Docker Compose (Recommended)
```bash
docker compose build           # Build image
docker compose up -d           # Start container
docker compose logs -f app     # View logs
docker compose down            # Stop & remove
```

### Docker CLI
```bash
docker build -t raport:latest .
docker run -d --name raport-app -p 3000:3000 --env-file .env raport:latest
docker logs -f raport-app
docker stop raport-app && docker rm raport-app
```

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# Supabase Database
DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

NODE_ENV=production

# JWT Secret (generate: openssl rand -base64 32)
JWT_ACCESS_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# NextAuth Secret (generate: openssl rand -base64 32)
NEXTAUTH_SECRET=<min-32-chars>
NEXTAUTH_URL=http://localhost:3000

# Optional
APP_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Key Notes
- **DATABASE_URL**: Connection pooling (port 6543) - untuk production
- **DIRECT_URL**: Direct connection (port 5432) - khusus untuk migrations
- Health check: `GET http://localhost:3000/api/health`

## 🔧 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solutions:**
- Verifikasi DATABASE_URL di `.env`
- Pastikan Supabase project aktif (tidak paused)
- Cek password sudah benar di Supabase dashboard
- Format string: `postgresql://postgres.xxxxx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

### Supabase Project Paused
Free tier projects pause setelah 1 minggu tidak aktif
- Buka Supabase dashboard → klik "Restore"
- Restart container: `docker compose restart app`

### Build Fails - "No space left on device"
```bash
docker system prune -a --volumes -f   # Clean Docker system
df -h                                 # Check disk space
docker images | grep "<none>" | awk '{print $3}' | xargs docker rmi -f
```

### Out of Memory (OOM)
```bash
docker inspect raport-app | grep Memory     # Check limits
sudo swapon --show                          # Enable swap jika perlu
docker compose restart app
```

**If VPS build fails:** Build locally, push to registry, pull di VPS
```bash
docker tag raport:latest yourusername/raport:latest
docker push yourusername/raport:latest
# On VPS:
docker pull yourusername/raport:latest
docker tag yourusername/raport:latest raport:latest
```

### Chromium/PDF Generation Error
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Container Exits Immediately
```bash
docker logs raport-app         # Check logs
docker inspect raport-app | grep -A 20 Env  # Check env vars
```

### Container Slow/Unresponsive
```bash
docker stats raport-app        # Check resource usage
free -h                        # Check if swap being used
docker compose restart app     # Restart container
```

## 📦 Production Deployment

### Using Docker Compose
```bash
docker compose -f docker-compose.yml up -d    # Build & start
docker compose pull && docker compose up -d   # Update
```

### Manual Docker
```bash
docker build -t your-registry/raport:1.0.0 .
docker push your-registry/raport:1.0.0

docker run -d \
  --name raport-app \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  your-registry/raport:1.0.0
```

## 📋 Useful Commands

```bash
# Container Management
docker ps                        # List running containers
docker compose stop              # Stop container
docker compose down              # Remove container & networks

# Image Management
docker images raport             # View image size
docker compose build --no-cache  # Rebuild without cache
docker rmi raport:latest         # Remove image

# Debugging
docker logs raport-app           # View logs
docker compose logs -f app       # Follow logs
docker compose exec app bun shell      # Shell access
docker stats raport-app          # Real-time stats

# Database
docker compose exec app bun run db:seed  # Seed database
docker compose config            # Show full config
```

## 📊 Image Details

| Item | Detail |
|------|--------|
| Base | oven/bun:1-alpine |
| Runtime | Bun (fast JS runtime) |
| Size | ~200-250MB |
| Build Time | ~2-4 menit |
| Port | 3000 |
| Memory | ~256-384MB at runtime |
| CPU | Low (efficient) |

## ℹ️ Notes

- `.next` dan dependencies di-cache untuk rebuild lebih cepat
- Health checks enabled untuk auto-restart unhealthy containers
- Multi-stage build menjaga image size minimal
- Bun runtime lebih cepat dari Node.js
- Semua env variables harus diset sebelum run

### 🔧 VPS Tips
- Memory limits enforced di container level (512MB max)
- NODE_OPTIONS limit heap size ke 384MB
- Log rotation prevent disk filling (max 30MB)
- Alpine image 50% lebih ringan dari Ubuntu
- Health checks run setiap 60 detik
- Swap recommended untuk 1GB RAM VPS
- Build locally jika VPS build gagal karena OOM

# 🐳 Docker Deployment Guide

Panduan lengkap untuk deploy aplikasi Raport menggunakan Docker.

## 📋 Prerequisites

1. **Docker & Docker Compose** harus sudah terinstall
   ```bash
   # Check Docker
   docker --version
   
   # Check Docker Compose
   docker compose version
   ```

2. **Port yang dibutuhkan** harus tersedia:
   - `3000` - Aplikasi (bisa diganti)
   - `5432` - PostgreSQL (bisa diganti)

## 🚀 Quick Start

### Option 1: Menggunakan Helper Script (Recommended)

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Edit .env.docker dan update semua secrets
nano .env.docker  # atau gunakan editor lain

# 3. Generate secure secrets
openssl rand -base64 32  # Copy output ke JWT_ACCESS_SECRET
openssl rand -base64 32  # Copy output ke JWT_REFRESH_SECRET

# 4. Run deployment script
./docker-deploy.sh
```

Pilih option 1 untuk build dan start containers.

### Option 2: Manual Deployment

```bash
# 1. Setup environment
cp .env.docker.example .env.docker
nano .env.docker  # Update all values

# 2. Build and start
docker compose --env-file .env.docker up --build -d

# 3. Wait for database to be ready
sleep 10

# 4. Run migrations
docker compose --env-file .env.docker exec app bun run prisma:migrate:deploy

# 5. (Optional) Seed database
docker compose --env-file .env.docker exec app bun run seed
```

## 🔧 Configuration

### Environment Variables (.env.docker)

**CRITICAL: Update these values before deployment!**

```env
# Database
DB_USER=raport
DB_PASSWORD=CHANGE_THIS_SECURE_PASSWORD
DB_NAME=raport_db
DB_PORT=5432

# JWT Secrets (MUST be different and random!)
JWT_ACCESS_SECRET=GENERATE_WITH_OPENSSL_RAND
JWT_REFRESH_SECRET=DIFFERENT_RANDOM_STRING
```

**Generate secure secrets:**
```bash
# Run this 3 times and use different outputs
openssl rand -base64 32
```

## 📊 Managing Containers

### Start/Stop Containers

```bash
# Start all services
docker compose --env-file .env.docker up -d

# Stop all services
docker compose --env-file .env.docker down

# Restart services
docker compose --env-file .env.docker restart

# Stop and remove volumes (DANGER: deletes data!)
docker compose --env-file .env.docker down -v
```

### View Logs

```bash
# All logs
docker compose --env-file .env.docker logs -f

# Application logs only
docker compose --env-file .env.docker logs -f app

# Database logs only
docker compose --env-file .env.docker logs -f db

# Last 100 lines
docker compose --env-file .env.docker logs --tail=100
```

### Execute Commands

```bash
# Enter application container
docker compose exec app sh

# Enter database container
docker compose exec db psql -U raport -d raport_db

# Run Prisma commands
docker compose exec app bun run prisma:studio
docker compose exec app bun run prisma:migrate:deploy

# Run seed
docker compose exec app bun run seed
```

## 🗄️ Database Management

### Backup Database

```bash
# Create backup
docker compose exec db pg_dump -U raport raport_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec db pg_dump -U raport raport_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# Stop application first
docker compose stop app

# Restore from backup
cat backup.sql | docker compose exec -T db psql -U raport -d raport_db

# Or from compressed
gunzip -c backup.sql.gz | docker compose exec -T db psql -U raport -d raport_db

# Restart application
docker compose start app
```

### Connect to Database

```bash
# From host (if port is exposed)
psql -h localhost -p 5432 -U raport -d raport_db

# From container
docker compose exec db psql -U raport -d raport_db
```

## 🏥 Health Checks

### Check Application Health

```bash
# Using curl
curl http://localhost:3000/api/health

# Using the helper script
./docker-deploy.sh
# Select option 8

# Check container status
docker compose ps
```

### View Container Stats

```bash
# Resource usage
docker stats raport-app raport-db

# Detailed info
docker compose ps
docker inspect raport-app
```

## 🔄 Updates & Maintenance

### Update Application Code

```bash
# 1. Pull latest code
git pull

# 2. Rebuild and restart
docker compose --env-file .env.docker up --build -d

# 3. Run new migrations (if any)
docker compose exec app bun run prisma:migrate:deploy
```

### Update Dependencies

```bash
# Rebuild from scratch
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs app

# Check if ports are in use
netstat -tulpn | grep -E '3000|5432'

# Remove old containers
docker compose down
docker compose up -d
```

### Database Connection Issues

```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test connection
docker compose exec db pg_isready -U raport

# Restart database
docker compose restart db
```

### Application Crashes

```bash
# View error logs
docker compose logs --tail=100 app

# Check environment variables
docker compose exec app env | grep -E 'DATABASE_URL|JWT'

# Restart application
docker compose restart app
```

### Out of Disk Space

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

## 🔒 Security Best Practices

1. **Never commit .env.docker** to git
   ```bash
   # Already in .gitignore
   echo ".env.docker" >> .gitignore
   ```

2. **Use strong passwords**
   - Minimum 16 characters
   - Mix of letters, numbers, symbols
   - Different for each secret

3. **Limit port exposure**
   ```yaml
   # In docker-compose.yml
   # Don't expose database port in production
   # Comment out:
   # ports:
   #   - "5432:5432"
   ```

4. **Regular updates**
   ```bash
   # Update base images
   docker compose pull
   docker compose up -d
   ```

## 📝 Production Deployment

### Using Production Override

```bash
# Use production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Behind Nginx/Traefik

```nginx
# Nginx reverse proxy
server {
    listen 80;
    server_name raport.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🎯 Common Commands Cheatsheet

```bash
# Quick deploy
./docker-deploy.sh

# View logs
docker compose logs -f app

# Restart after code changes
docker compose up --build -d

# Run migrations
docker compose exec app bun run prisma:migrate:deploy

# Seed database
docker compose exec app bun run seed

# Backup database
docker compose exec db pg_dump -U raport raport_db > backup.sql

# Enter app shell
docker compose exec app sh

# Check health
curl http://localhost:3000/api/health

# Stop everything
docker compose down

# Remove everything (including data)
docker compose down -v
```

## 🆘 Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Verify environment variables in `.env.docker`
3. Ensure ports are not in use
4. Try rebuilding: `docker compose up --build -d`
5. Check documentation: `docs/DEPLOYMENT.md`

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Next.js Docker](https://nextjs.org/docs/deployment#docker-image)

# Docker Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Bun or Node.js (untuk development lokal)

## Quick Start

### 1. Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your values
nano .env.local  # or use your editor
```

Update `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` dengan nilai yang aman:

```bash
# Generate random secrets (Linux/Mac)
openssl rand -base64 32
```

### 2. Run Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

Script ini akan:
- ✓ Validasi Docker installation
- ✓ Setup environment variables
- ✓ Build Docker images
- ✓ Start PostgreSQL & Next.js services
- ✓ Run Prisma migrations otomatis

### 3. Access Application

- **App**: http://localhost:3000
- **Database**: localhost:5432

## Manual Docker Commands

### Build Images
```bash
docker-compose build
```

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f app       # Next.js app logs
docker-compose logs -f db        # PostgreSQL logs
```

### Run Migrations
```bash
docker-compose exec app bun run prisma:migrate
```

### Enter Application Container
```bash
docker-compose exec app sh
```

### Prisma Studio (Database GUI)
```bash
docker-compose exec app bun run prisma:studio
```

## Production Deployment

### Environment Variables untuk Production

```bash
# .env.local untuk production
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-very-secure-secret-key-here
JWT_ACCESS_SECRET=your-very-secure-jwt-secret-here
JWT_REFRESH_SECRET=your-very-secure-jwt-refresh-secret-here
DATABASE_URL=postgresql://user:password@your-db-host:5432/raport_db
```

### Docker Compose Production Override

Buat file `docker-compose.prod.yml`:

```yaml
version: '3.9'
services:
  app:
    environment:
      NODE_ENV: production
    # Tidak perlu expose port jika behind reverse proxy
    # ports:
    #   - "3000:3000"
    restart: always
    # Tambahkan lebih banyak replicas jika perlu scaling
```

### Deploy ke Production

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Database Backup

### Backup PostgreSQL
```bash
docker-compose exec -T db pg_dump -U raport raport_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
docker-compose exec -T db psql -U raport raport_db < backup_20240214_120000.sql
```

## Troubleshooting

### Port 3000 already in use
```bash
# Change port in docker-compose.yml
# Ubah APP_PORT=3000 menjadi APP_PORT=3001
```

### Database connection error
```bash
# Check if database is ready
docker-compose logs db

# Check network connectivity
docker-compose exec app ping db
```

### Prisma migration fails
```bash
# Reset database (WARNING: deletes all data)
docker-compose exec app bun run prisma:migrate reset

# Or check migrations status
docker-compose exec app bun run prisma:migrate status
```

### Container exiting immediately
```bash
# Check logs
docker-compose logs app

# Run container in interactive mode for debugging
docker-compose run --rm app sh
```

## Resource Management

### Memory & CPU Limits

Edit `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
  db:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

### Persistent Volumes

Data disimpan di:
- `postgres_data:/var/lib/postgresql/data` - Database files
- `app_node_modules:/app/node_modules` - Node modules cache

## Security Best Practices

1. **Change Default Secrets**
   ```bash
   # Generate strong secrets
   openssl rand -base64 32
   ```

2. **Use Strong Database Password**
   - Jangan gunakan default `raport_password_123`

3. **Enable SSL/TLS**
   - Gunakan reverse proxy (Nginx/Caddy)
   - Implement HTTPS

4. **Keep Images Updated**
   ```bash
   docker-compose build --pull
   ```

5. **Use .env.local for Secrets**
   - Add `.env.local` to `.gitignore`
   - Jangan commit sensitive data

## Additional Resources

- [Next.js Docker Deployment](https://nextjs.org/docs/deployment)
- [Prisma Docker Setup](https://www.prisma.io/docs/guides/docker)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

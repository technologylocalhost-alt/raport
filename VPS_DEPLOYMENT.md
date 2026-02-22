# 🚀 VPS Deployment Guide

Panduan lengkap untuk deploy aplikasi raport ke VPS dengan Docker.

## 📋 Prerequisites

- VPS dengan Ubuntu/Debian (minimal 2GB RAM)
- Docker & Docker Compose terinstall di VPS
- Domain/subdomain (opsional, bisa pakai IP)
- Port 80, 443, 3000 terbuka di firewall

## 🔧 Step 1: Setup VPS

### 1.1 Login ke VPS
```bash
ssh user@your-vps-ip
```

### 1.2 Verify Docker Installation
```bash
docker --version
docker compose version
```

Jika belum terinstall:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt update
sudo apt install docker-compose-plugin -y

# Logout dan login kembali
exit
ssh user@your-vps-ip
```

## 📦 Step 2: Upload Project ke VPS

### Option A: Clone dari Git (Recommended)
```bash
# Di VPS
cd ~
git clone https://github.com/your-username/raport.git
cd raport
```

### Option B: Upload Manual dengan rsync
```bash
# Di local machine
rsync -avz --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env.local' \
  /home/aran/raport/ \
  user@your-vps-ip:~/raport/
```

## 🔐 Step 3: Setup Environment

```bash
# Di VPS
cd ~/raport

# Copy environment template
cp .env.docker.example .env.docker

# Edit dengan credentials production
nano .env.docker
```

Update values berikut di `.env.docker`:
```env
# Database
DB_PASSWORD=your_secure_password_here_change_this

# JWT Secrets (generate dengan openssl)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# Production URL (ganti dengan domain/IP VPS Anda)
NEXT_PUBLIC_API_URL=http://your-vps-ip:3000
# atau jika punya domain:
# NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Generate Secure Secrets
```bash
# Di VPS
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
```

Copy output ke `.env.docker`.

## 🚀 Step 4: Deploy Application

```bash
# Di VPS
cd ~/raport

# Build dan start containers
docker compose --env-file .env.docker up --build -d

# Wait for containers to be healthy
docker compose --env-file .env.docker ps
```

## 💾 Step 5: Setup Database

```bash
# Di VPS
cd ~/raport

# Run migrations (manual karena Prisma v7)
docker compose --env-file .env.docker exec -T db psql -U raport -d raport_db < prisma/migrations/20260219072434_init/migration.sql

docker compose --env-file .env.docker exec -T db psql -U raport -d raport_db < prisma/migrations/20260219080305_add_daily_assessment_type/migration.sql

# Verify tables created
docker compose --env-file .env.docker exec db psql -U raport -d raport_db -c "\dt"

# (Opsional) Seed data
docker compose --env-file .env.docker exec app bun run seed
```

## ✅ Step 6: Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Check logs
docker compose --env-file .env.docker logs -f app
```

Access aplikasi: `http://your-vps-ip:3000`

## 🔒 Step 7: Setup Firewall (UFW)

```bash
# Di VPS
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3000/tcp   # Next.js (temporary)
sudo ufw enable
sudo ufw status
```

## 🌐 Step 8: Setup Nginx Reverse Proxy (Recommended)

### 8.1 Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

### 8.2 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/raport
```

Paste configuration berikut:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Ganti dengan domain Anda
    # Atau pakai IP: server_name 123.45.67.89;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 8.3 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/raport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Sekarang akses: `http://your-domain.com` atau `http://your-vps-ip`

## 🔐 Step 9: Setup SSL dengan Let's Encrypt (Opsional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (pastikan domain sudah pointing ke VPS)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal sudah disetup otomatis
sudo certbot renew --dry-run
```

Sekarang akses: `https://your-domain.com` ✅

## 🔄 Management Commands

### View Logs
```bash
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f db
```

### Restart Services
```bash
docker compose --env-file .env.docker restart
```

### Stop Services
```bash
docker compose --env-file .env.docker down
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose --env-file .env.docker up --build -d
```

### Backup Database
```bash
# Create backup
docker compose --env-file .env.docker exec db pg_dump -U raport raport_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose --env-file .env.docker exec -T db psql -U raport -d raport_db < backup_20260222_101500.sql
```

### Clean Up Old Images
```bash
docker system prune -a --volumes -f
```

## 📊 Monitoring

### Check Resource Usage
```bash
docker stats
```

### Check Container Status
```bash
docker compose --env-file .env.docker ps
```

### Check Nginx Status
```bash
sudo systemctl status nginx
```

## 🐛 Troubleshooting

### Container tidak start
```bash
# Check logs
docker compose --env-file .env.docker logs app

# Check environment variables
docker compose --env-file .env.docker exec app env | grep DATABASE_URL
```

### Database connection error
```bash
# Verify database is running
docker compose --env-file .env.docker exec db psql -U raport -d raport_db -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

### Port sudah digunakan
```bash
# Check what's using port 3000
sudo lsof -i :3000
sudo netstat -tulpn | grep 3000

# Kill process jika perlu
sudo kill -9 <PID>
```

### Nginx error
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test configuration
sudo nginx -t
```

## 🔐 Security Best Practices

1. **Change Default Passwords**: Jangan gunakan password default
2. **Use Strong JWT Secrets**: Generate dengan openssl
3. **Enable Firewall**: UFW atau iptables
4. **Use SSL/HTTPS**: Setup Let's Encrypt
5. **Regular Updates**: `sudo apt update && sudo apt upgrade`
6. **Backup Database**: Setup cron job untuk auto backup
7. **Monitor Logs**: Setup log monitoring/alerting
8. **Limit SSH Access**: Gunakan SSH key, disable password auth
9. **Rate Limiting**: Nginx rate limiting untuk API endpoints
10. **Regular Security Audits**: Check untuk vulnerabilities

## 📝 Auto Backup Script

Create backup script:
```bash
nano ~/backup-raport.sh
```

Paste:
```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
mkdir -p $BACKUP_DIR
cd /home/$USER/raport
docker compose --env-file .env.docker exec -T db pg_dump -U raport raport_db > "$BACKUP_DIR/raport_$(date +%Y%m%d_%H%M%S).sql"

# Keep only last 7 days
find $BACKUP_DIR -name "raport_*.sql" -mtime +7 -delete
```

Make executable:
```bash
chmod +x ~/backup-raport.sh
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
# Add line:
0 2 * * * /home/$USER/backup-raport.sh
```

## 📞 Support

Jika ada masalah:
1. Check logs: `docker compose logs -f`
2. Check health: `curl http://localhost:3000/api/health`
3. Restart containers: `docker compose restart`
4. Check documentation di `docs/`

---

**🎉 Selamat! Aplikasi raport Anda sekarang running di VPS dengan Docker!**

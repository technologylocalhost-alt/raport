#!/bin/bash

# =============================================================================
# Deploy to VPS Script
# Automated VPS deployment untuk aplikasi raport
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    print_error "Error: Must run from project root directory"
    exit 1
fi

print_header "🚀 Deploy Raport to VPS"

# Get VPS details
read -p "VPS IP Address: " VPS_IP
read -p "VPS SSH User (default: root): " VPS_USER
VPS_USER=${VPS_USER:-root}

read -p "Deploy directory on VPS (default: ~/raport): " DEPLOY_DIR
DEPLOY_DIR=${DEPLOY_DIR:-~/raport}

read -p "Use Git clone? (y/n, default: n): " USE_GIT
USE_GIT=${USE_GIT:-n}

if [ "$USE_GIT" = "y" ]; then
    read -p "Git repository URL: " GIT_REPO
fi

# =============================================================================
# Step 1: Verify VPS Connection
# =============================================================================
print_header "Step 1: Verifying VPS Connection"

if ssh -o ConnectTimeout=10 "$VPS_USER@$VPS_IP" "echo 'Connected'" &>/dev/null; then
    print_success "Connected to VPS successfully"
else
    print_error "Cannot connect to VPS. Check IP, user, and SSH key."
    exit 1
fi

# =============================================================================
# Step 2: Check Docker Installation
# =============================================================================
print_header "Step 2: Checking Docker Installation"

if ssh "$VPS_USER@$VPS_IP" "docker --version && docker compose version" &>/dev/null; then
    print_success "Docker is installed"
else
    print_info "Docker not found. Installing..."
    ssh "$VPS_USER@$VPS_IP" "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh"
    print_success "Docker installed"
fi

# =============================================================================
# Step 3: Upload/Clone Project
# =============================================================================
print_header "Step 3: Uploading Project to VPS"

if [ "$USE_GIT" = "y" ]; then
    print_info "Cloning from Git..."
    ssh "$VPS_USER@$VPS_IP" "rm -rf $DEPLOY_DIR && git clone $GIT_REPO $DEPLOY_DIR"
    print_success "Project cloned from Git"
else
    print_info "Uploading via rsync..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.next' \
        --exclude '.env.local' \
        --exclude '.env.docker' \
        --exclude 'backup_*.sql' \
        --exclude '.git' \
        ./ "$VPS_USER@$VPS_IP:$DEPLOY_DIR/"
    print_success "Project uploaded"
fi

# =============================================================================
# Step 4: Setup Environment Variables
# =============================================================================
print_header "Step 4: Setting up Environment Variables"

print_info "Generating secure secrets..."

# Generate secrets locally
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

read -p "Enter database password (or press Enter for auto-generated): " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="raport_$(openssl rand -base64 12 | tr -d '/+=')"
fi

read -p "Enter your domain or VPS IP (default: $VPS_IP): " DOMAIN
DOMAIN=${DOMAIN:-$VPS_IP}

# Create .env.docker on VPS
ssh "$VPS_USER@$VPS_IP" "cat > $DEPLOY_DIR/.env.docker" << EOF
# =============================================================================
# Production Environment Configuration
# Generated on $(date)
# =============================================================================

# Node Environment
NODE_ENV=production

# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USER=raport
DB_PASSWORD=$DB_PASSWORD
DB_NAME=raport_db
DATABASE_URL=postgresql://raport:$DB_PASSWORD@db:5432/raport_db

# JWT Configuration
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# NextAuth Configuration
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://$DOMAIN

# Application URLs
NEXT_PUBLIC_API_URL=http://$DOMAIN:3000

# Logging
LOG_LEVEL=info

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
EOF

print_success "Environment variables configured"

# =============================================================================
# Step 5: Deploy with Docker Compose
# =============================================================================
print_header "Step 5: Deploying with Docker Compose"

print_info "Building and starting containers..."
ssh "$VPS_USER@$VPS_IP" "cd $DEPLOY_DIR && docker compose --env-file .env.docker up --build -d"

print_info "Waiting for containers to be healthy..."
sleep 10

# =============================================================================
# Step 6: Run Database Migrations
# =============================================================================
print_header "Step 6: Running Database Migrations"

print_info "Applying migrations..."
ssh "$VPS_USER@$VPS_IP" << EOF
cd $DEPLOY_DIR
docker compose --env-file .env.docker exec -T db psql -U raport -d raport_db < prisma/migrations/20260219072434_init/migration.sql
docker compose --env-file .env.docker exec -T db psql -U raport -d raport_db < prisma/migrations/20260219080305_add_daily_assessment_type/migration.sql
EOF

print_success "Database migrations completed"

# =============================================================================
# Step 7: Verify Deployment
# =============================================================================
print_header "Step 7: Verifying Deployment"

# Check container status
print_info "Checking container status..."
ssh "$VPS_USER@$VPS_IP" "cd $DEPLOY_DIR && docker compose --env-file .env.docker ps"

# Check health endpoint
print_info "Checking application health..."
sleep 5
if ssh "$VPS_USER@$VPS_IP" "curl -f http://localhost:3000/api/health &>/dev/null"; then
    print_success "Application is healthy!"
else
    print_error "Health check failed. Check logs with: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose logs -f app'"
fi

# =============================================================================
# Step 8: Setup Firewall (Optional)
# =============================================================================
print_header "Step 8: Firewall Setup (Optional)"

read -p "Configure UFW firewall? (y/n, default: n): " SETUP_FIREWALL
if [ "$SETUP_FIREWALL" = "y" ]; then
    print_info "Configuring firewall..."
    ssh "$VPS_USER@$VPS_IP" << 'EOF'
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw allow 3000/tcp
        echo "y" | sudo ufw enable
EOF
    print_success "Firewall configured"
fi

# =============================================================================
# Deployment Summary
# =============================================================================
print_header "✅ Deployment Complete!"

echo ""
print_success "Application deployed successfully!"
echo ""
echo "📋 Deployment Details:"
echo "   • VPS: $VPS_USER@$VPS_IP"
echo "   • Directory: $DEPLOY_DIR"
echo "   • Database Password: $DB_PASSWORD"
echo ""
echo "🌐 Access Points:"
echo "   • Application: http://$DOMAIN:3000"
echo "   • Health Check: http://$DOMAIN:3000/api/health"
echo ""
echo "📝 Useful Commands:"
echo "   • SSH: ssh $VPS_USER@$VPS_IP"
echo "   • Logs: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker logs -f app'"
echo "   • Restart: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker restart'"
echo "   • Stop: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker down'"
echo ""
print_info "Next steps:"
echo "   1. Setup Nginx reverse proxy (see VPS_DEPLOYMENT.md)"
echo "   2. Configure SSL with Let's Encrypt"
echo "   3. Setup automated backups"
echo "   4. (Optional) Seed database: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker exec app bun run seed'"
echo ""

# Save deployment info
cat > deployment-info.txt << EOF
VPS Deployment Information
Generated: $(date)

VPS: $VPS_USER@$VPS_IP
Directory: $DEPLOY_DIR
Database Password: $DB_PASSWORD
Domain: $DOMAIN

Application: http://$DOMAIN:3000
Health Check: http://$DOMAIN:3000/api/health

Commands:
- SSH: ssh $VPS_USER@$VPS_IP
- Logs: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker logs -f'
- Restart: ssh $VPS_USER@$VPS_IP 'cd $DEPLOY_DIR && docker compose --env-file .env.docker restart'
EOF

print_success "Deployment info saved to deployment-info.txt"
echo ""

#!/bin/bash
# Docker Deployment Helper Script
# This script helps you deploy the raport application using Docker

set -e  # Exit on error

echo "🚀 Raport Docker Deployment Helper"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

print_success "Docker and Docker Compose are installed"

# Check if .env.docker exists
if [ ! -f .env.docker ]; then
    print_warning ".env.docker not found"
    
    if [ -f .env.docker.example ]; then
        print_info "Copying .env.docker.example to .env.docker"
        cp .env.docker.example .env.docker
        print_warning "IMPORTANT: Edit .env.docker and update all secret values!"
        echo ""
        echo "Generate secure secrets with:"
        echo "  openssl rand -base64 32"
        echo ""
        read -p "Press Enter after you've updated .env.docker..." 
    else
        print_error ".env.docker.example not found. Cannot proceed."
        exit 1
    fi
fi

# Load environment variables
export $(grep -v '^#' .env.docker | xargs)

print_success ".env.docker loaded"

# Show menu
echo ""
print_info "What would you like to do?"
echo ""
echo "1) 🏗️  Build and start containers (fresh build)"
echo "2) 🚀 Start existing containers"
echo "3) 🛑 Stop containers"
echo "4) 🔄 Restart containers"
echo "5) 📋 View logs"
echo "6) 🗄️  Run database migrations"
echo "7) 🌱 Seed database"
echo "8) 🏥 Check health status"
echo "9) 🧹 Clean up (stop and remove containers, volumes)"
echo "0) ❌ Exit"
echo ""

read -p "Enter your choice [0-9]: " choice

case $choice in
    1)
        print_info "Building and starting containers..."
        echo ""
        
        # Build and start
        docker compose --env-file .env.docker up --build -d
        
        print_success "Containers started!"
        echo ""
        print_info "Waiting for services to be healthy..."
        sleep 10
        
        # Run migrations
        print_info "Running database migrations..."
        docker compose --env-file .env.docker exec app bun run prisma:migrate:deploy
        
        print_success "Deployment complete!"
        echo ""
        echo "🌐 Application is running at: http://localhost:${APP_PORT:-3000}"
        echo "🗄️  Database is running at: localhost:${DB_PORT:-5432}"
        echo ""
        echo "View logs with: docker compose logs -f"
        ;;
        
    2)
        print_info "Starting containers..."
        docker compose --env-file .env.docker up -d
        print_success "Containers started!"
        ;;
        
    3)
        print_info "Stopping containers..."
        docker compose --env-file .env.docker down
        print_success "Containers stopped!"
        ;;
        
    4)
        print_info "Restarting containers..."
        docker compose --env-file .env.docker restart
        print_success "Containers restarted!"
        ;;
        
    5)
        print_info "Showing logs (Ctrl+C to exit)..."
        docker compose --env-file .env.docker logs -f
        ;;
        
    6)
        print_info "Running database migrations..."
        docker compose --env-file .env.docker exec app bun run prisma:migrate:deploy
        print_success "Migrations completed!"
        ;;
        
    7)
        print_info "Seeding database..."
        docker compose --env-file .env.docker exec app bun run seed
        print_success "Database seeded!"
        ;;
        
    8)
        print_info "Checking health status..."
        echo ""
        echo "Database:"
        docker compose --env-file .env.docker exec db pg_isready -U ${DB_USER:-raport} || print_error "Database is not healthy"
        echo ""
        echo "Application:"
        if curl -s http://localhost:${APP_PORT:-3000}/api/health > /dev/null; then
            print_success "Application is healthy"
            curl -s http://localhost:${APP_PORT:-3000}/api/health | jq '.' 2>/dev/null || cat
        else
            print_error "Application is not responding"
        fi
        ;;
        
    9)
        print_warning "This will stop and remove all containers and volumes!"
        read -p "Are you sure? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            print_info "Cleaning up..."
            docker compose --env-file .env.docker down -v
            print_success "Cleanup complete!"
        else
            print_info "Cleanup cancelled"
        fi
        ;;
        
    0)
        print_info "Exiting..."
        exit 0
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_info "Useful commands:"
echo "  View logs:        docker compose logs -f"
echo "  View app logs:    docker compose logs -f app"
echo "  View db logs:     docker compose logs -f db"
echo "  Enter app shell:  docker compose exec app sh"
echo "  Enter db shell:   docker compose exec db psql -U ${DB_USER:-raport} -d ${DB_NAME:-raport_db}"
echo "  Stop all:         docker compose down"
echo ""

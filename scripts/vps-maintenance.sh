#!/bin/bash

# ============================================
# VPS Maintenance Script
# For Low-Resource VPS (1GB RAM, 20GB Storage)
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "VPS Maintenance Script for Raport App"
echo "========================================="
echo ""

# Function to check disk space
check_disk_space() {
    echo -e "${YELLOW}📊 Checking disk space...${NC}"
    df -h / | tail -1
    
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        echo -e "${RED}⚠️  Warning: Disk usage is above 80%!${NC}"
    else
        echo -e "${GREEN}✓ Disk space OK${NC}"
    fi
    echo ""
}

# Function to check memory usage
check_memory() {
    echo -e "${YELLOW}💾 Checking memory usage...${NC}"
    free -h
    echo ""
    
    MEMORY_PERCENT=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$MEMORY_PERCENT" -gt 80 ]; then
        echo -e "${RED}⚠️  Warning: Memory usage is above 80%!${NC}"
    else
        echo -e "${GREEN}✓ Memory usage OK${NC}"
    fi
    echo ""
}

# Function to check Docker stats
check_docker_stats() {
    echo -e "${YELLOW}🐳 Docker container stats:${NC}"
    docker stats raport-app --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
    echo ""
}

# Function to check Docker disk usage
check_docker_disk() {
    echo -e "${YELLOW}🗄️  Docker disk usage:${NC}"
    docker system df
    echo ""
}

# Function to clean Docker system
clean_docker() {
    echo -e "${YELLOW}🧹 Cleaning Docker system...${NC}"
    echo "This will remove:"
    echo "  - Stopped containers"
    echo "  - Unused networks"
    echo "  - Dangling images"
    echo "  - Build cache"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -f
        echo -e "${GREEN}✓ Docker system cleaned${NC}"
    else
        echo "Cleanup cancelled"
    fi
    echo ""
}

# Function to clean Docker system (aggressive)
clean_docker_aggressive() {
    echo -e "${RED}⚠️  AGGRESSIVE CLEANUP${NC}"
    echo "This will remove:"
    echo "  - All stopped containers"
    echo "  - All unused images (not just dangling)"
    echo "  - All unused volumes"
    echo "  - All build cache"
    echo ""
    echo -e "${RED}WARNING: This may remove images you want to keep!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -a --volumes -f
        echo -e "${GREEN}✓ Aggressive cleanup completed${NC}"
    else
        echo "Cleanup cancelled"
    fi
    echo ""
}

# Function to restart app
restart_app() {
    echo -e "${YELLOW}🔄 Restarting application...${NC}"
    cd /home/aran/raport
    docker compose restart app
    echo -e "${GREEN}✓ Application restarted${NC}"
    echo ""
}

# Function to check app logs
check_logs() {
    echo -e "${YELLOW}📋 Recent application logs (last 50 lines):${NC}"
    docker compose logs --tail=50 app
    echo ""
}

# Function to setup swap (if not exists)
setup_swap() {
    echo -e "${YELLOW}💫 Checking swap...${NC}"
    
    if swapon --show | grep -q "/swapfile"; then
        echo -e "${GREEN}✓ Swap already configured${NC}"
        free -h
    else
        echo -e "${YELLOW}No swap found. Setting up 1GB swap file...${NC}"
        echo "This requires sudo privileges."
        read -p "Continue? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo fallocate -l 1G /swapfile
            sudo chmod 600 /swapfile
            sudo mkswap /swapfile
            sudo swapon /swapfile
            echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
            echo -e "${GREEN}✓ Swap configured successfully${NC}"
            free -h
        else
            echo "Swap setup cancelled"
        fi
    fi
    echo ""
}

# Main menu
show_menu() {
    echo "========================================="
    echo "Choose an option:"
    echo "========================================="
    echo "1. Check disk space"
    echo "2. Check memory usage"
    echo "3. Check Docker container stats"
    echo "4. Check Docker disk usage"
    echo "5. Clean Docker system (safe)"
    echo "6. Clean Docker system (aggressive)"
    echo "7. Restart application"
    echo "8. View application logs"
    echo "9. Setup/Check swap"
    echo "10. Run full diagnostic"
    echo "0. Exit"
    echo ""
}

# Full diagnostic
run_diagnostic() {
    echo -e "${GREEN}Running full diagnostic...${NC}"
    echo ""
    check_disk_space
    check_memory
    check_docker_stats
    check_docker_disk
    echo -e "${GREEN}✓ Diagnostic complete${NC}"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice: " choice
    echo ""
    
    case $choice in
        1) check_disk_space ;;
        2) check_memory ;;
        3) check_docker_stats ;;
        4) check_docker_disk ;;
        5) clean_docker ;;
        6) clean_docker_aggressive ;;
        7) restart_app ;;
        8) check_logs ;;
        9) setup_swap ;;
        10) run_diagnostic ;;
        0) echo "Exiting..."; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}"; echo "" ;;
    esac
    
    read -p "Press Enter to continue..."
    clear
done

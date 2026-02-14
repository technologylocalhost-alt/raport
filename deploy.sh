#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Raport Docker Setup Script            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Check if docker and docker-compose are installed
echo -e "${YELLOW}Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is installed${NC}\n"

# Check if .env.local exists
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local from .env.example...${NC}"
    cp .env.example .env.local
    echo -e "${YELLOW}⚠ Please update .env.local with your actual values${NC}"
else
    echo -e "${GREEN}✓ .env.local exists${NC}"
fi

echo -e "\n${YELLOW}Building Docker images...${NC}"
docker-compose build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker images built successfully${NC}\n"
else
    echo -e "${RED}✗ Failed to build Docker images${NC}"
    exit 1
fi

echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Services started successfully${NC}\n"
    
    echo -e "${BLUE}Waiting for database to be ready...${NC}"
    sleep 5
    
    echo -e "${YELLOW}Running Prisma migrations...${NC}"
    docker-compose exec -T app bun run prisma:migrate
    
    echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Deployment Completed Successfully!    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"
    
    echo -e "Application is running at: ${BLUE}http://localhost:3000${NC}"
    echo -e "Database: ${BLUE}localhost:5432${NC}"
    echo -e "\nUseful commands:"
    echo -e "  ${YELLOW}View logs:${NC}          docker-compose logs -f app"
    echo -e "  ${YELLOW}Stop services:${NC}      docker-compose down"
    echo -e "  ${YELLOW}Prisma Studio:${NC}      docker-compose exec app bun run prisma:studio"
    echo -e "  ${YELLOW}Restart services:${NC}   docker-compose restart"
else
    echo -e "${RED}✗ Failed to start services${NC}"
    exit 1
fi

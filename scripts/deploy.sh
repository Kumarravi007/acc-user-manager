#!/bin/bash

# Production Deployment Script for ACC User Manager
# This script helps with common deployment tasks

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ACC User Manager Production Deployment ===${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to display menu
show_menu() {
    echo "Select deployment option:"
    echo "1) Railway - Deploy Backend"
    echo "2) Railway - Deploy Worker"
    echo "3) Railway - Deploy Both (Backend + Worker)"
    echo "4) Vercel - Deploy Frontend"
    echo "5) Docker - Build and Run Locally"
    echo "6) Docker - Build for Production"
    echo "7) Run Database Migrations"
    echo "8) Health Check"
    echo "9) Exit"
    echo ""
}

# Function to deploy to Railway
deploy_railway_backend() {
    echo -e "${YELLOW}Deploying Backend to Railway...${NC}"

    if ! command_exists railway; then
        echo -e "${RED}Railway CLI not found. Install it with: npm install -g @railway/cli${NC}"
        exit 1
    fi

    cd backend
    railway up
    cd ..

    echo -e "${GREEN}Backend deployed successfully!${NC}"
}

# Function to deploy worker to Railway
deploy_railway_worker() {
    echo -e "${YELLOW}Deploying Worker to Railway...${NC}"

    if ! command_exists railway; then
        echo -e "${RED}Railway CLI not found. Install it with: npm install -g @railway/cli${NC}"
        exit 1
    fi

    cd backend
    railway up --service worker
    cd ..

    echo -e "${GREEN}Worker deployed successfully!${NC}"
}

# Function to deploy to Vercel
deploy_vercel() {
    echo -e "${YELLOW}Deploying Frontend to Vercel...${NC}"

    if ! command_exists vercel; then
        echo -e "${RED}Vercel CLI not found. Install it with: npm install -g vercel${NC}"
        exit 1
    fi

    cd frontend
    vercel --prod
    cd ..

    echo -e "${GREEN}Frontend deployed successfully!${NC}"
}

# Function to build and run with Docker
docker_local() {
    echo -e "${YELLOW}Building and running with Docker Compose...${NC}"

    if ! command_exists docker-compose; then
        echo -e "${RED}Docker Compose not found. Please install Docker Desktop.${NC}"
        exit 1
    fi

    if [ ! -f .env ]; then
        echo -e "${YELLOW}No .env file found. Copying from .env.production.example...${NC}"
        cp .env.production.example .env
        echo -e "${RED}Please edit .env with your configuration before running again.${NC}"
        exit 1
    fi

    docker-compose up -d --build
    echo -e "${GREEN}Containers started successfully!${NC}"
    echo -e "Backend: http://localhost:3001"
    echo -e "Frontend: http://localhost:3000"
}

# Function to build Docker images for production
docker_build() {
    echo -e "${YELLOW}Building Docker images for production...${NC}"

    echo "Building backend image..."
    cd backend
    docker build -t acc-user-manager-backend:latest .
    cd ..

    echo "Building frontend image..."
    cd frontend
    docker build -t acc-user-manager-frontend:latest .
    cd ..

    echo -e "${GREEN}Docker images built successfully!${NC}"
    echo "Images:"
    echo "  - acc-user-manager-backend:latest"
    echo "  - acc-user-manager-frontend:latest"
}

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}Select migration target:${NC}"
    echo "1) Local (Docker Compose)"
    echo "2) Railway"
    echo "3) Custom DATABASE_URL"
    read -p "Enter choice [1-3]: " migration_choice

    case $migration_choice in
        1)
            docker-compose exec backend npm run migrate
            ;;
        2)
            cd backend
            railway run npm run migrate
            cd ..
            ;;
        3)
            read -p "Enter DATABASE_URL: " db_url
            cd backend
            DATABASE_URL=$db_url npm run migrate
            cd ..
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# Function to check health
health_check() {
    echo -e "${YELLOW}Running health checks...${NC}"
    read -p "Enter backend URL (e.g., http://localhost:3001): " backend_url

    echo "Checking backend health..."
    response=$(curl -s "${backend_url}/health")

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Health check response:${NC}"
        echo $response | jq . 2>/dev/null || echo $response
    else
        echo -e "${RED}Health check failed!${NC}"
    fi
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter choice [1-9]: " choice

    case $choice in
        1)
            deploy_railway_backend
            ;;
        2)
            deploy_railway_worker
            ;;
        3)
            deploy_railway_backend
            deploy_railway_worker
            ;;
        4)
            deploy_vercel
            ;;
        5)
            docker_local
            ;;
        6)
            docker_build
            ;;
        7)
            run_migrations
            ;;
        8)
            health_check
            ;;
        9)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
done

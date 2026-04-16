# 🚀 POS System Deployment Guide

## 📌 Overview
This guide provides complete step-by-step instructions for deploying the POS monorepo system to your Ubuntu server. The system includes:
- **Backend API** (NestJS) - Port 3000
- **POS Application** (Next.js) - Port 3001
- **Inventory Management** (Next.js) - Port 3002
- **Super Admin Panel** (Next.js) - Port 3003
- **PostgreSQL Database** - Internal only
- **Nginx Reverse Proxy** - Ports 80/443

---

## ✅ Prerequisites

### Server Requirements
- Ubuntu Server LTS (20.04 or later)
- Minimum 4GB RAM
- 20GB+ free disk space
- Domain name pointing to your server IP
- Root or sudo access

### Domain Configuration
- Subdomains configured (optional):
  - `api.yourdomain.com` → Backend API
  - `pos.yourdomain.com` → POS App
  - `inventory.yourdomain.com` → Inventory App
  - `admin.yourdomain.com` → Super Admin

### Local Development Machine
- SSH access to the server
- Git installed
- Your application repository

---

## ⚡ Quick Start Guide

Follow these parts in order:
1. **Part 1:** Server Preparation (Steps 1.1 - 1.5)
2. **Part 2:** Application Setup (Steps 2.1 - 2.4)
3. **Part 3:** Application Dockerfiles (Steps 3.1 - 3.4)
4. **Part 4:** Docker Compose Setup (Step 4.1)
5. **Part 5:** Nginx Configuration (Step 5.1)
6. **Part 6:** Deploy All Services (Steps 6.1 - 6.3)
7. **Part 7:** SSL/HTTPS Setup (Steps 7.1 - 7.5)
8. **Part 8:** Maintenance & Operations

**Result:** Your apps will be accessible at:
- `https://api.yourdomain.com`
- `https://pos.yourdomain.com`
- `https://inventory.yourdomain.com`
- `https://admin.yourdomain.com`

---

## 📋 Part 1: Server Preparation

### Step 1.1: Initial Server Setup

SSH into your server:
```bash
ssh username@YOUR_SERVER_IP
```

Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

Install required packages:
```bash
sudo apt install curl git unzip build-essential -y
```

### Step 1.2: Install Node.js and npm

Install Node.js 20+ (required by your apps):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should be v20.x.x or higher
npm --version
```

### Step 1.3: Configure Firewall

Allow necessary ports:
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### Step 1.4: Install Docker and Docker Compose

Install Docker:
```bash
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker
sudo systemctl start docker
```

Add your user to docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker`
```

Verify Docker installation:
```bash
docker --version
docker compose version
```

### Step 1.5: Create Project Directory Structure

```bash
mkdir -p ~/production/pos-system
mkdir -p ~/production/nginx/conf.d
mkdir -p ~/production/postgres-data
cd ~/production/pos-system
```

---

## 📦 Part 2: Application Setup

### Step 2.1: Clone Repository

Clone your application repository:
```bash
cd ~/production/pos-system
git clone YOUR_REPOSITORY_URL .
```

If using private repository:
```bash
# Generate SSH key on server if needed
ssh-keygen -t ed25519 -C "server@yourdomain.com"
cat ~/.ssh/id_ed25519.pub
# Add this public key to your Git provider (GitHub/GitLab)

# Then clone
git clone git@github.com:yourusername/pos.git .
```

### Step 2.2: Install Dependencies

Install all dependencies:
```bash
npm install
```

This will install dependencies for all apps and packages in the monorepo and update the package-lock.json file.

### Step 2.3: Create Environment Files

#### Backend API Environment

Create environment file for Backend API:
```bash
nano ~/production/pos-system/apps/backend-api/.env
```

Add the following configuration:
```env
# Database Configuration
DATABASE_URL=postgresql://pos_user:CHANGE_THIS_STRONG_PASSWORD@postgres:5432/pos_db

# JWT Configuration
JWT_SECRET=CHANGE_THIS_LONG_RANDOM_SECRET_STRING
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# CORS
CORS_ORIGIN=https://yourdomain.com,https://pos.yourdomain.com,https://inventory.yourdomain.com,https://admin.yourdomain.com
```

**Important:** Replace the following values:
- `CHANGE_THIS_STRONG_PASSWORD` - Choose a strong database password (save it, you'll use it in docker-compose.yml)
- `JWT_SECRET` - Generate a long random string (minimum 32 characters)
- `yourdomain.com` - Replace with your actual domain name

#### Frontend Applications Environment

**POS App:**
```bash
nano ~/production/pos-system/apps/pos/.env.production
```
Add:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Inventory App:**
```bash
nano ~/production/pos-system/apps/inventory/.env.production
```
Add:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Super Admin App:**
```bash
nano ~/production/pos-system/apps/super-admin/.env.production
```
Add:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Step 2.4: Build Applications

Build all applications:
```bash
cd ~/production/pos-system
npm run build
```

This command will:
- Build the Backend API (NestJS)
- Build the POS app (Next.js)
- Build the Inventory app (Next.js)
- Build the Super Admin app (Next.js)
- Compile shared packages

**✅ Checkpoint:** Your applications are now built and ready to be containerized!

---

## 🐳 Part 3: Application Dockerfiles

Now we'll create Dockerfiles for each application component.

### Step 3.1: Create Dockerfile for Backend API

Create Dockerfile for Backend API:
```bash
nano ~/production/pos-system/apps/backend-api/Dockerfile
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend-api/package*.json ./apps/backend-api/
COPY packages ./packages

# Install all dependencies (including dev dependencies needed for build)
RUN npm install

# Copy source code
COPY apps/backend-api ./apps/backend-api

# Build application
WORKDIR /app/apps/backend-api
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/backend-api/package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built application
COPY --from=builder /app/apps/backend-api/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/receipts

EXPOSE 3000

CMD ["node", "dist/main"]
```

### Step 3.2: Create Dockerfile for POS App

Create Dockerfile for POS app:
```bash
nano ~/production/pos-system/apps/pos/Dockerfile
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/pos/package*.json ./apps/pos/
COPY packages ./packages

# Install dependencies
RUN npm install

# Copy source code
COPY apps/pos ./apps/pos

# Build application
WORKDIR /app/apps/pos
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/pos/package*.json ./
RUN npm install --production

# Copy built application
COPY --from=builder /app/apps/pos/.next ./.next
COPY --from=builder /app/apps/pos/public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

Create Dockerfile for Inventory app:
```bash
nano ~/production/pos-system/apps/inventory/Dockerfile
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/inventory/package*.json ./apps/inventory/
COPY packages ./packages

# Install dependencies
RUN npm install

# Copy source code
COPY apps/inventory ./apps/inventory

# Build application
WORKDIR /app/apps/inventory
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/inventory/package*.json ./
RUN npm install --production

# Copy built application
COPY --from=builder /app/apps/inventory/.next ./.next
COPY --from=builder /app/apps/inventory/public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

Create Dockerfile for Super Admin app:
```bash
nano ~/production/pos-system/apps/super-admin/Dockerfile
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/super-admin/package*.json ./apps/super-admin/
COPY packages ./packages

# Install dependencies
RUN npm install

# Copy source code
COPY apps/super-admin ./apps/super-admin

# Build application
WORKDIR /app/apps/super-admin
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/super-admin/package*.json ./
RUN npm install --production

# Copy built application
COPY --from=builder /app/apps/super-admin/.next ./.next
COPY --from=builder /app/apps/super-admin/public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

**✅ Checkpoint:** All Dockerfiles are created! Now we'll set up the complete deployment configuration.

---

## 🐳 Part 4: Docker Compose Setup

### Step 4.1: Create Docker Network and Compose File

First, create a dedicated network for all services:
```bash
docker network create pos-network
```

Now create the complete docker-compose file:
```bash
nano ~/production/docker-compose.yml
```

> **💡 Note:** This file includes the database AND all application services in one configuration.

Add the following:
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: pos-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: pos_db
      POSTGRES_USER: pos_user
      POSTGRES_PASSWORD: CHANGE_THIS_STRONG_PASSWORD  # Use the same password from your backend .env
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    networks:
      - pos-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pos_user -d pos_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API (NestJS)
  backend:
    build:
      context: ./pos-system
      dockerfile: apps/backend-api/Dockerfile
    container_name: pos-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://pos_user:CHANGE_THIS_STRONG_PASSWORD@postgres:5432/pos_db
      JWT_SECRET: CHANGE_THIS_LONG_RANDOM_SECRET_STRING
      JWT_EXPIRES_IN: 7d
      NODE_ENV: production
      PORT: 3000
    volumes:
      - ./pos-system/apps/backend-api/uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - pos-network

  # POS Application (Next.js)
  pos-app:
    build:
      context: ./pos-system
      dockerfile: apps/pos/Dockerfile
    container_name: pos-app
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000
      NODE_ENV: production
    depends_on:
      - backend
    networks:
      - pos-network

  # Inventory Application (Next.js)
  inventory-app:
    build:
      context: ./pos-system
      dockerfile: apps/inventory/Dockerfile
    container_name: inventory-app
    restart: unless-stopped
    ports:
      - "3002:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000
      NODE_ENV: production
    depends_on:
      - backend
    networks:
      - pos-network

  # Super Admin Application (Next.js)
  super-admin-app:
    build:
      context: ./pos-system
      dockerfile: apps/super-admin/Dockerfile
    container_name: super-admin-app
    restart: unless-stopped
    ports:
      - "3003:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000
      NODE_ENV: production
    depends_on:
      - backend
    networks:
      - pos-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: pos-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - backend
      - pos-app
      - inventory-app
      - super-admin-app
    networks:
      - pos-network

networks:
  pos-network:
    external: true  # Use the network we created above
```

**Important:** Make sure to replace `CHANGE_THIS_STRONG_PASSWORD` with the SAME password you used in your backend .env file!

**✅ Checkpoint:** Complete docker-compose configuration is ready!

---

## 🌐 Part 5: Nginx Configuration

### Step 5.1: Configure Nginx

Create Nginx configuration file:
```bash
nano ~/production/nginx/conf.d/pos-system.conf
```

**Copy and paste this into the file:**
```nginx
# Upstream definitions
upstream backend {
    server backend:3000;
}

upstream pos {
    server pos-app:3000;
}

upstream inventory {
    server inventory-app:3000;
}

upstream admin {
    server super-admin-app:3000;
}

# Backend API Server
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# POS Application Server
server {
    listen 80;
    server_name pos.yourdomain.com;

    location / {
        proxy_pass http://pos;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Inventory Application Server
server {
    listen 80;
    server_name inventory.yourdomain.com;

    location / {
        proxy_pass http://inventory;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Super Admin Application Server
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Access URLs:**
- Backend API: `http://api.yourdomain.com`
- POS App: `http://pos.yourdomain.com`
- Inventory App: `http://inventory.yourdomain.com`
- Super Admin: `http://admin.yourdomain.com`

---

## 🚀 Part 6: Deploy All Services

### Step 6.1: Build and Start All Services

Navigate to production directory:
```bash
cd ~/production
```

**CRITICAL: Create Docker network if you haven't already:**
```bash
# Check if network exists
docker network ls | grep pos-network

# If not found, create it
docker network create pos-network
```

Clear Docker build cache completely:
```bash
# Stop all containers
docker compose down

# Remove all build cache (IMPORTANT!)
docker builder prune -af

# Remove all images
docker images -q | xargs -r docker rmi -f
```

Build and start all services **without cache**:
```bash
docker compose build --no-cache
docker compose up -d
```

This will:
1. Build Docker images for all applications
2. Download PostgreSQL image
3. Create containers
4. Start all services

Check if services are running:
```bash
docker compose ps
```

All services should show "running" status.

### Step 6.2: Initialize Database

Run database migrations:
```bash
docker compose exec backend npm run migration:run
```

Seed initial data (if you have seed script):
```bash
docker compose exec backend npm run seed
```

### Step 6.3: Verify Deployment

Check logs for each service:
```bash
# Backend logs
docker compose logs -f backend

# POS app logs
docker compose logs -f pos-app

# Inventory app logs
docker compose logs -f inventory-app

# Super Admin app logs
docker compose logs -f super-admin-app

# Database logs
docker compose logs -f postgres

# Nginx logs
docker compose logs -f nginx
```

Test endpoints:

```bash
# Test backend API health endpoint
curl http://api.yourdomain.com/api/health

# Test POS app
curl http://pos.yourdomain.com

# Test Inventory app
curl http://inventory.yourdomain.com

# Test Admin app
curl http://admin.yourdomain.com
```

**Open in Browser:**

Visit these URLs:
- `http://api.yourdomain.com` - Backend API
- `http://pos.yourdomain.com` - POS Application
- `http://inventory.yourdomain.com` - Inventory Application
- `http://admin.yourdomain.com` - Super Admin Panel

---

## 🔒 Part 7: SSL/HTTPS Setup

### Step 7.1: Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Step 7.2: Obtain SSL Certificates

Stop Nginx temporarily:
```bash
docker compose stop nginx
```

Obtain certificates for all domains:
```bash
sudo certbot certonly --standalone -d api.yourdomain.com
sudo certbot certonly --standalone -d pos.yourdomain.com
sudo certbot certonly --standalone -d inventory.yourdomain.com
sudo certbot certonly --standalone -d admin.yourdomain.com
```

Copy certificates to Nginx volume:
```bash
sudo mkdir -p ~/production/nginx/ssl
sudo cp -r /etc/letsencrypt/* ~/production/certbot/conf/
```

### Step 7.3: Update Nginx Configuration for HTTPS

Update your Nginx configuration:
```bash
nano ~/production/nginx/conf.d/pos-system.conf
```

Add SSL configuration (example for one server block):
```nginx
# Backend API - HTTPS
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    client_max_body_size 10M;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Repeat for all other server blocks (pos, inventory, admin).

### Step 7.4: Restart Nginx

```bash
docker compose restart nginx
```

### Step 7.5: Setup Auto-Renewal

Create renewal script:
```bash
nano ~/production/renew-certs.sh
```

Add:
```bash
#!/bin/bash
docker compose -f /home/yourusername/production/docker-compose.yml stop nginx
certbot renew
docker compose -f /home/yourusername/production/docker-compose.yml start nginx
```

Make it executable:
```bash
chmod +x ~/production/renew-certs.sh
```

Add to crontab:
```bash
crontab -e
```

Add this line:
```
0 0 1 * * /home/yourusername/production/renew-certs.sh >> /home/yourusername/production/certbot-renewal.log 2>&1
```

---

## 🔧 Part 8: Maintenance & Operations

### Common Commands

**View all running containers:**
```bash
docker compose ps
```

**View logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f pos-app
```

**Restart a service:**
```bash
docker compose restart backend
docker compose restart nginx
```

**Stop all services:**
```bash
docker compose down
```

**Start all services:**
```bash
docker compose up -d
```

**Rebuild a specific service:**
```bash
docker compose up -d --build backend
```

**Enter a container shell:**
```bash
docker compose exec backend sh
docker compose exec postgres psql -U pos_user -d pos_db
```

### Updating the Application

```bash
# Navigate to project directory
cd ~/production/pos-system

# Pull latest changes
git pull origin main

# Rebuild and restart services
cd ~/production
docker compose up -d --build
```

### Database Backup

Create backup script:
```bash
nano ~/production/backup-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/yourusername/production/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose exec -T postgres pg_dump -U pos_user pos_db > "$BACKUP_DIR/pos_db_$DATE.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "pos_db_*.sql" -mtime +7 -delete

echo "Backup completed: pos_db_$DATE.sql"
```

Make executable:
```bash
chmod +x ~/production/backup-db.sh
```

Schedule daily backup:
```bash
crontab -e
```

Add:
```
0 2 * * * /home/yourusername/production/backup-db.sh >> /home/yourusername/production/backup.log 2>&1
```

### Database Restore

```bash
# Stop the backend
docker compose stop backend

# Restore database
docker compose exec -T postgres psql -U pos_user pos_db < /path/to/backup.sql

# Start the backend
docker compose start backend
```

### Monitoring Resources

Monitor Docker stats:
```bash
docker stats
```

Monitor disk usage:
```bash
docker system df
```

Clean up unused resources:
```bash
docker system prune -a
```

---

## 🐛 Troubleshooting

### Docker Network Issues

**Error: "network pos-network declared as external, but could not be found"**

This means the Docker network hasn't been created yet. Fix it:

```bash
# Create the network
docker network create pos-network

# Verify it was created
docker network ls | grep pos-network

# Then retry deployment
docker compose up -d
```

If the network already exists but you still get the error:

```bash
# Remove the network
docker network rm pos-network

# Recreate it
docker network create pos-network

# Retry
docker compose up -d
```

### Docker Build Issues

**npm ci errors (lock file sync issues):**

If you get errors like `npm ci can only install packages when your package.json and package-lock.json are in sync`, follow these steps:

```bash
# 1. Stop all containers
cd ~/production
docker compose down

# 2. Update Dockerfiles to use npm install instead of npm ci
sed -i 's/RUN npm ci/RUN npm install/g' ~/production/pos-system/apps/*/Dockerfile
sed -i 's/npm ci --only=production/npm install --production/g' ~/production/pos-system/apps/*/Dockerfile

# 3. Verify the change
grep "RUN npm" ~/production/pos-system/apps/backend-api/Dockerfile
# Should show: RUN npm install (not npm ci)

# 4. Clear ALL Docker cache
docker builder prune -af
docker images -q | xargs -r docker rmi -f
docker system prune -af

# 5. Rebuild without cache
docker compose build --no-cache
docker compose up -d
```

**Clean up previous builds:**
```bash
# Stop and remove all containers
cd ~/production
docker compose down

# Remove project images
docker images | grep -E 'production' | awk '{print $3}' | xargs -r docker rmi -f

# Clean up dangling images and build cache
docker builder prune -af
docker system prune -af

# Complete cleanup (removes all unused Docker data)
docker system prune -a --volumes -f
```

**Package lock file sync issues:**
```bash
# If you still get errors, update package-lock.json on server
cd ~/production/pos-system
npm install  # This updates package-lock.json
git add package-lock.json
git commit -m "Update package-lock.json"

# Then rebuild
cd ~/production
docker compose build --no-cache
docker compose up -d
```

### Container won't start
```bash
# Check logs
docker compose logs backend

# Check if port is already in use
sudo netstat -tulpn | grep :3000

# Remove and recreate container
docker compose down
docker compose up -d
```

### Database connection issues
```bash
# Check if postgres is healthy
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection from backend
docker compose exec backend ping postgres

# Check backend database connection
docker compose logs backend | grep -i database

# If using DATABASE_URL, verify the format is correct
# Format: postgresql://username:password@host:port/database
# Example: postgresql://pos_user:mypassword@postgres:5432/pos_db

# Check environment variables inside container
docker compose exec backend env | grep -E 'DATABASE_URL|DB_'

# Test database connection from inside backend container
docker compose exec backend sh
# Then inside container:
# npm run migration:show   # or whatever command checks DB connection
```

**Common DATABASE_URL issues:**
- **Special characters in password:** URL-encode special characters (e.g., `@` becomes `%40`, `#` becomes `%23`)
- **Wrong format:** Must be `postgresql://user:pass@host:port/db` (not `postgres://`)
- **Missing port:** Always include `:5432` even if it's the default
- **Host name:** Use `postgres` (Docker service name), not `localhost` or `127.0.0.1`

### Nginx not routing correctly
```bash
# Test Nginx configuration
docker compose exec nginx nginx -t

# Reload Nginx
docker compose exec nginx nginx -s reload

# Check Nginx logs
docker compose logs nginx
```

### Out of disk space
```bash
# Check disk usage
df -h

# Clean Docker system
docker system prune -a --volumes

# Clean old images
docker image prune -a
```

### Domain not resolving
```bash
# Check DNS resolution
nslookup api.yourdomain.com
nslookup pos.yourdomain.com

# Test if domain points to your server
ping api.yourdomain.com

# Check Nginx server_name configuration
docker compose exec nginx cat /etc/nginx/conf.d/pos-system.conf | grep server_name
```

### SSL certificate issues
```bash
# Check certificate validity
sudo certbot certificates

# Renew certificates manually
docker compose stop nginx
sudo certbot renew --force-renewal
docker compose start nginx

# Check Nginx SSL configuration
docker compose exec nginx nginx -t
```

---

## 📊 Performance Optimization

### Enable Gzip in Nginx

Add to your Nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### Add Caching Headers

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Configure Docker Resource Limits

Update docker-compose.yml:
```yaml
services:
  backend:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

---

## 🎯 Security Checklist

- [ ] UFW firewall enabled
- [ ] SSH key-based authentication only
- [ ] Fail2Ban installed and configured
- [ ] Database not exposed to public internet
- [ ] Strong passwords for database
- [ ] JWT secret is long and random
- [ ] Environment variables not committed to Git
- [ ] Regular security updates scheduled
- [ ] Daily database backups configured
- [ ] Docker containers run as non-root user (recommended)
- [ ] SSL/HTTPS enabled for all domains
- [ ] SSL auto-renewal configured
- [ ] Rate limiting configured in Nginx (recommended)
- [ ] Security headers configured in Nginx
- [ ] DNS records properly configured
- [ ] CORS properly configured for all domains

---

## 📝 Post-Deployment Notes

### Access URLs

### Access URLs

Your applications are accessible at:
- **Backend API:** `https://api.yourdomain.com` (or `http://` if SSL not configured yet)
- **POS App:** `https://pos.yourdomain.com`
- **Inventory App:** `https://inventory.yourdomain.com`
- **Super Admin:** `https://admin.yourdomain.com`

### Default Credentials
Create your first admin user through the backend API or seed script.

### Next Steps

Recommended next steps:
1. Set up SSL/HTTPS (Part 8)
2. Configure automatic backups
3. Set up monitoring
4. Create your first admin user
5. Test all functionality

---

## 🆘 Support & Resources

- Check application logs: `docker compose logs -f [service-name]`
- Check system logs: `journalctl -xe`
- Monitor resources: `docker stats`
- PostgreSQL shell: `docker compose exec postgres psql -U pos_user -d pos_db`

---

## 📖 Quick Reference

### DATABASE_URL Format Examples

**Basic format:**
```
postgresql://username:password@host:port/database
```

**For this deployment:**
```env
# Using Docker service name
DATABASE_URL=postgresql://pos_user:yourpassword@postgres:5432/pos_db
```

**With special characters in password:**
```env
# Password: my@pass#123
# URL-encoded: my%40pass%23123
DATABASE_URL=postgresql://pos_user:my%40pass%23123@postgres:5432/pos_db
```

**Common URL encoding:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `/` → `%2F`
- `:` → `%3A`
- `?` → `%3F`

**With SSL (for external databases):**
```env
DATABASE_URL=postgresql://pos_user:password@postgres:5432/pos_db?sslmode=require
```

**Testing DATABASE_URL:**
```bash
# From command line (install postgresql-client first)
psql "postgresql://pos_user:password@localhost:5432/pos_db"

# Or parse it manually
# postgresql://[username]:[password]@[host]:[port]/[database]
```

---

**Deployment Date:** ___________  
**Server IP:** ___________  
**Deployed By:** ___________  
**Git Commit:** ___________

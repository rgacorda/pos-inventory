# 🚀 POS System Deployment Guide

> **Choose your deployment path:**  
> 🔵 **IP-Based** - Testing and local deployments  
> 🟢 **Domain-Based** - Production deployments with SSL

## 📌 Overview
This guide provides complete step-by-step instructions for deploying the POS monorepo system to your Ubuntu server. The system includes:
- **Backend API** (NestJS) - Port 3000
- **POS Application** (Next.js) - Port 3001
- **Inventory Management** (Next.js) - Port 3002
- **Super Admin Panel** (Next.js) - Port 3003
- **PostgreSQL Database** - Internal only
- **Nginx Reverse Proxy** - Ports 80/443

---

## 🎯 Deployment Options

This guide supports **two deployment methods**:

### Option A: IP-Based Deployment (Recommended for Testing)
✅ **Choose this if:**
- You want to test the system before purchasing a domain
- You're deploying on a local/private network
- You access via IP address only

**Access Pattern:** `http://YOUR_SERVER_IP/api`, `http://YOUR_SERVER_IP/pos`, etc.

### Option B: Domain-Based Deployment (Production)
✅ **Choose this if:**
- You have a domain name configured
- You need SSL/HTTPS
- You want professional URLs

**Access Pattern:** `https://api.yourdomain.com`, `https://pos.yourdomain.com`, etc.

> **Note:** Instructions marked with **🔵 [IP-BASED]** or **🟢 [DOMAIN-BASED]** indicate option-specific steps.

---

## 📊 Comparison Table

| Feature | 🔵 IP-Based | 🟢 Domain-Based |
|---------|-------------|-----------------|
| **Access Method** | `http://192.168.1.100/api` | `https://api.yourdomain.com` |
| **SSL/HTTPS** | ❌ Not required | ✅ Required |
| **Domain Cost** | 💰 Free | 💰 ~$10-15/year |
| **Setup Time** | ⚡ Faster (~30 min) | 🕐 Moderate (~1 hour) |
| **Best For** | Testing, Internal Networks | Production, Public Access |
| **Nginx Config** | Path-based routing | Subdomain routing |
| **CORS Setup** | Single origin | Multiple origins |
| **Professional URLs** | ❌ No | ✅ Yes |
| **Security** | ⚠️ HTTP only | ✅ HTTPS encrypted |

---

## ✅ Prerequisites

### Server Requirements
- Ubuntu Server LTS (20.04 or later)
- Minimum 4GB RAM
- 20GB+ free disk space
- Static IP address or domain name
- Root or sudo access

### 🟢 [DOMAIN-BASED] Domain Configuration
- Domain name pointing to your server IP
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

### 🔵 IP-Based Deployment Path
Follow these parts in order:
1. **Part 1:** Server Preparation (Steps 1.1 - 1.5)
2. **Part 2:** Database Setup (Steps 2.1 - 2.4) ⭐ **Set up & test database first**
3. **Part 3:** Application Setup (Steps 3.1 - 3.4)
   - Use **🔵 [IP-BASED]** configuration for environment files
4. **Part 4:** Application Dockerfiles (Steps 4.1 - 4.4)
5. **Part 5:** Complete Docker Compose Setup (Steps 5.1 - 5.2)
6. **Part 6:** Nginx Configuration (Step 6.1)
   - Use **🔵 [IP-BASED]** configuration (path-based routing)
7. **Part 7:** Deploy All Services (Steps 7.1 - 7.3)
8. **Part 9:** Maintenance & Operations
9. **Skip Part 8** (SSL/HTTPS - not needed for IP-based)

**Result:** Your apps will be accessible at:
- `http://YOUR_SERVER_IP/api`
- `http://YOUR_SERVER_IP/pos`
- `http://YOUR_SERVER_IP/inventory`
- `http://YOUR_SERVER_IP/admin`

### 🟢 Domain-Based Deployment Path
Follow these parts in order:
1. **Part 1:** Server Preparation (Steps 1.1 - 1.5)
2. **Part 2:** Database Setup (Steps 2.1 - 2.4) ⭐ **Set up & test database first**
3. **Part 3:** Application Setup (Steps 3.1 - 3.4)
   - Use **🟢 [DOMAIN-BASED]** configuration for environment files
4. **Part 4:** Application Dockerfiles (Steps 4.1 - 4.4)
5. **Part 5:** Complete Docker Compose Setup (Steps 5.1 - 5.2)
6. **Part 6:** Nginx Configuration (Step 6.1)
   - Use **🟢 [DOMAIN-BASED]** configuration (subdomain routing)
7. **Part 7:** Deploy All Services (Steps 7.1 - 7.3)
8. **Part 8:** SSL/HTTPS Setup (Steps 8.1 - 8.5)
9. **Part 9:** Maintenance & Operations

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

Install Node.js 18+ (required by your apps):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should be v18.x.x or higher
npm --version
```

### Step 1.3: Configure Firewall

🔵 **[IP-BASED]** Allow necessary ports:
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (Nginx)
sudo ufw enable
sudo ufw status
```

🟢 **[DOMAIN-BASED]** Allow necessary ports:
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
newgrp docker
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

## �️ Part 2: Database Setup

> **⭐ Important:** We set up the database first to ensure your infrastructure is working before building applications.

### Step 2.1: Create Docker Network

Create a dedicated network for all services:
```bash
docker network create pos-network
```

Verify network creation:
```bash
docker network ls | grep pos-network
```

### Step 2.2: Pull PostgreSQL Image

Pull the PostgreSQL Docker image:
```bash
docker pull postgres:15-alpine
```

This will download the PostgreSQL image. Wait for it to complete.

### Step 2.3: Start PostgreSQL Container

Create a simple docker-compose file for database testing:
```bash
nano ~/production/docker-compose-db.yml
```

Add the following:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pos-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: pos_db
      POSTGRES_USER: pos_user
      POSTGRES_PASSWORD: CHANGE_THIS_STRONG_PASSWORD
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"  # Expose for testing
    networks:
      - pos-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pos_user -d pos_db"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  pos-network:
    external: true
```

**Important:** Change `CHANGE_THIS_STRONG_PASSWORD` to a strong password. Save this password - you'll need it later!

Start the database:
```bash
cd ~/production
docker compose -f docker-compose-db.yml up -d
```

Check if PostgreSQL is running:
```bash
docker compose -f docker-compose-db.yml ps
docker compose -f docker-compose-db.yml logs postgres
```

You should see logs indicating PostgreSQL started successfully and is ready to accept connections.

### Step 2.4: Test Database Connection

Test the database connection:
```bash
# Check if postgres is healthy
docker ps | grep pos-postgres

# Connect to database
docker exec -it pos-postgres psql -U pos_user -d pos_db
```

If successful, you'll see the PostgreSQL prompt. Type `\l` to list databases, then `\q` to exit.

**Alternative test with docker compose:**
```bash
docker compose -f docker-compose-db.yml exec postgres psql -U pos_user -d pos_db -c "SELECT version();"
```

You should see the PostgreSQL version information.

**✅ Checkpoint:** Your database is now running! Keep this terminal session for reference.

---

## 📦 Part 3: Application Setup

### Step 3.1: Clone Repository

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

### Step 3.2: Install Dependencies

Install all dependencies:
```bash
npm install
```

This will install dependencies for all apps and packages in the monorepo.

### Step 3.3: Create Environment Files

#### Backend API Environment

Create environment file for Backend API:
```bash
nano ~/production/pos-system/apps/backend-api/.env
```

> **💡 Database Configuration Options:**
> 
> You can configure the database connection using **either**:
> - **Option 1:** Individual variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`)
> - **Option 2:** Single connection string (`DATABASE_URL`)
> 
> Both work with TypeORM. Choose based on your preference:
> - **Individual variables:** More explicit, easier to change individual parts
> - **DATABASE_URL:** Cleaner, single source of truth, common in deployment platforms (Heroku, Railway, etc.)
>
> **⚠️ Important:** Make sure your backend application code supports your chosen method. Most TypeORM configurations support both.

🔵 **[IP-BASED]** Configuration:

**Option 1: Individual Database Variables**
```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=pos_user
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
DB_DATABASE=pos_db

# JWT Configuration
JWT_SECRET=CHANGE_THIS_LONG_RANDOM_SECRET_STRING
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# CORS - Replace YOUR_SERVER_IP with your actual server IP
CORS_ORIGIN=http://YOUR_SERVER_IP
```

**Option 2: DATABASE_URL (Alternative)**
```env
# Database Configuration - Single connection string
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

# CORS - Replace YOUR_SERVER_IP with your actual server IP
CORS_ORIGIN=http://YOUR_SERVER_IP
```

🟢 **[DOMAIN-BASED]** Configuration:

**Option 1: Individual Database Variables**
```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=pos_user
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
DB_DATABASE=pos_db

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

**Option 2: DATABASE_URL (Alternative)**
```env
# Database Configuration - Single connection string
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

#### Frontend Applications Environment

🔵 **[IP-BASED]** - Create environment files:

**POS App:**
```bash
nano ~/production/pos-system/apps/pos/.env.production
```
Add (replace YOUR_SERVER_IP):
```env
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

**Inventory App:**
```bash
nano ~/production/pos-system/apps/inventory/.env.production
```
Add (replace YOUR_SERVER_IP):
```env
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

**Super Admin App:**
```bash
nano ~/production/pos-system/apps/super-admin/.env.production
```
Add (replace YOUR_SERVER_IP):
```env
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

🟢 **[DOMAIN-BASED]** - Create environment files:

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

### Step 3.4: Build Applications

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

## 🐳 Part 4: Application Dockerfiles

Now we'll create Dockerfiles for each application component.

### Step 4.1: Create Dockerfile for Backend API
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
      context: ./pos-system/apps/backend-api
      dockerfile: Dockerfile
    container_name: pos-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Option 1: Individual database variables
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: pos_user
      DB_PASSWORD: CHANGE_THIS_STRONG_PASSWORD
      DB_DATABASE: pos_db
      
      # Option 2: DATABASE_URL (Alternative - use one or the other)
      # DATABASE_URL: postgresql://pos_user:CHANGE_THIS_STRONG_PASSWORD@postgres:5432/pos_db
      
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
      context: ./pos-system/apps/pos
      dockerfile: Dockerfile
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
      context: ./pos-system/apps/inventory
      dockerfile: Dockerfile
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
      context: ./pos-system/apps/super-admin
      dockerfile: Dockerfile
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
    driver: bridge
```

### Step 3.3: Create Dockerfiles

Create Dockerfile for Backend API:
```bash
nano ~/production/pos-system/apps/backend-api/Dockerfile
```

Add:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend-api/package*.json ./apps/backend-api/
COPY packages ./packages

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY apps/backend-api ./apps/backend-api

# Build application
WORKDIR /app/apps/backend-api
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend-api/dist ./dist
COPY --from=builder /app/apps/backend-api/package*.json ./

# Create uploads directory
RUN mkdir -p uploads/receipts

EXPOSE 3000

CMD ["node", "dist/main"]
```

Create Dockerfile for POS app:
```bash
nano ~/production/pos-system/apps/pos/Dockerfile
```

Add:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/pos/package*.json ./apps/pos/
COPY packages ./packages

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/pos ./apps/pos

# Build application
WORKDIR /app/apps/pos
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/pos/.next ./.next
COPY --from=builder /app/apps/pos/public ./public
COPY --from=builder /app/apps/pos/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

Create Dockerfile for Inventory app:
```bash
nano ~/production/pos-system/apps/inventory/Dockerfile
```

Add:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/inventory/package*.json ./apps/inventory/
COPY packages ./packages

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/inventory ./apps/inventory

# Build application
WORKDIR /app/apps/inventory
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/inventory/.next ./.next
COPY --from=builder /app/apps/inventory/public ./public
COPY --from=builder /app/apps/inventory/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

Create Dockerfile for Super Admin app:
```bash
nano ~/production/pos-system/apps/super-admin/Dockerfile
```

Add:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/super-admin/package*.json ./apps/super-admin/
COPY packages ./packages

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/super-admin ./apps/super-admin

# Build application
WORKDIR /app/apps/super-admin
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/super-admin/.next ./.next
COPY --from=builder /app/apps/super-admin/public ./public
COPY --from=builder /app/apps/super-admin/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

**✅ Checkpoint:** All Dockerfiles are created! Now we'll set up the complete deployment configuration.

---

## 🐳 Part 5: Complete Docker Compose Setup

### Step 5.1: Stop Test Database

First, stop the test database we started earlier:
```bash
cd ~/production
docker compose -f docker-compose-db.yml down
```

**Note:** Don't worry, your data in `postgres-data` directory is preserved.

### Step 5.2: Create Complete Docker Compose File

Now create the complete docker-compose file for all services:
```bash
nano ~/production/docker-compose.yml
```

> **💡 Note:** This will include the database AND all application services.
> The network `pos-network` already exists from Part 2.

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
      POSTGRES_PASSWORD: CHANGE_THIS_STRONG_PASSWORD  # Use the same password from Part 2
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
      # Option 1: Individual database variables
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: pos_user
      DB_PASSWORD: CHANGE_THIS_STRONG_PASSWORD
      DB_DATABASE: pos_db
      
      # Option 2: DATABASE_URL (Alternative - use one or the other)
      # DATABASE_URL: postgresql://pos_user:CHANGE_THIS_STRONG_PASSWORD@postgres:5432/pos_db
      
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
    external: true  # Use the network we created in Part 2
```

**Important:** Make sure to replace `CHANGE_THIS_STRONG_PASSWORD` with the SAME password you used in Part 2!

**✅ Checkpoint:** Complete docker-compose configuration is ready!

---

## 🌐 Part 6: Nginx Configuration

### Step 6.1: Configure Nginx

Create Nginx configuration file:
```bash
nano ~/production/nginx/conf.d/pos-system.conf
```

---

### 🔵 [IP-BASED] Configuration (Path-Based Routing)

Use this configuration if you're accessing via IP address only.

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

# Main server block - all apps served from one IP
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    # Backend API - accessible at http://YOUR_SERVER_IP/api
    location /api {
        rewrite ^/api/(.*) /$1 break;
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

    # POS App - accessible at http://YOUR_SERVER_IP/pos
    location /pos {
        rewrite ^/pos/(.*) /$1 break;
        rewrite ^/pos$ / break;
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

    # Inventory App - accessible at http://YOUR_SERVER_IP/inventory
    location /inventory {
        rewrite ^/inventory/(.*) /$1 break;
        rewrite ^/inventory$ / break;
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

    # Super Admin App - accessible at http://YOUR_SERVER_IP/admin
    location /admin {
        rewrite ^/admin/(.*) /$1 break;
        rewrite ^/admin$ / break;
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

    # Root - simple status page
    location = / {
        return 200 'POS System is running. Access: /api, /pos, /inventory, /admin';
        add_header Content-Type text/plain;
    }
}
```

**Access URLs:**
- Backend API: `http://YOUR_SERVER_IP/api`
- POS App: `http://YOUR_SERVER_IP/pos`
- Inventory App: `http://YOUR_SERVER_IP/inventory`
- Super Admin: `http://YOUR_SERVER_IP/admin`

---

### 🟢 [DOMAIN-BASED] Configuration (Subdomain Routing)

Use this configuration if you have a domain with subdomains configured.

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

## 🚀 Part 7: Deploy All Services

### Step 7.1: Build and Start All Services

Navigate to production directory:
```bash
cd ~/production
```

Build and start all services:
```bash
docker compose up -d --build
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

### Step 7.2: Initialize Database

Run database migrations:
```bash
docker compose exec backend npm run migration:run
```

Seed initial data (if you have seed script):
```bash
docker compose exec backend npm run seed
```

### Step 7.3: Verify Deployment

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

🔵 **[IP-BASED]** Test with curl:
```bash
# Test if server is responding
curl http://YOUR_SERVER_IP

# Test backend API health endpoint
curl http://YOUR_SERVER_IP/api/health

# Test POS app
curl http://YOUR_SERVER_IP/pos

# Test Inventory app
curl http://YOUR_SERVER_IP/inventory

# Test Admin app
curl http://YOUR_SERVER_IP/admin
```

🟢 **[DOMAIN-BASED]** Test with curl:
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

🔵 **[IP-BASED]** - Visit these URLs:
- `http://YOUR_SERVER_IP/api` - Backend API
- `http://YOUR_SERVER_IP/pos` - POS Application
- `http://YOUR_SERVER_IP/inventory` - Inventory Application
- `http://YOUR_SERVER_IP/admin` - Super Admin Panel

🟢 **[DOMAIN-BASED]** - Visit these URLs:
- `http://api.yourdomain.com` - Backend API
- `http://pos.yourdomain.com` - POS Application
- `http://inventory.yourdomain.com` - Inventory Application
- `http://admin.yourdomain.com` - Super Admin Panel

---

## 🔒 Part 8: SSL/HTTPS Setup

> **Note:** This section is only for **🟢 [DOMAIN-BASED]** deployments. Skip this if you're using IP-based deployment.

### Step 8.1: Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Step 8.2: Obtain SSL Certificates

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

### Step 8.3: Update Nginx Configuration for HTTPS

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

### Step 8.4: Restart Nginx

```bash
docker compose restart nginx
```

### Step 8.5: Setup Auto-Renewal

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

## 🔧 Part 9: Maintenance & Operations

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

### 🔵 [IP-BASED] Path routing not working
```bash
# Check Nginx logs for routing errors
docker compose logs nginx | grep error

# Verify Nginx configuration
docker compose exec nginx nginx -t

# Test specific paths
curl -v http://YOUR_SERVER_IP/api
curl -v http://YOUR_SERVER_IP/pos

# Check if rewrite rules are working
docker compose exec nginx cat /etc/nginx/conf.d/pos-system.conf

# Restart Nginx
docker compose restart nginx
```

### 🔵 [IP-BASED] Frontend can't connect to backend
```bash
# Check CORS settings in backend .env
cat ~/production/pos-system/apps/backend-api/.env | grep CORS

# Should be: CORS_ORIGIN=http://YOUR_SERVER_IP

# Update if wrong, then rebuild
cd ~/production
docker compose up -d --build backend

# Check backend logs for CORS errors
docker compose logs backend | grep CORS
```

### 🟢 [DOMAIN-BASED] Domain not resolving
```bash
# Check DNS resolution
nslookup api.yourdomain.com
nslookup pos.yourdomain.com

# Test if domain points to your server
ping api.yourdomain.com

# Check Nginx server_name configuration
docker compose exec nginx cat /etc/nginx/conf.d/pos-system.conf | grep server_name
```

### 🟢 [DOMAIN-BASED] SSL certificate issues
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

### Common (Both IP-Based and Domain-Based)
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

### 🔵 [IP-BASED] Additional Considerations
- [ ] Firewall rules restrict access to trusted IPs only (optional)
- [ ] VPN access configured for remote access (recommended)
- [ ] Network is behind a router/firewall
- [ ] Regular security audits

### 🟢 [DOMAIN-BASED] Additional Requirements
- [ ] SSL/HTTPS enabled for all domains
- [ ] SSL auto-renewal configured
- [ ] Rate limiting configured in Nginx (recommended)
- [ ] Security headers configured in Nginx
- [ ] DNS records properly configured
- [ ] CORS properly configured for all domains

---

## 📝 Post-Deployment Notes

### 🔵 [IP-BASED] Access URLs

Your applications are accessible at:
- **Backend API:** `http://YOUR_SERVER_IP/api`
- **POS App:** `http://YOUR_SERVER_IP/pos`
- **Inventory App:** `http://YOUR_SERVER_IP/inventory`
- **Super Admin:** `http://YOUR_SERVER_IP/admin`

**Examples (replace with your actual IP):**
- `http://192.168.1.100/api`
- `http://192.168.1.100/pos`
- `http://192.168.1.100/inventory`
- `http://192.168.1.100/admin`

### 🟢 [DOMAIN-BASED] Access URLs

Your applications are accessible at:
- **Backend API:** `https://api.yourdomain.com` (or `http://` if SSL not configured yet)
- **POS App:** `https://pos.yourdomain.com`
- **Inventory App:** `https://inventory.yourdomain.com`
- **Super Admin:** `https://admin.yourdomain.com`

### Default Credentials
Create your first admin user through the backend API or seed script.

### Next Steps

🔵 **[IP-BASED]** Recommended next steps:
1. Test all applications thoroughly
2. Create your first admin user
3. Test creating products, orders, etc.
4. When ready for production, purchase a domain and migrate to domain-based deployment

🟢 **[DOMAIN-BASED]** Recommended next steps:
1. Set up SSL/HTTPS (Part 6)
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

# Using localhost (if running backend outside Docker)
DATABASE_URL=postgresql://pos_user:yourpassword@localhost:5432/pos_db

# Using external IP (not recommended for production)
DATABASE_URL=postgresql://pos_user:yourpassword@192.168.1.100:5432/pos_db
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

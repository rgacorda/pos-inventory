# AR-POS Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or Docker with PostgreSQL)
- Git

## Installation Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd pos
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### 3. Database Setup

#### Option A: Docker PostgreSQL (Recommended)

```bash
docker run --name arpos-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=arpos_db \
  -p 5432:5432 \
  -d postgres:14
```

#### Option B: Local PostgreSQL

Create a new database:

```sql
CREATE DATABASE arpos_db;
```

### 4. Configure Environment

Create `.env` file in `apps/backend-api/`:

```env
# Database
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/arpos_db"

# JWT
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Application
PORT=3001
NODE_ENV=development
```

### 5. Build Shared Packages

```bash
npm run build
```

### 6. Seed Database

```bash
npm run seed --workspace=apps/backend-api
```

### 7. Start Development Servers

```bash
npm run dev
```

This starts:

- Backend API on http://localhost:3001
- Frontend POS on http://localhost:3000

## Default Credentials

- **Cashier**: cashier@pos.com / cashier123
- **Admin**: admin@pos.com / admin123

## Troubleshooting

### Shared Types Import Error

```bash
cd packages/shared-types
npm run build
```

### Port Already in Use

Kill the process or change ports in package.json

### Database Connection Failed

- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists

## Next Steps

1. Login with cashier credentials
2. Browse product catalog
3. Create test orders
4. Check transaction sync
5. View transactions page

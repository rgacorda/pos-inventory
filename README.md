```md
# 🧱 Monorepo: POS & Inventory System

This monorepo contains a **backend API** and **two frontend applications**:

1. **Backend API** – NestJS (source of truth)
2. **POS Frontend** – Next.js (offline-first)
3. **Inventory System Frontend** – Next.js (online)

The system is designed to support **offline sales**, **eventual consistency**, and **safe synchronization** to a centralized PostgreSQL database.

---

## 📁 Project Structure
```

/apps
/backend-api # NestJS backend (PostgreSQL)
/pos # Offline-first POS (Next.js + IndexedDB)
/inventory # Inventory & admin frontend (Next.js)
/src
/app # Next.js pages (dashboard, products, users)
/components # React components (auth, navigation, UI)
/lib # API client, utilities
/packages
/shared-types # Shared DTOs, enums, interfaces
/shared-utils # Shared business logic
/config # ESLint, TS config, etc.
/docs # Documentation (setup guides, architecture, API)

````

---

## 🧠 Core Architectural Principles

- **PostgreSQL is the single source of truth**
- **POS must work fully offline**
- **POS never writes directly to PostgreSQL**
- **All synchronization happens through the backend API**
- **Completed sales are never rejected**
- **Inventory is authoritative on the backend**

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL database
- npm >= 10.2.4

### Installation

```bash
# Install all dependencies
npm install
````

### Database Setup

```bash
# Set environment variables in apps/backend-api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/pos
JWT_SECRET=your-secret-key-here

# Reset database and seed demo data
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run seed
```

### Running Applications

```bash
# Run all apps with Turbo
npm run dev

# Or run individually:
npm run dev:backend    # Backend API → http://localhost:3000
npm run dev:pos        # POS Frontend → http://localhost:3001
npm run dev:inventory  # Inventory → http://localhost:3002
```

### Port Configuration

| Application      | Port | URL                   |
| ---------------- | ---- | --------------------- |
| Backend API      | 3000 | http://localhost:3000 |
| POS Frontend     | 3001 | http://localhost:3001 |
| Inventory System | 3002 | http://localhost:3002 |

---

## 🧩 Applications Overview

### 1️⃣ Backend API (`apps/backend-api`)

**Tech**

- NestJS
- PostgreSQL
- REST API (sync-based)

**Responsibilities**

- Data validation
- Conflict handling
- Idempotent writes
- Inventory authority
- Authentication
- Sync coordination

**Important Rules**

- Never trust POS inventory values
- Always deduplicate using `pos_local_id`
- Accept offline sales even if stock goes negative

---

### 2️⃣ POS Frontend (`apps/pos`)

**Tech**

- Next.js
- PWA (Service Workers)
- IndexedDB (Dexie.js recommended)

**Offline Capabilities**

- Create sales
- Process payments
- Apply discounts & taxes
- Print receipts
- Cache products & prices

**Local Storage**

- IndexedDB is used as a **local transaction store**
- Data is synced later when online

**POS is NOT**

- A backend
- An inventory authority
- Allowed to write directly to PostgreSQL

---

### 3️⃣ Inventory System (`apps/inventory`) - Port 3002

**Tech**

- Next.js 16.1.6 (App Router, Turbopack)
- Online-only dashboard
- shadcn/ui + Radix UI components
- Recharts for analytics
- Role-based access (ADMIN, MANAGER only)
- Monochrome design system

**Features**

- **Dashboard**: Statistics cards (products, users, orders, revenue), quick actions
- **Products Management**: Full CRUD, category filters, stock tracking, SKU/barcode, tax rates
- **Users Management**: Full CRUD (ADMIN only), role-based filtering, status badges
- **Orders Management**: Data table with pagination, date range filters, order details, search
- **Reports & Analytics**: 5 comprehensive tabs
  - Overview: Sales trends (area chart), recent orders
  - Products: Top 10 products (ranked list + bar chart)
  - Performance: Cashier and terminal performance tables
  - Payments: Payment method breakdown (pie chart + list)
  - Patterns: Hourly sales analysis, peak hours identification
- **Terminals Management**: Register/manage POS terminals, sync status, manual sync trigger
- **Organization Settings**: View/edit organization details (ADMIN only)

**Responsibilities**

- Product catalog management (categories, pricing, stock)
- Stock control (quantity tracking, low stock indicators)
- Price updates (base price + tax rate configuration)
- User/team management (roles, permissions, status)
- Comprehensive analytics (sales trends, product performance, cashier metrics)
- Terminal registration & sync coordination
- Organization details management

**Access Control**

- ADMIN: Full CRUD access, organization settings, user management
- MANAGER: Read-only access to products/orders/reports
- CASHIER: Blocked (403) - POS only
- SUPER_ADMIN: Blocked (use separate Admin Portal at super.pos.com)

**Pages**

- `/` - Dashboard with statistics
- `/products` - Product catalog management
- `/users` - User management (ADMIN only)
- `/orders` - Order history & details
- `/reports` - 5-tab analytics dashboard
- `/terminals` - Terminal management & sync
- `/organization` - Organization settings (ADMIN only)

---

## 🔄 Offline Sync Model (Critical)

### Data Flow

```

POS (IndexedDB)
↓
Sync API (NestJS)
↓
PostgreSQL

```

### Sync Characteristics

- **Append-only**
- **Idempotent**
- **Retry-safe**
- **Batch-based**

### Example Sync Endpoint

```http
POST /pos/sync
```

```json
{
  "terminalId": "uuid",
  "lastSyncAt": "timestamp",
  "orders": [],
  "payments": []
}
```

---

## 🗃 IndexedDB Rules (POS)

### What is Stored Locally

- ✅ Orders
- ✅ Payments
- ✅ Refunds
- ✅ Cached product catalog
- ✅ Sync metadata

### What Is Never Stored

- ❌ Global inventory counts
- ❌ Financial totals
- ❌ Authoritative product data

---

## 🧪 Conflict Resolution Strategy

| Scenario                              | Behavior            |
| ------------------------------------- | ------------------- |
| Sale made offline, stock insufficient | Accept sale         |
| Product price updated while offline   | Use cached price    |
| Duplicate sync request                | Ignore (idempotent) |
| Inventory mismatch                    | Reconcile later     |

⚠️ **Sales are never rejected after completion**

---

## 🏢 Multi-Tenant Architecture

The system uses **organization-based data isolation** with `organizationId` on all entities.

### Tenant Isolation

Every entity (Order, Product, Payment, User, Terminal) includes:

```typescript
@Column({ type: 'uuid' })
@Index()
organizationId: string;
```

### Authentication Flow

1. User logs in with `email` + `password`
2. Backend validates and returns JWT containing:
   - `userId`
   - `email`
   - `role` (SUPER_ADMIN, ADMIN, MANAGER, CASHIER)
   - `organizationId` (nullable for SUPER_ADMIN)
   - `organizationName`
3. Frontend stores token + org context in localStorage
4. All API requests include JWT in Authorization header
5. Backend extracts `organizationId` from JWT and filters queries

### Role-Based Access Control

| Role        | Backend API    | POS Frontend   | Inventory Frontend |
| ----------- | -------------- | -------------- | ------------------ |
| SUPER_ADMIN | ✅ Full access | ❌ Blocked     | ❌ Blocked         |
| ADMIN       | ✅ Org-scoped  | ❌ Blocked     | ✅ Full access     |
| MANAGER     | ✅ Org-scoped  | ❌ Blocked     | ✅ Read-only       |
| CASHIER     | ✅ Limited     | ✅ Full access | ❌ Blocked         |

### Sync with Multi-Tenancy

```typescript
// Products filtered by organization during sync
const products = await queryBuilder
  .where("product.status = :status", { status: "ACTIVE" })
  .andWhere("product.organizationId = :orgId", {
    orgId: user.organizationId,
  })
  .getMany();

// Orders automatically tagged with organizationId
await this.ordersService.create({
  ...orderData,
  organizationId: user.organizationId,
});
```

### Demo Organizations

After running `npm run seed`:

**Demo Store**

- Admin: `admin@demo-store.com` / `admin123`
- Manager: `manager@demo-store.com` / `manager123`
- Cashier: `cashier@demo-store.com` / `cashier123`

**Coffee Shop**

- Admin: `admin@coffee-shop.com` / `admin123`
- Cashier: `cashier@coffee-shop.com` / `cashier123`

---

## 🔐 Authentication (Offline-Aware)

- Login requires online connection
- JWT/session cached locally
- Role checks performed locally
- Revalidated on next online sync

---

## 🧰 Shared Packages

### `shared-types`

- DTOs
- API contracts
- Enums
- Events

### `shared-utils`

- Tax calculation
- Price logic
- Discount rules

> Shared logic must be **pure and deterministic**

---

## 🚫 Explicit Non-Goals

- No direct POS → DB access
- No real-time inventory enforcement offline
- No multi-terminal local sync (for now)
- No backend per POS terminal

---

## 🧠 AI Assistant Instructions

When assisting with this repository:

- Assume **offline-first POS**
- Treat **backend as authority**
- Do not suggest direct DB writes from frontend
- Prefer sync-based, idempotent APIs
- Never reject completed sales

---

## 📚 Documentation

Comprehensive guides and documentation are available in the `/docs` folder:

- **[INVENTORY_SETUP.md](docs/INVENTORY_SETUP.md)** - Complete inventory system setup guide
- **[API.md](docs/API.md)** - API endpoints and authentication
- **[FEATURES.md](docs/FEATURES.md)** - Feature documentation
- **[SETUP.md](docs/SETUP.md)** - Initial setup instructions
- **[PROGRESS.md](docs/PROGRESS.md)** - Development progress tracking

---

## ✅ Summary

✔ One backend (NestJS)
✔ One offline POS (Next.js + IndexedDB)
✔ One inventory frontend (Next.js)
✔ PostgreSQL as source of truth
✔ Sync, not upload
✔ Multi-tenant with organization-based isolation
✔ Role-based access control (SUPER_ADMIN, ADMIN, MANAGER, CASHIER)

---

- NestJS **sync controller code**

Just say the word 🚀

```

```

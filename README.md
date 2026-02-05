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
/backend-api        # NestJS backend (PostgreSQL)
/pos                # Offline-first POS (Next.js + IndexedDB)
/inventory           # Inventory & admin frontend (Next.js)
/packages
/shared-types       # Shared DTOs, enums, interfaces
/shared-utils       # Shared business logic
/config             # ESLint, TS config, etc.

```

---

## 🧠 Core Architectural Principles

- **PostgreSQL is the single source of truth**
- **POS must work fully offline**
- **POS never writes directly to PostgreSQL**
- **All synchronization happens through the backend API**
- **Completed sales are never rejected**
- **Inventory is authoritative on the backend**

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

### 3️⃣ Inventory System (`apps/inventory`)

**Tech**
- Next.js
- Online-only

**Responsibilities**
- Product management
- Stock control
- Price updates
- Reports
- Reconciliation

---

## 🔄 Offline Sync Model (Critical)

### Data Flow

```

POS (IndexedDB)
↓
Sync API (NestJS)
↓
PostgreSQL

````

### Sync Characteristics

- **Append-only**
- **Idempotent**
- **Retry-safe**
- **Batch-based**

### Example Sync Endpoint

```http
POST /pos/sync
````

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

* ✅ Orders
* ✅ Payments
* ✅ Refunds
* ✅ Cached product catalog
* ✅ Sync metadata

### What Is Never Stored

* ❌ Global inventory counts
* ❌ Financial totals
* ❌ Authoritative product data

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

## 🔐 Authentication (Offline-Aware)

* Login requires online connection
* JWT/session cached locally
* Role checks performed locally
* Revalidated on next online sync

---

## 🧰 Shared Packages

### `shared-types`

* DTOs
* API contracts
* Enums
* Events

### `shared-utils`

* Tax calculation
* Price logic
* Discount rules

> Shared logic must be **pure and deterministic**

---

## 🚫 Explicit Non-Goals

* No direct POS → DB access
* No real-time inventory enforcement offline
* No multi-terminal local sync (for now)
* No backend per POS terminal

---

## 🧠 AI Assistant Instructions

When assisting with this repository:

* Assume **offline-first POS**
* Treat **backend as authority**
* Do not suggest direct DB writes from frontend
* Prefer sync-based, idempotent APIs
* Never reject completed sales

---

## ✅ Summary

✔ One backend (NestJS)
✔ One offline POS (Next.js + IndexedDB)
✔ One inventory frontend (Next.js)
✔ PostgreSQL as source of truth
✔ Sync, not upload

```

If you want next, I can generate:
- `SYNC_CONTRACT.md`
- `ARCHITECTURE.md`
- `AI_RULES.md`
- POS **IndexedDB schema**
- NestJS **sync controller code**

Just say the word 🚀
```

# Multi-Tenant User Role System - Implementation Progress

**Date Started**: February 12, 2026  
**Status**: Backend Implementation Complete ✅

---

## Overview

This document tracks the implementation of a multi-tenant, role-based access control (RBAC) system for the POS platform. The system supports multiple organizations with isolated data and different user roles across three frontend platforms.

---

## Architecture Design

### **Platform Structure**

```
┌─────────────────────────────────────────────────────────────┐
│                     POS Platform                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ admin.pos.com│  │inventory.pos │  │  pos.pos.com │      │
│  │              │  │     .com     │  │              │      │
│  │ Super Admin  │  │   Admin +    │  │   Cashier +  │      │
│  │   Portal     │  │   Manager    │  │  Manager +   │      │
│  │              │  │              │  │   Admin      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### **User Roles**

| Role            | Organization    | Access                          | Purpose                                                                |
| --------------- | --------------- | ------------------------------- | ---------------------------------------------------------------------- |
| **SUPER_ADMIN** | None (Platform) | admin.pos.com                   | Platform owner - manages all organizations, subscriptions, and billing |
| **ADMIN**       | Scoped          | inventory.pos.com + pos.pos.com | Organization owner - full access to their business data                |
| **MANAGER**     | Scoped          | inventory.pos.com + pos.pos.com | Store manager - can manage inventory and use POS                       |
| **CASHIER**     | Scoped          | pos.pos.com only                | POS operator - process sales only                                      |

### **Multi-Tenancy Model**

```
Organization (Tenant)
├── Subscription
│   ├── Plan (FREE, BASIC, PROFESSIONAL, ENTERPRISE)
│   ├── Status (ACTIVE, TRIAL, PAST_DUE, CANCELLED, EXPIRED)
│   └── Limits (users, terminals, products, transactions)
├── Users (ADMIN, MANAGER, CASHIER)
├── Terminals
├── Products
├── Orders
└── Payments
```

---

## Implementation Checklist

### ✅ Phase 1: Backend Foundation (COMPLETED)

#### 1.1 Shared Types & Enums

- [x] Update `UserRole` enum with new roles
  - `SUPER_ADMIN` - Platform owner
  - `ADMIN` - Organization owner
  - `MANAGER` - Store manager
  - `CASHIER` - POS operator
  - Removed: `INVENTORY_MANAGER` (replaced by MANAGER)
- [x] Add `SubscriptionPlan` enum (FREE, BASIC, PROFESSIONAL, ENTERPRISE)
- [x] Add `SubscriptionStatus` enum (ACTIVE, TRIAL, PAST_DUE, CANCELLED, EXPIRED)
- **File**: `/packages/shared-types/src/enums.ts`

#### 1.2 Database Entities

- [x] Create `OrganizationEntity`
  - Basic info (name, slug, description, contact details)
  - Settings (currency, timezone, language, tax rate, features)
  - Relationships to users, terminals, subscription
  - **File**: `/apps/backend-api/src/entities/organization.entity.ts`

- [x] Create `SubscriptionEntity`
  - Plan and status tracking
  - Billing information (Stripe integration ready)
  - Usage limits based on plan
  - Trial period tracking
  - **File**: `/apps/backend-api/src/entities/subscription.entity.ts`

- [x] Update `UserEntity`
  - Add `organizationId` (nullable for SUPER_ADMIN)
  - Add organization relationship
  - Add `phone` and `lastLoginAt` fields
  - **File**: `/apps/backend-api/src/entities/user.entity.ts`

- [x] Update `TerminalEntity`
  - Add `organizationId` (required)
  - Add organization relationship
  - **File**: `/apps/backend-api/src/entities/terminal.entity.ts`

#### 1.3 Authentication & Authorization

- [x] Create `TenantGuard` - Ensures users only access their organization's data
  - **File**: `/apps/backend-api/src/auth/guards/tenant.guard.ts`

- [x] Update `RolesGuard` - Super admin bypasses all role checks
  - **File**: `/apps/backend-api/src/auth/guards/roles.guard.ts`

- [x] Create `@CurrentOrganization()` decorator
  - **File**: `/apps/backend-api/src/auth/decorators/current-organization.decorator.ts`

#### 1.4 Organizations Module

- [x] Create Organizations CRUD service
  - Create organization with auto-generated slug
  - Auto-create subscription on organization creation
  - Plan-based limits configuration
  - Activate/deactivate organizations
  - **File**: `/apps/backend-api/src/modules/organizations/organizations.service.ts`

- [x] Create Organizations controller
  - POST `/organizations` - Create (SUPER_ADMIN only)
  - GET `/organizations` - List all (SUPER_ADMIN only)
  - GET `/organizations/:id` - Get one (SUPER_ADMIN, ADMIN)
  - PUT `/organizations/:id` - Update (SUPER_ADMIN, ADMIN)
  - DELETE `/organizations/:id` - Delete (SUPER_ADMIN only)
  - POST `/organizations/:id/activate` - Activate (SUPER_ADMIN only)
  - POST `/organizations/:id/deactivate` - Deactivate (SUPER_ADMIN only)
  - **File**: `/apps/backend-api/src/modules/organizations/organizations.controller.ts`

- [x] Create Organizations DTOs
  - `CreateOrganizationDto` with validation
  - `UpdateOrganizationDto` with optional fields
  - **File**: `/apps/backend-api/src/modules/organizations/dto/index.ts`

- [x] Create Organizations module
  - **File**: `/apps/backend-api/src/modules/organizations/organizations.module.ts`

- [x] Register module in `AppModule`
  - **File**: `/apps/backend-api/src/app.module.ts`

#### 1.5 Database Seeding

- [x] Update seed script with new structure
  - Create super admin (platform owner)
  - Create 2 demo organizations
  - Create subscriptions for organizations
  - Create users for each organization (Admin, Manager, Cashier)
  - Create terminals for each organization
  - **File**: `/apps/backend-api/src/seed.ts`

---

## Subscription Plan Limits

| Feature                | FREE | BASIC | PROFESSIONAL | ENTERPRISE |
| ---------------------- | ---- | ----- | ------------ | ---------- |
| Max Users              | 2    | 5     | 20           | Unlimited  |
| Max Terminals          | 1    | 2     | 10           | Unlimited  |
| Max Products           | 100  | 1,000 | 10,000       | Unlimited  |
| Max Transactions/Month | 500  | 5,000 | 50,000       | Unlimited  |
| Multiple Locations     | ❌   | ❌    | ✅           | ✅         |
| Advanced Reporting     | ❌   | ✅    | ✅           | ✅         |
| API Access             | ❌   | ❌    | ✅           | ✅         |
| Priority Support       | ❌   | ❌    | ❌           | ✅         |
| **Monthly Price**      | $0   | $29   | $99          | Custom     |

---

## Test Accounts (After Seeding)

### Platform Level

```
Email: superadmin@pos.com
Password: super123
Role: SUPER_ADMIN
Access: admin.pos.com
```

### Demo Store Organization

```
Admin:
  Email: admin@demo-store.com
  Password: admin123
  Access: inventory.pos.com + pos.pos.com

Manager:
  Email: manager@demo-store.com
  Password: manager123
  Access: inventory.pos.com + pos.pos.com

Cashier:
  Email: cashier@demo-store.com
  Password: cashier123
  Access: pos.pos.com only
```

### Coffee Shop Organization

```
Admin:
  Email: admin@coffee-shop.com
  Password: admin123
  Access: inventory.pos.com + pos.pos.com

Cashier:
  Email: cashier@coffee-shop.com
  Password: cashier123
  Access: pos.pos.com only
```

---

## Next Steps (Pending Frontend Implementation)

### 🔲 Phase 2: Admin Portal (admin.pos.com)

- [ ] Super admin dashboard
- [ ] Organization management UI
- [ ] Subscription management
- [ ] Billing integration (Stripe)
- [ ] Platform analytics

### 🔲 Phase 3: Inventory System (inventory.pos.com)

- [ ] Product management (ADMIN, MANAGER)
- [ ] Inventory tracking
- [ ] Reporting & analytics
- [ ] User management (ADMIN creates/manages CASHIER and MANAGER)
- [ ] Organization settings

### 🔲 Phase 4: POS System Updates (pos.pos.com)

- [ ] Update login to check user role
- [ ] Restrict CASHIER to POS only
- [ ] Allow MANAGER and ADMIN to use POS
- [ ] Organization-scoped data loading
- [ ] Offline sync with tenant isolation

### 🔲 Phase 5: Additional Backend Features

- [ ] Subscription webhooks (Stripe)
- [ ] Usage tracking & enforcement
- [ ] Audit logging
- [ ] Advanced tenant isolation middleware
- [ ] Rate limiting per organization
- [ ] Organization-level API keys

---

## Database Migration Steps

Once backend entities are finalized:

1. **Stop the backend server** (if running)
2. **Generate migration**:
   ```bash
   cd apps/backend-api
   npm run typeorm migration:generate -- -n AddMultiTenancy
   ```
3. **Run migration**:
   ```bash
   npm run typeorm migration:run
   ```
4. **Seed database**:
   ```bash
   npm run seed
   ```
5. **Start backend**:
   ```bash
   npm run start:dev
   ```

---

## Security Considerations

### Implemented

✅ Role-based access control (RBAC)  
✅ Organization-level data isolation  
✅ Super admin privilege system  
✅ Password hashing (bcrypt)  
✅ JWT authentication

### Pending

⏳ Rate limiting per organization  
⏳ Audit logging for sensitive actions  
⏳ Multi-factor authentication (MFA) for admins  
⏳ API key management for integrations  
⏳ IP whitelisting for super admin

---

## API Endpoints

### Organizations

```
POST   /organizations              - Create organization (SUPER_ADMIN)
GET    /organizations              - List all (SUPER_ADMIN)
GET    /organizations/:id          - Get one (SUPER_ADMIN, ADMIN)
PUT    /organizations/:id          - Update (SUPER_ADMIN, ADMIN)
DELETE /organizations/:id          - Delete (SUPER_ADMIN)
POST   /organizations/:id/activate - Activate (SUPER_ADMIN)
POST   /organizations/:id/deactivate - Deactivate (SUPER_ADMIN)
```

### Users (To be updated)

```
POST   /users                      - Create user (SUPER_ADMIN, ADMIN)
GET    /users                      - List organization users (ADMIN, MANAGER)
GET    /users/:id                  - Get user (SUPER_ADMIN, ADMIN, MANAGER)
PUT    /users/:id                  - Update user (SUPER_ADMIN, ADMIN)
DELETE /users/:id                  - Delete user (SUPER_ADMIN, ADMIN)
```

---

## File Changes Summary

### New Files Created

1. `/packages/shared-types/src/enums.ts` - Added subscription enums
2. `/apps/backend-api/src/entities/organization.entity.ts`
3. `/apps/backend-api/src/entities/subscription.entity.ts`
4. `/apps/backend-api/src/auth/guards/tenant.guard.ts`
5. `/apps/backend-api/src/auth/decorators/current-organization.decorator.ts`
6. `/apps/backend-api/src/modules/organizations/organizations.controller.ts`
7. `/apps/backend-api/src/modules/organizations/organizations.service.ts`
8. `/apps/backend-api/src/modules/organizations/organizations.module.ts`
9. `/apps/backend-api/src/modules/organizations/dto/index.ts`

### Modified Files

1. `/packages/shared-types/src/enums.ts` - Updated UserRole, added subscription enums
2. `/apps/backend-api/src/entities/user.entity.ts` - Added organization relationship
3. `/apps/backend-api/src/entities/terminal.entity.ts` - Added organization relationship
4. `/apps/backend-api/src/auth/guards/roles.guard.ts` - Super admin bypass logic
5. `/apps/backend-api/src/app.module.ts` - Registered OrganizationsModule
6. `/apps/backend-api/src/seed.ts` - Complete rewrite with multi-tenant data

---

## Testing Checklist

### Backend API Testing

- [ ] Create organization as super admin
- [ ] Verify subscription auto-creation
- [ ] Test organization slug uniqueness
- [ ] Create users with organization assignment
- [ ] Test tenant isolation (user can't access other org data)
- [ ] Test role-based access control
- [ ] Verify super admin can access all organizations
- [ ] Test organization activation/deactivation

---

## Notes & Decisions

1. **Super Admin Scope**: Super admins don't belong to any organization (`organizationId: null`). They manage the platform itself.

2. **Admin Flexibility**: Admins can use POS if needed (owner working shifts). This is intentional.

3. **Manager Role**: Replaces `INVENTORY_MANAGER` for better clarity. Managers have inventory permissions + POS access.

4. **Subscription Trial**: New organizations get a 14-day trial by default.

5. **Slug Generation**: Organization slugs are auto-generated from names (lowercase, hyphenated).

6. **Soft Delete**: Organizations can be deactivated instead of deleted for data retention.

---

## Questions for Frontend Implementation

1. How should cashiers select their terminal at login?
2. Should managers be able to create/edit products from POS app?
3. Do we need organization profile editing in inventory system?
4. Should super admin portal have analytics dashboard?

---

**Last Updated**: February 12, 2026  
**Next Review**: After frontend implementation begins

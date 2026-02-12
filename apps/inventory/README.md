# Inventory Management System

Multi-tenant inventory management frontend for ADMIN and MANAGER roles.

## Overview

This is a Next.js application that allows administrators and managers to:

- Manage products (CRUD operations)
- Manage users and team members
- View orders and sales reports
- Monitor organization statistics

## Access Control

| Role        | Access                                |
| ----------- | ------------------------------------- |
| ADMIN       | ✅ Full access (create, edit, delete) |
| MANAGER     | ✅ Read-only access                   |
| CASHIER     | ❌ Blocked                            |
| SUPER_ADMIN | ❌ Blocked (use Admin Portal)         |

## Getting Started

```bash
# From monorepo root
npm run dev:inventory

# Or from this directory
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) with your browser.

## Project Structure

```
/src
  /app
    page.tsx              # Dashboard with stats
    layout.tsx            # Root layout with AuthGuard
    /login
      page.tsx           # Login page
    /products
      page.tsx           # Products management
    /users
      page.tsx           # Users management
  /components
    auth-guard.tsx       # Route protection
    login-form.tsx       # Login component
    navigation.tsx       # Top navigation
    /ui                  # shadcn/ui components
  /lib
    api-client.ts        # API wrapper
    utils.ts             # Utilities
```

## Demo Accounts

```
Admin:
Email: admin@demo-store.com
Password: admin123

Manager:
Email: manager@demo-store.com
Password: manager123
```

## Features

- ✅ Multi-tenant data isolation
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Product catalog management
- ✅ User management
- ✅ Real-time statistics
- ✅ Organization dashboard

## Documentation

For complete setup and architecture documentation, see:

- [docs/INVENTORY_SETUP.md](../../docs/INVENTORY_SETUP.md)
- [Root README.md](../../README.md)

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Radix UI primitives
- Axios for API calls

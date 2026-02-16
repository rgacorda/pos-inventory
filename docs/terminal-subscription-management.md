# Terminal & Subscription Management Architecture

## Overview

This document explains how terminals, user accounts, and subscription limits work in the Multi-Tenant POS system.

---

## Role Hierarchy

### 1. Super Admin (Platform Owner)

**Purpose:** Manages the entire SaaS platform

**Responsibilities:**

- Creates Organizations (tenants)
- Assigns Subscription Plans
- Sets subscription limits based on pricing tiers
- Can override limits for special cases
- Monitors platform-wide usage
- Manages billing and payments

**Access:** Super Admin Portal (separate from POS/Inventory apps)

**Does NOT:**

- Directly add terminals for organizations
- Manage day-to-day operations of stores
- Access POS cashier interface

---

### 2. Admin (Organization Owner/Store Manager)

**Purpose:** Manages their specific organization/store

**Responsibilities:**

- Adds/removes terminals (within subscription limits)
- Adds/removes users (within subscription limits)
- Manages products and inventory
- Configures organization settings
- Views all reports and analytics
- Assigns staff to terminals

**Access:** Inventory Management System

**Constraints:**

- Cannot exceed subscription limits
- Can only manage their own organization's data
- Cannot change subscription plan (must contact Super Admin)

---

### 3. Manager

**Purpose:** Assists Admin with daily operations

**Responsibilities:**

- Views terminals and users
- Manages inventory
- Views reports
- Assigns staff to terminals
- Processes returns/voids

**Access:** Inventory Management System (limited)

**Cannot:**

- Add/remove terminals
- Add/remove users
- Change organization settings

---

### 4. Cashier

**Purpose:** Operates POS terminal for sales

**Responsibilities:**

- Process sales at assigned terminal
- Handle payments
- View product information
- Access their own transaction history

**Access:** POS App only

**Cannot:**

- Access Inventory system
- Manage terminals
- View other cashiers' data
- Access reports

---

## Terminal Entity Explained

### What is a Terminal?

A **Terminal** represents a physical checkout station/cash register in a store.

### Why Multiple Terminals?

**Business Operations:**

- Track sales by location (Front Counter, Drive-Thru, Self-Checkout)
- Monitor performance per station
- Identify busy vs. slow areas
- Staff assignment and scheduling

**Technical Benefits:**

- Independent offline operation per terminal
- Prevents sync conflicts
- Better audit trail (who sold what, where)
- Can enable/disable specific terminals

### Terminal Structure

```typescript
Terminal {
  id: uuid
  terminalId: "TERMINAL-001" // Human-readable ID
  name: "Front Counter"
  location: "Main Entrance"
  organizationId: uuid // Links to Organization
  isActive: boolean
  lastSyncAt: timestamp
}
```

### Example Multi-Terminal Setup

```
Large Store:
├── Terminal 1: Front Counter (Main Entrance)
├── Terminal 2: Self-Checkout (Side Entrance)
├── Terminal 3: Express Lane (Drive-Thru)
└── Terminal 4: Customer Service (Back)

Small Store:
├── Terminal 1: Main Counter
└── Terminal 2: Mobile POS (iPad)
```

---

## Subscription Plans & Limits

### Plan Structure

```typescript
interface SubscriptionLimits {
  maxUsers: number; // Maximum user accounts
  maxTerminals: number; // Maximum checkout stations
  maxProducts: number; // Maximum product catalog size
  maxTransactionsPerMonth: number;
  features: {
    multipleLocations: boolean;
    advancedReporting: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
}
```

### Pricing Tiers

#### Basic Plan - $29/month

```typescript
{
  maxUsers: 5
  maxTerminals: 2
  maxProducts: 1,000
  maxTransactionsPerMonth: 5,000
  features: {
    multipleLocations: false
    advancedReporting: false
    apiAccess: false
    prioritySupport: false
  }
}
```

**Best For:** Small single-location stores, food trucks, pop-ups

---

#### Professional Plan - $99/month

```typescript
{
  maxUsers: 20
  maxTerminals: 10
  maxProducts: 10,000
  maxTransactionsPerMonth: 50,000
  features: {
    multipleLocations: true
    advancedReporting: true
    apiAccess: true
    prioritySupport: false
  }
}
```

**Best For:** Medium-sized stores, small chains

---

#### Enterprise Plan - $299/month

```typescript
{
  maxUsers: 100;
  maxTerminals: 50;
  maxProducts: unlimited;
  maxTransactionsPerMonth: unlimited;
  features: {
    multipleLocations: true;
    advancedReporting: true;
    apiAccess: true;
    prioritySupport: true;
  }
}
```

**Best For:** Large chains, multi-location businesses

---

## Permission Matrix

| Action                       | Super Admin | Admin | Manager | Cashier |
| ---------------------------- | ----------- | ----- | ------- | ------- |
| **Subscriptions**            |
| Create subscription plans    | ✅          | ❌    | ❌      | ❌      |
| Assign org subscription      | ✅          | ❌    | ❌      | ❌      |
| Change subscription limits   | ✅          | ❌    | ❌      | ❌      |
| View subscription details    | ✅          | ✅    | ❌      | ❌      |
| **Terminals**                |
| Add terminals (within limit) | ❌\*        | ✅    | ❌      | ❌      |
| Remove terminals             | ❌\*        | ✅    | ❌      | ❌      |
| View terminals               | ✅          | ✅    | ✅      | ✅      |
| Assign staff to terminals    | ✅          | ✅    | ✅      | ❌      |
| Enable/disable terminals     | ❌\*        | ✅    | ❌      | ❌      |
| **Users**                    |
| Add users (within limit)     | ❌\*        | ✅    | ❌      | ❌      |
| Remove users                 | ❌\*        | ✅    | ❌      | ❌      |
| View users                   | ✅          | ✅    | ✅      | ❌      |
| Change user roles            | ❌\*        | ✅    | ❌      | ❌      |
| **Products**                 |
| Add/edit products            | ✅          | ✅    | ✅      | ❌      |
| Delete products              | ✅          | ✅    | ✅      | ❌      |
| View products                | ✅          | ✅    | ✅      | ✅      |
| **Orders**                   |
| Process sales                | ❌          | ❌    | ✅      | ✅      |
| View all orders              | ✅          | ✅    | ✅      | ❌      |
| View own orders              | ✅          | ✅    | ✅      | ✅      |
| Void orders                  | ✅          | ✅    | ✅      | ❌      |
| **Reports**                  |
| View analytics               | ✅          | ✅    | ✅      | ❌      |
| Export reports               | ✅          | ✅    | ❌      | ❌      |

\*Super Admin manages at organization level, not directly

---

## Implementation Guide

### Backend Validation

#### 1. Terminal Limit Guard

```typescript
// apps/backend-api/src/modules/terminals/terminals.service.ts

async create(createDto: CreateTerminalDto, requestingUser: any) {
  // Get organization's subscription
  const subscription = await this.subscriptionRepository.findOne({
    where: { organizationId: requestingUser.organizationId },
    relations: ['organization']
  });

  if (!subscription) {
    throw new NotFoundException('No subscription found for organization');
  }

  // Count existing terminals
  const terminalCount = await this.terminalsRepository.count({
    where: {
      organizationId: requestingUser.organizationId,
      isActive: true
    }
  });

  // Validate against limit
  if (terminalCount >= subscription.limits.maxTerminals) {
    throw new ForbiddenException(
      `Terminal limit reached. Your ${subscription.plan} plan allows ` +
      `${subscription.limits.maxTerminals} terminals. ` +
      `Please upgrade your subscription to add more terminals.`
    );
  }

  // Create terminal
  const terminal = this.terminalsRepository.create({
    ...createDto,
    organizationId: requestingUser.organizationId
  });

  return this.terminalsRepository.save(terminal);
}
```

#### 2. User Limit Guard

```typescript
// apps/backend-api/src/modules/users/users.service.ts

async create(createDto: CreateUserDto, requestingUser: any) {
  // Get organization's subscription
  const subscription = await this.subscriptionRepository.findOne({
    where: { organizationId: requestingUser.organizationId }
  });

  if (!subscription) {
    throw new NotFoundException('No subscription found for organization');
  }

  // Count existing users
  const userCount = await this.userRepository.count({
    where: {
      organizationId: requestingUser.organizationId,
      isActive: true
    }
  });

  // Validate against limit
  if (userCount >= subscription.limits.maxUsers) {
    throw new ForbiddenException(
      `User limit reached. Your ${subscription.plan} plan allows ` +
      `${subscription.limits.maxUsers} users. ` +
      `Please upgrade your subscription to add more users.`
    );
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(createDto.password, 10);

  // Create user
  const user = this.userRepository.create({
    ...createDto,
    password: hashedPassword,
    organizationId: requestingUser.organizationId
  });

  return this.userRepository.save(user);
}
```

#### 3. Controller Guards

```typescript
// apps/backend-api/src/modules/terminals/terminals.controller.ts

@Controller("terminals")
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class TerminalsController {
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async create(@Body() createDto: CreateTerminalDto, @CurrentUser() user: any) {
    return this.terminalsService.create(createDto, user);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.terminalsService.findAll(user);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.terminalsService.remove(id, user);
  }
}
```

---

### Frontend Implementation

#### Terminal Management Page UI

```tsx
// apps/inventory/src/app/(dashboard)/terminals/page.tsx

export default function TerminalsPage() {
  const [terminals, setTerminals] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [terminalsData, subData] = await Promise.all([
        apiClient.getTerminals(),
        apiClient.getSubscription(),
      ]);
      setTerminals(terminalsData);
      setSubscription(subData);
    } catch (error) {
      toast.error("Failed to load terminals");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTerminal = async () => {
    if (terminals.length >= subscription.limits.maxTerminals) {
      toast.error(`Terminal limit reached for ${subscription.plan} plan`);
      return;
    }

    // Show add terminal modal
    setShowAddModal(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Terminals</CardTitle>
            <CardDescription>
              Manage checkout stations for your store
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {terminals.length} / {subscription?.limits.maxTerminals} terminals
            </Badge>
            <Button
              onClick={handleAddTerminal}
              disabled={terminals.length >= subscription?.limits.maxTerminals}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Terminal
            </Button>
          </div>
        </div>
      </CardHeader>

      {terminals.length >= subscription?.limits.maxTerminals && (
        <Alert className="mx-6 mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Terminal Limit Reached</AlertTitle>
          <AlertDescription>
            You've reached the maximum of {subscription.limits.maxTerminals}{" "}
            terminals for your {subscription.plan} plan. Upgrade to add more
            terminals.
            <Button variant="link" onClick={contactSupport}>
              Upgrade Plan →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CardContent>{/* Terminal list table */}</CardContent>
    </Card>
  );
}
```

---

## User Workflows

### Workflow 1: Admin Adds New Terminal

1. **Admin logs into Inventory System**
   - Credentials: `admin@demo-store.com` / `admin123`

2. **Navigate to Terminals**
   - Click "Terminals" in sidebar
   - View current terminals: 2/10 (Professional Plan)

3. **Add Terminal**
   - Click "Add Terminal" button
   - Fill form:
     - Terminal ID: `TERMINAL-003`
     - Name: `Drive-Thru`
     - Location: `West Side`
   - Submit

4. **Backend Validates**
   - Checks subscription limits (10 terminals allowed)
   - Current count: 2 terminals
   - 2 < 10 ✅ Allowed
   - Creates terminal

5. **Success**
   - Terminal appears in list: 3/10
   - Can now be used by cashiers

### Workflow 2: Admin Reaches Terminal Limit

1. **Current State**
   - Basic Plan: 2 terminals allowed
   - Current: 2 terminals active

2. **Admin Tries to Add 3rd Terminal**
   - Clicks "Add Terminal" (button is disabled with tooltip)
   - Sees alert: "Terminal limit reached"

3. **Options Presented**
   - View current subscription: Basic ($29/mo)
   - Upgrade options:
     - Professional: 10 terminals ($99/mo)
     - Enterprise: 50 terminals ($299/mo)
   - "Contact Support" button

4. **Admin Contacts Support**
   - Opens support ticket
   - Super Admin reviews
   - Upgrades subscription to Professional
   - Admin can now add more terminals

---

## Database Schema Reference

### Organizations Table

```sql
organizations
├── id (uuid, PK)
├── name (varchar)
├── slug (varchar, unique)
├── email (varchar)
├── settings (jsonb)
├── isActive (boolean)
└── timestamps
```

### Subscriptions Table

```sql
subscriptions
├── id (uuid, PK)
├── organizationId (uuid, FK)
├── plan (enum: TRIAL, BASIC, PROFESSIONAL, ENTERPRISE)
├── status (enum: TRIAL, ACTIVE, CANCELLED, SUSPENDED)
├── monthlyPrice (decimal)
├── billingCycle (varchar)
├── limits (jsonb)
│   ├── maxUsers
│   ├── maxTerminals
│   ├── maxProducts
│   ├── maxTransactionsPerMonth
│   └── features
├── currentPeriodStart (timestamp)
├── currentPeriodEnd (timestamp)
├── trialEndsAt (timestamp)
└── timestamps
```

### Terminals Table

```sql
terminals
├── id (uuid, PK)
├── terminalId (varchar, unique)
├── name (varchar)
├── location (varchar)
├── organizationId (uuid, FK)
├── lastSyncAt (timestamp)
├── isActive (boolean)
└── timestamps
```

### Users Table

```sql
users
├── id (uuid, PK)
├── email (varchar, unique)
├── name (varchar)
├── password (varchar, hashed)
├── role (enum: SUPER_ADMIN, ADMIN, MANAGER, CASHIER)
├── organizationId (uuid, FK, nullable)
├── terminalId (uuid, FK, nullable)
├── isActive (boolean)
├── phone (varchar)
├── lastLoginAt (timestamp)
└── timestamps
```

### Orders Table

```sql
orders
├── id (uuid, PK)
├── orderNumber (varchar)
├── organizationId (uuid, FK)
├── terminalId (uuid, FK)
├── cashierId (uuid, FK)
├── status (enum: PENDING, COMPLETED, CANCELLED, VOIDED)
├── subtotalAmount (decimal)
├── taxAmount (decimal)
├── totalAmount (decimal)
├── items (relation: OrderItems[])
└── timestamps
```

---

## API Endpoints

### Terminals

```
GET    /terminals              - List all terminals (filtered by org)
GET    /terminals/:id          - Get terminal details
POST   /terminals              - Create terminal (ADMIN only, checks limits)
PUT    /terminals/:id          - Update terminal (ADMIN only)
DELETE /terminals/:id          - Delete/deactivate terminal (ADMIN only)
POST   /terminals/:id/sync     - Sync terminal data
```

### Users

```
GET    /users                  - List all users (filtered by org)
GET    /users/:id              - Get user details
POST   /users                  - Create user (ADMIN only, checks limits)
PUT    /users/:id              - Update user (ADMIN only)
DELETE /users/:id              - Deactivate user (ADMIN only)
```

### Subscriptions (Super Admin only)

```
GET    /subscriptions          - List all subscriptions
GET    /subscriptions/:orgId   - Get org subscription
POST   /subscriptions          - Create subscription
PUT    /subscriptions/:id      - Update subscription plan
DELETE /subscriptions/:id      - Cancel subscription
```

---

## Common Scenarios

### Scenario: New Store Registration

1. **Super Admin Portal**

   ```
   Create Organization → "Pizza Palace"
   Assign Plan → Professional ($99/mo)
   Limits Set: 10 terminals, 20 users
   ```

2. **Create Admin User**

   ```
   Email: admin@pizzapalace.com
   Role: ADMIN
   Organization: Pizza Palace
   Send welcome email with credentials
   ```

3. **Admin Sets Up Store**

   ```
   Login → Inventory System
   Add Terminal 1: "Main Counter"
   Add Terminal 2: "Drive-Thru"
   Add Users:
     - Manager: manager@pizzapalace.com
     - Cashier 1: cashier1@pizzapalace.com
     - Cashier 2: cashier2@pizzapalace.com
   Add Products: Pizza menu items
   ```

4. **Staff Starts Working**
   ```
   Cashier logs into POS app
   Selects Terminal: "Main Counter"
   Starts processing orders
   ```

### Scenario: Upgrade Request

1. **Admin Hits Limit**

   ```
   Current: Basic Plan (2 terminals)
   Used: 2/2 terminals
   Needs: 3rd terminal for new location
   ```

2. **Admin Contacts Support**

   ```
   Support Ticket: "Need to add 3rd terminal"
   Super Admin reviews account
   ```

3. **Super Admin Upgrades**

   ```
   Change Plan: Basic → Professional
   New Limits: 10 terminals, 20 users
   Prorated billing applied
   ```

4. **Admin Adds Terminal**
   ```
   Now shows: 2/10 terminals
   Can add Terminal 3: "New Location"
   ```

---

## Testing Checklist

### Terminal Limits

- [ ] Admin can add terminals within limit
- [ ] Admin blocked when limit reached
- [ ] Error message shows upgrade options
- [ ] UI button disabled at limit
- [ ] Limit count updates in real-time

### User Limits

- [ ] Admin can add users within limit
- [ ] Admin blocked when limit reached
- [ ] Existing users not affected by limit
- [ ] Deactivated users don't count toward limit

### Multi-Tenant Isolation

- [ ] Org A cannot see Org B's terminals
- [ ] Org A cannot add terminals to Org B
- [ ] Terminal IDs unique across platform
- [ ] Orders link to correct terminal

### Role Permissions

- [ ] Cashier blocked from Inventory app
- [ ] Manager cannot add terminals
- [ ] Admin cannot change subscription
- [ ] Super Admin can view all orgs

---

## Future Enhancements

### Planned Features

1. **Self-Service Subscription Management**
   - Admin can upgrade/downgrade own plan
   - Stripe integration for billing
   - Usage dashboard showing limit consumption

2. **Terminal Analytics**
   - Sales per terminal
   - Busy hours per terminal
   - Staff performance by terminal

3. **Dynamic Pricing**
   - Pay-per-terminal model
   - Overage charges for exceeding limits
   - Annual discount pricing

4. **Mobile Terminals**
   - iPad/tablet support
   - Roaming terminals (food trucks)
   - Offline-first architecture

5. **Terminal Groups**
   - Organize terminals by location/department
   - Bulk assign staff to terminal groups
   - Group-level reporting

---

## Support & Escalation

### Admin Support Issues

**Issue:** "I need more terminals"
**Solution:** Contact Super Admin for subscription upgrade

**Issue:** "Terminal not syncing"
**Solution:** Check terminal status, restart if needed, check internet

**Issue:** "Cannot add user"
**Solution:** Check user limit, verify email unique, upgrade plan if needed

### Super Admin Tasks

- Monitor subscription utilizations
- Handle upgrade/downgrade requests
- Resolve billing issues
- Configure special limits for VIP customers
- Troubleshoot multi-tenant issues

---

## Related Documentation

- [Authentication & Authorization](./authentication.md)
- [Multi-Tenant Architecture](./multi-tenant.md)
- [Offline Sync Strategy](./offline-sync.md)
- [API Documentation](./api-reference.md)

---

**Last Updated:** February 13, 2026  
**Maintained By:** Development Team  
**Version:** 1.0

# Database Relations & CRUD Protection - Quick Reference

## 🎯 System Status: ALL PROTECTED ✓

---

## 📊 Entity Protection Matrix

| Entity | Has Children | FK Protected | Status | Can Delete? |
|--------|--------------|--------------|--------|-------------|
| **Organization** | ✓ Users, Terminals, Products, Orders, etc. | ✓ Yes | 🟢 Protected | Only if empty |
| **Product** | ✓ OrderItems, Transactions | ✓ Yes | 🟢 Protected | Only if unused |
| **User** | ✓ Orders, Transactions | ✓ Yes | 🟢 Protected | Only if no records |
| **Terminal** | ✓ Orders, Payments | ✓ Yes | 🟢 Protected | Only if no records |
| **Order** | ✓ OrderItems (CASCADE), Payments | ✓ Yes | 🟢 Protected | Admin only, if no payments |
| **Payment** | None | N/A | 🟢 Safe | Admin only, if not completed |
| **Expense** | None | N/A | 🟢 Safe | Anytime |
| **Delivery** | None | N/A | 🟢 Safe | Anytime |
| **OrderItem** | None | CASCADE | 🔵 Auto | Deleted with Order |
| **Transaction** | None | N/A | 🟡 Immutable | Never (audit log) |
| **Subscription** | None | N/A | 🟡 Managed | With Organization |

---

## 🔐 What Happens When You Try to Delete...

### ❌ A Product Used in Orders
```
Backend: Catches foreign key constraint
Returns: BadRequestException with friendly message
Frontend: Shows toast notification
  Title: "Failed to delete product"
  Description: "Cannot delete this item because it is being used 
                by other records. Please remove all related records first."
```

### ❌ A User with Orders
```
Backend: Catches foreign key constraint  
Returns: BadRequestException with friendly message
Frontend: Shows toast notification
  Title: "Failed to delete user"
  Description: "Cannot delete user as they have associated records 
                (orders, transactions, etc.). Please transfer or remove 
                all related records first."
```

### ❌ A Terminal with Orders/Payments
```
Backend: Catches foreign key constraint
Returns: BadRequestException with friendly message
Frontend: Shows toast notification
  Title: "Failed to delete terminal"
  Description: "Cannot delete terminal as it has associated records 
                (orders, transactions, etc.). Please remove all related 
                records first."
```

### ❌ An Organization with Any Records
```
Backend: Catches foreign key constraint
Returns: BadRequestException with friendly message
Frontend: Shows toast notification
  Title: "Failed to delete organization"
  Description: "Cannot delete organization as it has associated records 
                (products, orders, terminals, etc.). Please remove all 
                related records first."
```

### ❌ An Order with Payments
```
Backend: Catches foreign key constraint (NEW!)
Returns: BadRequestException with friendly message
Frontend: Shows toast notification
  Title: "Failed to delete order"
  Description: "Cannot delete order as it has associated payments. 
                Please remove all payments first."
```

### ❌ A Completed Order
```
Backend: Business rule check
Returns: BadRequestException
Frontend: Shows toast notification
  Title: "Failed to delete order"
  Description: "Cannot delete completed or synced orders"
```

### ✅ An Order with Items (No Payments)
```
Backend: Deletes order
         CASCADE deletes all OrderItems automatically
Returns: Success
Frontend: Shows toast notification
  Title: "Order deleted successfully"
```

### ✅ An Expense
```
Backend: Deletes expense (no children)
Returns: Success
Frontend: Shows toast notification
  Title: "Expense deleted successfully"
```

---

## 🎨 User Experience Flow

### Before (Inconsistent)
```
User clicks delete → Product in use → Raw database error → Confused user
"Error: update or delete on table "products" violates foreign key 
constraint "fk_order_items_product_id" on table "order_items""
```

### After (Standardized) ✓
```
User clicks delete → Product in use → Clean error message → User understands

Toast appears:
┌─────────────────────────────────────────┐
│ ❌ Failed to delete product             │
│ Cannot delete this item because it is   │
│ being used by other records. Please     │
│ remove all related records first.       │
└─────────────────────────────────────────┘
```

---

## 🛡️ Protection Layers

### Layer 1: Frontend Validation (Future)
```typescript
// Check if product has orders before showing delete button
if (product.hasOrders) {
  // Disable delete button or show warning
}
```

### Layer 2: Backend Business Rules ✓
```typescript
// Check order status
if (order.status === 'COMPLETED') {
  throw new BadRequestException('Cannot delete completed orders');
}
```

### Layer 3: Database Constraints ✓
```typescript
// Try to delete, catch FK constraint
try {
  await repository.remove(entity);
} catch (error) {
  if (error instanceof QueryFailedError && isFKConstraint(error)) {
    throw new BadRequestException('User-friendly message');
  }
}
```

### Layer 4: Database Foreign Keys ✓
```sql
-- Database enforces referential integrity
ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_product 
FOREIGN KEY (productId) REFERENCES products(id) 
ON DELETE RESTRICT;
```

---

## 🔄 Cascade Delete

Only one cascade delete is configured (correct and safe):

```
Order → OrderItems (CASCADE DELETE)
```

When an Order is deleted:
1. ✓ All OrderItems are automatically deleted (they can't exist without order)
2. ✓ Database handles this automatically via `onDelete: 'CASCADE'`
3. ✓ No orphaned OrderItems remain

**Why this is safe:**
- OrderItems are completely owned by Order
- OrderItems have no meaning without parent Order
- No other entities reference OrderItems

---

## 📈 Entities by Deletion Safety

### 🔴 High Risk (Many References)
Cannot delete if being used:
- **Organization** - Referenced by: Users, Terminals, Products, Orders, Payments, Deliveries, Expenses
- **Product** - Referenced by: OrderItems, InventoryTransactions
- **User** - Referenced by: Orders (cashier), InventoryTransactions
- **Terminal** - Referenced by: Orders, Payments

### 🟡 Medium Risk (Some References)
Business rules + FK constraints:
- **Order** - Referenced by: Payments; Contains: OrderItems (CASCADE)

### 🟢 Low Risk (No References)
Safe to delete (leaf entities):
- **Payment** - No children (admin only, status check)
- **Expense** - No children
- **InventoryDelivery** - No children (JSONB items)

### 🔵 Special Cases
- **OrderItem** - Auto-deleted (CASCADE)
- **InventoryTransaction** - Immutable (audit log)
- **Subscription** - Managed with Organization

---

## 📝 Common Deletion Workflows

### Deleting an Organization
```
1. Delete all Expenses
2. Delete all InventoryDeliveries  
3. Delete all Payments (non-completed)
4. Delete all Orders (non-completed, no payments)
5. Delete all Products (not in orders)
6. Delete all Terminals (no orders)
7. Delete all Users (no orders)
8. Delete Subscription (auto-handled)
9. Delete Organization ✓
```

### Deleting a Product
```
1. Check if used in any OrderItems → If yes, STOP
2. Check if has InventoryTransactions → If yes, consider archiving
3. If unused → Delete ✓
Recommendation: Set status = INACTIVE instead
```

### Deleting a User
```
1. Check if has created Orders → If yes, STOP or transfer
2. Check if has InventoryTransactions → If yes, STOP
3. If no records → Delete ✓
Recommendation: Set isActive = false instead
```

### Deleting an Order
```
1. Check status → If COMPLETED/SYNCED, STOP
2. Check for Payments → If exists, delete payments first or STOP
3. OrderItems will be CASCADE deleted automatically
4. Delete Order ✓
```

---

## 🎯 Key Takeaways

1. ✅ **All critical entities are protected** from accidental deletion
2. ✅ **User-friendly error messages** replace database error codes
3. ✅ **Cascade delete works correctly** for OrderItems
4. ✅ **Business rules enforced** (status checks, admin-only)
5. ✅ **Frontend and backend aligned** on error handling
6. ✅ **No orphaned records** possible
7. ✅ **Audit trail preserved** (transactions immutable)

---

## 🧪 Quick Test Commands

```bash
# Test in browser console (logged in as admin)

// Try to delete product used in orders
await apiClient.deleteProduct('product-id-with-orders')
// Expected: Toast error about being used in records

// Try to delete user with orders  
await apiClient.deleteUser('user-id-with-orders')
// Expected: Toast error about associated records

// Try to delete terminal with orders
await apiClient.deleteTerminal('terminal-id-with-orders')
// Expected: Toast error about associated records

// Try to delete completed order
await apiClient.deleteOrder('completed-order-id')
// Expected: Toast error about completed orders

// Try to delete order with payments
await apiClient.deleteOrder('order-id-with-payments')
// Expected: Toast error about associated payments

// Delete order with no payments (works)
await apiClient.deleteOrder('empty-order-id')
// Expected: Success toast, OrderItems cascade deleted
```

---

## 📚 Documentation

**Detailed Docs:**
- [DATABASE_RELATIONSHIPS.md](./DATABASE_RELATIONSHIPS.md) - Full relationship diagram
- [DATABASE_CONSTRAINT_VERIFICATION.md](./DATABASE_CONSTRAINT_VERIFICATION.md) - Verification report
- [TOAST_STANDARDIZATION.md](./TOAST_STANDARDIZATION.md) - Toast notification system

**Code Files:**
- Backend: `/apps/backend-api/src/modules/*/services/*.service.ts`
- Entities: `/apps/backend-api/src/entities/*.entity.ts`
- Toast Utils: `/apps/*/src/lib/toast-utils.ts`

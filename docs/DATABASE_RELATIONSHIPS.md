# Database Relationships & Deletion Rules

## Entity Relationship Diagram

```
Organization (Root Entity)
├── Subscription (1:1)
├── Users (1:N)
│   └── Orders (as cashier) (1:N)
├── Terminals (1:N)
│   ├── Orders (1:N)
│   └── Payments (1:N)
├── Products (1:N)
│   ├── OrderItems (1:N)
│   └── InventoryTransactions (1:N)
├── Orders (1:N)
│   ├── OrderItems (1:N) [CASCADE DELETE]
│   └── Payments (1:N)
├── Payments (1:N)
├── InventoryDeliveries (1:N)
└── Expenses (1:N)
```

## Deletion Rules & Constraints

### ✅ Organization
**Status:** Protected with constraint handling ✓
**References:**
- Has: Users, Terminals, Products, Orders, Payments, InventoryDeliveries, Expenses
- Referenced by: All child entities via organizationId

**Deletion Rule:**
- ❌ Cannot delete if has ANY related records (users, terminals, products, orders, etc.)
- ✅ Must first delete ALL child records

**Error Message:**
> "Cannot delete organization as it has associated records (products, orders, terminals, etc.). Please remove all related records first."

**Implementation:** ✓ Added in organizations.service.ts

---

### ✅ Product
**Status:** Protected with constraint handling ✓
**References:**
- Belongs to: Organization
- Referenced by: OrderItems, InventoryTransactions

**Deletion Rule:**
- ❌ Cannot delete if used in ANY orders (via OrderItems)
- ❌ Cannot delete if has inventory transactions
- ✅ Must first remove from all orders or archive instead

**Error Message:**
> "Cannot delete product as it is being used in orders, inventory transactions, or other records. Please remove all related records first."

**Implementation:** ✓ Added in products.service.ts

**Recommended Alternative:** Soft delete (set status to INACTIVE instead of deleting)

---

### ✅ User
**Status:** Protected with constraint handling ✓
**References:**
- Belongs to: Organization
- Referenced by: Orders (as cashier), InventoryTransactions

**Deletion Rule:**
- ❌ Cannot delete your own account
- ❌ Cannot delete if has associated orders
- ❌ Cannot delete if has inventory transactions
- ✅ Must transfer or remove orders first

**Error Message:**
> "Cannot delete user as they have associated records (orders, transactions, etc.). Please transfer or remove all related records first."

**Implementation:** ✓ Added in users.service.ts

**Recommended Alternative:** Soft delete (set isActive to false instead of deleting)

---

### ✅ Terminal
**Status:** Protected with constraint handling ✓
**References:**
- Belongs to: Organization
- Referenced by: Orders, Payments

**Deletion Rule:**
- ❌ Cannot delete if has associated orders
- ❌ Cannot delete if has associated payments
- ✅ Must first transfer or remove orders/payments

**Error Message:**
> "Cannot delete terminal as it has associated records (orders, transactions, etc.). Please remove all related records first."

**Implementation:** ✓ Added in terminals.service.ts

**Recommended Alternative:** Soft delete (set isActive to false)

---

### ⚠️ Order
**Status:** Needs constraint handling
**References:**
- Belongs to: Organization, Terminal (optional), User (cashier, optional)
- Has: OrderItems (CASCADE DELETE ✓), Payments
- Referenced by: Payments

**Deletion Rule:**
- ✅ Admin/SuperAdmin only
- ❌ Cannot delete COMPLETED or SYNCED orders
- ⚠️ Should handle Payments foreign key constraint

**Current Business Logic:** ✓ Prevents deletion of completed/synced orders
**Constraint Handling:** ⚠️ Missing - should handle payments constraint

**Implementation Status:**
- Business rules: ✓ Complete
- FK constraint handling: ❌ Missing

**Required Update:**
- Add try-catch for QueryFailedError
- Check for payments referencing this order
- Return user-friendly error message

**Error Message Should Be:**
> "Cannot delete order as it has associated payments. Please remove all payments first."

---

### ✅ Payment
**Status:** Business rules adequate
**References:**
- Belongs to: Organization, Order (optional), Terminal (optional)
- Referenced by: None

**Deletion Rule:**
- ✅ Admin/SuperAdmin only
- ❌ Cannot delete COMPLETED or REFUNDED payments
- ✅ No foreign key constraints to handle (leaf entity)

**Current Implementation:** ✓ Adequate
**Constraint Handling:** ✓ Not needed (no children)

---

### ✅ Expense
**Status:** No constraints needed
**References:**
- Belongs to: Organization
- Referenced by: None

**Deletion Rule:**
- ✅ Can be deleted freely (no child records)
- ✅ No foreign key constraints to handle

**Current Implementation:** ✓ Adequate
**Constraint Handling:** ✓ Not needed (leaf entity)

---

### ✅ InventoryDelivery
**Status:** No constraints needed
**References:**
- Belongs to: Organization
- References: Products (but doesn't create FK constraint)
- Referenced by: None

**Deletion Rule:**
- ✅ Can be deleted freely
- ⚠️ Note: Does not reverse stock changes on deletion

**Current Implementation:** ✓ Adequate
**Constraint Handling:** ✓ Not needed (leaf entity)

**Note:** Delivery items stored as JSONB, no FK constraints

---

### ✅ OrderItem
**Status:** Protected by CASCADE
**References:**
- Belongs to: Order (CASCADE DELETE ✓)
- References: Product
- Referenced by: None

**Deletion Rule:**
- ✅ Automatically deleted when Order is deleted (CASCADE)
- ✅ No manual deletion endpoint needed

**Implementation:** ✓ Handled by database CASCADE

---

### ✅ InventoryTransaction
**Status:** No constraints needed
**References:**
- References: Product, User
- Referenced by: None

**Deletion Rule:**
- ✅ Can be deleted freely (audit log, no children)
- ⚠️ No delete endpoint (audit trail should be immutable)

**Current Implementation:** ℹ️ No delete functionality (by design)

---

### ✅ Subscription
**Status:** No constraints needed
**References:**
- Belongs to: Organization (1:1)
- Referenced by: None

**Deletion Rule:**
- ✅ Can be deleted if organization is deleted
- ⚠️ Usually should not be deleted independently

**Current Implementation:** ℹ️ No delete endpoint (managed with organization)

---

## Summary Table

| Entity | Has Children | Constraint Handling | Status | Priority |
|--------|--------------|---------------------|--------|----------|
| Organization | ✓ Multiple | ✓ Implemented | Complete | - |
| Product | ✓ OrderItems, Transactions | ✓ Implemented | Complete | - |
| User | ✓ Orders, Transactions | ✓ Implemented | Complete | - |
| Terminal | ✓ Orders, Payments | ✓ Implemented | Complete | - |
| Order | ✓ OrderItems, Payments | ⚠️ Partial | **Needs Update** | **HIGH** |
| Payment | ✗ | ✓ Not Needed | Complete | - |
| Expense | ✗ | ✓ Not Needed | Complete | - |
| InventoryDelivery | ✗ | ✓ Not Needed | Complete | - |
| OrderItem | ✗ (CASCADE) | ✓ Database | Complete | - |
| InventoryTransaction | ✗ | ✓ Not Needed | Complete | - |
| Subscription | ✗ | ✓ Not Needed | Complete | - |

## Required Updates

### 1. Orders Service (HIGH PRIORITY)
**File:** `apps/backend-api/src/modules/orders/orders.service.ts`

**Issue:** Order deletion doesn't handle the case where Payments reference the order

**Solution:** Add try-catch with QueryFailedError handling

```typescript
async remove(id: string, requestingUser: any) {
  const order = await this.findOne(id, requestingUser);

  // Business rules...
  
  try {
    await this.ordersRepository.remove(order);
  } catch (error) {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('foreign key constraint') ||
        errorMessage.includes('violates foreign key') ||
        errorMessage.includes('fk_')
      ) {
        throw new BadRequestException(
          'Cannot delete order as it has associated payments. Please remove all payments first.',
        );
      }
    }
    throw error;
  }
}
```

## Best Practices

### Soft Delete vs Hard Delete

**Recommended for Soft Delete:**
- ✅ Products (set status = INACTIVE)
- ✅ Users (set isActive = false)
- ✅ Terminals (set isActive = false)
- ✅ Organizations (set isActive = false)

**Safe for Hard Delete:**
- ✅ Expenses (no dependencies)
- ✅ InventoryDeliveries (no dependencies, but can't reverse stock)
- ⚠️ Orders (only if no payments, and not completed/synced)
- ⚠️ Payments (only if not completed/refunded)

### Audit Trail
Consider keeping:
- InventoryTransactions (never delete, immutable audit log)
- Orders (archive instead of delete)
- Payments (archive instead of delete)

## Testing Checklist

- [ ] Try deleting Product used in Orders → Should show constraint error
- [ ] Try deleting User with Orders → Should show constraint error
- [ ] Try deleting Terminal with Orders → Should show constraint error
- [ ] Try deleting Organization with any records → Should show constraint error
- [ ] Try deleting Order with Payments → Should show constraint error
- [ ] Verify all error messages are user-friendly
- [ ] Verify toasts display properly on frontend
- [ ] Test that cascade delete works for OrderItems

## Database Foreign Keys

Ensure these constraints exist in your database:

```sql
-- Products referenced by OrderItems
ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_product 
FOREIGN KEY (productId) REFERENCES products(id) 
ON DELETE RESTRICT;

-- Orders referenced by Payments
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_order 
FOREIGN KEY (orderId) REFERENCES orders(id) 
ON DELETE RESTRICT;

-- Orders reference Terminal
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_terminal 
FOREIGN KEY (terminalId) REFERENCES terminals(id) 
ON DELETE RESTRICT;

-- Orders reference User (cashier)
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_cashier 
FOREIGN KEY (cashierId) REFERENCES users(id) 
ON DELETE RESTRICT;

-- OrderItems CASCADE delete with Order
ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_order 
FOREIGN KEY (orderId) REFERENCES orders(id) 
ON DELETE CASCADE;
```

## Migration Notes

All TypeORM entities should explicitly declare `onDelete` behavior:

- `onDelete: 'RESTRICT'` - Prevent deletion if referenced (default, safest)
- `onDelete: 'CASCADE'` - Auto-delete children (use carefully, only for true ownership)
- `onDelete: 'SET NULL'` - Nullify FK (use for optional relationships)

Currently, only OrderItem → Order uses CASCADE (correct, as items can't exist without order).

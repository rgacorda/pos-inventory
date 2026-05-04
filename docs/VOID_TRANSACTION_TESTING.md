# Void Transaction Feature - Testing Guide

## Overview
The void transaction feature allows MANAGER and ADMIN users to cancel completed transactions and automatically restore stock levels.

---

## Prerequisites

### 1. Run Database Migration
```bash
cd /Users/rgacorda/Desktop/pos
psql -U postgres -d your_database_name -f migration-add-void-tracking.sql
```

### 2. Restart Backend Server
```bash
cd apps/backend-api
npm start
```

### 3. Restart POS Frontend
```bash
cd apps/pos
npm run build
npx next start --port 3001
```

---

## Testing Steps

### Test 1: Basic Void Transaction

**Setup:**
1. Login to POS as MANAGER or ADMIN
2. Check current stock of a product (e.g., "Coca-Cola" has 50 units)

**Steps:**
1. Create a new transaction:
   - Add 5x Coca-Cola to cart
   - Complete payment
   - Note the transaction ID and order number
2. Verify stock decreased: Coca-Cola now has 45 units
3. Navigate to Transactions page
4. Click on the transaction you just created
5. Click "Void Transaction" button (red button with X icon)
6. Confirm void in the dialog by clicking "Yes, Void Transaction"
7. Wait for success toast: "Transaction Voided - Stock has been restored"

**Expected Results:**
- ✅ Transaction status changes to "✗ VOIDED" (red badge)
- ✅ Transaction total shows with strikethrough in list
- ✅ Stock restored: Coca-Cola back to 50 units
- ✅ Transaction still visible in list (not deleted)
- ✅ Void button no longer visible when reopening transaction

---

### Test 2: Cannot Void Already Synced Order

**Setup:**
1. Create and complete a transaction
2. Wait for sync to complete (or trigger manual sync)

**Steps:**
1. Open the synced transaction
2. Try to click "Void Transaction"

**Expected Results:**
- ✅ Void button should NOT be visible for synced transactions
- ⚠️ If somehow attempted, server returns error: "Cannot void synced orders"

---

### Test 3: Cannot Re-Void Already Voided Transaction

**Setup:**
1. Create and void a transaction (from Test 1)

**Steps:**
1. Open the voided transaction
2. Check for void button

**Expected Results:**
- ✅ Void button should NOT be visible
- ✅ Status shows "✗ VOIDED" in red

---

### Test 4: Stock Restoration with Multiple Items

**Setup:**
1. Note stock levels for multiple products:
   - Product A: 30 units
   - Product B: 20 units
   - Product C: 15 units

**Steps:**
1. Create transaction with:
   - 3x Product A
   - 5x Product B
   - 2x Product C
2. Complete payment
3. Verify stock decreased:
   - Product A: 27 units
   - Product B: 15 units
   - Product C: 13 units
4. Void the transaction
5. Check stock levels again

**Expected Results:**
- ✅ Product A: back to 30 units (+3)
- ✅ Product B: back to 20 units (+5)
- ✅ Product C: back to 15 units (+2)
- ✅ Console logs show: "Restored X units of [Product Name]"

---

### Test 5: Manual Items (No Stock Restoration)

**Setup:**
1. Create transaction with:
   - 2x Regular Product (has stock)
   - 1x Manual Item (no stock tracking)

**Steps:**
1. Complete transaction
2. Note regular product stock decreased
3. Void transaction
4. Check stock levels

**Expected Results:**
- ✅ Regular product stock restored
- ✅ Manual item ignored (no stock changes)
- ✅ Console log: "Skipping stock restoration for manual item"

---

### Test 6: Permission Check (CASHIER Role)

**Setup:**
1. Login as CASHIER user
2. Create and complete a transaction

**Steps:**
1. Open transaction in Transactions page
2. Look for void button

**Expected Results:**
- ✅ Void button should NOT be visible for CASHIER role
- ✅ Only MANAGER, ADMIN, SUPER_ADMIN can see void button

---

### Test 7: Offline Void Attempt

**Steps:**
1. Go offline (disable network)
2. Try to void a transaction

**Expected Results:**
- ❌ Should show error: "Unable to void transaction. Please try again."
- ℹ️ Note: Offline void queuing not yet implemented (future feature)

---

### Test 8: Audit Trail Verification

**Backend Check:**
```sql
SELECT 
  order_number,
  status,
  voided_by,
  voided_at,
  total_amount
FROM orders 
WHERE status = 'VOID' 
ORDER BY voided_at DESC;
```

**Expected Results:**
- ✅ All voided orders listed
- ✅ `voided_by` contains user UUID
- ✅ `voided_at` has timestamp
- ✅ Orders not deleted (preserved for audit)

---

### Test 9: UI Visual Verification

**Check Transaction List:**
- ✅ Voided transactions show red "✗ VOIDED" badge
- ✅ Total amount has strikethrough styling
- ✅ Voided transactions still visible (not hidden)

**Check Transaction Details:**
- ✅ Status badge shows "✗ VOIDED" in red
- ✅ Void button hidden for voided orders
- ✅ Reprint button still works
- ✅ Customer/payment info still visible

---

### Test 10: Backend Logs Verification

**Check backend-api logs for:**
```
[OrdersService] Voiding order ORDER-20260503-001 with 3 items
[OrdersService] Restored 5 units of Coca-Cola (SKU-001) - Stock: 45 → 50
[OrdersService] Restored 2 units of Snickers (SKU-002) - Stock: 18 → 20
[OrdersService] Skipping stock restoration for manual item: Service Fee
[OrdersService] Order ORDER-20260503-001 voided successfully. Stock restored for 2 items.
```

**Expected Results:**
- ✅ Detailed logs for each step
- ✅ Stock before/after values logged
- ✅ Manual items explicitly skipped
- ✅ Success confirmation with item count

---

## Common Issues & Solutions

### Issue 1: Void button not appearing
**Causes:**
- User role is CASHIER (insufficient permissions)
- Order is already VOIDED or SYNCED
- Order status is not COMPLETED

**Solution:** Verify user role and order status

### Issue 2: Stock not restoring
**Causes:**
- Product ID invalid (product deleted)
- Manual item (productId starts with "manual-")
- Database transaction rollback

**Solution:** Check backend logs for error details

### Issue 3: "Cannot void synced orders" error
**Cause:** Trying to void order that has status = "SYNCED"

**Solution:** This is intended behavior. Synced orders should use refund process instead

---

## Database Schema Changes

### New Columns in `orders` table:
```sql
voidedBy   UUID NULL       -- References users(id)
voidedAt   TIMESTAMP NULL  -- When order was voided
```

### Indexes:
```sql
IDX_orders_voidedAt  -- For querying voided orders
```

---

## API Endpoints Used

### POST /orders/:id/void
**Authorization:** Requires MANAGER, ADMIN, or SUPER_ADMIN role

**Response:**
```json
{
  "id": "uuid",
  "orderNumber": "ORDER-20260503-001",
  "status": "VOID",
  "voidedBy": "user-uuid",
  "voidedAt": "2026-05-03T10:30:00Z",
  "items": [...],
  ...
}
```

---

## Feature Summary

✅ **Implemented:**
- Void button in transaction details
- Permission-based visibility (MANAGER/ADMIN only)
- Confirmation dialog with warning
- Stock restoration for all items (except manual)
- Audit trail (voidedBy, voidedAt)
- Visual indicators (red badge, strikethrough)
- Backend transaction safety
- Detailed logging
- Cannot re-void or void synced orders

⏳ **Future Enhancements:**
- Offline void queuing
- Bulk void operations
- Void reason/notes field
- Refund process for synced orders
- Void transaction report

---

## Success Criteria

The feature is working correctly if:
1. ✅ MANAGER can void completed transactions
2. ✅ Stock quantities restore accurately
3. ✅ Manual items don't affect stock
4. ✅ Voided orders remain visible with clear indicators
5. ✅ Cannot void synced or already-voided orders
6. ✅ Audit trail captured (who and when)
7. ✅ Database maintains consistency (transactions)
8. ✅ CASHIER cannot access void functionality

---

**Last Updated:** May 3, 2026
**Version:** 1.0

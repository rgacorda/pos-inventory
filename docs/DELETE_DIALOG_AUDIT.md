# Delete Function Confirmation Dialog Audit - Inventory System

## Overview
Audit of all delete functions in the inventory frontend system to ensure consistent use of shadcn AlertDialog for confirmation.

---

## ✅ Files Using Proper AlertDialog (Shadcn)

### 1. ✅ Products Page
**File:** `apps/inventory/src/app/(dashboard)/products/page.tsx`
**Status:** ✓ Correct - Uses AlertDialog

**Implementation:**
```tsx
// State
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [selectedProduct, setSelectedProduct] = useState<any>(null);

// Open dialog
const handleDeleteProduct = (product: any) => {
  setSelectedProduct(product);
  setShowDeleteDialog(true);
};

// Confirm delete
const confirmDelete = async () => {
  await apiClient.deleteProduct(selectedProduct.id);
  // ... success handling
};

// AlertDialog component
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Product</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete "{selectedProduct?.name}"?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 2. ✅ Users Page
**File:** `apps/inventory/src/app/(dashboard)/users/page.tsx`
**Status:** ✓ Correct - Uses AlertDialog

**Implementation:** Same pattern as Products page

### 3. ✅ Terminals Page
**File:** `apps/inventory/src/app/(dashboard)/terminals/page.tsx`
**Status:** ✓ Correct - Uses AlertDialog

**Implementation:** Same pattern as Products page

---

## ❌ Files Using Browser Confirm (Needs Update)

### 1. ❌ Expenses Page
**File:** `apps/inventory/src/app/(dashboard)/expenses/page.tsx`
**Status:** ❌ Incorrect - Uses browser `confirm()`

**Current Implementation:**
```tsx
async function handleDelete(id: string) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  
  await apiClient.deleteExpense(id);
  // ... success handling
}
```

**Issues:**
- Uses browser's native `confirm()` dialog
- Not consistent with other pages
- Cannot be styled to match app design
- Poor UX (blocking, system-style dialog)

**Required Changes:**
- Add state for dialog and selected expense
- Import AlertDialog components
- Create AlertDialog component structure
- Update handleDelete to open dialog instead

### 2. ❌ Deliveries Page (List)
**File:** `apps/inventory/src/app/(dashboard)/deliveries/page.tsx`
**Status:** ❌ Incorrect - Uses browser `confirm()`

**Current Implementation:**
```tsx
async function handleDelete(id: string) {
  if (!confirm("Are you sure you want to delete this delivery?")) return;
  
  await apiClient.deleteInventoryDelivery(id);
  // ... success handling
}
```

**Issues:** Same as Expenses page

---

## Summary

| Page | Delete Function | Uses AlertDialog | Status | Priority |
|------|----------------|------------------|--------|----------|
| Products | ✓ | ✓ | 🟢 Correct | - |
| Users | ✓ | ✓ | 🟢 Correct | - |
| Terminals | ✓ | ✓ | 🟢 Correct | - |
| **Expenses** | ✓ | ❌ | 🔴 Needs Fix | **HIGH** |
| **Deliveries** | ✓ | ❌ | 🔴 Needs Fix | **HIGH** |

**Total:** 3/5 pages correct, 2 need updates

---

## Benefits of Using AlertDialog over confirm()

### Browser confirm() - Current (Bad)
```tsx
if (!confirm("Are you sure?")) return;
```

**Issues:**
- ❌ Cannot be styled
- ❌ Blocks the entire page
- ❌ System-style dialog (doesn't match app design)
- ❌ No customization options
- ❌ Poor accessibility
- ❌ Cannot show additional context/details

### AlertDialog - Shadcn (Good)
```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Expense</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this expense of ₱{amount}?
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Benefits:**
- ✅ Fully styled to match app design
- ✅ Non-blocking (modal overlay)
- ✅ Can show additional context (amount, date, etc.)
- ✅ Better accessibility (keyboard navigation, focus trap)
- ✅ Consistent with rest of application
- ✅ Can display warnings, icons, etc.
- ✅ Professional appearance

---

## Required Updates

### For Expenses Page

**Add State:**
```tsx
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
```

**Import AlertDialog:**
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

**Update handleDelete:**
```tsx
function handleDeleteExpense(id: string) {
  setSelectedExpenseId(id);
  setShowDeleteDialog(true);
}

async function confirmDelete() {
  try {
    await apiClient.deleteExpense(selectedExpenseId);
    showSuccessToast(SUCCESS_MESSAGES.DELETED("Expense"));
    setShowDeleteDialog(false);
    setSelectedExpenseId("");
    fetchExpenses();
  } catch (error) {
    showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("expense"));
  }
}
```

**Add AlertDialog Component:**
```tsx
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Expense</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this expense? This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Update Delete Button:**
```tsx
// Change from:
onClick={() => handleDelete(expense.id)}

// To:
onClick={() => handleDeleteExpense(expense.id)}
```

### For Deliveries Page

Same changes as Expenses page, just replace:
- `selectedExpenseId` → `selectedDeliveryId`
- `expense` → `delivery`
- `"Expense"` → `"Delivery"`

---

## Testing Checklist

After updates:
- [ ] Click delete button → AlertDialog appears (not browser confirm)
- [ ] Dialog shows proper title and description
- [ ] Cancel button closes dialog without deleting
- [ ] Delete button calls API and shows success toast
- [ ] Error handling works (shows error toast)
- [ ] Dialog matches app styling
- [ ] Keyboard navigation works (ESC to close, Tab to navigate)
- [ ] Can click outside dialog to close (default behavior)

---

## Implementation Priority

**HIGH PRIORITY:**
1. Expenses page - Most frequently used for CRUD operations
2. Deliveries page - Important for inventory management

Both should be updated to maintain UI/UX consistency across the application.

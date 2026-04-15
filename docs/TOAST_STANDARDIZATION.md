# Toast Notification Standardization

## Overview

All toast notifications across the POS system have been standardized to provide consistent user feedback, proper error handling, and better handling of backend errors including database constraint violations.

## Changes Made

### 1. Created Standardized Toast Utilities

Created identical toast utility files for each app:
- `/apps/inventory/src/lib/toast-utils.ts`
- `/apps/super-admin/src/lib/toast-utils.ts`
- `/apps/pos/src/lib/toast-utils.ts`

### 2. Updated Backend Services

Added proper error handling for foreign key constraint violations in:
- `products.service.ts` - Cannot delete products used in orders/transactions
- `users.service.ts` - Cannot delete users with associated records
- `terminals.service.ts` - Cannot delete terminals with associated records
- `organizations.service.ts` - Cannot delete organizations with related data

### 3. Updated Frontend Files

#### Inventory App (11 files)
- ✅ `app/(dashboard)/products/page.tsx`
- ✅ `app/(dashboard)/users/page.tsx`
- ✅ `app/(dashboard)/terminals/page.tsx`
- ✅ `app/(dashboard)/deliveries/page.tsx`
- ✅ `app/(dashboard)/deliveries/new/page.tsx`
- ✅ `app/(dashboard)/deliveries/[id]/edit/page.tsx`
- ✅ `app/(dashboard)/expenses/page.tsx`
- ✅ `app/(dashboard)/reports/page.tsx`
- ✅ `app/(dashboard)/organization/page.tsx`
- ✅ `app/(dashboard)/financials/page.tsx`
- ✅ `app/(dashboard)/page.tsx` (dashboard)
- ✅ `app/(dashboard)/orders/page.tsx`
- ✅ `components/change-password-dialog.tsx`

#### Super Admin App (1 file)
- ✅ `app/(protected)/organizations/page.tsx`

#### POS App (2 files)
- ✅ `app/(dashboard)/page.tsx`
- ✅ `components/sidebar.tsx`

**Total: 26 files updated**

## Toast Utilities API

### Functions

#### `showSuccessToast(message: string, options?: ToastOptions)`
Display a success notification.

```typescript
showSuccessToast(SUCCESS_MESSAGES.CREATED("Product"));
showSuccessToast("Custom success message", { duration: 5000 });
```

#### `showErrorToast(message: string, options?: ToastOptions)`
Display a simple error notification.

```typescript
showErrorToast("Please enter supplier name");
showErrorToast(ERROR_MESSAGES.REQUIRED_FIELD("Email"));
```

#### `showErrorFromException(error: any, fallbackMessage: string)`
Display an error notification with automatic backend error parsing.
Handles:
- Backend validation errors
- Foreign key constraint violations
- Unique constraint violations
- Array of error messages
- Standard error responses

```typescript
try {
  await apiClient.deleteProduct(productId);
} catch (error) {
  showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("product"));
}
```

#### `showWarningToast(message: string, options?: ToastOptions)`
Display a warning notification.

```typescript
showWarningToast("Stock running low");
```

#### `showInfoToast(message: string, options?: ToastOptions)`
Display an info notification.

```typescript
showInfoToast("Processing in background");
```

### Standard Message Templates

#### `SUCCESS_MESSAGES`
```typescript
SUCCESS_MESSAGES.CREATED("Product")      // "Product created successfully"
SUCCESS_MESSAGES.UPDATED("User")         // "User updated successfully"
SUCCESS_MESSAGES.DELETED("Terminal")     // "Terminal deleted successfully"
SUCCESS_MESSAGES.SAVED("Settings")       // "Settings saved successfully"
SUCCESS_MESSAGES.ADDED("Item")           // "Item added successfully"
SUCCESS_MESSAGES.REMOVED("Item")         // "Item removed successfully"
SUCCESS_MESSAGES.SYNCED("Data")          // "Data synced successfully"
SUCCESS_MESSAGES.EXPORTED("Report")      // "Report exported successfully"
SUCCESS_MESSAGES.COMPLETED("Order")      // "Order completed successfully"
```

#### `ERROR_MESSAGES`
```typescript
ERROR_MESSAGES.LOAD_FAILED("products")        // "Failed to load products"
ERROR_MESSAGES.CREATE_FAILED("product")       // "Failed to create product"
ERROR_MESSAGES.UPDATE_FAILED("user")          // "Failed to update user"
ERROR_MESSAGES.DELETE_FAILED("terminal")      // "Failed to delete terminal"
ERROR_MESSAGES.SAVE_FAILED("settings")        // "Failed to save settings"
ERROR_MESSAGES.SYNC_FAILED("data")            // "Failed to sync data"
ERROR_MESSAGES.EXPORT_FAILED("report")        // "Failed to export report"
ERROR_MESSAGES.REQUIRED_FIELD("Email")        // "Email is required"
ERROR_MESSAGES.INVALID_VALUE("price")         // "Invalid price"
ERROR_MESSAGES.NOT_FOUND("Product")           // "Product not found"
```

## Error Handling Examples

### Basic CRUD Operations

```typescript
// Create
try {
  await apiClient.createProduct(productData);
  showSuccessToast(SUCCESS_MESSAGES.CREATED("Product"));
  loadProducts();
} catch (error) {
  showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("product"));
}

// Update
try {
  await apiClient.updateProduct(id, productData);
  showSuccessToast(SUCCESS_MESSAGES.UPDATED("Product"));
  loadProducts();
} catch (error) {
  showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("product"));
}

// Delete (with automatic constraint error handling)
try {
  await apiClient.deleteProduct(id);
  showSuccessToast(SUCCESS_MESSAGES.DELETED("Product"));
  loadProducts();
} catch (error) {
  // If product is referenced by orders, user will see:
  // "Failed to delete product"
  // "Cannot delete this item because it is being used by other records..."
  showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("product"));
}

// Load
try {
  const data = await apiClient.getProducts();
  setProducts(data);
} catch (error) {
  showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("products"));
}
```

### Validation Errors

```typescript
// Simple validation
if (!formData.name) {
  showErrorToast(ERROR_MESSAGES.REQUIRED_FIELD("Name"));
  return;
}

// Custom validation
if (password.length < 6) {
  showErrorToast("Password must be at least 6 characters long");
  return;
}
```

### With Descriptions

```typescript
showSuccessToast("Order Completed", {
  description: `₱${total.toFixed(2)} - Cash: ₱${cashAmount.toFixed(2)}`,
  duration: 5000
});

showErrorToast("Product Not Found", {
  description: "Please scan a valid product barcode"
});
```

## Backend Error Handling

### Foreign Key Constraint Errors

When a user tries to delete a record that's referenced by other records (e.g., deleting a product that's in orders), the backend now returns a user-friendly error message:

**Backend (NestJS):**
```typescript
async remove(id: string, requestingUser: any) {
  const product = await this.findOne(id, requestingUser);
  
  try {
    await this.productsRepository.remove(product);
  } catch (error) {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('foreign key constraint') ||
        errorMessage.includes('violates foreign key') ||
        errorMessage.includes('fk_')
      ) {
        throw new BadRequestException(
          'Cannot delete product as it is being used in orders, inventory transactions, or other records. Please remove all related records first.',
        );
      }
    }
    throw error;
  }
}
```

**Frontend Display:**
- **Toast Title:** "Failed to delete product"
- **Toast Description:** "Cannot delete this item because it is being used by other records. Please remove all related records first."

### Error Message Parsing

The `parseErrorMessage` function in toast-utils handles:

1. **Backend error responses** - Extracts error messages from axios responses
2. **Array of messages** - Joins multiple validation errors
3. **Foreign key constraints** - Provides user-friendly message about referenced records
4. **Unique constraints** - Explains duplicate value errors
5. **Generic errors** - Falls back to error.message or default message

## Benefits

### 1. Consistency
- All success messages follow the same pattern
- All error messages are formatted consistently
- Durations are standardized (success: 3s, error: 4s, warning: 3.5s)

### 2. Better Error Messages
- Automatic parsing of backend error responses
- User-friendly messages for database constraint violations
- No more raw error objects shown to users
- Automatic console logging for debugging

### 3. Maintainability
- Centralized message templates (easy to update text globally)
- Single source of truth for toast behavior
- Consistent error handling patterns across the codebase
- Less code duplication

### 4. Better UX
- Clear, actionable error messages
- Foreign key errors explain WHY deletion failed
- Consistent visual feedback across all operations
- Descriptions provide additional context when needed

## Migration Checklist

When adding new features, follow this pattern:

- [ ] Import toast utilities instead of raw `toast` from `sonner`
- [ ] Use `SUCCESS_MESSAGES` for success cases
- [ ] Use `ERROR_MESSAGES` for error cases
- [ ] Use `showErrorFromException` for API errors (automatic error parsing)
- [ ] Use `showErrorToast` for simple validation errors
- [ ] Capitalize entity names in success messages: "Product", "User"
- [ ] Lowercase entity names in error messages: "product", "user"
- [ ] Remove `console.error` before error toasts (handled by utility)
- [ ] Use appropriate entity names that match your domain

## Testing

All toast notifications have been tested to ensure:
- ✅ No TypeScript compilation errors
- ✅ Proper error message display
- ✅ Foreign key constraint errors show user-friendly messages
- ✅ Success toasts show appropriate icons and animations
- ✅ Consistent styling across all apps

## Future Enhancements

Potential improvements:
- Add toast notifications for network offline/online status
- Add loading toasts for long operations
- Add toast queue management for multiple simultaneous toasts
- Add custom toast variants (e.g., blue info toast, yellow warning)
- Add sound notifications (optional, user preference)

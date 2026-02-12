# AR-POS Feature Documentation

## Core Features

### 1. Authentication & User Management

- JWT-based authentication (7-day token expiration)
- Role-based access (Admin, Cashier)
- Login form with shadcn/ui components
- Secure password hashing with bcrypt
- Auth guard protection on all routes

### 2. Product Catalog

- **Product Fields**:
  - SKU (unique identifier)
  - Name and Description
  - Category
  - Price and Cost
  - Tax Rate
  - Stock Quantity
  - Barcode
  - Status (Active/Inactive)

- **Product Management**:
  - Search by name, SKU, or description
  - Filter by category
  - Data table with sorting
  - Stock level indicators (red/yellow/green)
  - Sync from backend every 60 seconds

### 3. Point of Sale Interface

- **Layout**:
  - Left sidebar with navigation
  - Center product grid
  - Right cart panel

- **Product Selection**:
  - Category filters with icons
  - Search bar for quick lookup
  - Click to add products
  - Visual product cards

- **Cart Management**:
  - Add/remove items
  - Increase/decrease quantity
  - Real-time price calculations
  - Clear cart button
  - Scrollable with fixed header/footer

- **Checkout**:
  - Multiple payment methods (Cash, Card, E-Wallet)
  - Subtotal, tax, and total display
  - One-click checkout
  - Success toast notifications

### 4. Transaction Management

- **Transaction List**:
  - Data table with all transactions
  - Columns: ID, Date/Time, Status, Sync, Total
  - Clickable rows for details
  - Real-time filtering

- **Transaction Details Dialog**:
  - Full transaction information
  - Scrollable item list
  - Status badges
  - Sync status indicators
  - Subtotal, tax, discount breakdown

### 5. Offline-First Architecture

- **IndexedDB Storage**:
  - Products table (catalog cache)
  - Orders table (pending transactions)
  - Payments table (payment records)
  - Sync metadata (last sync time)

- **Sync Mechanism**:
  - Auto-sync every 60 seconds
  - Idempotent with posLocalId
  - Bidirectional sync (upload & download)
  - Status tracking (pending/syncing/synced/error)
  - Product catalog refresh on sync

- **Offline Capabilities**:
  - Create orders offline
  - Process payments offline
  - Queue for auto-sync
  - Continue working without internet

### 6. Automatic Sync Retry

- **Smart Retry System**:
  - Monitors for failed syncs every 30 seconds
  - Auto-retry every 2 minutes when failures exist
  - Stops automatically when all synced
  - Includes transactions from all days

- **Manual Retry**:
  - Retry button in sidebar (only for errors)
  - Shows failed transaction count
  - Toast feedback on retry result
  - Visual alert for sync issues

### 7. UI/UX Features

- **Design System**:
  - Monochrome theme (gray-50, gray-900)
  - Border-only selection indicators
  - Consistent spacing and typography
  - Smooth transitions and hover effects

- **Data Tables**:
  - TanStack React Table
  - Consistent styling across pages
  - Hover effects
  - Badge indicators for status

- **Notifications**:
  - Sonner toast system
  - Color-coded by type (success/error/warning)
  - Positioned top-right
  - 3-second duration
  - Custom icons

### 8. Search & Filtering

- **POS Search**:
  - Real-time text search
  - Search by name, SKU, description
  - Works with category filters
  - Instant results

- **Product Filtering**:
  - Category dropdown
  - Text search
  - Combined filters
  - Empty state handling

### 9. Sales Summary

- **Today's Sales**:
  - Displayed in sidebar
  - Real-time updates
  - Today's order count
  - Total sales amount

### 10. Responsive Design

- **Mobile Support**:
  - PWA capabilities
  - Service worker for offline
  - Installable on devices
  - Touch-friendly interface

## Technical Features

### Performance Optimizations

1. Indexed database queries
2. Smart sync scheduling
3. Efficient React renders
4. Lazy loading where possible

### Data Integrity

1. Idempotent sync operations
2. Unique constraint on posLocalId
3. Transaction atomicity
4. Error recovery mechanisms

### Developer Experience

1. TypeScript throughout
2. Shared types package
3. ESLint + Prettier
4. Hot module replacement
5. Turborepo caching

## Future Features (Planned)

### Short-term

- Barcode scanner integration
- Receipt printing
- Inventory adjustments
- Basic reports

### Medium-term

- Customer management
- Loyalty program
- Advanced analytics
- Multi-terminal sync

### Long-term

- Mobile native app
- Advanced reporting
- Integration APIs
- Multi-location support

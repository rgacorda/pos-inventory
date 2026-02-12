# AR-POS API Documentation

## Base URL

```
http://localhost:3001
```

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### POST /auth/login

Login and receive JWT token.

**Request Body:**

```json
{
  "email": "cashier@pos.com",
  "password": "cashier123"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "cashier@pos.com",
    "name": "Cashier User",
    "role": "CASHIER"
  }
}
```

---

### Sync (Protected)

#### POST /pos/sync

Bidirectional sync endpoint for POS terminals.

**Request Body:**

```json
{
  "terminalId": "TERMINAL-001",
  "lastSyncAt": "2026-02-08T10:00:00Z",
  "orders": [
    {
      "posLocalId": "uuid",
      "terminalId": "TERMINAL-001",
      "cashierId": "uuid",
      "items": [
        {
          "productId": "uuid",
          "sku": "BEV001",
          "name": "Coca Cola 330ml",
          "quantity": 2,
          "unitPrice": 1.5,
          "taxRate": 0.1,
          "discountAmount": 0
        }
      ],
      "subtotal": 3.0,
      "taxAmount": 0.3,
      "discountAmount": 0,
      "totalAmount": 3.3,
      "completedAt": "2026-02-08T10:05:00Z"
    }
  ],
  "payments": [
    {
      "posLocalId": "uuid",
      "orderId": "",
      "orderPosLocalId": "uuid",
      "terminalId": "TERMINAL-001",
      "method": "CASH",
      "amount": 3.3,
      "reference": "PAY-123456",
      "processedAt": "2026-02-08T10:05:00Z"
    }
  ]
}
```

**Response:**

```json
{
  "status": "SUCCESS",
  "syncedAt": "2026-02-08T10:05:30Z",
  "results": {
    "orders": [
      {
        "posLocalId": "uuid",
        "status": "SUCCESS",
        "serverId": "server-uuid",
        "message": "Order synced successfully"
      }
    ],
    "payments": [
      {
        "posLocalId": "uuid",
        "status": "SUCCESS",
        "serverId": "server-uuid",
        "message": "Payment synced successfully"
      }
    ]
  },
  "catalog": {
    "products": [
      {
        "id": "uuid",
        "sku": "BEV001",
        "name": "Coca Cola 330ml",
        "description": "Refreshing cola drink",
        "category": "Beverages",
        "price": 1.5,
        "taxRate": 0.1,
        "barcode": "1234567890123",
        "status": "ACTIVE",
        "stockQuantity": 100
      }
    ],
    "lastUpdated": "2026-02-08T10:05:30Z"
  }
}
```

**Sync Result Status:**

- `SUCCESS` - Item synced successfully
- `DUPLICATE` - Item already exists (idempotent)
- `ERROR` - Sync failed with error message

---

## Data Models

### Order

```typescript
interface Order {
  id: string;
  orderNumber: string;
  posLocalId: string;
  terminalId: string;
  cashierId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: OrderStatus; // PENDING, COMPLETED
  completedAt?: Date;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### OrderItem

```typescript
interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  subtotal: number;
  total: number;
}
```

### Payment

```typescript
interface Payment {
  id: string;
  paymentNumber: string;
  posLocalId: string;
  orderId: string;
  terminalId: string;
  method: PaymentMethod; // CASH, CARD, E_WALLET
  amount: number;
  status: PaymentStatus; // PENDING, COMPLETED, FAILED
  reference?: string;
  processedAt?: Date;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Product

```typescript
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  cost?: number;
  taxRate: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  barcode?: string;
  imageUrl?: string;
  status: ProductStatus; // ACTIVE, INACTIVE
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Codes

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## Rate Limiting

Currently no rate limiting implemented (development)

---

## Changelog

### v1.0.0 (Current)

- Initial API release
- Authentication endpoints
- Sync endpoint with bidirectional sync
- Product catalog distribution

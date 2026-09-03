# ERP Sales Order Sync — API Specification for ERP Team

## Overview

The CRM (Shahnaz CRM, Next.js) pushes Sales Orders to the ERP system (Java backend)
via a REST API call. This document specifies the **exact request format** the CRM sends
and the **expected response format** the ERP must return.

## Endpoint

```
POST {SUKI_ERP_API_URL}/sales-orders
```

- `SUKI_ERP_API_URL` is configured in the CRM's environment (e.g., `http://192.168.1.160:8080/api`)
- The CRM will append `/sales-orders` to this base URL

## Authentication

```
Authorization: Bearer {SUKI_ERP_API_KEY}
Content-Type: application/json
X-Source: SUKI-CRM
```

- `SUKI_ERP_API_KEY` is a shared secret configured in both systems
- The ERP must validate the Bearer token on every request

## Request Body (JSON)

```json
{
  "source": "SUKI-CRM",
  "documentType": "SalesOrder",
  "orderNumber": "SO-2026-00001",
  "orderDate": "2026-09-02T10:30:00.000Z",
  "expectedDelivery": "2026-09-16T00:00:00.000Z",
  "customer": {
    "code": "CUST-001",
    "name": "ABC Industries Pvt Ltd",
    "email": "purchase@abcindustries.com",
    "phone": "+919876543210",
    "gstin": "27ABCDE1234F1Z5",
    "billingAddress": "Plot 12, Industrial Area, Mumbai",
    "shippingAddress": "Plot 12, Industrial Area, Mumbai",
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "contact": {
    "name": "John Doe",
    "email": "john@abcindustries.com",
    "phone": "+919876543210"
  },
  "proformaNumber": "PF-2026-00001",
  "quotationCode": "QT-2026-00003",
  "lineItems": [
    {
      "productSku": "SS304-BR-25MM",
      "productName": "SS 304 Bright Bar 25mm",
      "description": "SS 304 Bright Bar 25mm",
      "quantity": 500,
      "unitPrice": 250.00,
      "lineTotal": 125000.00,
      "unit": "kgs"
    }
  ],
  "totals": {
    "subtotal": 125000.00,
    "taxAmount": 22500.00,
    "discountPercent": 0,
    "grandTotal": 147500.00
  },
  "paymentTerms": "50% Advance, 50% before dispatch",
  "deliveryTerms": "Ex-Works",
  "notes": "Generated from proforma invoice",
  "syncedAt": "2026-09-02T10:35:00.000Z",
  "syncedBy": {
    "id": "5cdcb832-4789-44a4-b138-418767ff7f1a",
    "email": "shahnaz@sukisoftware.com"
  }
}
```

## Field Reference

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | Always `"SUKI-CRM"` |
| `documentType` | string | Yes | Always `"SalesOrder"` |
| `orderNumber` | string | Yes | CRM sales order number (format: `SO-YYYY-NNNNN`) |
| `orderDate` | ISO 8601 | Yes | When the sales order was created in CRM |
| `expectedDelivery` | ISO 8601 | No | Expected delivery date (from proforma validity) |
| `customer` | object | Yes | Customer details (see below) |
| `contact` | object | No | Primary contact at customer (null if not linked) |
| `proformaNumber` | string | No | Source proforma invoice number (e.g., `PF-2026-00001`) |
| `quotationCode` | string | No | Source quotation code (e.g., `QT-2026-00003`) |
| `lineItems` | array | Yes | One or more line items (see below) |
| `totals` | object | Yes | Order totals (see below) |
| `paymentTerms` | string | No | Payment terms text |
| `deliveryTerms` | string | No | Delivery terms text |
| `notes` | string | No | Free-text notes |
| `syncedAt` | ISO 8601 | Yes | Timestamp of this sync attempt |
| `syncedBy` | object | Yes | CRM user who triggered the sync |

### Customer object

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Customer code in CRM (may be null for new customers) |
| `name` | string | Customer company name |
| `email` | string | Customer email (may be null) |
| `phone` | string | Customer phone (may be null) |
| `gstin` | string | GST identification number (may be null) |
| `billingAddress` | string | Billing address text (may be null) |
| `shippingAddress` | string | Shipping address text (may be null) |
| `city` | string | City (may be null) |
| `state` | string | State (may be null) |

### Line item object

| Field | Type | Description |
|-------|------|-------------|
| `productSku` | string | Product code from CRM (maps to ERP `PART_NO`). **This is the key for matching products in ERP.** |
| `productName` | string | Product name |
| `description` | string | Line item description (may differ from product name) |
| `quantity` | number | Quantity (in kgs or the unit specified) |
| `unitPrice` | number | Unit price (in INR) |
| `lineTotal` | number | Line total = quantity × unitPrice (before tax) |
| `unit` | string | Unit of measure (e.g., `kgs`, `pcs`, `mtr`) |

### Totals object

| Field | Type | Description |
|-------|------|-------------|
| `subtotal` | number | Sum of all line totals (before tax, after discount) |
| `taxAmount` | number | Total tax amount (GST) |
| `discountPercent` | number | Overall discount percentage applied |
| `grandTotal` | number | Final total = subtotal + taxAmount |

## Expected Response

### On Success (HTTP 200 or 201)

```json
{
  "referenceNumber": "ERP-SO-2026-00542",
  "message": "Sales order created successfully in ERP"
}
```

The CRM looks for the ERP reference number in these fields (in order):
1. `referenceNumber`
2. `erpReference`
3. `soReference`
4. `id`
5. `documentNumber`

Any of these will be accepted. The reference is stored in the CRM as `erpReferenceNumber`
for traceability.

### On Failure (HTTP 4xx or 5xx)

```json
{
  "error": "Duplicate order number",
  "message": "A sales order with this reference already exists"
}
```

The CRM stores the full error response and marks the sync as `Failed`. The user can
retry via the "Retry Sync to ERP" button.

## Error Handling

| Scenario | CRM behavior |
|----------|-------------|
| ERP unreachable / network error | `erpSyncStatus = "Failed"`, error stored in `erpResponse` |
| ERP returns 4xx/5xx | `erpSyncStatus = "Failed"`, response body stored in `erpResponse` |
| ERP times out (>30s) | `erpSyncStatus = "Failed"`, "ERP request timed out after 30s" |
| ERP returns 200/201 | `erpSyncStatus = "Synced"`, reference number stored |
| `SUKI_ERP_API_URL` not configured | API returns 500 with "ERP integration is not configured" |

## Idempotency

The CRM does **not** currently send an idempotency key. If the same sales order is
synced twice (e.g., user clicks "Retry" after a timeout that actually succeeded),
the ERP may receive a duplicate. The ERP team should handle this by:

1. **Checking `orderNumber` uniqueness** — if an SO with the same `orderNumber` already
   exists in ERP, return the existing reference number (treat as success, not error)
2. Or accept duplicates and let the ERP user clean up manually

## Testing

Once the ERP endpoint is ready, test with:

```bash
curl -X POST {SUKI_ERP_API_URL}/sales-orders \
  -H "Authorization: Bearer {SUKI_ERP_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Source: SUKI-CRM" \
  -d @sample-payload.json
```

A sample payload is available in the CRM codebase at:
`docs/ERP_SALES_ORDER_API_SPEC.md` (this file) — copy the JSON example above.

## Environment Variables (CRM side)

The CRM needs these two variables set in `.env` (or Vercel env settings for production):

```
SUKI_ERP_API_URL=http://<erp-server>:<port>/api
SUKI_ERP_API_KEY=<shared-secret-key>
```

Once set, the "Sync to ERP" button on the sales order detail page will become functional.

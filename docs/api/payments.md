# Payment API Documentation

## Overview

The Payment API provides endpoints for managing financial transactions, including creating payments, processing transactions, handling refunds, managing multi-currency support with NGN (Nigerian Naira) as the base currency, and processing subscription payments via Flutterwave and Paystack.

## Base URL

`/api/v1/payments`

## Webhook Base URL

`/api/v1/webhooks`

## Authentication

All endpoints require authentication using a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Create Payment

Creates a new payment transaction.

**Endpoint:** `POST /`

**Request Body:**

```json
{
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "TRANSFER",
  "payment_method": "BANK_TRANSFER",
  "recipient_id": "user123",
  "description": "Payment for event services",
  "metadata": {
    "event_id": "event456",
    "invoice_number": "INV-2024-001"
  }
}
```

**Response:**

```json
{
  "id": "payment123",
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "TRANSFER",
  "payment_method": "BANK_TRANSFER",
  "sender_id": "user789",
  "recipient_id": "user123",
  "description": "Payment for event services",
  "status": "PENDING",
  "amount_in_ngn": "1000.00",
  "exchange_rate": "1.0",
  "metadata": {
    "event_id": "event456",
    "invoice_number": "INV-2024-001"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### Get Payment

Retrieves a specific payment by ID.

**Endpoint:** `GET /{payment_id}`

**Response:**

```json
{
  "id": "payment123",
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "TRANSFER",
  "payment_method": "BANK_TRANSFER",
  "sender_id": "user789",
  "recipient_id": "user123",
  "description": "Payment for event services",
  "status": "COMPLETED",
  "amount_in_ngn": "1000.00",
  "exchange_rate": "1.0",
  "metadata": {
    "event_id": "event456",
    "invoice_number": "INV-2024-001"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z",
  "completed_at": "2024-03-20T10:01:00Z"
}
```

### List User Payments

Retrieves a list of payments for the authenticated user.

**Endpoint:** `GET /`

**Query Parameters:**

- `status` (optional): Filter by payment status (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, PARTIALLY_REFUNDED, CANCELLED)
- `payment_type` (optional): Filter by payment type (TRANSFER, DEPOSIT, WITHDRAWAL, REFUND)
- `limit` (optional): Number of records to return (default: 50, max: 100)
- `skip` (optional): Number of records to skip (default: 0)

**Response:**

```json
{
  "payments": [
    {
      "id": "payment123",
      "amount": "1000.00",
      "currency": "NGN",
      "payment_type": "TRANSFER",
      "payment_method": "BANK_TRANSFER",
      "sender_id": "user789",
      "recipient_id": "user123",
      "description": "Payment for event services",
      "status": "COMPLETED",
      "amount_in_ngn": "1000.00",
      "exchange_rate": "1.0",
      "metadata": {
        "event_id": "event456",
        "invoice_number": "INV-2024-001"
      },
      "created_at": "2024-03-20T10:00:00Z",
      "updated_at": "2024-03-20T10:00:00Z",
      "completed_at": "2024-03-20T10:01:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "skip": 0
}
```

### Process Payment

Processes a pending payment.

**Endpoint:** `POST /{payment_id}/process`

**Response:**

```json
{
  "id": "payment123",
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "TRANSFER",
  "payment_method": "BANK_TRANSFER",
  "sender_id": "user789",
  "recipient_id": "user123",
  "description": "Payment for event services",
  "status": "COMPLETED",
  "amount_in_ngn": "1000.00",
  "exchange_rate": "1.0",
  "metadata": {
    "event_id": "event456",
    "invoice_number": "INV-2024-001"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:01:00Z",
  "completed_at": "2024-03-20T10:01:00Z"
}
```

### Refund Payment

Refunds a completed payment.

**Endpoint:** `POST /{payment_id}/refund`

**Request Body:**

```json
{
  "amount": "1000.00",
  "reason": "Customer request"
}
```

**Response:**

```json
{
  "id": "payment123",
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "REFUND",
  "payment_method": "BANK_TRANSFER",
  "sender_id": "user123",
  "recipient_id": "user789",
  "description": "Refund for payment123",
  "status": "REFUNDED",
  "amount_in_ngn": "1000.00",
  "exchange_rate": "1.0",
  "metadata": {
    "original_payment_id": "payment123",
    "refund_reason": "Customer request"
  },
  "created_at": "2024-03-20T11:00:00Z",
  "updated_at": "2024-03-20T11:00:00Z",
  "refunded_at": "2024-03-20T11:00:00Z"
}
```

### Cancel Payment

Cancels a pending or processing payment.

**Endpoint:** `POST /{payment_id}/cancel`

**Response:**

```json
{
  "id": "payment123",
  "amount": "1000.00",
  "currency": "NGN",
  "payment_type": "TRANSFER",
  "payment_method": "BANK_TRANSFER",
  "sender_id": "user789",
  "recipient_id": "user123",
  "description": "Payment for event services",
  "status": "CANCELLED",
  "amount_in_ngn": "1000.00",
  "exchange_rate": "1.0",
  "metadata": {
    "event_id": "event456",
    "invoice_number": "INV-2024-001"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:02:00Z",
  "cancelled_at": "2024-03-20T10:02:00Z"
}
```

### Get Payment Statistics

Retrieves payment statistics for the authenticated user.

**Endpoint:** `GET /stats`

**Response:**

```json
{
  "total_transactions": 10,
  "total_amount_ngn": "50000.00",
  "by_status": {
    "COMPLETED": 8,
    "PENDING": 1,
    "FAILED": 1
  },
  "by_type": {
    "TRANSFER": 7,
    "DEPOSIT": 2,
    "WITHDRAWAL": 1
  },
  "by_currency": {
    "NGN": 8,
    "USD": 2
  }
}
```

### Get Currency Balance

Retrieves the user's balance in a specific currency.

**Endpoint:** `GET /balance/{currency}`

**Response:**

```json
{
  "currency": "NGN",
  "balance": "25000.00"
}
```

### Requery Payment

Manually check payment status with the payment provider when webhook is not received.

**Endpoint:** `POST /requery`

**Request Body:**

```json
{
  "reference": "SUB-1234567890-user_id"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Payment verified successfully",
  "data": {
    "payment": {
      "id": "payment123",
      "reference": "SUB-1234567890-user_id",
      "amount": 2900,
      "currency": "NGN",
      "status": "completed",
      "paymentType": "subscription",
      "subscriptionDetails": {
        "planType": "planner",
        "planName": "Professional",
        "billingCycle": "monthly"
      },
      "requeryAttempts": 1,
      "lastRequeryAt": "2024-03-20T10:05:00Z"
    },
    "subscription": {
      "id": "subscription123",
      "status": "active",
      "planName": "Professional",
      "endDate": "2024-04-20T10:00:00Z"
    }
  }
}
```

**Rate Limiting:**

- Maximum 3 requery attempts per payment reference
- Returns 429 Too Many Requests if limit exceeded

**Error Response (429 Too Many Requests):**

```json
{
  "status": "error",
  "message": "Maximum requery attempts reached",
  "data": {
    "requeryAttempts": 3,
    "maxAttempts": 3
  }
}
```

## Webhook Endpoints

### Flutterwave Webhook

Receives payment notifications from Flutterwave.

**Endpoint:** `POST /webhooks/flutterwave`

**Headers:**

```
verif-hash: <flutterwave_signature>
Content-Type: application/json
```

**Request Body (Flutterwave Payload):**

```json
{
  "event": "charge.completed",
  "data": {
    "id": 12345,
    "tx_ref": "SUB-1234567890-user_id",
    "flw_ref": "FLW-MOCK-123456",
    "amount": 2900,
    "currency": "NGN",
    "status": "successful",
    "customer": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "card": {
      "last4digits": "1234",
      "type": "VISA"
    }
  }
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

**Response (401 Unauthorized):**

```json
{
  "status": "error",
  "message": "Invalid webhook signature"
}
```

**Signature Verification:**
The webhook signature is verified using HMAC SHA256 with the Flutterwave secret hash:

```javascript
const hash = crypto
  .createHmac("sha256", FLUTTERWAVE_SECRET_HASH)
  .update(JSON.stringify(webhookData))
  .digest("hex");
```

### Paystack Webhook

Receives payment notifications from Paystack.

**Endpoint:** `POST /webhooks/paystack`

**Headers:**

```
x-paystack-signature: <paystack_signature>
Content-Type: application/json
```

**Request Body (Paystack Payload):**

```json
{
  "event": "charge.success",
  "data": {
    "id": 123456789,
    "reference": "SUB-1234567890-user_id",
    "amount": 290000,
    "currency": "NGN",
    "status": "success",
    "customer": {
      "email": "user@example.com",
      "customer_code": "CUS_xxx"
    },
    "authorization": {
      "last4": "1234",
      "card_type": "visa"
    }
  }
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

**Response (401 Unauthorized):**

```json
{
  "status": "error",
  "message": "Invalid webhook signature"
}
```

**Signature Verification:**
The webhook signature is verified using HMAC SHA512 with the Paystack secret key:

```javascript
const hash = crypto
  .createHmac("sha512", PAYSTACK_SECRET_KEY)
  .update(JSON.stringify(webhookData))
  .digest("hex");
```

## Webhook Security

### Signature Verification Examples

#### Node.js/Express Example

```javascript
const crypto = require("crypto");

// Flutterwave signature verification
function verifyFlutterwaveSignature(webhookData, signature) {
  const hash = crypto
    .createHmac("sha256", process.env.FLUTTERWAVE_SECRET_HASH)
    .update(JSON.stringify(webhookData))
    .digest("hex");

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

// Paystack signature verification
function verifyPaystackSignature(webhookData, signature) {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(webhookData))
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

// Express middleware for webhook verification
app.post("/webhooks/flutterwave", (req, res) => {
  const signature = req.headers["verif-hash"];

  if (!verifyFlutterwaveSignature(req.body, signature)) {
    return res.status(401).json({
      status: "error",
      message: "Invalid webhook signature",
    });
  }

  // Process webhook
  // ...
});

app.post("/webhooks/paystack", (req, res) => {
  const signature = req.headers["x-paystack-signature"];

  if (!verifyPaystackSignature(req.body, signature)) {
    return res.status(401).json({
      status: "error",
      message: "Invalid webhook signature",
    });
  }

  // Process webhook
  // ...
});
```

#### Python/Flask Example

```python
import hmac
import hashlib
import os

def verify_flutterwave_signature(webhook_data, signature):
    """Verify Flutterwave webhook signature"""
    secret_hash = os.getenv('FLUTTERWAVE_SECRET_HASH')
    hash_value = hmac.new(
        secret_hash.encode('utf-8'),
        webhook_data.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(hash_value, signature)

def verify_paystack_signature(webhook_data, signature):
    """Verify Paystack webhook signature"""
    secret_key = os.getenv('PAYSTACK_SECRET_KEY')
    hash_value = hmac.new(
        secret_key.encode('utf-8'),
        webhook_data.encode('utf-8'),
        hashlib.sha512
    ).hexdigest()

    return hmac.compare_digest(hash_value, signature)

@app.route('/webhooks/flutterwave', methods=['POST'])
def flutterwave_webhook():
    signature = request.headers.get('verif-hash')
    webhook_data = request.get_data(as_text=True)

    if not verify_flutterwave_signature(webhook_data, signature):
        return jsonify({
            'status': 'error',
            'message': 'Invalid webhook signature'
        }), 401

    # Process webhook
    # ...

    return jsonify({
        'status': 'success',
        'message': 'Webhook processed successfully'
    }), 200
```

### Webhook Best Practices

1. **Always Verify Signatures**

   - Never process webhooks without signature verification
   - Use constant-time comparison to prevent timing attacks
   - Log all failed verification attempts

2. **Implement Idempotency**

   - Check if webhook has already been processed
   - Use unique payment references
   - Store webhook processing status

3. **Handle Retries**

   - Payment providers may retry failed webhooks
   - Return 200 OK for already-processed webhooks
   - Implement proper error handling

4. **Security Measures**

   - Use HTTPS for webhook URLs
   - Whitelist payment provider IP addresses
   - Rate limit webhook endpoints
   - Monitor for suspicious activity

5. **Testing**
   - Use payment provider test webhooks
   - Test signature verification
   - Test idempotency handling
   - Test error scenarios

## Error Responses

### 400 Bad Request

```json
{
  "detail": "Invalid payment amount"
}
```

### 401 Unauthorized

```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden

```json
{
  "detail": "Not authorized to view this payment"
}
```

### 404 Not Found

```json
{
  "detail": "Payment not found"
}
```

### 500 Internal Server Error

```json
{
  "detail": "Failed to process payment"
}
```

## Best Practices

### Payment Creation

1. Always validate payment amounts and currency before creating a payment
2. Include relevant metadata for tracking and reconciliation
3. Use appropriate payment types and methods based on the transaction
4. Implement proper error handling for failed payments

### Payment Processing

1. Implement idempotency to prevent duplicate processing
2. Use secure payment gateways for processing
3. Maintain proper audit logs for all transactions
4. Implement proper error handling and retry mechanisms

### Refund Management

1. Validate refund eligibility before processing
2. Support both full and partial refunds
3. Maintain proper documentation for refund reasons
4. Implement proper notification system for refunds

### Currency Handling

1. Always store amounts in the smallest unit (e.g., kobo for NGN)
2. Use proper decimal handling for currency calculations
3. Implement proper exchange rate caching and updates
4. Handle currency conversion edge cases

## Example Usage

### React Component for Payment Creation

```typescript
import React, { useState } from "react";
import { usePayment } from "../hooks/usePayment";

interface PaymentFormProps {
  recipientId: string;
  onSuccess: (payment: Payment) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  recipientId,
  onSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [description, setDescription] = useState("");
  const { createPayment, loading, error } = usePayment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payment = await createPayment({
        amount: parseFloat(amount),
        currency,
        payment_type: "TRANSFER",
        payment_method: "BANK_TRANSFER",
        recipient_id: recipientId,
        description,
        metadata: {
          source: "web_app",
        },
      });
      onSuccess(payment);
    } catch (err) {
      console.error("Payment failed:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Amount:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Currency:</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="NGN">NGN</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div>
        <label>Description:</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? "Processing..." : "Make Payment"}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
};

export default PaymentForm;
```

### React Hook for Payment Management

```typescript
import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const createPayment = useCallback(
    async (paymentData: PaymentCreateData) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(paymentData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail);
        }

        return await response.json();
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const getPayment = useCallback(
    async (paymentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/payments/${paymentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail);
        }

        return await response.json();
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const getPaymentStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    createPayment,
    getPayment,
    getPaymentStats,
    loading,
    error,
  };
};
```

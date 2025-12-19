# LedgerFlow 🏦

A **Double-Entry Ledger System** with **Idempotency** and **Async Webhooks**.

LedgerFlow is a reliable financial transaction API designed to handle high-concurrency money transfers without data corruption. It solves the "Double Spend" problem using **Pessimistic Locking** and ensures network resilience via **Idempotency Keys**.

---

## 🏗 Key Engineering Concepts

### 1. 🛡️ Data Integrity (Double-Entry)
LedgerFlow records every transaction as two immutable ledger entries (Debit/Credit).

- **Benefit**: Full audit trail
- **Math**: `Sum(Debits) - Sum(Credits) = Current Balance`

### 2. 🔒 Concurrency Control (Row Locking)
Uses PostgreSQL `SELECT ... FOR UPDATE` to lock both sender and receiver accounts during a transaction.

- **Outcome**: Prevents race conditions where parallel requests could withdraw more funds than available

### 3. 🔁 API Idempotency (Redis)
Implements an **Idempotency Layer** using Redis to cache responses for 24 hours.

- **Scenario**: If a client times out but the server processed the payment, a retry with the same `Idempotency-Key` returns the original receipt instantly without re-processing funds

### 4. 📨 Event-Driven Webhooks (BullMQ)
After a successful transfer, an event is pushed to a reliable queue. A worker process attempts to notify external webhooks with **Exponential Backoff** (retry in 1s, 2s, 4s...) to handle external downtime.

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript (Node.js) |
| **Framework** | Fastify (High-performance API) |
| **Database** | PostgreSQL (Transactions & Locking) |
| **Cache/Queue** | Redis & BullMQ |
| **Infrastructure** | Docker & Docker Compose |
| **Docs** | Swagger / OpenAPI |

---

## 🚀 How to Run

### 1. Start Infrastructure
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Migrate Schema
```bash
npm run migrate
```

### 4. Script Testing
```bash
npm run scripts
```

### 5. Run Development Server
```bash
npm run dev
```

### 6. Access API Documentation
Visit: **http://localhost:3001/documentation**

---

## 🧪 Concurrency & Stress Testing

> **Demonstration of Atomicity**: 50 concurrent transfers processed with zero race conditions or deadlocks using Pessimistic Locking.

The system is designed to handle high-concurrency scenarios where multiple clients attempt to transfer funds simultaneously. Through the use of PostgreSQL row-level locking and double-entry bookkeeping, LedgerFlow maintains data integrity even under extreme load.

---

## 📁 Project Structure

```
ledger-flow/
├── src/
│   ├── db/
│   │   ├── connection.ts      # PostgreSQL connection pool
│   │   ├── redis-client.ts    # Redis client setup
│   │   └── schema.sql         # Database schema
│   ├── queue/
│   │   └── webhook-queue.ts   # BullMQ webhook worker
│   ├── scripts/
│   │   ├── migrate.ts         # Database migration script
│   │   ├── seed.ts            # Seed initial data
│   │   └── test-transfer.ts   # Transfer testing script
│   ├── services/
│   │   └── ledger-service.ts  # Core ledger logic
│   ├── server.ts              # Fastify server setup
│   └── types.ts               # TypeScript type definitions
├── docker-compose.yml         # Infrastructure setup
├── package.json
└── tsconfig.json
```

---

## 🎯 API Endpoints

### Transfer Money
```http
POST /transfer
Content-Type: application/json
Idempotency-Key: unique-request-id

{
  "fromAccountId": 1,
  "toAccountId": 2,
  "amount": 100.00,
  "reference": "Payment #123",
}
```

### Get Account Balance
```http
GET /accounts/:id/balance
```

---

## 🔐 Key Features

- **Double-Entry Bookkeeping** - Every transaction creates two entries
- **Pessimistic Locking** - Prevents concurrent modification issues
- **Idempotency** - Safe retry mechanism for network failures
- **Async Webhooks** - Reliable event delivery with retries
- **Audit Trail** - Complete transaction history
- **High Performance** - Built on Fastify for speed
- **Type Safety** - Full TypeScript coverage

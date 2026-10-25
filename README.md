# Nest SMS — Mini SMS Gateway

An ACID-compliant, concurrency-safe bulk SMS Gateway API built with **Node.js, Express, TypeScript, PostgreSQL, and Prisma ORM**. Designed using a modular monolith architecture, strict dependency injection, deterministic multi-part SMS pricing (GSM-7 vs. Unicode), automated route failover, and transactional refunds.

---

## Table of Contents

- [Nest SMS — Mini SMS Gateway](#nest-sms--mini-sms-gateway)
  - [Table of Contents](#table-of-contents)
  - [Architectural Overview](#architectural-overview)
  - [System Architecture \& Flow](#system-architecture--flow)
  - [Core Requirements \& Implementation](#core-requirements--implementation)
    - [1. Phone Number Normalization](#1-phone-number-normalization)
    - [2. Multi-Part SMS \& Cost Calculation](#2-multi-part-sms--cost-calculation)
    - [3. Concurrency \& Race-Condition Defense](#3-concurrency--race-condition-defense)
    - [4. Route Failover \& Refund Lifecycle](#4-route-failover--refund-lifecycle)
  - [Route Health Formula](#route-health-formula)
  - [Project Directory Structure](#project-directory-structure)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Environment Variables](#environment-variables)
    - [Local Installation](#local-installation)
    - [Docker Setup](#docker-setup)
  - [Database Migrations \& Seeding](#database-migrations--seeding)
  - [API Reference](#api-reference)
    - [Authentication](#authentication)
      - [Register User](#register-user)
      - [Login](#login)
    - [Wallet](#wallet)
      - [Get Balance](#get-balance)
    - [SMS Dispatch \& Reporting](#sms-dispatch--reporting)
      - [Send SMS (with Failover \& Deduction)](#send-sms-with-failover--deduction)
      - [Query Message Logs (Paginated \& Filterable)](#query-message-logs-paginated--filterable)
    - [Provider Health](#provider-health)
      - [Get Route Health Metrics](#get-route-health-metrics)
  - [Postman Setup \& API Testing](#postman-setup--api-testing)
  - [Verification \& Concurrency Testing](#verification--concurrency-testing)
    - [Parallel Overspend Challenge Test](#parallel-overspend-challenge-test)
  - [Key Design Decisions \& Trade-offs](#key-design-decisions--trade-offs)
  - [Production Improvements](#production-improvements)

---

## Architectural Overview

This gateway is engineered as a **Modular Monolith** adhering to **SOLID principles** and clean **N-Layer Separation**:

- **Transport Layer (`controllers`, `routes`):** Handles HTTP request parsing, status codes, query pagination, and payload handling.
- **Service Layer (`services`):** Pure domain logic, orchestration of credit calculations, multi-part segmentation, provider failover sequences, and auto-refund transactions.
- **Data Access Layer (`repositories`):** Encapsulates Prisma queries, raw PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), and interactive transaction clients.
- **Infrastructure / Clients (`provider/clients`):** Isolated mock implementations of telecommunication carrier endpoints (`ROUTE_A`, `ROUTE_B`) fulfilling an explicit contract interface (`ISmsProvider`).
- **Dependency Injection:** Dependencies (repositories, providers, database pools) are injected through constructors at the composition root (`app.ts`), eliminating hidden couplings and making the codebase unit-testable.

---

## System Architecture & Flow

```
Client (HTTP / JWT)
       │
       ▼
[ authMiddleware ] ── (Verify Bearer JWT)
       │
       ▼
[ SmsController ]
       │
       ▼
[ SmsService ]
  ├── 1. PhoneNormalizer (Validate Nepali prefixes: 97, 98)
  ├── 2. SegmentCounter (GSM-7 vs Unicode part cost calculation)
  ├── 3. WalletRepository.$transaction
  │        └── SELECT FOR UPDATE (Atomic Row Lock -> Prevent Overspend)
  ├── 4. Provider Dispatch Loop (Priority: ROUTE_A -> Failover to ROUTE_B)
  │        ├── Success ──> Record RouteAudit & Log Message (SENT)
  │        └── Dropped ──> Audit Failure & Try Next Route
  └── 5. All Routes Failed?
           ├── Atomic Refund to Wallet inside DB Transaction
           └── Log Message (FAILED)
```

---

## Core Requirements & Implementation

### 1. Phone Number Normalization

Valid Nepali mobile numbers must be 10 digits starting with `97` or `98`.

- Strips whitespace and normalizes country prefixes `+977` and `977` to a standard 10-digit number.
- Validates against `/^(97|98)\d{8}$/`. Invalid numbers are rejected upfront before any wallet operations occur.

### 2. Multi-Part SMS & Cost Calculation

The engine evaluates the character set of the message body:

- **GSM-7:** Evaluated against the standard GSM 03.38 7-bit alphabet. Single message holds up to **160 characters**; multipart messages split into segments of **153 characters**.
- **Unicode:** Triggered if any non-GSM character is present (Nepali Devanagari, special symbols, or emojis). Single message holds up to **70 characters**; multipart messages split into segments of **67 characters**.
- **Formula:** $\text{Total Cost} = \text{Segments} \times \text{Valid Recipients}$

### 3. Concurrency & Race-Condition Defense

> **Core Challenge:** "Never lose or double-spend a credit. Two parallel requests, a failing route or a crash must never leave a wallet wrong."

To solve this, credit deduction is executed upfront inside an **interactive PostgreSQL transaction** utilizing **Row-Level Locking**:

```sql
SELECT id, credits FROM "wallets" WHERE "user_id" = $1 FOR UPDATE;
```

If 20 concurrent requests hit a wallet containing only 10 credits, every request acquires a sequential lock. The first request confirms balance, deducts, and commits. The subsequent requests evaluate the updated balance sequentially, immediately throwing a `400 Insufficient Credits` error once the balance is exhausted. Parallel execution cannot overdraw the wallet.

### 4. Route Failover & Refund Lifecycle

- **Priority Routing:** Dispatches attempt transmission via `ROUTE_A` first (Priority 1).
- **Dynamic Failover:** If `ROUTE_A` has zero balance or drops the transmission (configurable 30% failure rate), execution transitions to `ROUTE_B` (Priority 2, 5% failure rate).
- **Guaranteed Refunds:** If all available carrier routes fail or exhaust their balances, an atomic refund transaction increments the deducted credits back into the user's wallet with an audit trail.

---

## Route Health Formula

The `/routes/health` endpoint calculates a live health score using telemetry collected in the `RouteAudit` table:

$$\text{Health \%} = (\text{Success Rate}_{24h} \times 0.7) + (\text{Balance Factor} \times 0.3)$$

Where:

- **$\text{Success Rate}_{24h}$:** Percentage of successful deliveries recorded over the past 24 hours:
  $$\text{Success Rate}_{24h} = \left( \frac{\text{Successful Requests}_{24h}}{\text{Total Requests}_{24h}} \right) \times 100$$
  _(Defaults to 100% if no requests were made in the last 24 hours)_
- **$\text{Balance Factor}$:** Proportional availability of carrier balance against an operational threshold ($T = 500$):
  $$\text{Balance Factor} = \min\left(100, \frac{\text{Current Provider Balance}}{500} \times 100\right)$$
- **Weighting Rationale:** Delivery reliability constitutes 70% of the health index, while balance reserve represents 30% to warn when a route requires topping up before it causes service interruption.

---

## Project Directory Structure

```text
nest-sms-gateway/
├── prisma/
│   ├── schema.prisma                  # Data models (User, Wallet, MessageLog, RouteAudit)
│   └── seed.ts                        # Seed script (Default user with 20 credits)
├── src/
│   ├── app.ts                         # App factory, middleware & DI composition root
│   ├── server.ts                      # Server bootstrap & graceful shutdown hooks
│   ├── config/
│   │   ├── env.ts                     # Environment variable validation
│   │   └── prisma.ts                  # PostgreSQL pool & PrismaClient adapter
│   ├── middlewares/
│   │   ├── auth.middleware.ts          # Bearer JWT verification
│   │   └── error.middleware.ts         # Global centralized error handler
│   ├── routes/
│   │   └── v1.routes.ts               # Versioned router mounting (/api/v1)
│   └── modules/
│       ├── auth/
│       │   ├── auth.controller.ts     # HTTP request mapping
│       │   ├── auth.repository.ts     # User queries & creation
│       │   ├── auth.routes.ts         # Registration & login routes
│       │   └── auth.service.ts        # Bcrypt hashing & JWT issuance
│       ├── wallet/
│       │   ├── wallet.controller.ts   # Wallet balance handlers
│       │   ├── wallet.repository.ts   # SELECT FOR UPDATE row-locking queries
│       │   ├── wallet.routes.ts       # /wallet routes
│       │   └── wallet.service.ts      # Balance retrieval logic
│       ├── provider/
│       │   ├── clients/
│       │   │   ├── provider.interface.ts # ISmsProvider interface contract
│       │   │   ├── route-a.provider.ts   # ROUTE_A (Priority 1, 30% failure)
│       │   │   └── route-b.provider.ts   # ROUTE_B (Priority 2, 5% failure)
│       │   ├── provider.controller.ts # Health endpoint handler
│       │   ├── provider.repository.ts # 24h RouteAudit aggregate queries
│       │   ├── provider.routes.ts     # /routes routes
│       │   └── provider.service.ts    # Weighted health score engine
│       └── sms/
│           ├── utils/
│           │   ├── phone-normalizer.ts# Nepali number validation & normalizer
│           │   └── segment-counter.ts # GSM-7 & Unicode multipart calculator
│           ├── sms.controller.ts      # Send & message logs endpoints
│           ├── sms.repository.ts      # Paginated and filtered log queries
│           ├── sms.routes.ts          # /sms routes
│           └── sms.service.ts         # Atomic deduction, failover & auto-refunds
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── nest_sms_gateway.postman_collection.json
├── package.json
├── README.md
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js (v20.x or higher)
- Docker & Docker Compose
- PostgreSQL (if running natively without Docker)

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default configuration:

```env
PORT=3000
DATABASE_URL="postgresql://nest_user:nest_password@localhost:5432/nest_sms_gateway?schema=public"
JWT_SECRET="nest_super_secret_jwt_key_development_32chars"
```

---

### Local Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start PostgreSQL via Docker Compose:**

   ```bash
   docker compose up -d postgres
   ```

3. **Run Prisma Migrations & Generate Client:**

   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Seed Database:**

   ```bash
   npm run prisma:seed
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The gateway will start on `http://localhost:3000`.

---

### Docker Setup

To spin up the entire system (API + PostgreSQL container) in one command:

```bash
docker compose up --build -d
```

---

## Database Migrations & Seeding

The database includes a pre-configured test user with **20 credits** to test wallet deductions and parallel requests:

- **Email:** `test@nestnepal.com`
- **Password:** `Password123!`
- **Initial Wallet Balance:** `20` credits

To run or re-run the seed script:

```bash
npm run prisma:seed
```

---

## API Reference

All endpoints support both `/api/v1/*` and direct root paths (`/sms/send`, `/sms/logs`, `/routes/health`) for test suite compatibility.

### Authentication

#### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "developer@nestnepal.com",
  "password": "Password123!"
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "test@nestnepal.com",
  "password": "Password123!"
}
```

---

### Wallet

#### Get Balance

```http
GET /api/v1/wallet/balance
Authorization: Bearer <JWT_TOKEN>
```

---

### SMS Dispatch & Reporting

#### Send SMS (with Failover & Deduction)

```http
POST /api/v1/sms/send
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "to": ["9841234567", "+9779801122334"],
  "message": "Hello from Nest Nepal SMS Gateway!"
}
```

#### Query Message Logs (Paginated & Filterable)

```http
GET /api/v1/sms/logs?page=1&limit=10&status=SENT&recipient=9841234567
Authorization: Bearer <JWT_TOKEN>
```

---

### Provider Health

#### Get Route Health Metrics

```http
GET /api/v1/routes/health
```

---

## Postman Setup & API Testing

1. Open Postman.
2. Click **Import** (top left).
3. Select the provided `nest_sms_gateway.postman_collection.json`.
4. Run the **Auth > 02. Login (Existing User)** request. The collection has a built-in test script that automatically sets the `jwt_token` collection variable.
5. All subsequent requests in the collection (`Wallet`, `SMS`, `Routes`) will authenticate automatically.

---

## Verification & Concurrency Testing

### Parallel Overspend Challenge Test

> Brief Challenge: _"Fire 20 parallel send requests at a wallet that can only afford 10. Exactly 10 should succeed."_

Verify race condition defense using `curl`:

1. Obtain a JWT token from `/api/v1/auth/login`.
2. Ensure the user's wallet has exactly **10 credits**.
3. Fire 20 parallel 1-part SMS requests simultaneously:

```bash
TOKEN="<YOUR_JWT_TOKEN>"

for i in {1..20}; do
  curl -s -X POST http://localhost:3000/api/v1/sms/send \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"to": ["9841111111"], "message": "Parallel concurrency test"}' &
done
wait
```

**Observed Result:**

- **Exactly 10 requests** succeed with `HTTP 200` (`SENT`).
- **Exactly 10 requests** fail with `HTTP 400` (`Insufficient credits`).
- The wallet balance never drops below `0`.

---

## Key Design Decisions & Trade-offs

1. **Row-Level Lock vs. Optimistic Locking:**
   - _Decision:_ Used PostgreSQL pessimistic locking (`SELECT ... FOR UPDATE`).
   - _Trade-off:_ High contention causes requests to queue rather than fail with retry conflicts, ensuring predictable behavior during bursts of bulk SMS dispatches.
2. **Upfront Deduction vs. Post-Dispatch Billing:**
   - _Decision:_ Deduct the maximum potential cost upfront and refund on failure.
   - _Trade-off:_ Eliminates the risk of a user spending credits across other requests while a network dispatch is in flight.
3. **In-Memory Provider State vs. Database Persistence:**
   - _Decision:_ Mock provider instances hold runtime state in-memory during server lifecycle.
   - _Trade-off:_ Fast execution and simple isolation for unit/integration testing; in production, route health and balances are backed by database models or external telecom balance APIs.

---

## Production Improvements

If expanding this gateway for high-throughput production workloads:

1. **Asynchronous Queues:** Integrate **BullMQ / Redis** so `/sms/send` pushes jobs onto an ingestion queue, responds with an `ack_id` immediately, and lets background workers handle dispatch and failover.
2. **Distributed Rate Limiting:** Add Redis token-bucket rate limiting per user (e.g., 60 requests/minute) to protect internal queues and downstream telecom routes.
3. **Delivery Webhooks (DLR):** Implement a `/webhooks/delivery-report` endpoint for telecom providers to push asynchronous delivery status updates (DELIVERED, UNDELIVERED, REJECTED).
4. **Circuit Breaker Pattern:** Automatically trip routes into an open state if consecutive failures exceed a threshold, bypassing unnecessary attempts to broken carriers.

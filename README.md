# CAM — Card & Account Management API

A production-grade REST API for credit card account management. Handles customer accounts with KYC workflows, virtual and physical card issuance, card controls (lock/unlock, suspend, close), and per-card/per-account spending limits with ACID-compliant balance tracking.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript (strict) |
| Framework | Fastify 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Validation | Fastify JSON Schema (Ajv) + Zod (env) |
| Testing | Jest + ts-jest (unit + integration) |

## Key Design Decisions

- **Integer cents** — all monetary values stored as integers; no floats ever
- **Soft deletes** — accounts and cards are `CLOSED`, never deleted; full audit trail
- **State machines** — invalid status transitions rejected at the service layer
- **ACID balances** — credit limit and balance updates use `SELECT ... FOR UPDATE` inside Prisma transactions
- **PCI-DSS** — full PANs never stored; only `last4` and masked PAN
- **Cursor pagination** — stable under concurrent inserts
- **UUID v4** — no sequential ID leakage

## Project Structure

```
src/
├── app.ts                    # Fastify app factory
├── main.ts                   # Entry point
├── config/index.ts           # Zod-validated env config (fail-fast)
├── plugins/
│   ├── auth.ts               # Bearer token auth
│   ├── database.ts           # Prisma singleton plugin
│   └── errorHandler.ts       # Normalised error responses
├── modules/
│   ├── accounts/             # Account CRUD, KYC, balance, status machine
│   ├── cards/                # Card issuance, state machine, lock/unlock
│   ├── limits/               # Account & card spending limits, MCC controls
│   └── health/               # Liveness + readiness endpoints
└── shared/
    ├── errors/               # AppError hierarchy (NotFound, Conflict, …)
    └── utils/                # Currency (cents) helpers, cursor pagination

web/
└── index.html                # Single-page frontend (apply + manage cards)

prisma/
├── schema.prisma
└── migrations/
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and API_KEY
```

### 3. Start PostgreSQL

```bash
# With Docker
docker-compose up -d

# Or with Homebrew
brew services start postgresql@16
psql postgres -c "CREATE USER cam_user WITH PASSWORD 'cam_password' CREATEDB;"
psql postgres -c "CREATE DATABASE cam_db OWNER cam_user;"
```

### 4. Run migrations

```bash
npm run migrate:dev
```

### 5. Start the server

```bash
npm run dev        # development (hot reload)
npm run build && npm start  # production
```

The API is available at `http://localhost:3000`.

## API Reference

All endpoints are prefixed with `/api/v1` and require:
```
Authorization: Bearer <API_KEY>
```

### Accounts

| Method | Path | Description |
|---|---|---|
| `POST` | `/accounts` | Create account |
| `GET` | `/accounts` | List accounts (paginated, filter by `status`/`kycStatus`) |
| `GET` | `/accounts/:id` | Get account |
| `PATCH` | `/accounts/:id` | Update account (address, phone, status, creditLimit) |
| `DELETE` | `/accounts/:id` | Close account (soft delete) |
| `PATCH` | `/accounts/:id/kyc` | Update KYC status |
| `GET` | `/accounts/:id/balance` | Get balance details |
| `GET` | `/accounts/:id/cards` | List cards for account |
| `PUT` | `/accounts/:id/limits` | Set account-level spending limits |
| `GET` | `/accounts/:id/limits` | Get account-level spending limits |

### Cards

| Method | Path | Description |
|---|---|---|
| `POST` | `/accounts/:id/cards` | Issue a card (virtual or physical) |
| `GET` | `/cards/:id` | Get card |
| `PATCH` | `/cards/:id` | Update card (name, limits) |
| `POST` | `/cards/:id/activate` | `PENDING_ACTIVATION` → `ACTIVE` |
| `POST` | `/cards/:id/deactivate` | `ACTIVE` → `INACTIVE` |
| `POST` | `/cards/:id/suspend` | → `SUSPENDED` |
| `POST` | `/cards/:id/reactivate` | `INACTIVE`/`SUSPENDED` → `ACTIVE` |
| `POST` | `/cards/:id/lock` | Lock card (blocks transactions, preserves status) |
| `POST` | `/cards/:id/unlock` | Unlock card |
| `DELETE` | `/cards/:id` | Close card (terminal soft delete) |
| `PUT` | `/cards/:id/limits` | Set card spending limits |
| `GET` | `/cards/:id/limits` | Get card spending limits |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Readiness (DB ping) |

### Error Response Shape

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human readable message",
    "statusCode": 422,
    "requestId": "req_abc123",
    "timestamp": "2026-03-08T00:00:00.000Z"
  }
}
```

## Business Rules

### Account State Machine
```
INACTIVE → ACTIVE (after KYC verified)
ACTIVE ↔ SUSPENDED
ACTIVE / SUSPENDED → CLOSED (terminal)
```

**Closure pre-conditions:** all cards must be `CLOSED` and `statementBalanceCents === 0`.

### Card State Machine
```
PENDING_ACTIVATION → ACTIVE   (physical cards only, via /activate)
ACTIVE → INACTIVE             (via /deactivate)
INACTIVE → ACTIVE             (via /reactivate)
ACTIVE → SUSPENDED            (via /suspend)
SUSPENDED → ACTIVE            (via /reactivate)
Any → CLOSED                  (terminal, via DELETE)
```

**KYC gate:** cards can only be created when `account.status === ACTIVE` AND `account.kycStatus === VERIFIED`.

**Virtual cards** are created as `ACTIVE` immediately. **Physical cards** start as `PENDING_ACTIVATION` and require a shipping address.

### Card Lock

Lock is orthogonal to the status machine — a card can be `ACTIVE + locked` or `SUSPENDED + locked`. Lock/unlock does not change `status`.

### Spending Limit Hierarchy

```
transactionLimitCents ≤ dailyLimitCents ≤ account.creditLimitCents
monthlyLimitCents ≤ account.creditLimitCents
```

**MCC evaluation order:** Card BLOCK → Account BLOCK → Card ALLOW → allow by default.

## Testing

```bash
npm test                        # all tests (unit + integration)
npm run test:unit               # unit tests only (mocked Prisma)
npm run test:integration        # integration tests (requires PostgreSQL)
```

Integration tests use a separate `cam_test_db` database.

```bash
# Set up test DB
psql postgres -c "CREATE DATABASE cam_test_db OWNER cam_user;"
DATABASE_URL="postgresql://cam_user:cam_password@localhost:5432/cam_test_db" npx prisma migrate deploy
```

**101 tests:** 37 unit + 64 integration, all passing.

## Frontend

A zero-dependency single-page app is included at `web/index.html`. Open it directly in a browser (no build step required).

**Apply for a Card** — 3-step wizard that creates an account, verifies KYC, activates the account, and issues a card.

**Manage Cards** — view all cards for an account with status badges, lock/unlock controls.

The frontend targets `http://localhost:3000` with the default API key. Update the constants at the top of the `<script>` tag to point at a different environment.

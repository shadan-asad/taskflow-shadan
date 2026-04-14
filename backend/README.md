# TaskFlow API

A **production-ready REST API** for managing projects and tasks — built with Node.js, Express, PostgreSQL, and JWT authentication.

---

## 1. Overview

TaskFlow is a task management backend that lets teams create projects, organise tasks within them, assign work to members, and track progress by status. It exposes a clean JSON REST API with JWT-secured endpoints and structured error responses throughout.

### Why Node.js + Express (not Go)?

| Concern | Rationale |
|---|---|
| **Ecosystem** | `pg`, `bcryptjs`, `jsonwebtoken`, `zod` are battle-tested npm packages with huge communities |
| **Developer velocity** | Express's minimal footprint keeps the codebase readable with no boilerplate |
| **JSON-first** | Node's event loop is optimised for the I/O-bound workloads a REST API performs |
| **Team familiarity** | JavaScript / TypeScript is the most common language in full-stack teams |

Go would excel at raw throughput at very high concurrency, but for a team-oriented task management system the operational and ergonomic benefits of Node.js outweigh the marginal CPU gains.

---

## 2. Architecture Decisions

### Folder Structure

```
src/
  controllers/   — Pure async functions, one concern each (auth / projects / tasks)
  routes/        — Express Routers; wire middleware + controller; no logic
  middleware/    — auth.js (JWT verify), validate.js (Zod), errorHandler.js
  schemas/       — Zod schemas co-located by domain, imported by validate middleware
  db/index.js    — Singleton pg.Pool; never recreated between requests
  app.js         — Express factory (importable by tests without binding a port)
  server.js      — Binds the port; manages graceful shutdown
```

**Why separate `app.js` from `server.js`?**  
Supertest imports `app` directly — no port is bound during tests, so test suites never collide on ports and start instantly.

### Raw SQL instead of an ORM

- Parameterised queries via `node-postgres` (`pg`) prevent SQL injection without abstraction overhead
- Dynamic `PATCH` clauses (build `SET col = $N` arrays at runtime) are trivial with raw SQL and harder with an ORM
- Migrations stay in plain `.sql` files — reviewable, diffable, and runnable by any DBA without framework knowledge
- Zero magic: every query is visible; N+1 issues are immediately obvious

### Zod for Validation

- Schema-first: the shape of accepted input is declared once and reused as TypeScript-compatible type inference
- `validate.js` middleware calls `schema.parse(req.body)`; on failure it throws a `ZodError` which `errorHandler.js` converts to a structured `400` with per-field messages
- Enum types (`task_status`, `task_priority`) are validated at the HTTP layer before any SQL is executed

### Security Choices

- Passwords hashed with **bcrypt cost 12** — never stored in plaintext
- `JWT_SECRET` always sourced from `process.env` — never hardcoded
- Login uses a **dummy hash comparison** even when the user doesn't exist, preventing timing attacks that leak email existence
- Non-root Docker user (`appuser`) — container doesn't run as root

---

## 3. Running Locally

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose (for the DB, or a local PostgreSQL 16 instance)

### Option A — Docker Compose (recommended, zero setup)

```bash
git clone <repo-url>
cd taskflow

# Copy and (optionally) edit environment variables
cp backend/.env.example .env

# Start postgres + api  (runs migrations + seed automatically)
docker compose up --build
```

The API is now live at **http://localhost:8080**.

### Option B — Local PostgreSQL

```bash
git clone <repo-url>
cd taskflow/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, PORT

# Start the server in development (hot-reload)
npm run dev
```

### Health check

```bash
curl http://localhost:8080/health
# → {"status":"ok","timestamp":"..."}
```

---

## 4. Running Migrations

Migrations use [node-pg-migrate](https://github.com/salsita/node-pg-migrate) and plain SQL files.

```bash
# Apply all pending migrations (up)
DATABASE_URL=postgres://taskflow_user:taskflow_pass@localhost:5432/taskflow \
  npm run migrate:up

# Roll back the last migration (down)
DATABASE_URL=postgres://taskflow_user:taskflow_pass@localhost:5432/taskflow \
  npm run migrate:down

# Seed the database (idempotent — safe to re-run)
DATABASE_URL=postgres://taskflow_user:taskflow_pass@localhost:5432/taskflow \
  npm run seed
```

Migration files live in `migrations/` and follow the naming convention:
```
001_create_users.up.sql   / 001_create_users.down.sql
002_create_projects.up.sql / 002_create_projects.down.sql
003_create_tasks.up.sql    / 003_create_tasks.down.sql
```

---

## 5. Test Credentials

The seed script inserts a ready-to-use account:

| Field    | Value                |
|----------|----------------------|
| Email    | `test@example.com`   |
| Password | `password123`        |

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq .
```

The seeded project ID is `b0000000-0000-0000-0000-000000000001`.

---

## 6. API Reference

All authenticated endpoints require the header:
```
Authorization: Bearer <token>
```

All responses are `Content-Type: application/json`.

### Error format

```json
{ "error": "validation failed", "fields": { "email": "must be a valid email" } }  // 400
{ "error": "unauthorized" }       // 401
{ "error": "forbidden" }          // 403
{ "error": "not found" }          // 404
{ "error": "internal server error" } // 500
```

---

### Auth

#### `POST /api/v1/auth/register`
```json
// Request
{ "name": "Alice", "email": "alice@example.com", "password": "password123" }

// 201 Response
{
  "token": "<jwt>",
  "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com" }
}
```

#### `POST /api/v1/auth/login`
```json
// Request
{ "email": "alice@example.com", "password": "password123" }

// 200 Response
{
  "token": "<jwt>",
  "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com" }
}
```

---

### Projects

| Method   | Path                    | Auth | Description                             |
|----------|-------------------------|------|-----------------------------------------|
| `GET`    | `/api/v1/projects`             | ✅   | List projects (owner or assignee)       |
| `POST`   | `/api/v1/projects`             | ✅   | Create a project                        |
| `GET`    | `/api/v1/projects/:id`         | ✅   | Get project + tasks array               |
| `PATCH`  | `/api/v1/projects/:id`         | ✅   | Update project (owner only)             |
| `DELETE` | `/api/v1/projects/:id`         | ✅   | Delete project + tasks (owner only)     |
| `GET`    | `/api/v1/projects/:id/stats`   | ✅   | Task counts by status and assignee      |

**GET /api/v1/projects** — supports `?page=1&limit=20`

```json
// 200 Response
{
  "data": [{ "id": "uuid", "name": "My Project", "owner_id": "uuid", ... }],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

**POST /api/v1/projects**
```json
// Request
{ "name": "Sprint 1", "description": "Q1 work" }

// 201 Response
{ "id": "uuid", "name": "Sprint 1", "description": "Q1 work", "owner_id": "uuid", "created_at": "..." }
```

**GET /api/v1/projects/:id/stats**
```json
// 200 Response
{
  "by_status": { "todo": 2, "in_progress": 1, "done": 3 },
  "by_assignee": [
    { "assignee_id": "uuid", "name": "Alice", "count": 3 }
  ]
}
```

---

### Tasks

| Method   | Path                        | Auth | Description                                     |
|----------|-----------------------------|------|-------------------------------------------------|
| `GET`    | `/api/v1/projects/:id/tasks`       | ✅   | List tasks (filter by status / assignee)         |
| `POST`   | `/api/v1/projects/:id/tasks`       | ✅   | Create a task in a project                       |
| `PATCH`  | `/api/v1/tasks/:id`                | ✅   | Update task (owner or assignee)                  |
| `DELETE` | `/api/v1/tasks/:id`                | ✅   | Delete task (owner or assignee)                  |

**GET /api/v1/projects/:id/tasks** — supports `?status=todo|in_progress|done`, `?assignee=uuid`, `?page`, `?limit`

```json
// 200 Response
{
  "data": [{ "id": "uuid", "title": "Fix bug", "status": "todo", "priority": "high", ... }],
  "pagination": { "page": 1, "limit": 20, "total": 7 }
}
```

**POST /api/v1/projects/:id/tasks**
```json
// Request
{
  "title": "Design database schema",
  "description": "Write ERD and migrations",
  "priority": "high",
  "assignee_id": "uuid",
  "due_date": "2025-06-30"
}

// 201 Response
{
  "id": "uuid", "title": "Design database schema",
  "status": "todo", "priority": "high",
  "project_id": "uuid", "assignee_id": "uuid",
  "due_date": "2025-06-30", "created_at": "...", "updated_at": "..."
}
```

**PATCH /api/v1/tasks/:id**
```json
// Request — all fields optional
{ "status": "in_progress", "priority": "medium" }

// 200 Response — updated_at refreshed automatically
{ "id": "uuid", "status": "in_progress", "updated_at": "2025-04-13T...", ... }
```

---

## 7. What You'd Do With More Time

| Area | Improvement |
|---|---|
| **Refresh tokens** | Implement short-lived access tokens (15 min) + long-lived refresh tokens stored in `httpOnly` cookies; add `POST /auth/refresh` endpoint |
| **Rate limiting** | Add `express-rate-limit` per IP + per-user on auth endpoints to prevent brute-force |
| **Redis caching** | Cache `GET /projects/:id/stats` and project lists in Redis with a short TTL; invalidate on mutation |
| **Role system** | Add a `project_members` join table with roles (`viewer`, `editor`, `admin`) instead of binary owner/assignee |
| **Soft deletes** | Add `deleted_at` column + filter in all queries; expose `DELETE /tasks/:id/restore` |
| **Cursor pagination** | Replace offset/limit with keyset (cursor) pagination for large datasets — avoids drift on inserts |
| **OpenAPI spec** | Auto-generate `openapi.yaml` from Zod schemas using `zod-to-openapi`; serve Swagger UI at `/docs` |
| **TypeScript** | Migrate to TypeScript for end-to-end type safety from DB row to HTTP response |
| **CI/CD pipeline** | GitHub Actions: lint → test → build Docker image → push to registry → deploy |
| **Observability** | Add OpenTelemetry spans, integrate with Datadog or Grafana Loki + Tempo |
| **Connection pooling** | Use PgBouncer in front of PostgreSQL for connection multiplexing at scale |

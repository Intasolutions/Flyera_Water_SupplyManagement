# Scalable Backend Architecture & Implementation Plan

## Architecture Overview
We are adopting a **Separate Backend** architecture using **FastAPI (Python)** and a **Next.js Frontend**. This is the most professional and scalable approach, allowing for future mobile app integrations, microservices, and heavy data processing.

1. **Frontend (Next.js)**: Acts purely as the Presentation Layer. It will consume RESTful APIs provided by the backend.
2. **Backend (FastAPI)**: Acts as the core Business Logic and Data Access layer. It will expose a REST API.
3. **Database (PostgreSQL)**: We will use PostgreSQL as the production-ready database, managed by the backend using SQLAlchemy.

---

## 1. Database Translation (Prisma -> SQLAlchemy)
Since the backend will now own the database, we need to translate the existing Prisma schema to Python SQLAlchemy models.

**Core Entities**:
- `User` (Admin, Driver, Helper)
- `Client` (Customers receiving water)
- `Vehicle` (Delivery trucks)
- `InventoryType` (20L Bottle, 5L Bottle)
- `Stock` (Current warehouse stock)
- `Assignment` (Daily route for a vehicle & driver)
- `Allocation` (Stock given to an assignment)
- `Delivery` & `DeliveryItem` (Actual drop-offs to clients)

---

## 2. Backend Tech Stack
- **Framework**: FastAPI (High performance, async, auto-docs).
- **ORM**: SQLAlchemy (Industry standard for Python databases).
- **Migrations**: Alembic (To handle database schema changes).
- **Validation**: Pydantic (For request/response schemas).
- **Database**: SQLite (for local dev) -> PostgreSQL (for production).

---

## 3. Step-by-Step Implementation Plan

### Phase 1: Backend Scaffolding & Database Models
- [ ] Initialize standard FastAPI project structure (`app/models`, `app/schemas`, `app/api`, `app/core`).
- [ ] Set up SQLAlchemy engine and database session middleware.
- [ ] Translate the Prisma schema to SQLAlchemy models.
- [ ] Configure Alembic for database migrations and generate the first migration.

### Phase 2: Core API Endpoints (CRUD)
- [ ] Create Pydantic schemas (e.g., `ClientCreate`, `ClientResponse`).
- [ ] Implement CRUD operations in `app/crud`.
- [ ] Create API routes in `app/api/routers` for:
  - `/api/clients`
  - `/api/inventory`
  - `/api/vehicles`
  - `/api/users` (Staff)
  - `/api/assignments` (Routes)

### Phase 3: Frontend Refactoring
- [ ] Create a central API client in Next.js (`src/lib/api.ts`) using standard `fetch` or `axios` configured to talk to `http://localhost:8000`.
- [ ] Remove Prisma dependencies and `prisma/schema.prisma` from the Next.js frontend, as it's no longer the database owner.
- [ ] Update frontend pages to fetch data from the FastAPI backend instead of relying on mock static data.

### Phase 4: Business Logic & Dashboard
- [ ] Implement backend logic for Stock Allocations (deducting warehouse stock when assigning to a vehicle).
- [ ] Implement backend logic for Deliveries (calculating returned empties, revenue).
- [ ] Create a specific `/api/dashboard-stats` endpoint to aggregate data for the main overview screen.

---

## Next Steps
We should begin **Phase 1** immediately. I will start by structuring the Python backend and creating the SQLAlchemy database models based on your existing Prisma schema. Let me know if you are ready to proceed!

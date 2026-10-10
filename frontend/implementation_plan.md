# Architecture & Implementation Plan

## Current Frontend Understanding
The current project is a Next.js App Router application providing a dashboard for a water supply delivery business. It uses a modern, responsive UI built with Tailwind CSS, featuring a sidebar and multiple pages (`/clients`, `/deliveries`, `/driver`, `/glass`, `/inventory`, `/routes`, `/staff`). The UI is currently using mocked static data to demonstrate layout and aesthetics. The database schema has been defined using Prisma, encompassing models for `User`, `Client`, `Vehicle`, `InventoryType`, `Stock`, `Assignment`, `Allocation`, `Delivery`, and `DeliveryItem`.

## Recommended Architecture for Scaling

To ensure the application scales effectively as the business grows, we recommend the following architecture:

### 1. **Next.js App Router (Server Components & Actions)**
- **Data Fetching:** Use React Server Components (RSC) to fetch data directly from the database (via Prisma) on the server. This eliminates the need for separate API layers for internal app use, reducing latency and client-side bundle size.
- **Mutations:** Use Server Actions for all database mutations (creating clients, assigning routes, updating stock). This provides type-safe, seamless server-side execution without writing dedicated API routes.
- **Client Components:** Use client components (`"use client"`) only when interactivity is needed (e.g., forms, charts, interactive state).

### 2. **Database & ORM**
- **Current (Development):** SQLite is excellent for local development and initial prototyping.
- **Production (Scaling):** Migrate to **PostgreSQL**. PostgreSQL is robust, handles concurrent read/writes exceptionally well, and supports advanced querying needed for reporting.
- **ORM:** Continue using **Prisma**. It provides excellent type safety and developer experience, making schema migrations and queries straightforward.

### 3. **API Layer (Optional/Future)**
- If you plan to build a mobile app for drivers later, you will need a REST or GraphQL API. In Next.js, this can be implemented using Route Handlers (`app/api/...`) which can reuse the same Prisma logic.

### 4. **State Management & Caching**
- Rely on Next.js built-in caching for Server Components.
- For complex client-side state (if it grows), consider tools like Zustand or React Query, though Next.js Server Actions often reduce the need for heavy client state management.

---

## Implementation Plan

### Phase 1: Environment Setup & Database Initialization (Current Phase)
- [x] Review project structure and database schema.
- [ ] Install all Node.js dependencies (`npm install`).
- [ ] Initialize the SQLite database and run Prisma migrations (`npx prisma db push`).
- [ ] Generate the Prisma Client (`npx prisma generate`).
- [ ] Create a seed script (`prisma/seed.ts`) to populate the database with initial dummy data (admin user, a few clients, inventory items).

### Phase 2: Core Backend Implementation (Server Actions)
- [ ] Create a `src/lib/prisma.ts` file for a singleton Prisma client instance.
- [ ] **Inventory & Stock Management:** Create Server Actions to fetch current stock, add new stock, and manage inventory types.
- [ ] **Staff & Vehicles:** Create actions to list drivers/helpers and manage vehicles.
- [ ] **Clients:** Create actions to fetch, add, and update client records.
- [ ] **Assignments & Routes:** Create actions to create daily assignments (vehicle + driver + helper) and allocate stock to them.

### Phase 3: Frontend Integration
- [ ] **Dashboard (`/page.tsx`):** Convert static stats and recent activity to fetch real data from the database.
- [ ] **Inventory Page:** Wire up real data for stock levels and create forms (using Server Actions) to add new stock.
- [ ] **Clients Page:** Fetch client lists and wire up the "Add Client" form.
- [ ] **Routes/Assignments Page:** Display active routes based on database records.

### Phase 4: Driver Interface & Deliveries
- [ ] Implement the mobile-friendly driver view where a driver can see their assigned route.
- [ ] Allow drivers to record deliveries (bottles given, empties returned, payment collected) which mutates the `Delivery` and `DeliveryItem` models.
- [ ] Update allocations when a delivery is completed to maintain real-time stock tracking.

Let's begin by setting up the database and seeding it with data!

# FLYERA

Runs two businesses from one system: water-jar delivery and glass collection for recycling.

- `frontend/`: Next.js app. All pages run in the browser and call the API through a Next.js proxy.
- `backend/`: FastAPI app with SQLAlchemy. All business rules and permissions live here.

## Run it locally

First-time setup:

```
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements-dev.txt
copy .env.example .env
```

Generate a key and put it in `backend/.env` as `SECRET_KEY`:

```
venv\Scripts\python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Then create your admin account, and install the frontend:

```
venv\Scripts\python create_superuser.py
cd ..\frontend
npm install
copy .env.example .env.local
```

After that, `start_servers.bat` starts the backend on port 8000 and the frontend on port 3000.
API docs are at http://127.0.0.1:8000/docs. `backend/seed_rich_demo_data.py` loads demo data.

Before changing frontend code, read `frontend/AGENTS.md`: this Next.js version differs from older ones.

## Tests

```
cd backend
venv\Scripts\python -m pytest tests
```

The tests use a throwaway database and never touch your real data.

## Roles

| Role | Can do |
| --- | --- |
| `ADMIN`, `Owner` | Everything in both businesses |
| `WATER_STAFF` | Water office work: dispatch, verify payments, stock, routes, customers |
| `DRIVER`, `HELPER` | Their own water routes: deliveries, expenses, customer contact details |
| `GLASS_STAFF` | Glass office work: runs, properties, godown, sales, reports |
| `GLASS_DRIVER` | Their own glass runs: collections and drop-offs |

## How money and stock work

- The server sets prices and totals from the customer's tier.
- Cash counts as paid at the door. UPI waits until the office checks the bank reference (UTR). Pay Later goes on the customer's dues.
- Undoing a delivery reverses its dues, jar balance, loyalty points and, on a closed route, warehouse stock. Payments the office has verified cannot be deleted.
- Ending a route works out returned jars and empties per product from its saved deliveries.
- Stock can never go below zero.
- People, customers and products with history are kept. Removing a staff member with history deactivates the account.

## Before going to production

Set these on the backend server:

| Setting | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `SECRET_KEY` | A private random value of at least 32 characters. The app refuses to start without one |
| `SETUP_MASTER_KEY` | A private value, needed to use the `/setup` page |
| `CORS_ORIGINS` | Exact origins that call the API directly, or empty if all traffic goes through the proxy |
| `DATABASE_URL` | Your database. SQLite and PostgreSQL URLs both work |

Set `BACKEND_URL` on the frontend server to the backend's address.

Start the backend with `--timeout-keep-alive 75`. This keeps idle connections open longer than uvicorn's 5-second default, to reduce the chance of the Next.js proxy reusing one just as it closes.

Changing `SECRET_KEY` logs everyone out and invalidates the UPI ID seal, so save the UPI ID again in Settings afterward.

Database updates run automatically at startup, and only add tables, columns and indexes. Back up the database before any upgrade.

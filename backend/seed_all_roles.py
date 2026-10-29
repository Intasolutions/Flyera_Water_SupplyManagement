import datetime
import random
from app.database import SessionLocal, engine, Base
from app import models
from app.core.security import get_password_hash

def seed_all():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("--- 1. SEEDING / ENSURING VEHICLES ---")
        vehicles_data = [
            {"plate_number": "MH 12 AB 1234", "model": "Tata Ace (Water)", "is_active": True},
            {"plate_number": "MH 12 CD 5678", "model": "Mahindra Bolero Pickup (Glass)", "is_active": True},
            {"plate_number": "MH 12 EF 9012", "model": "Tata 407 (Bulk)", "is_active": True},
        ]
        vehicles = []
        for v in vehicles_data:
            existing = db.query(models.Vehicle).filter(models.Vehicle.plate_number == v["plate_number"]).first()
            if not existing:
                existing = models.Vehicle(**v)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            vehicles.append(existing)

        print("--- 2. SEEDING / ENSURING ROUTES ---")
        routes_data = [
            {"name": "Downtown Commercial Zone", "area": "City Center / MG Road"},
            {"name": "Tech Corridor Zone", "area": "IT Park / Hinjewadi"},
            {"name": "Green Valley Residential", "area": "Lake View / Residency Road"}
        ]
        routes = []
        for r in routes_data:
            existing = db.query(models.Route).filter(models.Route.name == r["name"]).first()
            if not existing:
                existing = models.Route(**r)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            routes.append(existing)

        print("--- 3. SEEDING / ENSURING INVENTORY TYPES & STOCK ---")
        inv_data = [
            {"name": "20L Mineral Water Jar", "price": 80.0, "wholesale_price": 65.0, "premium_price": 60.0, "points_value": 1},
            {"name": "5L Packaged Water Bottle", "price": 35.0, "wholesale_price": 28.0, "premium_price": 25.0, "points_value": 0},
            {"name": "Paper Cups Pack (100 pcs)", "price": 50.0, "wholesale_price": 42.0, "premium_price": 38.0, "points_value": 0},
        ]
        inventory_types = []
        for item in inv_data:
            existing = db.query(models.InventoryType).filter(models.InventoryType.name == item["name"]).first()
            if not existing:
                existing = models.InventoryType(**item)
                db.add(existing)
                db.commit()
                db.refresh(existing)
                # Create stock
                stock = models.Stock(
                    inventory_type_id=existing.id,
                    full_count=350,
                    empty_count=80,
                    damaged_count=5
                )
                db.add(stock)
                db.commit()
            inventory_types.append(existing)

        print("--- 4. SEEDING / ENSURING CLIENTS ---")
        clients_data = [
            {"name": "Fresh Bites Cafe", "phone": "9811112222", "address": "Shop 4, MG Road Commercial complex", "tier": "Standard", "loyalty_points": 140, "opt_in_loyalty": True, "route_id": routes[0].id, "credit_amount": 0.0},
            {"name": "Tech Park Tower A", "phone": "9822223333", "address": "Tower A Lobby, Phase 1 IT Park", "tier": "Premium", "loyalty_points": 450, "opt_in_loyalty": True, "route_id": routes[1].id, "credit_amount": 160.0},
            {"name": "Sunrise Apartments Society", "phone": "9833334444", "address": "Gate 2, Lake View Road", "tier": "Standard", "loyalty_points": 20, "opt_in_loyalty": True, "route_id": routes[2].id, "credit_amount": 0.0},
            {"name": "Fitness First Gym", "phone": "9844445555", "address": "2nd Floor, Royal Arcade", "tier": "Standard", "loyalty_points": 80, "opt_in_loyalty": True, "route_id": routes[0].id, "credit_amount": 80.0},
        ]
        clients = []
        for c in clients_data:
            existing = db.query(models.Client).filter(models.Client.phone == c["phone"]).first()
            if not existing:
                existing = models.Client(**c)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            clients.append(existing)

        print("--- 5. SEEDING USERS FOR ALL ROLES ---")
        users_config = [
            {
                "name": "Rajesh Sharma (Admin)",
                "username": "admin",
                "phone": "9800000001",
                "role": "ADMIN",
                "password": "password123",
                "address": "Head Office, Sector 1"
            },
            {
                "name": "Priya Patel (Water Staff)",
                "username": "water_staff",
                "phone": "9800000002",
                "role": "WATER_STAFF",
                "password": "password123",
                "address": "Dispatch Center Desk 1"
            },
            {
                "name": "Rahul Verma (Lead Driver)",
                "username": "driver_rahul",
                "phone": "9800000003",
                "role": "DRIVER",
                "password": "password123",
                "assigned_vehicle_id": vehicles[0].id,
                "driving_license": "DL-12201900345",
                "address": "East Block, Camp Area"
            },
            {
                "name": "Amit Kumar (Route Helper)",
                "username": "helper_amit",
                "phone": "9800000004",
                "role": "HELPER",
                "password": "password123",
                "address": "South Colony, Lane 3"
            },
            {
                "name": "Suresh Mehta (Glass Staff)",
                "username": "glass_staff",
                "phone": "9800000005",
                "role": "GLASS_STAFF",
                "password": "password123",
                "address": "Recycling Facility Godown A"
            },
            {
                "name": "Vikram Singh (Glass Driver)",
                "username": "glass_driver",
                "phone": "9800000006",
                "role": "GLASS_DRIVER",
                "password": "password123",
                "assigned_vehicle_id": vehicles[1].id,
                "driving_license": "DL-12202000892",
                "address": "Industrial Area, Gate 4"
            }
        ]

        created_users = {}
        for u in users_config:
            pw = u.pop("password")
            existing = db.query(models.User).filter(
                (models.User.username == u["username"]) | (models.User.phone == u["phone"])
            ).first()

            if not existing:
                existing = models.User(
                    **u,
                    hashed_password=get_password_hash(pw),
                    is_active=True,
                    token_version=1
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
                print(f"Created user: {u['username']} ({u['role']})")
            else:
                # Update role, name, and password so credentials are guaranteed to match
                existing.role = u["role"]
                existing.name = u["name"]
                existing.hashed_password = get_password_hash(pw)
                existing.is_active = True
                if "assigned_vehicle_id" in u:
                    existing.assigned_vehicle_id = u["assigned_vehicle_id"]
                db.commit()
                db.refresh(existing)
                print(f"Updated user: {u['username']} ({u['role']})")
            created_users[existing.role] = existing

        print("--- 6. SEEDING / ENSURING ACTIVE ASSIGNMENT FOR WATER DRIVER ---")
        driver_user = created_users.get("DRIVER")
        helper_user = created_users.get("HELPER")
        if driver_user:
            today = datetime.datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0)
            existing_assignment = db.query(models.Assignment).filter(
                models.Assignment.driver_id == driver_user.id,
                models.Assignment.status.in_(["PENDING", "ACTIVE"])
            ).first()

            if not existing_assignment:
                assignment = models.Assignment(
                    date=today,
                    vehicle_id=vehicles[0].id,
                    driver_id=driver_user.id,
                    helper_id=helper_user.id if helper_user else None,
                    route_id=routes[0].id,
                    status="ACTIVE"
                )
                db.add(assignment)
                db.commit()
                db.refresh(assignment)

                # Allocation
                alloc = models.Allocation(
                    assignment_id=assignment.id,
                    inventory_type_id=inventory_types[0].id,
                    allocated_count=60,
                    returned_full=0,
                    returned_empty=0
                )
                db.add(alloc)

                # Deduct from warehouse
                stock = db.query(models.Stock).filter(models.Stock.inventory_type_id == inventory_types[0].id).first()
                if stock:
                    stock.full_count = max(0, stock.full_count - 60)

                db.commit()
                print("Created active delivery shift assignment for Rahul Driver.")

        print("--- 7. SEEDING / ENSURING GLASS RECYCLING BASE DATA ---")
        for inv_t in ["unseparated", "white", "mixed"]:
            g_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == inv_t).first()
            if not g_inv:
                g_inv = models.GlassInventory(type=inv_t, tons=5.5 if inv_t != "unseparated" else 0.0)
                db.add(g_inv)
                db.commit()

        # Add a sample glass collection ready for godown separation
        glass_driver_user = created_users.get("GLASS_DRIVER")
        sample_col = db.query(models.GlassCollection).first()
        if not sample_col:
            col = models.GlassCollection(
                driver_id=glass_driver_user.id if glass_driver_user else None,
                vehicle="MH 12 CD 5678",
                property="Grand Ocean Hotel & Banquet",
                location="Marine Drive, Sector 2",
                phone="9899988811",
                tons_collected=3.5,
                payment_amount=1200.0,
                status="dropped_at_godown",
                date=datetime.datetime.utcnow()
            )
            db.add(col)
            db.commit()
            print("Created sample glass collection dropped at godown.")

        print("\nALL ROLES & ACCOUNTS HAVE BEEN SUCCESSFULLY INITIALIZED!")

    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_all()


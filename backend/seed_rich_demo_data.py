import datetime
import uuid
from app.database import SessionLocal, engine, Base
from app import models
from app.core.security import get_password_hash

def seed_rich_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("=== STEP 1: USERS & STAFF ===")
        users_info = [
            {"username": "admin", "name": "Rajesh Sharma", "role": "ADMIN", "phone": "9800000001", "address": "Central Admin Office"},
            {"username": "water_staff", "name": "Priya Patel", "role": "WATER_STAFF", "phone": "9800000002", "address": "Hub Dispatch Desk"},
            {"username": "water_staff_arun", "name": "Arun Nair", "role": "WATER_STAFF", "phone": "9800000009", "address": "Floor Operations Supervisor"},
            {"username": "driver_rahul", "name": "Rahul Verma", "role": "DRIVER", "phone": "9800000003", "driving_license": "DL-12201900345", "address": "Camp Area, Lane 2"},
            {"username": "driver_vikram", "name": "Vikram Shinde", "role": "DRIVER", "phone": "9800000007", "driving_license": "DL-12202100982", "address": "Kothrud Depot"},
            {"username": "helper_amit", "name": "Amit Kumar", "role": "HELPER", "phone": "9800000004", "address": "South Block, Sector 4"},
            {"username": "helper_suresh", "name": "Suresh Patil", "role": "HELPER", "phone": "9800000008", "address": "Shivaji Nagar"},
            {"username": "glass_staff", "name": "Suresh Mehta", "role": "GLASS_STAFF", "phone": "9800000005", "address": "Godown Facility A"},
            {"username": "glass_driver", "name": "Vikram Singh", "role": "GLASS_DRIVER", "phone": "9800000006", "driving_license": "DL-12202000892", "address": "Industrial Zone Gate 2"}
        ]
        created_users = {}
        for u in users_info:
            existing = db.query(models.User).filter(
                (models.User.username == u["username"]) | (models.User.phone == u["phone"])
            ).first()
            if not existing:
                existing = models.User(
                    **u,
                    hashed_password=get_password_hash("password123"),
                    is_active=True,
                    token_version=1
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
            else:
                existing.role = u["role"]
                existing.name = u["name"]
                existing.is_active = True
                db.commit()
                db.refresh(existing)
            created_users[u["username"]] = existing
        print(f"Users ready: {len(created_users)}")

        print("=== STEP 2: VEHICLES ===")
        vehicles_data = [
            {"plate_number": "MH 12 AB 1234", "model": "Tata Ace (Van 1 - Water)", "is_active": True},
            {"plate_number": "MH 12 GH 3456", "model": "Ashok Leyland Dost (Van 2 - Water)", "is_active": True},
            {"plate_number": "MH 12 EF 9012", "model": "Tata 407 (Heavy Truck - Water)", "is_active": True},
            {"plate_number": "MH 12 CD 5678", "model": "Mahindra Bolero Pickup (Glass 1)", "is_active": True},
            {"plate_number": "MH 12 IJ 7890", "model": "Eicher Pro 2049 (Glass Heavy)", "is_active": True},
        ]
        created_vehicles = {}
        for v in vehicles_data:
            existing = db.query(models.Vehicle).filter(models.Vehicle.plate_number == v["plate_number"]).first()
            if not existing:
                existing = models.Vehicle(**v)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            created_vehicles[v["plate_number"]] = existing
        print(f"Vehicles ready: {len(created_vehicles)}")

        print("=== STEP 3: ROUTES ===")
        routes_data = [
            {"name": "Downtown Commercial Zone", "area": "MG Road / City Center"},
            {"name": "Tech Corridor Zone", "area": "IT Park Phase 1 & 2"},
            {"name": "Green Valley Residential", "area": "Lake View & Hillside Road"},
            {"name": "Old City Market & Bazaar", "area": "Central Market / Wholesale Belt"},
            {"name": "Coastal Resort & Hotel Strip", "area": "Beach Road / Hospitality Hub"}
        ]
        created_routes = {}
        for r in routes_data:
            existing = db.query(models.Route).filter(models.Route.name == r["name"]).first()
            if not existing:
                existing = models.Route(**r)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            created_routes[r["name"]] = existing
        print(f"Routes ready: {len(created_routes)}")

        print("=== STEP 4: INVENTORY TYPES & STOCKS ===")
        inv_data = [
            {"name": "20L Mineral Water Jar", "price": 80.0, "wholesale_price": 65.0, "premium_price": 60.0, "points_value": 1, "full": 420, "empty": 85, "damaged": 4},
            {"name": "5L Packaged Water Bottle", "price": 35.0, "wholesale_price": 28.0, "premium_price": 25.0, "points_value": 0, "full": 180, "empty": 30, "damaged": 2},
            {"name": "Paper Cups Pack (100 pcs)", "price": 50.0, "wholesale_price": 42.0, "premium_price": 38.0, "points_value": 0, "full": 150, "empty": 0, "damaged": 0},
            {"name": "Automatic Pump Dispenser", "price": 350.0, "wholesale_price": 280.0, "premium_price": 250.0, "points_value": 5, "full": 40, "empty": 0, "damaged": 1},
        ]
        created_inv = {}
        for item in inv_data:
            existing = db.query(models.InventoryType).filter(models.InventoryType.name == item["name"]).first()
            if not existing:
                existing = models.InventoryType(
                    name=item["name"],
                    price=item["price"],
                    wholesale_price=item["wholesale_price"],
                    premium_price=item["premium_price"],
                    points_value=item["points_value"]
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
                # Stock
                stock = models.Stock(
                    inventory_type_id=existing.id,
                    full_count=item["full"],
                    empty_count=item["empty"],
                    damaged_count=item["damaged"]
                )
                db.add(stock)
                db.commit()
            else:
                stock = db.query(models.Stock).filter(models.Stock.inventory_type_id == existing.id).first()
                if stock:
                    stock.full_count = max(stock.full_count, item["full"])
                    db.commit()
            created_inv[item["name"]] = existing
        print(f"Inventory ready: {len(created_inv)}")

        print("=== STEP 5: CLIENTS ===")
        clients_data = [
            {"name": "Fresh Bites Cafe", "phone": "9811112222", "address": "Shop 4, MG Road Arcade", "tier": "Wholesale", "loyalty_points": 240, "route": "Downtown Commercial Zone", "credit_amount": 0.0},
            {"name": "Fitness First Gym", "phone": "9844445555", "address": "2nd Floor, Royal Arcade", "tier": "Standard", "loyalty_points": 80, "route": "Downtown Commercial Zone", "credit_amount": 0.0},
            {"name": "Saffron Fine Dine", "phone": "9811113333", "address": "12 High Street, MG Road", "tier": "Wholesale", "loyalty_points": 350, "route": "Downtown Commercial Zone", "credit_amount": 780.0},
            {"name": "Green Grocers Supermarket", "phone": "9811114444", "address": "Opposite Town Hall", "tier": "Standard", "loyalty_points": 45, "route": "Downtown Commercial Zone", "credit_amount": 320.0},

            {"name": "Tech Park Tower A", "phone": "9822223333", "address": "Tower A Lobby, Cyber City", "tier": "Premium", "loyalty_points": 580, "route": "Tech Corridor Zone", "credit_amount": 0.0},
            {"name": "Horizon Coworking Hub", "phone": "9822224444", "address": "3rd Floor, Innovation Tower", "tier": "Premium", "loyalty_points": 420, "route": "Tech Corridor Zone", "credit_amount": 0.0},
            {"name": "Infosys Gate 1 Canteen", "phone": "9822225555", "address": "Campus Cafeteria, Phase 2", "tier": "Wholesale", "loyalty_points": 890, "route": "Tech Corridor Zone", "credit_amount": 160.0},

            {"name": "Sunrise Apartments Society", "phone": "9833334444", "address": "Gate 2, Lake View Road", "tier": "Standard", "loyalty_points": 60, "route": "Green Valley Residential", "credit_amount": 0.0},
            {"name": "Palm Springs Villa Community", "phone": "9833335555", "address": "Clubhouse, Hillside Ave", "tier": "Standard", "loyalty_points": 110, "route": "Green Valley Residential", "credit_amount": 0.0},

            {"name": "Royal Orchid Luxury Resort", "phone": "9855551111", "address": "Beach Road, North Cliff", "tier": "Premium", "loyalty_points": 650, "route": "Coastal Resort & Hotel Strip", "credit_amount": 0.0},
            {"name": "Blue Dart Express Logistics Hub", "phone": "9866661111", "address": "Godown 18, Central Market", "tier": "Wholesale", "loyalty_points": 190, "route": "Old City Market & Bazaar", "credit_amount": 450.0},
            {"name": "City Care Heart Hospital", "phone": "9877771111", "address": "Station Link Road", "tier": "Premium", "loyalty_points": 720, "route": "Downtown Commercial Zone", "credit_amount": 0.0},
        ]
        created_clients = {}
        for c in clients_data:
            existing = db.query(models.Client).filter(models.Client.phone == c["phone"]).first()
            route_id = created_routes[c["route"]].id if c["route"] in created_routes else None
            if not existing:
                existing = models.Client(
                    name=c["name"],
                    phone=c["phone"],
                    address=c["address"],
                    tier=c["tier"],
                    loyalty_points=c["loyalty_points"],
                    opt_in_loyalty=True,
                    route_id=route_id,
                    credit_amount=c["credit_amount"]
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
            else:
                existing.route_id = route_id
                existing.tier = c["tier"]
                existing.credit_amount = c["credit_amount"]
                db.commit()
                db.refresh(existing)
            created_clients[c["name"]] = existing
        print(f"Clients ready: {len(created_clients)}")

        print("=== STEP 6: ASSIGNMENTS (WITH PETTY CASH) & DELIVERIES ===")
        jar_inv = created_inv["20L Mineral Water Jar"]
        bottle_inv = created_inv["5L Packaged Water Bottle"]
        cups_inv = created_inv["Paper Cups Pack (100 pcs)"]

        # Assignment 1: Active Run on Downtown with Rahul & Amit
        a1 = db.query(models.Assignment).filter(
            models.Assignment.driver_id == created_users["driver_rahul"].id,
            models.Assignment.status == "ACTIVE"
        ).first()

        now = datetime.datetime.utcnow()
        if not a1:
            a1 = models.Assignment(
                date=now.replace(hour=8, minute=30, second=0),
                vehicle_id=created_vehicles["MH 12 AB 1234"].id,
                driver_id=created_users["driver_rahul"].id,
                helper_id=created_users["helper_amit"].id,
                route_id=created_routes["Downtown Commercial Zone"].id,
                status="ACTIVE",
                petty_cash=500.0
            )
            db.add(a1)
            db.commit()
            db.refresh(a1)

            # Allocations
            alloc1 = models.Allocation(assignment_id=a1.id, inventory_type_id=jar_inv.id, allocated_count=65)
            alloc2 = models.Allocation(assignment_id=a1.id, inventory_type_id=bottle_inv.id, allocated_count=15)
            db.add_all([alloc1, alloc2])
            db.commit()
        else:
            a1.petty_cash = 500.0
            db.commit()

        # Add deliveries for Assignment 1 if none exist
        if len(a1.deliveries) == 0:
            # Delivery 1: Fresh Bites Cafe (UPI Verified)
            c1 = created_clients["Fresh Bites Cafe"]
            d1 = models.Delivery(
                assignment_id=a1.id,
                client_id=c1.id,
                total_amount=520.0,
                paid_amount=520.0,
                payment_method="UPI (Verified)",
                status="COMPLETED",
                upi_reference="UTR902811442019",
                verified_by="Priya Patel (water_staff)",
                verified_at=now - datetime.timedelta(hours=2)
            )
            db.add(d1)
            db.commit()
            db.refresh(d1)
            item1 = models.DeliveryItem(delivery_id=d1.id, inventory_type_id=jar_inv.id, delivered_full=8, collected_empty=8, price_charged=65.0)
            db.add(item1)

            # Delivery 2: Fitness First Gym (Cash Handover)
            c2 = created_clients["Fitness First Gym"]
            d2 = models.Delivery(
                assignment_id=a1.id,
                client_id=c2.id,
                total_amount=400.0,
                paid_amount=400.0,
                payment_method="Cash",
                status="COMPLETED"
            )
            db.add(d2)
            db.commit()
            db.refresh(d2)
            item2 = models.DeliveryItem(delivery_id=d2.id, inventory_type_id=jar_inv.id, delivered_full=5, collected_empty=5, price_charged=80.0)
            db.add(item2)

            # Delivery 3: Saffron Fine Dine (Pending Slip QR)
            c3 = created_clients["Saffron Fine Dine"]
            d3 = models.Delivery(
                assignment_id=a1.id,
                client_id=c3.id,
                total_amount=780.0,
                paid_amount=0.0,
                payment_method="Doorstep Slip QR",
                status="PENDING_PAYMENT"
            )
            db.add(d3)
            db.commit()
            db.refresh(d3)
            item3 = models.DeliveryItem(delivery_id=d3.id, inventory_type_id=jar_inv.id, delivered_full=12, collected_empty=10, price_charged=65.0)
            db.add(item3)

            # Delivery 4: Green Grocers Supermarket (Credited to account)
            c4 = created_clients["Green Grocers Supermarket"]
            d4 = models.Delivery(
                assignment_id=a1.id,
                client_id=c4.id,
                total_amount=320.0,
                paid_amount=0.0,
                payment_method="Credited / Invoice Dues",
                status="CREDITED"
            )
            db.add(d4)
            db.commit()
            db.refresh(d4)
            item4 = models.DeliveryItem(delivery_id=d4.id, inventory_type_id=jar_inv.id, delivered_full=4, collected_empty=4, price_charged=80.0)
            db.add(item4)

            # Add Trip Expenses for Shift 1
            exp1 = models.TripExpense(
                assignment_id=a1.id,
                reported_by=created_users["driver_rahul"].id,
                category="FUEL",
                amount=300.0,
                description="IOC Petrol Pump - 3.2L Diesel Refuel"
            )
            exp2 = models.TripExpense(
                assignment_id=a1.id,
                reported_by=created_users["driver_rahul"].id,
                category="TOLL",
                amount=65.0,
                description="City Bypass FastTag Toll"
            )
            db.add_all([exp1, exp2])
            db.commit()
            print("Shift 1 loaded with 4 deliveries & 2 trip expenses.")

        # Assignment 2: Active Run on Tech Corridor with Vikram & Suresh
        a2 = db.query(models.Assignment).filter(
            models.Assignment.driver_id == created_users["driver_vikram"].id,
            models.Assignment.status == "ACTIVE"
        ).first()

        if not a2:
            a2 = models.Assignment(
                date=now.replace(hour=9, minute=0, second=0),
                vehicle_id=created_vehicles["MH 12 GH 3456"].id,
                driver_id=created_users["driver_vikram"].id,
                helper_id=created_users["helper_suresh"].id,
                route_id=created_routes["Tech Corridor Zone"].id,
                status="ACTIVE",
                petty_cash=750.0
            )
            db.add(a2)
            db.commit()
            db.refresh(a2)

            alloc2_1 = models.Allocation(assignment_id=a2.id, inventory_type_id=jar_inv.id, allocated_count=80)
            db.add(alloc2_1)
            db.commit()

            # Delivery on Tech Corridor: Tech Park Tower A
            c_tp = created_clients["Tech Park Tower A"]
            d_tp = models.Delivery(
                assignment_id=a2.id,
                client_id=c_tp.id,
                total_amount=1200.0,
                paid_amount=1200.0,
                payment_method="UPI (Verified)",
                status="COMPLETED",
                upi_reference="UTR882910443912",
                verified_by="Priya Patel (water_staff)",
                verified_at=now - datetime.timedelta(hours=1)
            )
            db.add(d_tp)
            db.commit()
            db.refresh(d_tp)
            db.add(models.DeliveryItem(delivery_id=d_tp.id, inventory_type_id=jar_inv.id, delivered_full=20, collected_empty=20, price_charged=60.0))

            # Delivery on Tech Corridor: Horizon Coworking Hub
            c_hz = created_clients["Horizon Coworking Hub"]
            d_hz = models.Delivery(
                assignment_id=a2.id,
                client_id=c_hz.id,
                total_amount=900.0,
                paid_amount=900.0,
                payment_method="Cash",
                status="COMPLETED"
            )
            db.add(d_hz)
            db.commit()
            db.refresh(d_hz)
            db.add(models.DeliveryItem(delivery_id=d_hz.id, inventory_type_id=jar_inv.id, delivered_full=15, collected_empty=15, price_charged=60.0))

            # Trip expense for shift 2
            exp_v = models.TripExpense(
                assignment_id=a2.id,
                reported_by=created_users["driver_vikram"].id,
                category="FUEL",
                amount=450.0,
                description="HP Fuel Hinjewadi Phase 1"
            )
            db.add(exp_v)
            db.commit()
            print("Shift 2 loaded with 2 deliveries & 1 fuel expense.")

        print("=== STEP 7: GLASS RECYCLING DEMO DATA ===")
        # Collections
        sample_colls = [
            {
                "vehicle": "MH 12 CD 5678",
                "property": "Grand Ocean Hotel & Banquet",
                "location": "Marine Drive, Sector 2",
                "phone": "9899988811",
                "tons_collected": 3.5,
                "payment_amount": 1200.0,
                "status": "dropped_at_godown"
            },
            {
                "vehicle": "MH 12 CD 5678",
                "property": "Sunshine Beach Resort",
                "location": "North Cliff Beach Strip",
                "phone": "9899988822",
                "tons_collected": 2.8,
                "payment_amount": 950.0,
                "status": "collected" # in transit
            },
            {
                "vehicle": "MH 12 IJ 7890",
                "property": "Royal Marina Sky Lounge",
                "location": "Central Promenade, Bay 4",
                "phone": "9899988833",
                "tons_collected": 4.2,
                "payment_amount": 1500.0,
                "status": "dropped_at_godown"
            },
        ]
        glass_driver = created_users["glass_driver"]
        for gc in sample_colls:
            existing = db.query(models.GlassCollection).filter(models.GlassCollection.property == gc["property"]).first()
            if not existing:
                col = models.GlassCollection(
                    driver_id=glass_driver.id,
                    vehicle=gc["vehicle"],
                    property=gc["property"],
                    location=gc["location"],
                    phone=gc["phone"],
                    tons_collected=gc["tons_collected"],
                    payment_amount=gc["payment_amount"],
                    status=gc["status"],
                    date=now - datetime.timedelta(hours=4)
                )
                db.add(col)
                db.commit()

        # Update glass inventory balances
        inv_w = db.query(models.GlassInventory).filter(models.GlassInventory.type == "white").first()
        inv_m = db.query(models.GlassInventory).filter(models.GlassInventory.type == "mixed").first()
        if inv_w:
            inv_w.tons = 14.5
        if inv_m:
            inv_m.tons = 22.0
        db.commit()

        # Vendor pickups
        if db.query(models.GlassVendorPickup).count() == 0:
            vp1 = models.GlassVendorPickup(
                vendor_name="EcoRecycle Glass Mills Pvt Ltd",
                type="white",
                tons=8.0,
                price_per_ton=3200.0,
                date=now - datetime.timedelta(days=2)
            )
            vp2 = models.GlassVendorPickup(
                vendor_name="Maharashtra Cullet Processors",
                type="mixed",
                tons=12.0,
                price_per_ton=2400.0,
                date=now - datetime.timedelta(days=1)
            )
            db.add_all([vp1, vp2])
            db.commit()
            print("Glass vendor pickups recorded.")

        print("\nALL RICH DUMMY DATA HAS BEEN SUCCESSFULLY SEEDED!")

    except Exception as e:
        print(f"Error during rich data seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_rich_data()


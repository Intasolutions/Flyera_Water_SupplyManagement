import random
from app.database import SessionLocal, engine, Base
from app import models
from app.schemas import UserCreate, ClientCreate, VehicleCreate, InventoryTypeCreate
from app.crud import create_user, create_client, create_vehicle, create_inventory_type

def seed_database():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if we already have data
        if db.query(models.User).first():
            print("Database already seeded. Skipping...")
            return

        print("Seeding database with initial dummy data...")

        # 1. Create Users (Staff)
        users_data = [
            UserCreate(name="Admin User", role="ADMIN", phone="9998887776", password="password123", username="admin"),
            UserCreate(name="Rahul Driver", role="DRIVER", phone="9876543210", password="password123", username="rahul"),
            UserCreate(name="Vikram Driver", role="DRIVER", phone="8765432109", password="password123", username="vikram"),
            UserCreate(name="Amit Helper", role="HELPER", phone="7654321098", password="password123", username="amit"),
            UserCreate(name="Suresh Helper", role="HELPER", phone="6543210987", password="password123", username="suresh"),
        ]
        users = [create_user(db, u) for u in users_data]
        print(f"Created {len(users)} users.")

        # 2. Create Clients
        clients_data = [
            ClientCreate(name="Fresh Bites Cafe", phone="1112223334", address="MG Road, City Center", loyalty_points=120, opt_in_loyalty=True),
            ClientCreate(name="Tech Park Tower A", phone="2223334445", address="IT Park, Sector 4", loyalty_points=450, opt_in_loyalty=True),
            ClientCreate(name="Sunrise Apartments", phone="3334445556", address="Lake View Road", loyalty_points=0, opt_in_loyalty=False),
            ClientCreate(name="Fitness First Gym", phone="4445556667", address="Commercial Street", loyalty_points=85, opt_in_loyalty=True),
        ]
        clients = [create_client(db, c) for c in clients_data]
        print(f"Created {len(clients)} clients.")

        # 2.5 Create Routes
        routes_data = [
            models.Route(name="Downtown Zone", area="City Center"),
            models.Route(name="IT Corridor", area="Hinjewadi Phase 1"),
            models.Route(name="Lake View", area="Residential")
        ]
        db.add_all(routes_data)
        db.commit()
        for r in routes_data:
            db.refresh(r)
        print(f"Created {len(routes_data)} routes.")

        # Assign routes to clients
        clients[0].route_id = routes_data[0].id
        clients[1].route_id = routes_data[1].id
        clients[2].route_id = routes_data[2].id
        clients[3].route_id = routes_data[0].id
        db.commit()

        # 3. Create Vehicles
        vehicles_data = [
            VehicleCreate(plate_number="MH 12 AB 1234", model="Tata Ace", is_active=True),
            VehicleCreate(plate_number="MH 12 CD 5678", model="Mahindra Bolero", is_active=True),
            VehicleCreate(plate_number="MH 12 EF 9012", model="Tata 407", is_active=False),
        ]
        vehicles = [create_vehicle(db, v) for v in vehicles_data]
        print(f"Created {len(vehicles)} vehicles.")

        # 4. Create Inventory Types
        inventory_data = [
            InventoryTypeCreate(name="20L Mineral Water Bottle", price=80.0, points_value=1),
            InventoryTypeCreate(name="5L Water Jar", price=35.0, points_value=0),
            InventoryTypeCreate(name="Paper Cups (100 pack)", price=50.0, points_value=0),
        ]
        inventory_types = [create_inventory_type(db, i) for i in inventory_data]
        print(f"Created {len(inventory_types)} inventory items.")

        # Create some initial stock records
        for inv_type in inventory_types:
            db_stock = models.Stock(
                inventory_type_id=inv_type.id,
                full_count=random.randint(50, 500),
                empty_count=random.randint(10, 100),
                damaged_count=random.randint(0, 5)
            )
            db.add(db_stock)
        db.commit()
        print("Created initial stock levels.")

        print("Database seeded successfully!")

    except Exception as e:
        print(f"An error occurred while seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

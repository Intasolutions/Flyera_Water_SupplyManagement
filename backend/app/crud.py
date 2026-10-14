from sqlalchemy.orm import Session
from . import models, schemas

# --- Users ---
def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_phone(db: Session, phone: str):
    return db.query(models.User).filter(models.User.phone == phone).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

from app.core.security import get_password_hash

def create_user(db: Session, user: schemas.UserCreate):
    user_data = user.model_dump()
    password = user_data.pop("password")
    user_data["hashed_password"] = get_password_hash(password)
    if not user_data.get("username"):
        user_data["username"] = user_data.get("phone") # fallback username to phone if empty
        
    db_user = models.User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: str):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

def update_user(db: Session, user_id: str, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if db_user:
        update_data = user_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user


# --- Clients ---
def get_client(db: Session, client_id: str):
    return db.query(models.Client).filter(models.Client.id == client_id).first()

def get_clients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()

def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Client(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

def update_client(db: Session, client_id: str, client_update: schemas.ClientUpdate):
    db_client = get_client(db, client_id)
    if db_client:
        update_data = client_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_client, key, value)
        db.commit()
        db.refresh(db_client)
    return db_client

def delete_client(db: Session, client_id: str):
    db_client = get_client(db, client_id)
    if db_client:
        # Explicitly delete any deliveries and delivery items associated with this client
        deliveries = db.query(models.Delivery).filter(models.Delivery.client_id == client_id).all()
        for d in deliveries:
            for item in d.items:
                db.delete(item)
            db.delete(d)
        db.delete(db_client)
        db.commit()
    return db_client

# --- Vehicles ---
def get_vehicles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Vehicle).offset(skip).limit(limit).all()

def get_vehicle(db: Session, vehicle_id: str):
    return db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()

def create_vehicle(db: Session, vehicle: schemas.VehicleCreate):
    db_vehicle = models.Vehicle(**vehicle.model_dump())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

def update_vehicle(db: Session, vehicle_id: str, vehicle_update: schemas.VehicleUpdate):
    db_vehicle = get_vehicle(db, vehicle_id)
    if db_vehicle:
        update_data = vehicle_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_vehicle, key, value)
        db.commit()
        db.refresh(db_vehicle)
    return db_vehicle

def delete_vehicle(db: Session, vehicle_id: str):
    db_vehicle = get_vehicle(db, vehicle_id)
    if db_vehicle:
        db.delete(db_vehicle)
        db.commit()
    return db_vehicle

# --- Inventory Types ---
def get_inventory_types(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.InventoryType).offset(skip).limit(limit).all()

def get_inventory_type(db: Session, inv_type_id: str):
    return db.query(models.InventoryType).filter(models.InventoryType.id == inv_type_id).first()

def create_inventory_type(db: Session, inv_type: schemas.InventoryTypeCreate):
    db_inv_type = models.InventoryType(**inv_type.model_dump())
    db.add(db_inv_type)
    db.commit()
    db.refresh(db_inv_type)
    return db_inv_type

def update_inventory_type(db: Session, inv_type_id: str, inv_update: schemas.InventoryTypeUpdate):
    db_inv_type = get_inventory_type(db, inv_type_id)
    if db_inv_type:
        update_data = inv_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_inv_type, key, value)
        db.commit()
        db.refresh(db_inv_type)
    return db_inv_type

def delete_inventory_type(db: Session, inv_type_id: str):
    db_inv_type = get_inventory_type(db, inv_type_id)
    if db_inv_type:
        for stock in list(db_inv_type.stocks):
            db.delete(stock)
        for alloc in list(db_inv_type.allocations):
            db.delete(alloc)
        for ditem in list(db_inv_type.delivery_items):
            db.delete(ditem)
        db.delete(db_inv_type)
        db.commit()
    return db_inv_type

def adjust_inventory_stock(db: Session, inv_type_id: str, stock_adj: schemas.StockAdjust):
    inv_type = get_inventory_type(db, inv_type_id)
    if not inv_type:
        return None
        
    stock = db.query(models.Stock).filter(models.Stock.inventory_type_id == inv_type_id).first()
    if not stock:
        stock = models.Stock(
            inventory_type_id=inv_type_id,
            full_count=0,
            empty_count=0,
            damaged_count=0
        )
        db.add(stock)
        
    stock.full_count = (stock.full_count or 0) + stock_adj.add_full
    stock.empty_count = (stock.empty_count or 0) + stock_adj.add_empty
    stock.damaged_count = (stock.damaged_count or 0) + stock_adj.add_damaged
    
    db.commit()
    db.refresh(inv_type)
    return inv_type

# --- Routes ---
def get_route(db: Session, route_id: str):
    return db.query(models.Route).filter(models.Route.id == route_id).first()

def get_routes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Route).offset(skip).limit(limit).all()

def create_route(db: Session, route: schemas.RouteCreate):
    db_route = models.Route(**route.model_dump())
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    return db_route

def update_route(db: Session, route_id: str, route_update: schemas.RouteUpdate):
    db_route = get_route(db, route_id)
    if db_route:
        for key, value in route_update.model_dump(exclude_unset=True).items():
            setattr(db_route, key, value)
        db.commit()
        db.refresh(db_route)
    return db_route

def delete_route(db: Session, route_id: str):
    db_route = get_route(db, route_id)
    if db_route:
        db.delete(db_route)
        db.commit()
    return db_route

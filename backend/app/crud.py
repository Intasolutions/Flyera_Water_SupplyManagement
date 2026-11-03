from typing import Optional

from sqlalchemy.orm import Session, selectinload
from . import models, schemas
from .database import Base


class InsufficientStockError(ValueError):
    """A stock change would take a warehouse count below zero."""


def _paged(query, skip: int = 0, limit: Optional[int] = None):
    query = query.offset(skip)
    return query.limit(limit) if limit else query

# --- Users ---
def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_phone(db: Session, phone: str):
    return db.query(models.User).filter(models.User.phone == phone).first()

def get_users(db: Session, skip: int = 0, limit: Optional[int] = None):
    return _paged(db.query(models.User).order_by(models.User.created_at.asc()), skip, limit).all()

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

def user_has_history(db: Session, user_id: str) -> bool:
    """True when business records point at this user, so the account must be kept."""
    checks = [
        db.query(models.Assignment.id).filter(
            (models.Assignment.driver_id == user_id) | (models.Assignment.helper_id == user_id)
        ),
        db.query(models.TripExpense.id).filter(models.TripExpense.reported_by == user_id),
        db.query(models.GlassCollection.id).filter(models.GlassCollection.driver_id == user_id),
        db.query(models.GlassSeparation.id).filter(models.GlassSeparation.staff_id == user_id),
    ]
    return any(query.first() is not None for query in checks)

def deactivate_user(db: Session, db_user: models.User):
    db_user.is_active = False
    db_user.token_version = (db_user.token_version or 1) + 1
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, db_user: models.User):
    db.delete(db_user)
    db.commit()

def update_user(db: Session, user_id: str, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if db_user:
        update_data = user_update.model_dump(exclude_unset=True)
        password = update_data.pop("password", None)
        if password:
            db_user.hashed_password = get_password_hash(password)
        if password or update_data.get("is_active") is False:
            # Existing sessions end when the password changes or the account is switched off.
            db_user.token_version = (db_user.token_version or 1) + 1
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user


# --- Clients ---
def get_client(db: Session, client_id: str):
    return db.query(models.Client).filter(models.Client.id == client_id).first()

def get_clients(db: Session, skip: int = 0, limit: Optional[int] = None):
    query = (
        db.query(models.Client)
        .options(selectinload(models.Client.bottle_credits))
        .order_by(models.Client.created_at.asc())
    )
    return _paged(query, skip, limit).all()

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

def client_has_history(db: Session, client_id: str) -> bool:
    return db.query(models.Delivery.id).filter(models.Delivery.client_id == client_id).first() is not None

def delete_client(db: Session, db_client: models.Client):
    db.delete(db_client)
    db.commit()

# --- Vehicles ---
def get_vehicles(db: Session, skip: int = 0, limit: Optional[int] = None):
    return _paged(db.query(models.Vehicle).order_by(models.Vehicle.created_at.asc()), skip, limit).all()

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
def get_inventory_types(db: Session, skip: int = 0, limit: Optional[int] = None):
    return _paged(db.query(models.InventoryType).order_by(models.InventoryType.created_at.asc()), skip, limit).all()

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

def inventory_type_has_history(db: Session, inv_type_id: str) -> bool:
    checks = [
        db.query(models.Allocation.id).filter(models.Allocation.inventory_type_id == inv_type_id),
        db.query(models.DeliveryItem.id).filter(models.DeliveryItem.inventory_type_id == inv_type_id),
        db.query(models.BottleCreditLedger.id).filter(models.BottleCreditLedger.inventory_type_id == inv_type_id),
    ]
    return any(query.first() is not None for query in checks)

def delete_inventory_type(db: Session, db_inv_type: models.InventoryType):
    db.delete(db_inv_type)
    db.commit()

def adjust_inventory_stock(db: Session, inv_type_id: str, stock_adj: schemas.StockAdjust, commit: bool = True):
    """Applies a stock change, refusing any that would take a count below zero.

    Pass commit=False when this is one step of a larger change, so all of it saves or none of it does.
    """
    inv_type = get_inventory_type(db, inv_type_id)
    if not inv_type:
        return None

    stock = (
        db.query(models.Stock)
        .filter(models.Stock.inventory_type_id == inv_type_id)
        .with_for_update()
        .first()
    )
    if not stock:
        stock = models.Stock(
            inventory_type_id=inv_type_id,
            full_count=0,
            empty_count=0,
            damaged_count=0
        )
        db.add(stock)

    for label, field, change in (
        ("full", "full_count", stock_adj.add_full),
        ("empty", "empty_count", stock_adj.add_empty),
        ("damaged", "damaged_count", stock_adj.add_damaged),
    ):
        current = getattr(stock, field) or 0
        if change < 0 and current + change < 0:
            raise InsufficientStockError(
                f"Not enough {label} stock of {inv_type.name}: {current} available, {-change} needed."
            )
        setattr(stock, field, current + change)

    if commit:
        db.commit()
        db.refresh(inv_type)
    else:
        db.flush()
    return inv_type

# --- Routes ---
def get_route(db: Session, route_id: str):
    return db.query(models.Route).filter(models.Route.id == route_id).first()

def get_routes(db: Session, skip: int = 0, limit: Optional[int] = None, business_type: str = "WATER"):
    query = db.query(models.Route).filter(models.Route.business_type == business_type).order_by(models.Route.created_at.asc())
    return _paged(query, skip, limit).all()

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

def route_in_use(db: Session, route_id: str) -> bool:
    checks = [
        db.query(models.Client.id).filter(models.Client.route_id == route_id),
        db.query(models.Assignment.id).filter(models.Assignment.route_id == route_id),
        db.query(models.GlassProperty.id).filter(models.GlassProperty.route_id == route_id),
    ]
    return any(query.first() is not None for query in checks)

def delete_route(db: Session, route_id: str):
    db_route = get_route(db, route_id)
    if db_route:
        db.delete(db_route)
        db.commit()
    return db_route

# --- Full Reset ---
def wipe_all_data(db: Session):
    """Deletes every row, children before parents. The caller commits."""
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())

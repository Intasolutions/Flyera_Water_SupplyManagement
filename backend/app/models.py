import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True) # Used for login
    hashed_password = Column(String, nullable=False, default="unhashed") 
    role = Column(String, nullable=False) # "ADMIN", "WATER_STAFF", "GLASS_STAFF", "DRIVER", "HELPER"
    phone = Column(String, unique=True, nullable=True)
    address = Column(String, nullable=True)
    id_proof_url = Column(String, nullable=True)
    assigned_vehicle_id = Column(String, nullable=True)
    driving_license = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    token_version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    driver_assignments = relationship("Assignment", foreign_keys="[Assignment.driver_id]", back_populates="driver")
    helper_assignments = relationship("Assignment", foreign_keys="[Assignment.helper_id]", back_populates="helper")

class Route(Base):
    __tablename__ = "routes"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    area = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clients = relationship("Client", back_populates="route")
    assignments = relationship("Assignment", back_populates="route")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    tier = Column(String, default="Standard") # Standard, Premium, etc.
    loyalty_points = Column(Integer, default=0)
    opt_in_loyalty = Column(Boolean, default=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    route_id = Column(String, ForeignKey("routes.id"), nullable=True, index=True)
    credit_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    route = relationship("Route", back_populates="clients")
    deliveries = relationship("Delivery", back_populates="client", cascade="all, delete-orphan")
    bottle_credits = relationship("BottleCreditLedger", back_populates="client", cascade="all, delete-orphan")

    @property
    def bottle_balance(self) -> int:
        return sum((b.quantity or 0) for b in self.bottle_credits)

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    plate_number = Column(String, unique=True, nullable=False)
    model = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments = relationship("Assignment", back_populates="vehicle")

class InventoryType(Base):
    __tablename__ = "inventory_types"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    wholesale_price = Column(Float, nullable=False, default=65.0)
    premium_price = Column(Float, nullable=False, default=60.0)
    points_value = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stocks = relationship("Stock", back_populates="inventory_type", cascade="all, delete-orphan")
    allocations = relationship("Allocation", back_populates="inventory_type", cascade="all, delete-orphan")
    delivery_items = relationship("DeliveryItem", back_populates="inventory_type", cascade="all, delete-orphan")
    bottle_credits = relationship("BottleCreditLedger", back_populates="inventory_type")

    @property
    def full(self):
        return sum((s.full_count or 0) for s in self.stocks)
        
    @property
    def empty(self):
        return sum((s.empty_count or 0) for s in self.stocks)
        
    @property
    def damaged(self):
        return sum((s.damaged_count or 0) for s in self.stocks)

class Stock(Base):
    __tablename__ = "stocks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    inventory_type_id = Column(String, ForeignKey("inventory_types.id"), nullable=False)
    full_count = Column(Integer, default=0)
    empty_count = Column(Integer, default=0)
    damaged_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventory_type = relationship("InventoryType", back_populates="stocks")

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    date = Column(DateTime, nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.id"), nullable=False, index=True)
    driver_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    helper_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    route_id = Column(String, ForeignKey("routes.id"), nullable=True, index=True)
    status = Column(String, default="PENDING", index=True)
    petty_cash = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="assignments")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="driver_assignments")
    helper = relationship("User", foreign_keys=[helper_id], back_populates="helper_assignments")
    route = relationship("Route", back_populates="assignments")
    
    allocations = relationship("Allocation", back_populates="assignment", cascade="all, delete-orphan")
    deliveries = relationship("Delivery", back_populates="assignment", cascade="all, delete-orphan")
    expenses = relationship("TripExpense", back_populates="assignment", cascade="all, delete-orphan")

    @property
    def deliveries_count(self) -> int:
        return len(self.deliveries)

class Allocation(Base):
    __tablename__ = "allocations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False, index=True)
    inventory_type_id = Column(String, ForeignKey("inventory_types.id"), nullable=False, index=True)
    allocated_count = Column(Integer, nullable=False)
    returned_full = Column(Integer, default=0)
    returned_empty = Column(Integer, default=0)
    
    assignment = relationship("Assignment", back_populates="allocations")
    inventory_type = relationship("InventoryType", back_populates="allocations")

class Delivery(Base):
    __tablename__ = "deliveries"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False, index=True)
    total_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0.0)
    payment_method = Column(String, nullable=True)
    status = Column(String, default="COMPLETED", index=True) # "COMPLETED", "PARTIAL_PAID", "PENDING_PAYMENT", "CREDITED", "SKIPPED"
    upi_reference = Column(String, nullable=True, index=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    assignment = relationship("Assignment", back_populates="deliveries")
    client = relationship("Client", back_populates="deliveries")
    items = relationship("DeliveryItem", back_populates="delivery", cascade="all, delete-orphan")

class DeliveryItem(Base):
    __tablename__ = "delivery_items"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    delivery_id = Column(String, ForeignKey("deliveries.id"), nullable=False, index=True)
    inventory_type_id = Column(String, ForeignKey("inventory_types.id"), nullable=False, index=True)
    delivered_full = Column(Integer, nullable=False)
    collected_empty = Column(Integer, nullable=False)
    price_charged = Column(Float, nullable=False)
    
    delivery = relationship("Delivery", back_populates="items")
    inventory_type = relationship("InventoryType", back_populates="delivery_items")

# --- Glass Business Models ---

class GlassInventory(Base):
    __tablename__ = "glass_inventory"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String, nullable=False, unique=True) # "white", "mixed", "unseparated"
    tons = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GlassCollection(Base):
    __tablename__ = "glass_collections"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    driver_id = Column(String, ForeignKey("users.id"), nullable=True)
    vehicle = Column(String, nullable=False)
    property = Column(String, nullable=False)
    location = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    phone = Column(String, nullable=True)
    tons_collected = Column(Float, nullable=False)
    payment_amount = Column(Float, default=0.0)
    status = Column(String, default="collected") # "collected", "dropped_at_godown", "separated"
    date = Column(DateTime, default=datetime.utcnow)
    
    driver = relationship("User", foreign_keys=[driver_id])

class GlassSeparation(Base):
    __tablename__ = "glass_separations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("users.id"), nullable=True)
    collection_id = Column(String, ForeignKey("glass_collections.id"), nullable=True) # Optional, can separate bulk
    tons_separated = Column(Float, nullable=False)
    white_tons = Column(Float, nullable=False)
    mixed_tons = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("User", foreign_keys=[staff_id])
    collection = relationship("GlassCollection")

class GlassVendorPickup(Base):
    __tablename__ = "glass_vendor_pickups"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    vendor_name = Column(String, nullable=False)
    type = Column(String, nullable=False) # "white" or "mixed"
    tons = Column(Float, nullable=False)
    price_per_ton = Column(Float, nullable=False, default=0.0)
    date = Column(DateTime, default=datetime.utcnow)

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --- Trip Expenses ---

class TripExpense(Base):
    """Per-trip expense entries logged by driver or helper during a shift."""
    __tablename__ = "trip_expenses"

    id = Column(String, primary_key=True, default=generate_uuid)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False)
    reported_by = Column(String, ForeignKey("users.id"), nullable=True)
    # Category: FUEL | TOLL | PARKING | MAINTENANCE | OTHER
    category = Column(String, nullable=False, default="OTHER")
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="expenses")
    reporter = relationship("User", foreign_keys=[reported_by])


# --- Bottle Credit Ledger ---

class BottleCreditLedger(Base):
    """Per-customer bottle credit/debit ledger.

    quantity > 0  → we owe the customer bottles (e.g. advance booking, partial delivery)
    quantity < 0  → customer owes us bottles (delivered but not paid/acknowledged)
    """
    __tablename__ = "bottle_credit_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=True)
    inventory_type_id = Column(String, ForeignKey("inventory_types.id"), nullable=False)
    quantity = Column(Integer, nullable=False)  # +ve = owed to customer, -ve = customer owes
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="bottle_credits")
    assignment = relationship("Assignment")
    inventory_type = relationship("InventoryType")


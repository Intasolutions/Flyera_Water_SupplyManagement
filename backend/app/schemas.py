from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Optional[Dict[str, Any]] = None
    
class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    token_type: Optional[str] = "access" # "access" or "refresh"
    token_version: Optional[int] = 1
    exp: Optional[int] = None
    iat: Optional[int] = None

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    username: Optional[str] = None
    role: str
    # Validate phone to be 10 digits
    phone: Optional[str] = None
    address: Optional[str] = None
    id_proof_url: Optional[str] = None
    assigned_vehicle_id: Optional[str] = None
    driving_license: Optional[str] = None
    is_active: Optional[bool] = True
    token_version: Optional[int] = 1

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    id_proof_url: Optional[str] = None
    assigned_vehicle_id: Optional[str] = None
    driving_license: Optional[str] = None
    is_active: Optional[bool] = None
    token_version: Optional[int] = None

class UserResponse(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    id_proof_url: Optional[str] = None
    assigned_vehicle_id: Optional[str] = None
    driving_license: Optional[str] = None
    is_active: Optional[bool] = True
    token_version: Optional[int] = 1
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Route Schemas ---
class RouteBase(BaseModel):
    name: str
    area: Optional[str] = None

class RouteCreate(RouteBase):
    pass

class RouteUpdate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Client Schemas ---
class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    tier: str = "Standard"
    loyalty_points: int = 0
    opt_in_loyalty: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    route_id: Optional[str] = None
    credit_amount: float = 0.0

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tier: Optional[str] = None
    loyalty_points: Optional[int] = None
    opt_in_loyalty: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    route_id: Optional[str] = None
    credit_amount: Optional[float] = None

class ClientResponse(ClientBase):
    id: str
    bottle_balance: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ClientCreditAdjustRequest(BaseModel):
    amount: float
    type: str = "SET" # "SET" | "ADD" | "DEDUCT"
    notes: Optional[str] = None

# --- Vehicle Schemas ---
class VehicleBase(BaseModel):
    plate_number: str
    model: Optional[str] = None
    is_active: bool = True

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(VehicleBase):
    pass

class VehicleResponse(VehicleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- InventoryType Schemas ---
class InventoryTypeBase(BaseModel):
    name: str
    price: float
    wholesale_price: float = 65.0
    premium_price: float = 60.0
    points_value: int = 1

class InventoryTypeCreate(InventoryTypeBase):
    pass

class InventoryTypeUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    wholesale_price: Optional[float] = None
    premium_price: Optional[float] = None
    points_value: Optional[int] = None

class InventoryTypeResponse(InventoryTypeBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    full: int = 0
    empty: int = 0
    damaged: int = 0

    class Config:
        from_attributes = True

class StockAdjust(BaseModel):
    add_full: int = 0
    add_empty: int = 0
    add_damaged: int = 0

# --- Stock Schemas ---
class StockBase(BaseModel):
    inventory_type_id: str
    full_count: int = 0
    empty_count: int = 0
    damaged_count: int = 0

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    id: str
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Allocation Schemas ---
class AllocationBase(BaseModel):
    inventory_type_id: str
    allocated_count: int
    returned_full: int = 0
    returned_empty: int = 0

class AllocationCreate(AllocationBase):
    pass

class AllocationResponse(AllocationBase):
    id: str
    assignment_id: str

    class Config:
        from_attributes = True

# --- Assignment Schemas ---
class AssignmentBase(BaseModel):
    date: datetime
    vehicle_id: str
    driver_id: str
    helper_id: Optional[str] = None
    route_id: Optional[str] = None
    status: str = "PENDING"
    petty_cash: float = 0.0

class AssignmentCreate(AssignmentBase):
    allocations: List[AllocationCreate] = []

class AssignmentUpdate(BaseModel):
    date: Optional[datetime] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    helper_id: Optional[str] = None
    route_id: Optional[str] = None
    status: Optional[str] = None
    allocations: Optional[List[AllocationCreate]] = None
    petty_cash: Optional[float] = None

class AssignmentResponse(AssignmentBase):
    id: str
    created_at: datetime
    updated_at: datetime
    allocations: List[AllocationResponse] = []
    deliveries_count: int = 0
    deliveries: List['DeliveryResponse'] = []
    expenses: List['TripExpenseResponse'] = []
    total_expense: float = 0.0

    class Config:
        from_attributes = True

    def model_post_init(self, __context: Any) -> None:
        # Auto-compute total_expense from expenses list
        if self.expenses:
            object.__setattr__(self, 'total_expense', sum(e.amount for e in self.expenses))

# --- DeliveryItem Schemas ---
class DeliveryItemBase(BaseModel):
    inventory_type_id: str
    delivered_full: int
    collected_empty: int
    price_charged: float

class DeliveryItemCreate(DeliveryItemBase):
    pass

class DeliveryItemResponse(DeliveryItemBase):
    id: str
    delivery_id: str

    class Config:
        from_attributes = True

# --- Delivery Schemas ---
class DeliveryBase(BaseModel):
    assignment_id: str
    client_id: str
    total_amount: float = 0
    paid_amount: float = 0.0
    payment_method: Optional[str] = None
    status: str = "COMPLETED"

class DeliveryCreate(DeliveryBase):
    items: List[DeliveryItemCreate] = []

class DeliveryResponse(DeliveryBase):
    id: str
    created_at: datetime
    upi_reference: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None
    items: List[DeliveryItemResponse] = []

    class Config:
        from_attributes = True

class DeliveryVerifyRequest(BaseModel):
    action: str # "VERIFY_PAID" | "MARK_CREDITED"
    amount_paid: Optional[float] = None
    upi_reference: Optional[str] = None
    notes: Optional[str] = None
    payment_mode: Optional[str] = "UPI"

# --- Glass Business Schemas ---

class GlassInventoryBase(BaseModel):
    type: str
    tons: float = 0.0

class GlassInventoryResponse(GlassInventoryBase):
    id: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

class GlassCollectionBase(BaseModel):
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle: str
    property: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    tons_collected: float
    payment_amount: float = 0.0

class GlassCollectionCreate(GlassCollectionBase):
    pass

class GlassCollectionUpdateStatus(BaseModel):
    status: str

class GlassDropoffAllRequest(BaseModel):
    driver_id: Optional[str] = None

class GlassCollectionResponse(GlassCollectionBase):
    id: str
    status: str
    date: datetime
    
    class Config:
        from_attributes = True

class GlassSeparationBase(BaseModel):
    staff_id: Optional[str] = None
    collection_id: Optional[str] = None
    tons_separated: float
    white_tons: float
    mixed_tons: float

class GlassSeparationCreate(GlassSeparationBase):
    pass

class GlassSeparationResponse(GlassSeparationBase):
    id: str
    date: datetime
    
    class Config:
        from_attributes = True

class GlassVendorPickupBase(BaseModel):
    vendor_name: str
    type: str
    tons: float
    price_per_ton: float = 0.0

class GlassVendorPickupCreate(GlassVendorPickupBase):
    pass

class GlassVendorPickupResponse(GlassVendorPickupBase):
    id: str
    date: datetime
    
    class Config:
        from_attributes = True

# --- Trip Expense Schemas ---

class TripExpenseCreate(BaseModel):
    assignment_id: str
    category: str  # FUEL | TOLL | PARKING | MAINTENANCE | OTHER
    amount: float
    paid_from_inhand: bool = True
    inhand_amount: float = 0.0
    description: Optional[str] = None
    # reported_by is set server-side from auth token

class TripExpenseResponse(BaseModel):
    id: str
    assignment_id: str
    reported_by: Optional[str] = None
    reporter_name: Optional[str] = None
    category: str
    amount: float
    paid_from_inhand: bool = True
    inhand_amount: float = 0.0
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Bottle Credit Ledger Schemas ---

class BottleCreditCreate(BaseModel):
    quantity: int           # +ve = owed to customer, -ve = customer owes us
    inventory_type_id: str
    assignment_id: Optional[str] = None
    notes: Optional[str] = None

class BottleCreditResponse(BaseModel):
    id: str
    client_id: str
    assignment_id: Optional[str] = None
    inventory_type_id: str
    inventory_name: Optional[str] = None
    quantity: int
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


AssignmentResponse.model_rebuild()



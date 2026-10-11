from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    username: Optional[str] = None
    role: str
    # Validate phone to be 8-15 digits, optionally starting with +
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{8,15}$")
    address: Optional[str] = None
    id_proof_url: Optional[str] = None
    assigned_vehicle_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    pass

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

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

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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

class InventoryTypeUpdate(InventoryTypeBase):
    pass

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

class AssignmentCreate(AssignmentBase):
    allocations: List[AllocationCreate] = []

class AssignmentUpdate(BaseModel):
    status: Optional[str] = None
    helper_id: Optional[str] = None

class AssignmentResponse(AssignmentBase):
    id: str
    created_at: datetime
    updated_at: datetime
    allocations: List[AllocationResponse] = []
    deliveries_count: int = 0
    deliveries: List['DeliveryResponse'] = []

    class Config:
        from_attributes = True

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
    payment_method: Optional[str] = None
    status: str = "COMPLETED"

class DeliveryCreate(DeliveryBase):
    items: List[DeliveryItemCreate] = []

class DeliveryResponse(DeliveryBase):
    id: str
    created_at: datetime
    items: List[DeliveryItemResponse] = []

    class Config:
        from_attributes = True

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

AssignmentResponse.model_rebuild()

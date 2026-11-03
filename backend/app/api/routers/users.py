import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, schemas, models
from app.core.config import UPLOADS_DIR
from app.database import get_db
from app.api import deps

router = APIRouter()

admin_only = deps.require_roles([])
staff_records = deps.require_roles(deps.WATER_OFFICE)

ALLOWED_UPLOAD_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _content_matches_extension(ext: str, head: bytes) -> bool:
    if ext in (".jpg", ".jpeg"):
        return head.startswith(b"\xff\xd8\xff")
    if ext == ".png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == ".webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return head.startswith(b"%PDF")


@router.post("/upload-id")
def upload_id_proof(
    file: UploadFile = File(...),
    current_user: models.User = Depends(admin_only)
):
    raw_name = file.filename or "upload.jpg"
    ext = ("." + raw_name.rsplit(".", 1)[-1].lower()) if "." in raw_name else ""
    if ext not in ALLOWED_UPLOAD_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed formats: {', '.join(sorted(ALLOWED_UPLOAD_EXTS))}"
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large. The limit is 5 MB.")
    if not _content_matches_extension(ext, content[:16]):
        raise HTTPException(status_code=400, detail="The file content does not match its type.")

    # Cryptographically random safe filename to eliminate directory traversal attacks
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / safe_filename).write_bytes(content)
    return {"url": f"/api/users/uploads/{safe_filename}"}


@router.get("/uploads/{filename}")
def get_upload(
    filename: str,
    current_user: models.User = Depends(staff_records)
):
    path = (UPLOADS_DIR / filename).resolve()
    if path.parent != UPLOADS_DIR.resolve() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, headers={"X-Content-Type-Options": "nosniff"})


def _visible_user(user: models.User, viewer: models.User):
    """Office staff see full records. Everyone else sees names and work contact details only."""
    if deps.is_admin(viewer) or viewer.role in deps.WATER_OFFICE or viewer.id == user.id:
        return user
    return schemas.UserResponse(id=user.id, name=user.name, role=user.role, phone=user.phone, is_active=user.is_active)


def _ensure_unique_login(db: Session, username: Optional[str], phone: Optional[str], user_id: Optional[str] = None) -> None:
    if phone:
        existing = crud.get_user_by_phone(db, phone=phone)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Mobile number already registered")
    if username:
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Username already taken")


def _ensure_not_last_admin(db: Session, user: models.User) -> None:
    if user.role not in deps.ADMIN_ROLES:
        return
    other_admins = db.query(models.User).filter(
        models.User.role.in_(deps.ADMIN_ROLES),
        models.User.is_active.is_not(False),
        models.User.id != user.id,
    ).count()
    if other_admins == 0:
        raise HTTPException(status_code=400, detail="This is the only active administrator, so it cannot be removed or changed.")


@router.post("", response_model=schemas.UserResponse, include_in_schema=False)
@router.post("/", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    _ensure_unique_login(db, user.username, user.phone)
    return crud.create_user(db=db, user=user)


@router.get("", response_model=List[schemas.UserResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.UserResponse])
def read_users(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    return [_visible_user(user, current_user) for user in crud.get_users(db, skip=skip, limit=limit)]


@router.get("/{user_id}", response_model=schemas.UserResponse)
def read_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _visible_user(db_user, current_user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account.")
    _ensure_not_last_admin(db, db_user)

    # People with work history stay on record, so their deliveries and revenue are never lost.
    if crud.user_has_history(db, user_id):
        crud.deactivate_user(db, db_user)
        return {"message": f"{db_user.name} has work history, so the account was deactivated instead of deleted."}

    crud.delete_user(db, db_user)
    return {"message": "User deleted successfully"}


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: str,
    user: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _ensure_unique_login(db, user.username, user.phone, user_id=user_id)

    losing_admin = user.role is not None and user.role not in deps.ADMIN_ROLES
    if losing_admin or user.is_active is False:
        _ensure_not_last_admin(db, db_user)

    return crud.update_user(db=db, user_id=user_id, user_update=user)

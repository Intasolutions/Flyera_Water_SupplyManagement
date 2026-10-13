import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas
from app.database import get_db

router = APIRouter()

@router.post("/upload-id")
def upload_id_proof(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    return {"url": f"/api/users/uploads/{file.filename}"}

@router.get("/uploads/{filename}")
def get_upload(filename: str):
    file_path = f"uploads/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

def _ensure_user_columns(db: Session):
    try:
        from sqlalchemy import text
        for col in ["is_active BOOLEAN DEFAULT 1", "token_version INTEGER DEFAULT 1", "driving_license VARCHAR"]:
            try:
                db.execute(text(f"ALTER TABLE users ADD COLUMN {col}"))
                db.commit()
            except Exception:
                db.rollback()
    except Exception:
        pass

@router.post("", response_model=schemas.UserResponse, include_in_schema=False)
@router.post("/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.phone:
        try:
            existing_user = crud.get_user_by_phone(db, phone=user.phone)
        except Exception as e:
            if "driving_license" in str(e) or "no such column" in str(e):
                _ensure_user_columns(db)
                existing_user = crud.get_user_by_phone(db, phone=user.phone)
            else:
                raise e
        if existing_user:
            raise HTTPException(status_code=400, detail="Mobile number already registered")
    try:
        return crud.create_user(db=db, user=user)
    except Exception as e:
        if "driving_license" in str(e) or "no such column" in str(e):
            _ensure_user_columns(db)
            return crud.create_user(db=db, user=user)
        raise e

@router.get("", response_model=List[schemas.UserResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        users = crud.get_users(db, skip=skip, limit=limit)
        return users
    except Exception as e:
        if "driving_license" in str(e) or "no such column" in str(e):
            _ensure_user_columns(db)
            return crud.get_users(db, skip=skip, limit=limit)
        raise e

@router.get("/{user_id}", response_model=schemas.UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db)):
    try:
        db_user = crud.get_user(db, user_id=user_id)
    except Exception as e:
        if "driving_license" in str(e) or "no such column" in str(e):
            _ensure_user_columns(db)
            db_user = crud.get_user(db, user_id=user_id)
        else:
            raise e
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    crud.delete_user(db=db, user_id=user_id)
    return {"message": "User deleted successfully"}

@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: str, user: schemas.UserUpdate, db: Session = Depends(get_db)):
    try:
        db_user = crud.get_user(db, user_id=user_id)
    except Exception as e:
        if "driving_license" in str(e) or "no such column" in str(e):
            _ensure_user_columns(db)
            db_user = crud.get_user(db, user_id=user_id)
        else:
            raise e
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.phone and user.phone != db_user.phone:
        existing_user = crud.get_user_by_phone(db, phone=user.phone)
        if existing_user:
            raise HTTPException(status_code=400, detail="Mobile number already registered")
            
    try:
        return crud.update_user(db=db, user_id=user_id, user_update=user)
    except Exception as e:
        if "driving_license" in str(e) or "no such column" in str(e):
            _ensure_user_columns(db)
            return crud.update_user(db=db, user_id=user_id, user_update=user)
        raise e

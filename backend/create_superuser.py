
#!/usr/bin/env python3
"""
CLI Command to create or reset a Super User / Administrator in Aqua & Glass.
Usage:
  Interactive:
    python create_superuser.py

  With CLI Arguments:
    python create_superuser.py --username admin --password secretpassword --name "Super Admin" --role ADMIN
"""

import sys
import os
import argparse
import getpass

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.core import security

def create_or_update_superuser(username, password, name="Super Admin", phone=None, role="ADMIN"):
    db = SessionLocal()
    try:
        username = username.strip().lower()
        user = db.query(models.User).filter(func_lower(models.User.username) == username).first()

        hashed_pw = security.get_password_hash(password)

        if user:
            print(f"\n[!] User '{username}' already exists. Updating credentials and elevating to {role}...")
            user.hashed_password = hashed_pw
            user.role = role
            user.name = name or user.name
            user.is_active = True
            if phone:
                user.phone = phone
            db.commit()
            print(f"[OK] Successfully updated user '{username}' to {role} with the new password.")
        else:
            new_user = models.User(
                username=username,
                hashed_password=hashed_pw,
                name=name or "Super Admin",
                phone=phone,
                role=role,
                is_active=True,
                token_version=1
            )
            db.add(new_user)
            db.commit()
            print(f"\n[OK] Super User created successfully!")
            print(f"    - Username: {username}")
            print(f"    - Name:     {new_user.name}")
            print(f"    - Role:     {new_user.role}")

    except Exception as e:
        db.rollback()
        print(f"[X] Error creating superuser: {e}")
        sys.exit(1)
    finally:
        db.close()

def func_lower(col):
    from sqlalchemy import func
    return func.lower(col)

def main():
    parser = argparse.ArgumentParser(description="Create or reset an Admin / Superuser for the platform.")
    parser.add_argument("-u", "--username", help="Superuser username")
    parser.add_argument("-p", "--password", help="Superuser password")
    parser.add_argument("-n", "--name", default="Super Admin", help="Full name of the user")
    parser.add_argument("--phone", default=None, help="Contact phone number (optional)")
    parser.add_argument("-r", "--role", default="ADMIN", choices=["ADMIN", "Owner"], help="Role (ADMIN or Owner)")

    args = parser.parse_args()

    username = args.username
    password = args.password
    name = args.name
    phone = args.phone
    role = args.role

    # Interactive prompt if username or password not provided
    if not username:
        print("=" * 50)
        print("  Aqua & Glass Platform - Create Super User")
        print("=" * 50)
        default_user = "admin"
        val = input(f"Enter username [{default_user}]: ").strip()
        username = val if val else default_user

    if not password:
        password = getpass.getpass("Enter password: ").strip()
        if not password:
            print("[X] Password cannot be empty.")
            sys.exit(1)
        confirm_password = getpass.getpass("Confirm password: ").strip()
        if password != confirm_password:
            print("[X] Passwords do not match.")
            sys.exit(1)

    create_or_update_superuser(
        username=username,
        password=password,
        name=name,
        phone=phone,
        role=role
    )

if __name__ == "__main__":
    main()

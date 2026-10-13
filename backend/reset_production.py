#!/usr/bin/env python3
"""
Production Database Reset & Superuser Creation Tool
---------------------------------------------------
This script wipes 100% of all data from the database and initializes a fresh
superuser (ADMIN role) for production launch.

Usage:
    python reset_production.py
"""

import sys
import getpass
from app.database import SessionLocal, Base, engine
from app import models
from app.core import security

def reset_and_create_superuser():
    print("=" * 65)
    print("  FLYERA LOGISTICS - PRODUCTION DATABASE INITIALIZATION TOOL")
    print("=" * 65)
    print("\nWARNING: This will permanently delete ALL data:")
    print("  - All clients and route records")
    print("  - All vehicles and allocations")
    print("  - All deliveries, items, and payments")
    print("  - All inventory and stock counts")
    print("  - All glass collections, separations, and pickups")
    print("  - All staff accounts")
    print("\nOnly your newly created Superuser will remain.\n")

    confirm = input("Are you SURE you want to proceed? Type 'WIPE' to confirm: ").strip()
    if confirm != "WIPE":
        print("\nAborted. No changes were made to the database.")
        sys.exit(0)

    print("\n--- Enter New Production Superuser Details ---")
    name = input("Superuser Full Name (e.g. Akash - Owner): ").strip()
    while not name:
        name = input("Full Name cannot be empty: ").strip()

    username = input("Superuser Login Username (e.g. admin): ").strip()
    while len(username) < 3:
        username = input("Username must be at least 3 characters: ").strip()

    phone = input("Superuser Phone (optional, e.g. 9876543210): ").strip() or None

    password = getpass.getpass("Superuser Password (min 4 chars): ").strip()
    while len(password) < 4:
        password = getpass.getpass("Password too short. Enter at least 4 characters: ").strip()

    password_confirm = getpass.getpass("Confirm Superuser Password: ").strip()
    if password != password_confirm:
        print("\nError: Passwords do not match. Aborting.")
        sys.exit(1)

    print("\nCleaning database tables...")
    db = SessionLocal()
    try:
        # Wipe all child and parent tables
        db.query(models.DeliveryItem).delete()
        db.query(models.Delivery).delete()
        db.query(models.Allocation).delete()
        db.query(models.Assignment).delete()
        db.query(models.Stock).delete()
        db.query(models.InventoryType).delete()
        db.query(models.Client).delete()
        db.query(models.Vehicle).delete()
        db.query(models.Route).delete()
        db.query(models.GlassCollection).delete()
        db.query(models.GlassSeparation).delete()
        db.query(models.GlassVendorPickup).delete()
        db.query(models.GlassInventory).delete()
        db.query(models.User).delete()

        # Create new superuser
        superuser = models.User(
            name=name,
            username=username,
            role="ADMIN",
            phone=phone,
            hashed_password=security.get_password_hash(password),
            is_active=True,
            token_version=1
        )
        db.add(superuser)
        db.commit()
        db.refresh(superuser)

        print("\n" + "=" * 65)
        print("  SUCCESS: Database wiped 100% clean!")
        print("=" * 65)
        print(f"  Superuser ID       : {superuser.id}")
        print(f"  Superuser Name     : {superuser.name}")
        print(f"  Username           : {superuser.username}")
        print(f"  Role               : {superuser.role} (Owner / Superuser)")
        print(f"  Phone              : {superuser.phone or 'Not provided'}")
        print("=" * 65)
        print("You can now log in at /login with these new credentials.\n")

    except Exception as e:
        db.rollback()
        print(f"\nError resetting database: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_create_superuser()

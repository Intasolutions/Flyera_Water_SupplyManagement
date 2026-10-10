import sqlite3

def reset_db():
    conn = sqlite3.connect("water_supply.db")
    c = conn.cursor()
    
    tables = [
        "users", "routes", "clients", "vehicles", 
        "inventory_types", "stocks", "assignments", 
        "allocations", "deliveries", "delivery_items"
    ]
    
    for table in tables:
        try:
            c.execute(f"DELETE FROM {table}")
            print(f"Cleared {table}")
        except Exception as e:
            print(f"Error clearing {table}: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_db()

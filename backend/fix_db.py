import sqlite3
import traceback

def fix_db():
    conn = sqlite3.connect("water_supply.db")
    c = conn.cursor()
    
    try:
        c.execute("ALTER TABLE clients ADD COLUMN route_id VARCHAR")
        print("Added route_id to clients")
    except Exception as e:
        print(f"Error adding to clients: {e}")
        
    try:
        c.execute("ALTER TABLE assignments ADD COLUMN route_id VARCHAR")
        print("Added route_id to assignments")
    except Exception as e:
        print(f"Error adding to assignments: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    fix_db()

import sqlite3
from app.core.security import get_password_hash

conn = sqlite3.connect("water_supply.db")
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE users ADD COLUMN username VARCHAR")
except Exception as e:
    print("Column username:", e)

try:
    cursor.execute("ALTER TABLE users ADD COLUMN hashed_password VARCHAR")
except Exception as e:
    print("Column hashed_password:", e)

try:
    cursor.execute("ALTER TABLE users ADD COLUMN driving_license VARCHAR")
except Exception as e:
    print("Column driving_license:", e)

# Update existing users with a default password and username
hashed_pwd = get_password_hash("password123")

# We will assign username = name lowercase and stripped of spaces for dummy data
cursor.execute("SELECT id, name FROM users")
users = cursor.fetchall()
for u in users:
    uid, name = u
    username = name.split()[0].lower() if name else "user"
    cursor.execute("UPDATE users SET username = ?, hashed_password = ? WHERE id = ?", (username, hashed_pwd, uid))

conn.commit()
conn.close()
print("Database schema and users updated successfully.")

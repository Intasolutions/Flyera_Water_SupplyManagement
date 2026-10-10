import urllib.request
import json
import sqlite3

conn = sqlite3.connect('water_supply.db')
c = conn.cursor()
c.execute("SELECT id FROM users WHERE name='RAmu'")
row = c.fetchone()
if not row:
    print("RAmu not found")
    exit(1)
user_id = row[0]

data = json.dumps({'name': 'RAmu', 'role': 'DRIVER', 'phone': '8129686484'}).encode('utf-8')
req = urllib.request.Request(f'http://127.0.0.1:8000/api/users/{user_id}', data=data, method='PUT', headers={'Content-Type': 'application/json'})

try:
    response = urllib.request.urlopen(req)
    print("Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error:", e.read().decode('utf-8'))

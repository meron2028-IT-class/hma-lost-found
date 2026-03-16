import sqlite3
import qrcode
import os
from urllib.parse import quote

DB_PATH = '../hma.db'
OUTPUT_FOLDER = 'qr_codes'
BASE_URL = 'http://localhost:3000/report.html'  # Change to your deployed URL later

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("""
    SELECT items.item_code, items.item_name, students.name 
    FROM items 
    JOIN students ON items.student_id = students.id
""")
items = cursor.fetchall()

print(f"🎯 Generating QR codes for {len(items)} items...")
print("-" * 50)

for code, item_name, owner_name in items:
    url = f"{BASE_URL}?code={quote(code)}"
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save with item code as filename
    filename = os.path.join(OUTPUT_FOLDER, f"{code}.png")
    img.save(filename)
    print(f"✅ {code}: {item_name} (Owner: {owner_name})")

conn.close()
print("-" * 50)
print(f"📁 QR codes saved to: {OUTPUT_FOLDER}/")
print("🎉 Done!")
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'hma.db'));

// Initialize tables
function initialize() {
    console.log('Initializing database...');
    
    db.serialize(() => {
        // Students table
       // Find the CREATE TABLE reports section and replace with:
db.run(`
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT NOT NULL,
        location TEXT NOT NULL,
        finder_name TEXT,
        finder_email TEXT,
        notes TEXT,
        photo_url TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_code) REFERENCES items(item_code)
    )
`);

        // Items table (QR-coded items)
        db.run(`
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_code TEXT UNIQUE NOT NULL,
                item_name TEXT NOT NULL,
                description TEXT,
                student_id INTEGER NOT NULL,
                FOREIGN KEY(student_id) REFERENCES students(id)
            )
        `);

        // Reports table (found QR items)
        db.run(`
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_code TEXT NOT NULL,
                location TEXT NOT NULL,
                finder_name TEXT,
                notes TEXT,
                photo_url TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(item_code) REFERENCES items(item_code)
            )
        `);

        // Unknown items table (no QR)
        db.run(`
            CREATE TABLE IF NOT EXISTS unknown_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_url TEXT,
                location TEXT NOT NULL,
                notes TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if we have data, if not insert sample data
        db.get("SELECT COUNT(*) AS count FROM students", (err, row) => {
            if (err) {
                console.error('Error checking students:', err);
                return;
            }
            
            if (row.count === 0) {
                console.log('📝 Adding sample data...');
                
                // Insert students
                const students = [
                    ['Meron Shitaye', 'meron2028@hmacademy.org', '10'],
                    ['Abel Bekele', 'abel2027@hmacademy.org', '11'],
                    ['Samuel Bekele', 'samuel2028@hmacademy.org', '10'],
                    ['Jovani Tewodros', 'jovanitewodros72@gmail.com', '11'],
                    ['Meron Shitaye', 'meri.shitaye@gmail.com', '10']
                ];
                
                const studentStmt = db.prepare("INSERT INTO students (name, email, grade) VALUES (?, ?, ?)");
                students.forEach(s => studentStmt.run(s));
                studentStmt.finalize();
                
                // Insert items
                setTimeout(() => {
                    const items = [
                        ['IPAD001', 'iPad Pro', 'iPad Pro 12.9" with Magic Keyboard', 1],
                        ['AIRP001', 'AirPods Pro', 'AirPods Pro with MagSafe case', 1],
                        ['IPAD002', 'iPad Air', 'iPad Air 10.9" Blue', 4],
                        ['PEN001', 'Apple Pencil', 'Apple Pencil Gen 2', 4],
                        ['MAC001', 'MacBook Air', 'MacBook Air M1 Silver', 5],
                        ['CALC001', 'Calculator', 'Texas Instruments TI-84 Plus', 5],
                        ['IPAD003', 'iPad Mini', 'iPad Mini 6 Purple', 2],
                        ['POWER001', 'Power Bank', 'Anker 20000mAh Power Bank', 3]
                    ];
                    
                    const itemStmt = db.prepare("INSERT INTO items (item_code, item_name, description, student_id) VALUES (?, ?, ?, ?)");
                    items.forEach(i => itemStmt.run(i));
                    itemStmt.finalize();
                    
                    console.log('✅ Sample data added successfully');
                    console.log(`   - ${students.length} students`);
                    console.log(`   - ${items.length} items`);
                }, 500);
            } else {
                console.log(`✅ Database ready with ${row.count} existing students`);
            }
        });
    });
}

// Look up item by code
function getItemByCode(code) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT items.item_code, items.item_name, items.description,
                   students.name AS owner_name, students.email AS owner_email, students.grade
            FROM items
            JOIN students ON items.student_id = students.id
            WHERE items.item_code = ?
        `;
        db.get(sql, [code], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Add a report
function addReport({ item_code, location, finder_name, notes, photo_url }) {
    return new Promise((resolve, reject) => {
        const stmt = `
            INSERT INTO reports (item_code, location, finder_name, notes, photo_url)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.run(stmt, [item_code, location, finder_name, notes, photo_url], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Get recent reports (with owner info)
function getRecentReports(limit = 20) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT reports.*, items.item_name, items.description,
                   students.name AS owner_name, students.email AS owner_email
            FROM reports
            JOIN items ON reports.item_code = items.item_code
            JOIN students ON items.student_id = students.id
            ORDER BY reports.timestamp DESC
            LIMIT ?
        `;
        db.all(sql, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Add unknown item
function addUnknownItem({ location, notes, photo_url }) {
    return new Promise((resolve, reject) => {
        const stmt = `
            INSERT INTO unknown_items (location, notes, photo_url)
            VALUES (?, ?, ?)
        `;
        db.run(stmt, [location, notes, photo_url], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Get unknown items
function getUnknownItems() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM unknown_items ORDER BY timestamp DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Export all functions AND the database connection
module.exports = {
    initialize,
    getItemByCode,
    addReport,
    getRecentReports,
    addUnknownItem,
    getUnknownItems,
    db: db  // This is important! Export the database connection as 'db'
};
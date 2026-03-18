const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create database connection
const dbPath = path.join(__dirname, 'hma.db');
const db = new Database(dbPath);

// Initialize tables
function initialize() {
    console.log('📊 Initializing database...');
    
    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            grade TEXT
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_code TEXT UNIQUE NOT NULL,
            item_name TEXT NOT NULL,
            description TEXT,
            student_id INTEGER NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
    `);

    db.exec(`
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

    db.exec(`
        CREATE TABLE IF NOT EXISTS unknown_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_url TEXT,
            location TEXT NOT NULL,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            gender TEXT,
            grade TEXT,
            photo_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS user_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            description TEXT,
            item_code TEXT UNIQUE NOT NULL,
            qr_code_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Check if we have sample data
    const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    
    if (studentCount === 0) {
        console.log('📝 Adding sample data...');
        
        // Insert students
        const insertStudent = db.prepare('INSERT INTO students (name, email, grade) VALUES (?, ?, ?)');
        insertStudent.run('Jovani Tewodros', 'jovanitewodros72@gmail.com', '11');
        insertStudent.run('Meron Shitaye', 'meri.shitaye@gmail.com', '10');
        insertStudent.run('Meron Shitaye', 'meron2028@hmacademy.org', '10');
        
        // Insert items
        const insertItem = db.prepare('INSERT INTO items (item_code, item_name, description, student_id) VALUES (?, ?, ?, ?)');
        insertItem.run('IPAD001', 'iPad Pro', 'iPad Pro 12.9" with Magic Keyboard', 1);
        insertItem.run('AIRP001', 'AirPods Pro', 'AirPods Pro with MagSafe case', 1);
        insertItem.run('IPAD002', 'iPad Air', 'iPad Air 10.9" Blue', 2);
        insertItem.run('PEN001', 'Apple Pencil', 'Apple Pencil Gen 2', 2);
        insertItem.run('MAC001', 'MacBook Air', 'MacBook Air M1 Silver', 3);
        insertItem.run('CALC001', 'Calculator', 'TI-84 Plus Calculator', 3);
        
        console.log('✅ Sample data added!');
    }

    console.log('✅ Database ready');
}

// ===== EXPORT FUNCTIONS =====

// Get item by code
function getItemByCode(code) {
    // Try items table first
    let item = db.prepare(`
        SELECT 
            items.item_code, 
            items.item_name, 
            items.description,
            students.name AS owner_name, 
            students.email AS owner_email
        FROM items 
        JOIN students ON items.student_id = students.id
        WHERE items.item_code = ?
    `).get(code);
    
    // If not found, try user_items table
    if (!item) {
        item = db.prepare(`
            SELECT 
                ui.item_code, 
                ui.item_name, 
                ui.description,
                u.name AS owner_name, 
                u.email AS owner_email
            FROM user_items ui
            JOIN users u ON ui.user_id = u.id
            WHERE ui.item_code = ?
        `).get(code);
    }
    
    return item;
}

// Add a report
function addReport({ item_code, location, finder_name, finder_email, notes, photo_url }) {
    const stmt = db.prepare(`
        INSERT INTO reports (item_code, location, finder_name, finder_email, notes, photo_url)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(item_code, location, finder_name, finder_email, notes, photo_url);
    return result.lastInsertRowid;
}

// Get recent reports
function getRecentReports(limit = 20) {
    return db.prepare(`
        SELECT reports.*, items.item_name, students.name AS owner_name
        FROM reports
        JOIN items ON reports.item_code = items.item_code
        JOIN students ON items.student_id = students.id
        ORDER BY reports.timestamp DESC
        LIMIT ?
    `).all(limit);
}

// Add unknown item
function addUnknownItem({ location, notes, photo_url }) {
    const stmt = db.prepare(`
        INSERT INTO unknown_items (location, notes, photo_url)
        VALUES (?, ?, ?)
    `);
    const result = stmt.run(location, notes, photo_url);
    return result.lastInsertRowid;
}

// Get unknown items
function getUnknownItems() {
    return db.prepare(`
        SELECT * FROM unknown_items 
        ORDER BY timestamp DESC
    `).all();
}

// User functions
function createUser({ name, email, password_hash, gender, grade, photo_url }) {
    const stmt = db.prepare(`
        INSERT INTO users (name, email, password_hash, gender, grade, photo_url)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, password_hash, gender, grade, photo_url);
    return result.lastInsertRowid;
}

function getUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
    return db.prepare('SELECT id, name, email, gender, grade, photo_url FROM users WHERE id = ?').get(id);
}

function getUserItems(userId) {
    return db.prepare(`
        SELECT * FROM user_items 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    `).all(userId);
}

function addUserItem({ user_id, item_name, description, item_code }) {
    const stmt = db.prepare(`
        INSERT INTO user_items (user_id, item_name, description, item_code)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(user_id, item_name, description, item_code);
    return result.lastInsertRowid;
}

// Stats
function getStats() {
    return {
        totalItems: db.prepare('SELECT COUNT(*) as count FROM items').get().count,
        totalReports: db.prepare('SELECT COUNT(*) as count FROM reports').get().count,
        totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count || 0,
        totalUnknown: db.prepare('SELECT COUNT(*) as count FROM unknown_items').get().count
    };
}

// Export everything
module.exports = {
    initialize,
    getItemByCode,
    addReport,
    getRecentReports,
    addUnknownItem,
    getUnknownItems,
    createUser,
    getUserByEmail,
    getUserById,
    getUserItems,
    addUserItem,
    getStats,
    db
};
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const db = require('./database');
const app = express();
const PORT = 3000;
// At top, add requires
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const QRCode = require('qrcode'); // we'll use this for generating QR codes dynamically

// Session middleware
app.use(session({
    secret: 'hma-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Serve uploaded profile photos
app.use('/uploads', express.static('public/uploads'));

// ---------- AUTH ROUTES ----------

// Register
app.post('/api/register', upload.single('photo'), async (req, res) => {
    const { name, email, password, gender, grade } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    try {
        // Check if user exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (name, email, password_hash, gender, grade, photo_url) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(name, email, hash, gender, grade, photo_url);
        
        req.session.userId = result.lastInsertRowid;
        req.session.userEmail = email;
        
        res.json({ success: true, userId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/login', express.json(), async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.json({ success: true });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const user = db.prepare('SELECT id, name, email, gender, grade, photo_url FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
});

// ---------- USER ITEMS ----------

// Add a new item for current user
app.post('/api/user-items', express.json(), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    
    const { item_name, description } = req.body;
    // Generate unique code: prefix + random string
    const item_code = 'U' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Generate QR code as data URL (or save file)
    const qrDataUrl = QRCode.toDataURL(`https://hma-lost-found-production.up.railway.app/report.html?code=${item_code}`);
    
    // Save to database
    const stmt = db.prepare('INSERT INTO user_items (user_id, item_name, description, item_code, qr_code_path) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(req.session.userId, item_name, description, item_code, null); // we'll store QR as file later, but for simplicity we'll generate on fly
    
    res.json({ success: true, item_code, qrDataUrl });
});

// Get all items for current user
app.get('/api/user-items', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const items = db.prepare('SELECT * FROM user_items WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
    res.json(items);
});

// Also need to update the item lookup to search both tables
app.get('/api/item/:code', (req, res) => {
    const { code } = req.params;
    // First try items table (old)
    let item = db.prepare(`
        SELECT items.item_code, items.item_name, items.description,
               students.name AS owner_name, students.email AS owner_email
        FROM items 
        JOIN students ON items.student_id = students.id
        WHERE items.item_code = ?
    `).get(code);
    
    if (!item) {
        // Try user_items table
        item = db.prepare(`
            SELECT ui.item_code, ui.item_name, ui.description,
                   u.name AS owner_name, u.email AS owner_email
            FROM user_items ui
            JOIN users u ON ui.user_id = u.id
            WHERE ui.item_code = ?
        `).get(code);
    }
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer
const upload = multer({ dest: 'uploads/' });
app.use('/uploads', express.static('uploads'));

// Initialize database
db.initialize();

// API Routes
app.get('/api/item/:code', (req, res) => {
    const item = db.getItemByCode(req.params.code);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
});

app.post('/api/report', upload.single('photo'), (req, res) => {
    const { item_code, location, finder_name, finder_email, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    const id = db.addReport({
        item_code,
        location,
        finder_name: finder_name || 'Anonymous',
        finder_email: finder_email || '',
        notes: notes || '',
        photo_url
    });
    
    res.json({ success: true, reportId: id });
});

app.get('/api/recent-qr', (req, res) => {
    const reports = db.getRecentReports(10);
    res.json(reports);
});

app.post('/api/unknown', upload.single('photo'), (req, res) => {
    const { location, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    const id = db.addUnknownItem({ location, notes, photo_url });
    res.json({ success: true, id });
});

app.get('/api/unknown', (req, res) => {
    const items = db.getUnknownItems();
    res.json(items);
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 QR test: http://localhost:${PORT}/report.html?code=IPAD001`);
    console.log(`🔍 Discover: http://localhost:${PORT}/discover.html`);
    console.log(`🧪 Test page: http://localhost:${PORT}/test-codes.html\n`);
});
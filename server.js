const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    secret: 'hma-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ===== DATABASE INITIALIZATION =====
db.initialize();

// ===== API ROUTES =====

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// ---------- AUTH ROUTES ----------

// Register new user
app.post('/api/register', upload.single('photo'), async (req, res) => {
    try {
        const { name, email, password, gender, grade } = req.body;
        const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

        // Check if user exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const stmt = db.prepare(`
            INSERT INTO users (name, email, password_hash, gender, grade, photo_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(name, email, password_hash, gender, grade, photo_url);

        // Set session
        req.session.userId = result.lastInsertRowid;
        req.session.userEmail = email;

        res.json({ 
            success: true, 
            userId: result.lastInsertRowid,
            message: 'Registration successful' 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', express.json(), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        req.session.userId = user.id;
        req.session.userEmail = user.email;

        res.json({ success: true, message: 'Login successful' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get current user
app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const user = db.prepare(`
        SELECT id, name, email, gender, grade, photo_url 
        FROM users 
        WHERE id = ?
    `).get(req.session.userId);

    res.json(user);
});

// ---------- USER ITEMS ROUTES ----------

// Add a new item for current user
app.post('/api/user-items', express.json(), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const { item_name, description } = req.body;
        
        // Generate unique code
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const item_code = `U${timestamp}${random}`;

        // Generate QR code as data URL
        const baseUrl = process.env.BASE_URL || 'https://hma-lost-found-production.up.railway.app';
        const qrDataUrl = await QRCode.toDataURL(`${baseUrl}/report.html?code=${item_code}`);

        // Save to database
        const stmt = db.prepare(`
            INSERT INTO user_items (user_id, item_name, description, item_code, qr_code_path)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(req.session.userId, item_name, description, item_code, null);

        res.json({ 
            success: true, 
            item_code,
            qrDataUrl,
            id: result.lastInsertRowid 
        });

    } catch (error) {
        console.error('Add item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all items for current user
app.get('/api/user-items', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const items = db.prepare(`
            SELECT * FROM user_items 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).all(req.session.userId);

        res.json(items);

    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- ITEM LOOKUP (for QR scans) ----------

app.get('/api/item/:code', (req, res) => {
    const { code } = req.params;

    try {
        // First try old items table
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

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(item);

    } catch (error) {
        console.error('Item lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- REPORT ROUTES ----------

// Submit a report
app.post('/api/report', upload.single('photo'), (req, res) => {
    const { item_code, location, finder_name, finder_email, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const stmt = db.prepare(`
            INSERT INTO reports (item_code, location, finder_name, finder_email, notes, photo_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            item_code, 
            location, 
            finder_name || 'Anonymous', 
            finder_email || '', 
            notes || '', 
            photo_url
        );

        res.json({ success: true, reportId: result.lastInsertRowid });

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent QR reports
app.get('/api/recent-qr', (req, res) => {
    try {
        const reports = db.prepare(`
            SELECT reports.*, items.item_name, students.name AS owner_name
            FROM reports
            JOIN items ON reports.item_code = items.item_code
            JOIN students ON items.student_id = students.id
            ORDER BY reports.timestamp DESC
            LIMIT 20
        `).all();

        res.json(reports);

    } catch (error) {
        console.error('Recent reports error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- UNKNOWN ITEMS ROUTES ----------

// Submit unknown item
app.post('/api/unknown', upload.single('photo'), (req, res) => {
    const { location, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const stmt = db.prepare(`
            INSERT INTO unknown_items (location, notes, photo_url)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(location || '', notes || '', photo_url);

        res.json({ success: true, id: result.lastInsertRowid });

    } catch (error) {
        console.error('Unknown item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unknown items
app.get('/api/unknown', (req, res) => {
    try {
        const items = db.prepare(`
            SELECT * FROM unknown_items 
            ORDER BY timestamp DESC
        `).all();

        res.json(items);

    } catch (error) {
        console.error('Get unknown items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- STATS ROUTE ----------

app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalItems: db.prepare('SELECT COUNT(*) as count FROM items').get().count,
            totalReports: db.prepare('SELECT COUNT(*) as count FROM reports').get().count,
            totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
            totalUnknown: db.prepare('SELECT COUNT(*) as count FROM unknown_items').get().count
        };
        res.json(stats);

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 QR test: http://localhost:${PORT}/report.html?code=IPAD001`);
    console.log(`🔍 Discover: http://localhost:${PORT}/discover.html`);
    console.log(`🧪 Test page: http://localhost:${PORT}/test-codes.html`);
    console.log(`👤 Register: http://localhost:${PORT}/register.html`);
    console.log(`📋 Profile: http://localhost:${PORT}/profile.html`);
});
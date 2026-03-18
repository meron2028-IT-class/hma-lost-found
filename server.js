const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const db = require('./database');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

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
        maxAge: 1000 * 60 * 60 * 24,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
    res.send('🚀 HMA Lost and Found API is RUNNING!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

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
        const existing = db.getUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create user
        const userId = db.createUser({
            name, email, password_hash, gender, grade, photo_url
        });

        // Set session
        req.session.userId = userId;
        req.session.userEmail = email;

        res.json({ 
            success: true, 
            userId,
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

        const user = db.getUserByEmail(email);
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

    const user = db.getUserById(req.session.userId);
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
        const itemId = db.addUserItem({
            user_id: req.session.userId,
            item_name,
            description,
            item_code
        });

        res.json({ 
            success: true, 
            item_code,
            qrDataUrl,
            id: itemId 
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
        const items = db.getUserItems(req.session.userId);
        res.json(items);

    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- ITEM LOOKUP ----------

app.get('/api/item/:code', (req, res) => {
    const { code } = req.params;

    try {
        const item = db.getItemByCode(code);

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
        const reportId = db.addReport({
            item_code,
            location,
            finder_name: finder_name || 'Anonymous',
            finder_email: finder_email || '',
            notes: notes || '',
            photo_url
        });

        res.json({ success: true, reportId });

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent QR reports
app.get('/api/recent-qr', (req, res) => {
    try {
        const reports = db.getRecentReports(20);
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
        const id = db.addUnknownItem({
            location: location || '',
            notes: notes || '',
            photo_url
        });

        res.json({ success: true, id });

    } catch (error) {
        console.error('Unknown item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unknown items
app.get('/api/unknown', (req, res) => {
    try {
        const items = db.getUnknownItems();
        res.json(items);

    } catch (error) {
        console.error('Get unknown items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- STATS ROUTE ----------

app.get('/api/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json(stats);

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📱 Test: http://localhost:${PORT}/report.html?code=IPAD001`);
    console.log(`👤 Register: http://localhost:${PORT}/register.html`);
    console.log(`📋 Profile: http://localhost:${PORT}/profile.html`);
});
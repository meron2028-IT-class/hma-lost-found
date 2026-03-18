const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');

// Database import
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// ===== SESSION MIDDLEWARE - FIXED FOR RAILWAY =====
app.use(session({
    secret: 'hma-secret-key-2026',
    resave: true,  // Changed from false to true
    saveUninitialized: true,  // Changed from false to true
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        secure: false, // Set to false for Railway (no HTTPS locally)
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'hma.sid' // Custom name to avoid conflicts
}));

// Add this middleware to log session
app.use((req, res, next) => {
    console.log('🍪 Session ID:', req.sessionID);
    console.log('👤 Session user:', req.session?.userId);
    next();
});

// ===== UPLOADS DIRECTORY SETUP =====
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
}

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Serve uploaded files - FIXED PATH
app.use('/uploads', express.static(uploadsDir));

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
    res.send('🚀 HMA Lost and Found API is RUNNING!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        time: new Date().toISOString(),
        uploadsDir: uploadsDir,
        files: fs.readdirSync(uploadsDir).length
    });
});

// ===== DATABASE INITIALIZATION =====
db.initialize();

// ===== DEBUG MIDDLEWARE =====
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

// ===== API ROUTES =====

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', time: new Date().toISOString() });
});

// ---------- AUTH ROUTES ----------

// Register new user
app.post('/api/register', upload.single('photo'), async (req, res) => {
    console.log('📝 Registration attempt:', req.body.email);
    
    try {
        const { name, email, password, gender, grade } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }
        
        const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
        console.log('📸 Photo uploaded:', photo_url);

        // Check if user exists
        const existing = db.getUserByEmail(email);
        if (existing) {
            console.log('❌ User already exists:', email);
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create user
        const userId = db.createUser({
            name, email, password_hash, gender, grade, photo_url
        });

        console.log('✅ User created:', userId);

        // Set session
        req.session.userId = userId;
        req.session.userEmail = email;

        res.json({ 
            success: true, 
            userId,
            message: 'Registration successful' 
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', express.json(), async (req, res) => {
    console.log('🔐 Login attempt:', req.body.email);
    
    try {
        const { email, password } = req.body;

        const user = db.getUserByEmail(email);
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('✅ Login successful:', email);
        req.session.userId = user.id;
        req.session.userEmail = user.email;

        res.json({ success: true, message: 'Login successful' });

    } catch (error) {
        console.error('❌ Login error:', error);
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
    console.log('👤 Profile request, session:', req.session.userId);
    
    if (!req.session.userId) {
        console.log('❌ Not logged in');
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const user = db.getUserById(req.session.userId);
        console.log('✅ User found:', user?.name);
        res.json(user);
    } catch (error) {
        console.error('❌ Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- USER ITEMS ROUTES ----------

// Add a new item for current user
app.post('/api/user-items', express.json(), async (req, res) => {
    console.log('📦 Add item request');
    
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const { item_name, description } = req.body;
        
        if (!item_name) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        // Generate unique code
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const item_code = `U${timestamp}${random}`;

        console.log('🔑 Generated code:', item_code);

        // Generate QR code as data URL
        const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;
        const qrDataUrl = await QRCode.toDataURL(`${baseUrl}/report.html?code=${item_code}`);

        // Save to database
        const itemId = db.addUserItem({
            user_id: req.session.userId,
            item_name,
            description: description || '',
            item_code
        });

        console.log('✅ Item saved:', itemId);

        res.json({ 
            success: true, 
            item_code,
            qrDataUrl,
            id: itemId 
        });

    } catch (error) {
        console.error('❌ Add item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all items for current user
app.get('/api/user-items', (req, res) => {
    console.log('📋 Fetching items for user:', req.session.userId);
    
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const items = db.getUserItems(req.session.userId);
        console.log(`✅ Found ${items.length} items`);
        res.json(items);

    } catch (error) {
        console.error('❌ Get items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- ITEM LOOKUP ----------

app.get('/api/item/:code', (req, res) => {
    const { code } = req.params;
    console.log('🔍 Looking up item:', code);

    try {
        const item = db.getItemByCode(code);

        if (!item) {
            console.log('❌ Item not found:', code);
            return res.status(404).json({ error: 'Item not found' });
        }

        console.log('✅ Item found:', item.item_name);
        res.json(item);

    } catch (error) {
        console.error('❌ Item lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- REPORT ROUTES ----------

// Submit a report
app.post('/api/report', upload.single('photo'), (req, res) => {
    const { item_code, location, finder_name, finder_email, notes } = req.body;
    console.log('📝 Report submitted for:', item_code);
    
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

        console.log('✅ Report saved:', reportId);
        res.json({ success: true, reportId });

    } catch (error) {
        console.error('❌ Report error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent QR reports
app.get('/api/recent-qr', (req, res) => {
    console.log('📋 Fetching recent reports');

    try {
        const reports = db.getRecentReports(20);
        console.log(`✅ Found ${reports.length} reports`);
        res.json(reports);

    } catch (error) {
        console.error('❌ Recent reports error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- UNKNOWN ITEMS ROUTES ----------

// Submit unknown item
app.post('/api/unknown', upload.single('photo'), (req, res) => {
    const { location, notes } = req.body;
    console.log('📝 Unknown item report');
    
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const id = db.addUnknownItem({
            location: location || '',
            notes: notes || '',
            photo_url
        });

        console.log('✅ Unknown item saved:', id);
        res.json({ success: true, id });

    } catch (error) {
        console.error('❌ Unknown item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unknown items
app.get('/api/unknown', (req, res) => {
    console.log('📋 Fetching unknown items');

    try {
        const items = db.getUnknownItems();
        console.log(`✅ Found ${items.length} unknown items`);
        res.json(items);

    } catch (error) {
        console.error('❌ Get unknown items error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------- STATS ROUTE ----------

app.get('/api/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DEBUG: List uploads =====
app.get('/api/debug/uploads', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        res.json({ 
            uploadsDir,
            fileCount: files.length,
            files: files.slice(0, 10) // Show first 10
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📱 Test: http://localhost:${PORT}/report.html?code=IPAD001`);
    console.log(`👤 Register: http://localhost:${PORT}/register.html`);
    console.log(`📋 Profile: http://localhost:${PORT}/profile.html`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🔍 Debug uploads: http://localhost:${PORT}/api/debug/uploads\n`);
});
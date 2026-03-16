require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for photo uploads
const upload = multer({ dest: 'uploads/' });

// Serve uploads folder
app.use('/uploads', express.static('uploads'));

// ---------- API ENDPOINTS ----------

// 1. Look up item by code
app.get('/api/item/:code', async (req, res) => {
    const { code } = req.params;
    console.log('Looking up item:', code);
    
    try {
        const item = await db.getItemByCode(code);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        console.log('Item found:', item);
        res.json(item);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Submit a report for a QR item
app.post('/api/report', upload.single('photo'), async (req, res) => {
    const { item_code, location, finder_name, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    console.log('Saving report for item:', item_code);

    try {
        const reportId = await db.addReport({
            item_code,
            location,
            finder_name: finder_name || 'Anonymous',
            notes: notes || '',
            photo_url
        });
        console.log('Report saved with ID:', reportId);
        res.json({ success: true, reportId });
    } catch (err) {
        console.error('Error saving report:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Get recent QR reports for Discover page
app.get('/api/recent-qr', async (req, res) => {
    try {
        const reports = await db.getRecentReports(20);
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Submit an unknown item (no QR)
app.post('/api/unknown', upload.single('photo'), async (req, res) => {
    const { location, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const id = await db.addUnknownItem({ 
            location, 
            notes: notes || '', 
            photo_url 
        });
        res.json({ success: true, id });
    } catch (err) {
        console.error('Error saving unknown item:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Get unknown items
app.get('/api/unknown', async (req, res) => {
    try {
        const items = await db.getUnknownItems();
        res.json(items);
    } catch (err) {
        console.error('Error fetching unknown items:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Get all items for test page (FIXED VERSION)
app.get('/api/items', async (req, res) => {
    console.log('Fetching all items...');
    
    try {
        // Use db.db to access the SQLite database directly
        const sql = `
            SELECT 
                items.item_code, 
                items.item_name, 
                items.description,
                students.name as owner_name, 
                students.email as owner_email
            FROM items 
            JOIN students ON items.student_id = students.id
            ORDER BY items.item_code
        `;
        
        db.db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Database error in /api/items:', err);
                return res.status(500).json({ 
                    error: err.message,
                    details: 'Error querying items table'
                });
            }
            
            console.log(`Found ${rows.length} items`);
            res.json(rows);
        });
    } catch (err) {
        console.error('Error in /api/items:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Get database stats for home page
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    db.db.get("SELECT COUNT(*) as count FROM reports", (err, row) => {
        stats.reports = err ? 0 : (row ? row.count : 0);
        
        db.db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
            stats.items = err ? 0 : (row ? row.count : 0);
            
            db.db.get("SELECT COUNT(*) as count FROM students", (err, row) => {
                stats.students = err ? 0 : (row ? row.count : 0);
                res.json(stats);
            });
        });
    });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Test page: http://localhost:${PORT}/test-codes.html`);
    console.log(`📱 QR scan: http://localhost:${PORT}/report.html?code=IPAD001`);
    console.log(`🔍 Discover: http://localhost:${PORT}/discover.html\n`);
    
    // Initialize database
    db.initialize();
});

// 2. Submit a report for a QR item
app.post('/api/report', upload.single('photo'), async (req, res) => {
    const { item_code, location, finder_name, finder_email, notes } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const reportId = await db.addReport({
            item_code,
            location,
            finder_name: finder_name || 'Anonymous',
            finder_email: finder_email || '',
            notes: notes || '',
            photo_url
        });
        res.json({ success: true, reportId });
    } catch (err) {
        console.error('Error saving report:', err);
        res.status(500).json({ error: err.message });
    }
});
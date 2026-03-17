const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = 3000;

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
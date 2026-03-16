const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../hma.db'));

const realStudents = [
    {
        name: 'Jovani Tewodros',
        email: 'jovanitewodros72@gmail.com',
        grade: '11'
    },
    {
        name: 'Meron Shitaye',
        email: 'meri.shitaye@gmail.com',
        grade: '10'
    },
    {
        name: 'Meron Shitaye (School)',
        email: 'meron2028@hmacademy.org',
        grade: '10'
    },
    {
        name: 'Abel Bekele',
        email: 'abel.bekele@hmacademy.org',
        grade: '11'
    },
    {
        name: 'Samuel Bekele',
        email: 'samuel.bekele@hmacademy.org',
        grade: '10'
    }
];

const realItems = [
    // Items for Jovani
    {
        code: 'IPAD001',
        name: 'iPad Pro',
        description: 'iPad Pro 12.9" with Magic Keyboard',
        student_email: 'jovanitewodros72@gmail.com'
    },
    {
        code: 'AIRP001',
        name: 'AirPods Pro',
        description: 'AirPods Pro with MagSafe case',
        student_email: 'jovanitewodros72@gmail.com'
    },
    
    // Items for Meron (personal)
    {
        code: 'IPAD002',
        name: 'iPad Air',
        description: 'iPad Air 10.9" Blue',
        student_email: 'meri.shitaye@gmail.com'
    },
    {
        code: 'PEN001',
        name: 'Apple Pencil',
        description: 'Apple Pencil Gen 2',
        student_email: 'meri.shitaye@gmail.com'
    },
    
    // Items for Meron (school)
    {
        code: 'MAC001',
        name: 'MacBook Air',
        description: 'MacBook Air M1 Silver',
        student_email: 'meron2028@hmacademy.org'
    },
    {
        code: 'CALC001',
        name: 'Calculator',
        description: 'Texas Instruments TI-84 Plus',
        student_email: 'meron2028@hmacademy.org'
    },
    
    // Items for Abel
    {
        code: 'IPAD003',
        name: 'iPad Mini',
        description: 'iPad Mini 6 Purple',
        student_email: 'abel.bekele@hmacademy.org'
    },
    
    // Items for Samuel
    {
        code: 'POWER001',
        name: 'Power Bank',
        description: 'Anker 20000mAh Power Bank',
        student_email: 'samuel.bekele@hmacademy.org'
    }
];

db.serialize(() => {
    console.log('📝 Adding real student data...');
    
    // First, get current max ID to avoid conflicts
    db.get("SELECT MAX(id) as maxId FROM students", (err, row) => {
        if (err) console.error(err);
        let nextId = (row && row.maxId) ? row.maxId + 1 : 1;
        
        // Insert students
        const studentStmt = db.prepare(`
            INSERT OR IGNORE INTO students (id, name, email, grade) 
            VALUES (?, ?, ?, ?)
        `);
        
        realStudents.forEach((student, index) => {
            studentStmt.run(nextId + index, student.name, student.email, student.grade);
            console.log(`  ✅ Added student: ${student.name} (${student.email})`);
        });
        studentStmt.finalize();
        
        // Get student IDs for email lookup
        setTimeout(() => {
            // Insert items
            const itemStmt = db.prepare(`
                INSERT OR REPLACE INTO items (item_code, item_name, description, student_id) 
                VALUES (?, ?, ?, (SELECT id FROM students WHERE email = ?))
            `);
            
            realItems.forEach(item => {
                itemStmt.run(item.code, item.name, item.description, item.student_email, function(err) {
                    if (err) {
                        console.error(`  ❌ Failed to add item ${item.code}:`, err.message);
                    } else {
                        console.log(`  ✅ Added item: ${item.code} - ${item.name} for ${item.student_email}`);
                    }
                });
            });
            itemStmt.finalize();
            
            console.log('\n✨ Real student data added successfully!');
            console.log('\n📊 Summary:');
            console.log(`   - Students added: ${realStudents.length}`);
            console.log(`   - Items added: ${realItems.length}`);
            console.log('\n🔍 Test these codes:');
            realItems.forEach(item => {
                console.log(`   http://localhost:3000/report.html?code=${item.code}`);
            });
        }, 500);
    });
});

setTimeout(() => {
    db.close();
}, 2000);
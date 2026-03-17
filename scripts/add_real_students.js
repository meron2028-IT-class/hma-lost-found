const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to your database
const db = new sqlite3.Database(path.join(__dirname, '../hma.db'));

const newStudents = [
    { name: 'Etsub Dink', email: 'etsubdink2028@hmacademy.org', grade: '10' },
    { name: 'Mandela', email: 'mandela2028@hmacademy.org', grade: '11' },
    { name: 'Edna', email: 'edna2028@hmacademy.org', grade: '9' },
    { name: 'Jovani', email: 'jovani2028@hmacademy.org', grade: '12' },
    { name: 'Fikremariam', email: 'fikremariam2028@hmacademy.org', grade: '10' }
];

const newItems = [
    // Items for Etsub
    { code: 'IPAD004', name: 'iPad Air', description: 'iPad Air 10.9" Green', student_email: 'etsubdink2028@hmacademy.org' },
    { code: 'PEN004', name: 'Apple Pencil', description: 'Apple Pencil Gen 2', student_email: 'etsubdink2028@hmacademy.org' },
    
    // Items for Mandela
    { code: 'MAC002', name: 'MacBook Pro', description: 'MacBook Pro 14" Space Gray', student_email: 'mandela2028@hmacademy.org' },
    { code: 'AIRP003', name: 'AirPods Max', description: 'AirPods Max Silver', student_email: 'mandela2028@hmacademy.org' },
    
    // Items for Edna
    { code: 'IPAD005', name: 'iPad Mini', description: 'iPad Mini 6 Purple', student_email: 'edna2028@hmacademy.org' },
    { code: 'PHONE001', name: 'iPhone', description: 'iPhone 13 Pink', student_email: 'edna2028@hmacademy.org' },
    
    // Items for Jovani
    { code: 'WATCH001', name: 'Apple Watch', description: 'Apple Watch Series 8', student_email: 'jovani2028@hmacademy.org' },
    { code: 'POWER002', name: 'Power Bank', description: 'Anker 20000mAh', student_email: 'jovani2028@hmacademy.org' },
    
    // Items for Fikremariam
    { code: 'CALC002', name: 'Calculator', description: 'Casio Scientific Calculator', student_email: 'fikremariam2028@hmacademy.org' },
    { code: 'NOTE001', name: 'Notebook', description: 'Leather-bound notebook', student_email: 'fikremariam2028@hmacademy.org' }
];

console.log('📝 Adding new students and items...');

db.serialize(() => {
    // First, get current max student ID
    db.get("SELECT MAX(id) as maxId FROM students", (err, row) => {
        let nextId = (row && row.maxId) ? row.maxId + 1 : 4;
        
        // Insert students
        const studentStmt = db.prepare("INSERT INTO students (id, name, email, grade) VALUES (?, ?, ?, ?)");
        
        newStudents.forEach((student, index) => {
            const studentId = nextId + index;
            studentStmt.run(studentId, student.name, student.email, student.grade, function(err) {
                if (err) {
                    console.log(`⚠️ Student ${student.email} already exists or error:`, err.message);
                } else {
                    console.log(`✅ Added student: ${student.name} (${student.email})`);
                }
            });
        });
        
        studentStmt.finalize();
        
        // Wait a moment then add items
        setTimeout(() => {
            // Get student IDs for each email
            newItems.forEach(item => {
                db.get("SELECT id FROM students WHERE email = ?", [item.student_email], (err, student) => {
                    if (student) {
                        db.run(
                            "INSERT INTO items (item_code, item_name, description, student_id) VALUES (?, ?, ?, ?)",
                            [item.code, item.name, item.description, student.id],
                            function(err) {
                                if (err) {
                                    console.log(`⚠️ Item ${item.code} already exists or error:`, err.message);
                                } else {
                                    console.log(`✅ Added item: ${item.code} - ${item.name} for ${item.student_email}`);
                                }
                            }
                        );
                    }
                });
            });
            
            console.log('\n✨ All new students and items added!');
            console.log('\n📊 New QR codes to test:');
            newItems.forEach(item => {
                console.log(`   ${item.code} - ${item.name}`);
            });
        }, 500);
    });
});

setTimeout(() => {
    db.close();
    console.log('\n🎉 Database updated successfully!');
}, 2000);
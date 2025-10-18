const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'wbridge.db');
const db = new Database(dbPath);

console.log('🔄 Running database migration...');

try {
  // Add the new column if it doesn't exist
  db.exec(`
    ALTER TABLE messages ADD COLUMN sentFromDashboard INTEGER DEFAULT 0;
  `);
  console.log('✅ Added sentFromDashboard column to messages table');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️  Column already exists, skipping migration');
  } else {
    console.error('❌ Migration error:', err.message);
  }
}

// Create streak table if it doesn't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS streak (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currentStreak INTEGER DEFAULT 0,
      longestStreak INTEGER DEFAULT 0,
      lastUpdated DATE DEFAULT CURRENT_DATE,
      streakBrokenDate DATE,
      totalDaysDetox INTEGER DEFAULT 0
    )
  `);
  console.log('✅ Created streak table');
} catch (err) {
  console.error('❌ Error creating streak table:', err.message);
}

// Initialize streak if not exists
try {
  db.exec(`
    INSERT OR IGNORE INTO streak (id, currentStreak, longestStreak) 
    SELECT 1, 0, 0 
    WHERE NOT EXISTS (SELECT 1 FROM streak WHERE id = 1)
  `);
  console.log('✅ Initialized streak data');
} catch (err) {
  console.error('❌ Error initializing streak:', err.message);
}

db.close();
console.log('✅ Migration completed successfully!');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'wbridge.db');
const db = new Database(dbPath);

console.log('🔄 Running database migration for media support...');

try {
  // Add mediaType column
  db.exec(`ALTER TABLE messages ADD COLUMN mediaType TEXT;`);
  console.log('✅ Added mediaType column');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️  mediaType column already exists');
  } else {
    console.error('❌ Error adding mediaType:', err.message);
  }
}

try {
  // Add mediaData column
  db.exec(`ALTER TABLE messages ADD COLUMN mediaData TEXT;`);
  console.log('✅ Added mediaData column');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️  mediaData column already exists');
  } else {
    console.error('❌ Error adding mediaData:', err.message);
  }
}

db.close();
console.log('✅ Migration completed successfully!');
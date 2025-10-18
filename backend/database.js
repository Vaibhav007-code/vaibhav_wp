const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'wbridge.db');
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    senderName TEXT,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    direction TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    chatId TEXT,
    sentFromDashboard INTEGER DEFAULT 0,
    mediaType TEXT,
    mediaData TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

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

db.exec(`
  CREATE TABLE IF NOT EXISTS contact_auto_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contactNumber TEXT UNIQUE NOT NULL,
    contactName TEXT,
    customMessage TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const initSettings = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

initSettings.run('autoReplyEnabled', 'true');
initSettings.run('wbridgeEnabled', 'true');
initSettings.run('autoReplyMessage', `Hey, I'm currently offline for a while!
This is an automated message.
If anything is super urgent, please call or SMS me directly. 🙏`);

db.exec(`
  INSERT OR IGNORE INTO streak (id, currentStreak, longestStreak) 
  SELECT 1, 0, 0 
  WHERE NOT EXISTS (SELECT 1 FROM streak WHERE id = 1)
`);

const statements = {
  insertMessage: db.prepare(`
    INSERT INTO messages (sender, senderName, message, direction, chatId, sentFromDashboard, mediaType, mediaData)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getAllMessages: db.prepare(`
    SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
  `),
  
  searchMessages: db.prepare(`
    SELECT * FROM messages 
    WHERE sender LIKE ? OR senderName LIKE ? OR message LIKE ?
    ORDER BY timestamp DESC
  `),
  
  getMessagesByChat: db.prepare(`
    SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC
  `),
  
  markAsRead: db.prepare(`
    UPDATE messages SET isRead = 1 WHERE id = ?
  `),
  
  markChatAsRead: db.prepare(`
    UPDATE messages SET isRead = 1 WHERE chatId = ? AND direction = 'incoming'
  `),
  
  getSetting: db.prepare(`
    SELECT value FROM settings WHERE key = ?
  `),
  
  updateSetting: db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `),
  
  getUnreadCount: db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE isRead = 0 AND direction = 'incoming'
  `),
  
  getUniqueChats: db.prepare(`
    SELECT 
      chatId,
      sender,
      senderName,
      MAX(timestamp) as lastMessage,
      COUNT(*) as messageCount,
      SUM(CASE WHEN isRead = 0 AND direction = 'incoming' THEN 1 ELSE 0 END) as unreadCount
    FROM messages 
    GROUP BY chatId 
    ORDER BY lastMessage DESC
  `),
  
  getLastMessage: db.prepare(`
    SELECT message, direction FROM messages 
    WHERE chatId = ? 
    ORDER BY timestamp DESC 
    LIMIT 1
  `),

  getStreak: db.prepare(`
    SELECT * FROM streak WHERE id = 1
  `),

  updateStreak: db.prepare(`
    UPDATE streak 
    SET currentStreak = ?, longestStreak = ?, lastUpdated = ?, totalDaysDetox = ?
    WHERE id = 1
  `),

  resetStreak: db.prepare(`
    UPDATE streak 
    SET currentStreak = 0, streakBrokenDate = CURRENT_DATE, lastUpdated = CURRENT_DATE
    WHERE id = 1
  `),

  checkPhoneUsage: db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE direction = 'outgoing' 
    AND sentFromDashboard = 0 
    AND datetime(timestamp) > datetime('now', '-1 day')
  `),

  getContactAutoReply: db.prepare(`
    SELECT * FROM contact_auto_replies WHERE contactNumber = ? AND enabled = 1
  `),

  getAllContactAutoReplies: db.prepare(`
    SELECT * FROM contact_auto_replies ORDER BY contactName ASC
  `),

  addContactAutoReply: db.prepare(`
    INSERT OR REPLACE INTO contact_auto_replies (contactNumber, contactName, customMessage, enabled)
    VALUES (?, ?, ?, ?)
  `),

  deleteContactAutoReply: db.prepare(`
    DELETE FROM contact_auto_replies WHERE id = ?
  `),

  toggleContactAutoReply: db.prepare(`
    UPDATE contact_auto_replies SET enabled = ? WHERE id = ?
  `)
};

const dbHelpers = {
  insertMessage: (sender, senderName, message, direction, chatId, sentFromDashboard = 0, mediaType = null, mediaData = null) => {
    try {
      const info = statements.insertMessage.run(sender, senderName, message, direction, chatId, sentFromDashboard, mediaType, mediaData);
      return info.lastInsertRowid;
    } catch (err) {
      console.error('Error inserting message:', err);
      throw err;
    }
  },

  getAllMessages: (limit = 100) => {
    try {
      return statements.getAllMessages.all(limit);
    } catch (err) {
      console.error('Error getting messages:', err);
      throw err;
    }
  },

  searchMessages: (query) => {
    try {
      const searchTerm = `%${query}%`;
      return statements.searchMessages.all(searchTerm, searchTerm, searchTerm);
    } catch (err) {
      console.error('Error searching messages:', err);
      throw err;
    }
  },

  getMessagesByChat: (chatId) => {
    try {
      return statements.getMessagesByChat.all(chatId);
    } catch (err) {
      console.error('Error getting chat messages:', err);
      throw err;
    }
  },

  markAsRead: (messageId) => {
    try {
      statements.markAsRead.run(messageId);
    } catch (err) {
      console.error('Error marking as read:', err);
      throw err;
    }
  },

  markChatAsRead: (chatId) => {
    try {
      statements.markChatAsRead.run(chatId);
    } catch (err) {
      console.error('Error marking chat as read:', err);
      throw err;
    }
  },

  getSetting: (key) => {
    try {
      const row = statements.getSetting.get(key);
      return row ? row.value : null;
    } catch (err) {
      console.error('Error getting setting:', err);
      throw err;
    }
  },

  updateSetting: (key, value) => {
    try {
      statements.updateSetting.run(key, value);
    } catch (err) {
      console.error('Error updating setting:', err);
      throw err;
    }
  },

  getUnreadCount: () => {
    try {
      const row = statements.getUnreadCount.get();
      return row.count;
    } catch (err) {
      console.error('Error getting unread count:', err);
      throw err;
    }
  },

  getUniqueChats: () => {
    try {
      const chats = statements.getUniqueChats.all();
      return chats.map(chat => {
        const lastMsg = statements.getLastMessage.get(chat.chatId);
        return {
          ...chat,
          lastMessageText: lastMsg ? lastMsg.message : '',
          lastMessageDirection: lastMsg ? lastMsg.direction : ''
        };
      });
    } catch (err) {
      console.error('Error getting unique chats:', err);
      throw err;
    }
  },

  getStreak: () => {
    try {
      return statements.getStreak.get();
    } catch (err) {
      console.error('Error getting streak:', err);
      throw err;
    }
  },

  updateStreakDaily: () => {
    try {
      const streak = statements.getStreak.get();
      const today = new Date().toISOString().split('T')[0];
      const lastUpdated = streak.lastUpdated;

      if (lastUpdated === today) {
        return streak;
      }

      const phoneUsage = statements.checkPhoneUsage.get();
      
      if (phoneUsage.count > 0) {
        console.log('⚠️ Streak broken! User sent messages from phone/WhatsApp Web');
        statements.resetStreak.run();
        return statements.getStreak.get();
      }

      const lastDate = new Date(lastUpdated);
      const currentDate = new Date(today);
      const diffTime = currentDate - lastDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let newStreak = streak.currentStreak;
      
      if (diffDays === 1) {
        newStreak = streak.currentStreak + 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }

      const newLongest = Math.max(newStreak, streak.longestStreak);
      const newTotal = streak.totalDaysDetox + 1;

      statements.updateStreak.run(newStreak, newLongest, today, newTotal);
      
      console.log(`✅ Streak updated: ${newStreak} days (Longest: ${newLongest})`);
      
      return statements.getStreak.get();
    } catch (err) {
      console.error('Error updating streak:', err);
      throw err;
    }
  },

  resetStreak: () => {
    try {
      statements.resetStreak.run();
      console.log('🔄 Streak reset to 0');
      return statements.getStreak.get();
    } catch (err) {
      console.error('Error resetting streak:', err);
      throw err;
    }
  },

  checkAndResetStreak: () => {
    try {
      const phoneUsage = statements.checkPhoneUsage.get();
      
      if (phoneUsage.count > 0) {
        statements.resetStreak.run();
        return { reset: true, streak: statements.getStreak.get() };
      }
      
      return { reset: false, streak: statements.getStreak.get() };
    } catch (err) {
      console.error('Error checking streak:', err);
      throw err;
    }
  },

  getContactAutoReply: (contactNumber) => {
    try {
      const normalized = contactNumber.replace(/[@c.us|@g.us|\s|\-|\+|KATEX_INLINE_OPEN|KATEX_INLINE_CLOSE]/g, '');
      const allContacts = statements.getAllContactAutoReplies.all();
      const match = allContacts.find(contact => {
        const normalizedContact = contact.contactNumber.replace(/[@c.us|@g.us|\s|\-|\+|KATEX_INLINE_OPEN|KATEX_INLINE_CLOSE]/g, '');
        return normalizedContact === normalized && contact.enabled === 1;
      });
      return match || null;
    } catch (err) {
      console.error('Error getting contact auto-reply:', err);
      return null;
    }
  },

  getAllContactAutoReplies: () => {
    try {
      return statements.getAllContactAutoReplies.all();
    } catch (err) {
      console.error('Error getting all contact auto-replies:', err);
      return [];
    }
  },

  addContactAutoReply: (contactNumber, contactName, customMessage, enabled = 1) => {
    try {
      statements.addContactAutoReply.run(contactNumber, contactName, customMessage, enabled);
      return { success: true };
    } catch (err) {
      console.error('Error adding contact auto-reply:', err);
      throw err;
    }
  },

  deleteContactAutoReply: (id) => {
    try {
      statements.deleteContactAutoReply.run(id);
      return { success: true };
    } catch (err) {
      console.error('Error deleting contact auto-reply:', err);
      throw err;
    }
  },

  toggleContactAutoReply: (id, enabled) => {
    try {
      statements.toggleContactAutoReply.run(enabled ? 1 : 0, id);
      return { success: true };
    } catch (err) {
      console.error('Error toggling contact auto-reply:', err);
      throw err;
    }
  }
};

module.exports = { db, dbHelpers };
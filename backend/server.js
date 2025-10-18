require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const { dbHelpers } = require('./database');
const WhatsAppClient = require('./whatsappClient');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const FRONTEND_URLS = [
  (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  'http://localhost:5173',
];

const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      const cleanedOrigin = origin.replace(/\/$/, '');
      if (FRONTEND_URLS.includes(cleanedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const cleanedOrigin = origin.replace(/\/$/, '');
    if (FRONTEND_URLS.includes(cleanedOrigin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'wbridge-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax'
  },
  proxy: isProduction
}));

let whatsappClient;

const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.get('/', (req, res) => {
  res.json({ 
    status: 'WBridge Backend Running',
    version: '1.0.0',
    author: 'Vaibhav'
  });
});

app.post('/api/login', async (req, res) => {
  try {
    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD || 'VaibhavDiwali2024';

    if (password === correctPassword) {
      req.session.authenticated = true;
      await new Promise((resolve) => req.session.save(resolve));
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

app.get('/api/status', isAuthenticated, (req, res) => {
  try {
    const status = whatsappClient.getStatus();
    res.json(status);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qr', isAuthenticated, (req, res) => {
  try {
    const { qrCode } = whatsappClient.getStatus();
    res.json({ qrCode: qrCode || null, message: qrCode ? undefined : 'No QR code available' });
  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/logout', isAuthenticated, async (req, res) => {
  try {
    await whatsappClient.logout();
    res.json({ success: true, message: 'Disconnected from WhatsApp' });
  } catch (err) {
    console.error('WhatsApp logout error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', isAuthenticated, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const messages = dbHelpers.getAllMessages(limit);
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/:chatId', isAuthenticated, (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = dbHelpers.getMessagesByChat(chatId);
    res.json({ messages });
  } catch (err) {
    console.error('Get chat messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/search/:query', isAuthenticated, (req, res) => {
  try {
    const { query } = req.params;
    const messages = dbHelpers.searchMessages(query);
    res.json({ messages });
  } catch (err) {
    console.error('Search messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chats', isAuthenticated, (req, res) => {
  try {
    const chats = dbHelpers.getUniqueChats();
    res.json({ chats });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/:id/read', isAuthenticated, (req, res) => {
  try {
    dbHelpers.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/:chatId/read', isAuthenticated, (req, res) => {
  try {
    dbHelpers.markChatAsRead(req.params.chatId);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark chat read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send', isAuthenticated, async (req, res) => {
  try {
    const { number, message } = req.body;
    if (!number || !message) return res.status(400).json({ error: 'Number and message are required' });

    const result = await whatsappClient.sendMessage(number, message);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/unread-count', isAuthenticated, (req, res) => {
  try {
    const count = dbHelpers.getUnreadCount();
    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auto-reply/status', isAuthenticated, (req, res) => {
  try {
    const enabled = dbHelpers.getSetting('autoReplyEnabled');
    const message = dbHelpers.getSetting('autoReplyMessage');
    res.json({ enabled: enabled === 'true', message });
  } catch (err) {
    console.error('Get auto-reply status error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auto-reply/toggle', isAuthenticated, (req, res) => {
  try {
    const { enabled } = req.body;
    dbHelpers.updateSetting('autoReplyEnabled', enabled ? 'true' : 'false');
    res.json({ success: true, enabled });
  } catch (err) {
    console.error('Toggle auto-reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auto-reply/message', isAuthenticated, (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    dbHelpers.updateSetting('autoReplyMessage', message);
    res.json({ success: true, message });
  } catch (err) {
    console.error('Update auto-reply message error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/streak', isAuthenticated, (req, res) => {
  try {
    res.json(dbHelpers.getStreak());
  } catch (err) {
    console.error('Get streak error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/streak/update', isAuthenticated, (req, res) => {
  try {
    res.json({ success: true, streak: dbHelpers.updateStreakDaily() });
  } catch (err) {
    console.error('Update streak error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/streak/reset', isAuthenticated, (req, res) => {
  try {
    res.json({ success: true, streak: dbHelpers.resetStreak() });
  } catch (err) {
    console.error('Reset streak error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wbridge/status', isAuthenticated, (req, res) => {
  try {
    const enabled = dbHelpers.getSetting('wbridgeEnabled');
    res.json({ enabled: enabled === 'true' });
  } catch (err) {
    console.error('Get WBridge status error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wbridge/toggle', isAuthenticated, (req, res) => {
  try {
    const { enabled } = req.body;
    dbHelpers.updateSetting('wbridgeEnabled', enabled ? 'true' : 'false');
    console.log(`🔄 WBridge ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, enabled });
  } catch (err) {
    console.error('Toggle WBridge error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contact-auto-replies', isAuthenticated, (req, res) => {
  try {
    res.json({ contacts: dbHelpers.getAllContactAutoReplies() });
  } catch (err) {
    console.error('Get contact auto-replies error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact-auto-replies', isAuthenticated, (req, res) => {
  try {
    const { contactNumber, contactName, customMessage, enabled } = req.body;
    if (!contactNumber || !customMessage) return res.status(400).json({ error: 'Contact number and message are required' });

    dbHelpers.addContactAutoReply(contactNumber, contactName || contactNumber, customMessage, enabled ? 1 : 0);
    console.log(`✅ Added custom auto-reply for ${contactName || contactNumber}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Add contact auto-reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contact-auto-replies/:id', isAuthenticated, (req, res) => {
  try {
    dbHelpers.deleteContactAutoReply(req.params.id);
    console.log(`🗑️ Deleted contact auto-reply ID: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete contact auto-reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact-auto-replies/:id/toggle', isAuthenticated, (req, res) => {
  try {
    const { enabled } = req.body;
    dbHelpers.toggleContactAutoReply(req.params.id, enabled);
    console.log(`🔄 Toggled contact auto-reply ID: ${req.params.id} to ${enabled ? 'ON' : 'OFF'}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle contact auto-reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });

  socket.on('request_status', () => {
    const status = whatsappClient.getStatus();
    socket.emit('status_update', status);
  });
});

const scheduleStreakUpdate = () => {
  const now = new Date();
  const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const msToMidnight = night.getTime() - now.getTime();

  setTimeout(() => {
    dbHelpers.updateStreakDaily();
    io.emit('streak_updated', dbHelpers.getStreak());
    setInterval(() => {
      dbHelpers.updateStreakDaily();
      io.emit('streak_updated', dbHelpers.getStreak());
    }, 24 * 60 * 60 * 1000);
  }, msToMidnight);

  console.log(`⏰ Streak scheduler started. Next update in ${Math.round(msToMidnight / 1000 / 60)} minutes`);
};

const initializeWhatsApp = async () => {
  try {
    console.log('🚀 Initializing WhatsApp Client...');
    whatsappClient = new WhatsAppClient(io);
    await whatsappClient.initialize();
  } catch (err) {
    console.error('❌ Failed to initialize WhatsApp:', err);
    setTimeout(initializeWhatsApp, 10000);
  }
};

server.listen(PORT, async () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🌉 WBridge Backend Server Running   ║
  ║                                        ║
  ║   Port: ${PORT}                         ║
  ║   Frontend: ${FRONTEND_URLS[0]}    ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   Author: Vaibhav                      ║
  ╚════════════════════════════════════════╝
  `);

  await initializeWhatsApp();
  scheduleStreakUpdate();
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (whatsappClient) {
    await whatsappClient.logout();
  }
  process.exit(0);
});

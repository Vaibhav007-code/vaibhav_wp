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

// Get all allowed frontend URLs
const getAllowedOrigins = () => {
  const origins = [
    process.env.FRONTEND_URL,
    'https://vaibhav-wp2.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174'
  ].filter(Boolean).map(url => url.replace(/\/$/, ''));
  
  console.log('✅ Allowed origins:', origins);
  return origins;
};

const FRONTEND_URLS = getAllowedOrigins();

// Trust proxy for Render
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const cleanedOrigin = origin.replace(/\/$/, '');
    
    // Check if origin is allowed
    if (FRONTEND_URLS.includes(cleanedOrigin) || cleanedOrigin.includes('onrender.com')) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Socket.IO with same CORS
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'wbridge-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'wbridge.sid',
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    domain: undefined // Let browser handle it
  },
  proxy: true,
  rolling: true // Reset cookie expiration on every request
};

app.use(session(sessionConfig));

// Debug middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Session: ${req.sessionID?.substring(0, 8)}... Auth: ${!!req.session.authenticated}`);
  next();
});

let whatsappClient;

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    console.log('❌ Unauthorized access attempt:', {
      path: req.path,
      sessionID: req.sessionID,
      authenticated: req.session?.authenticated,
      cookie: req.headers.cookie ? 'present' : 'missing'
    });
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Please log in again'
    });
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'WBridge Backend Running',
    version: '1.0.0',
    author: 'Vaibhav',
    authenticated: !!req.session.authenticated
  });
});

app.post('/api/login', async (req, res) => {
  try {
    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD || 'VaibhavDiwali2024';

    console.log('🔑 Login attempt');

    if (password === correctPassword) {
      req.session.authenticated = true;
      
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('✅ Login successful - Session:', req.sessionID.substring(0, 8));
      
      res.json({ 
        success: true, 
        message: 'Login successful'
      });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.clearCookie('wbridge.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated
  });
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
    res.json({ qrCode: qrCode || null });
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

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  if (whatsappClient) {
    const status = whatsappClient.getStatus();
    socket.emit('status_update', status);
    
    if (status.qrCode) {
      socket.emit('qr', status.qrCode);
    }
  }

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });

  socket.on('request_status', () => {
    if (whatsappClient) {
      const status = whatsappClient.getStatus();
      socket.emit('status_update', status);
    }
  });
});

// Streak scheduler
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

  console.log(`⏰ Streak scheduler started`);
};

// Initialize WhatsApp
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

// Start server
server.listen(PORT, async () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🌉 WBridge Backend Server Running   ║
  ║                                        ║
  ║   Port: ${PORT}                         ║
  ║   Environment: ${isProduction ? 'production' : 'development'}              ║
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

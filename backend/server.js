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
  'https://vaibhav-wp2.onrender.com',
  'http://localhost:5173',
];

const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      const cleanedOrigin = origin.replace(/\/$/, '');
      if (FRONTEND_URLS.some(url => cleanedOrigin === url || cleanedOrigin.includes('onrender.com'))) {
        callback(null, true);
      } else {
        console.warn('⚠️ CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('trust proxy', 1);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const cleanedOrigin = origin.replace(/\/$/, '');
    if (FRONTEND_URLS.some(url => cleanedOrigin === url || cleanedOrigin.includes('onrender.com'))) {
      return callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
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

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'wbridge-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'wbridge.sid',
  cookie: {
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  },
  proxy: true
});

app.use(sessionMiddleware);

let whatsappClient;

const isAuthenticated = (req, res, next) => {
  console.log('🔐 Auth check - Session ID:', req.sessionID);
  console.log('🔐 Authenticated:', req.session.authenticated);
  
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', sessionID: req.sessionID });
  }
};

app.get('/', (req, res) => {
  res.json({ 
    status: 'WBridge Backend Running',
    version: '1.0.0',
    author: 'Vaibhav',
    socketConnections: io.engine.clientsCount,
    sessionID: req.sessionID
  });
});

app.post('/api/login', async (req, res) => {
  try {
    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD || 'VaibhavDiwali2024';

    console.log('🔑 Login attempt - Session ID:', req.sessionID);

    if (password === correctPassword) {
      req.session.authenticated = true;
      
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('❌ Session save error:', err);
            reject(err);
          } else {
            console.log('✅ Login successful - Session saved:', req.sessionID);
            resolve();
          }
        });
      });

      res.json({ 
        success: true, 
        message: 'Login successful',
        sessionID: req.sessionID
      });
    } else {
      console.log('❌ Invalid password attempt');
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get('/api/auth-status', (req, res) => {
  console.log('🔍 Auth status check - Session ID:', req.sessionID, 'Authenticated:', req.session.authenticated);
  res.json({ 
    authenticated: !!req.session.authenticated,
    sessionID: req.sessionID
  });
});

app.get('/api/status', isAuthenticated, (req, res) => {
  try {
    const status = whatsappClient.getStatus();
    console.log('📊 Status requested:', status);
    res.json(status);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qr', isAuthenticated, (req, res) => {
  try {
    const { qrCode } = whatsappClient.getStatus();
    console.log('📱 QR requested, available:', !!qrCode);
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
  console.log('📊 Total connections:', io.engine.clientsCount);

  if (whatsappClient) {
    const status = whatsappClient.getStatus();
    console.log('📤 Sending initial status to new client:', status);
    socket.emit('status_update', status);
    
    if (status.qrCode) {
      console.log('📱 Sending QR code to new client');
      socket.emit('qr', status.qrCode);
    }
  }

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    console.log('📊 Total connections:', io.engine.clientsCount);
  });

  socket.on('request_status', () => {
    console.log('📨 Status requested by client:', socket.id);
    if (whatsappClient) {
      const status = whatsappClient.getStatus();
      socket.emit('status_update', status);
      console.log('📤 Status sent to client');
    }
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
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
```

### **2. Update Render Environment Variables**

In your Render backend dashboard, make sure you have:
```
NODE_ENV=production
FRONTEND_URL=https://vaibhav-wp2.onrender.com
SESSION_SECRET=your-very-secure-random-string-here
DASHBOARD_PASSWORD=YourPassword123
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

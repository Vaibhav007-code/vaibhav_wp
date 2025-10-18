const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { dbHelpers } = require('./database');

class WhatsAppClient {
  constructor(io) {
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.io = io;
    this.openChats = new Set();
    this.isDashboardMessage = false;
    this.initClient();
    this.setupSocketListeners();
  }

  normalizePhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  setupSocketListeners() {
    this.io.on('connection', (socket) => {
      socket.on('chat_opened', (chatId) => {
        this.openChats.add(chatId);
        console.log(`📖 Chat opened: ${chatId}`);
      });

      socket.on('chat_closed', () => {
        this.openChats.clear();
        console.log(`📕 All chats closed`);
      });

      socket.on('disconnect', () => {
        this.openChats.clear();
      });
    });
  }

  initClient() {
    console.log('🔄 Initializing WhatsApp Client...');
    
    // Detect Chromium path for different environments
    const chromiumPath = process.env.CHROME_BIN || 
                        process.env.PUPPETEER_EXECUTABLE_PATH ||
                        '/usr/bin/chromium-browser' ||
                        '/usr/bin/chromium' ||
                        '/usr/bin/google-chrome';

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      }
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('qr', async (qr) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        console.log('📱 QR Code generated');
        this.io.emit('qr', this.qrCode);
      } catch (err) {
        console.error('❌ QR Code generation error:', err);
      }
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      console.log('✅ WhatsApp Client is ready!');
      this.io.emit('ready');
    });

    this.client.on('authenticated', () => {
      console.log('✅ Client authenticated');
      this.io.emit('authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      this.io.emit('auth_failure', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 Client disconnected:', reason);
      this.isReady = false;
      this.qrCode = null;
      this.io.emit('disconnected', reason);
    });

    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log(`⏳ Loading: ${percent}% - ${message}`);
    });
  }

  async handleMessage(message) {
    try {
      if (this.isDashboardMessage) {
        this.isDashboardMessage = false;
        return;
      }

      const contact = await message.getContact();
      const chat = await message.getChat();
      const isGroup = chat.isGroup;
      const fromMe = message.fromMe;

      const chatId = message.from;
      const chatName = isGroup ? chat.name : (contact.pushname || contact.name || contact.number);

      const msgData = {
        id: message.id._serialized,
        chatId: chatId,
        chatName: chatName,
        body: message.body,
        fromMe: fromMe,
        timestamp: message.timestamp,
        isRead: fromMe ? 1 : 0
      };

      dbHelpers.saveMessage(msgData);

      const isFromOpenChat = this.openChats.has(chatId);

      this.io.emit('new_message', {
        ...msgData,
        isFromOpenChat
      });

      if (!fromMe) {
        const wbridgeEnabled = dbHelpers.getSetting('wbridgeEnabled') === 'true';
        if (!wbridgeEnabled) return;

        const contactAutoReply = dbHelpers.getContactAutoReply(chatId);
        if (contactAutoReply && contactAutoReply.enabled) {
          console.log(`🤖 Sending custom auto-reply to ${chatName}`);
          await chat.sendMessage(contactAutoReply.customMessage);
          return;
        }

        const autoReplyEnabled = dbHelpers.getSetting('autoReplyEnabled') === 'true';
        if (autoReplyEnabled) {
          const autoReplyMessage = dbHelpers.getSetting('autoReplyMessage') || 
            'Thank you for your message! I will get back to you soon.';
          console.log(`🤖 Sending auto-reply to ${chatName}`);
          await chat.sendMessage(autoReplyMessage);
        }
      }
    } catch (err) {
      console.error('❌ Error handling message:', err);
    }
  }

  async initialize() {
    try {
      console.log('🚀 Starting WhatsApp client initialization...');
      await this.client.initialize();
    } catch (err) {
      console.error('❌ Error initializing client:', err);
      throw err;
    }
  }

  async sendMessage(number, message) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const normalizedNumber = this.normalizePhoneNumber(number);
      if (!normalizedNumber) {
        throw new Error('Invalid phone number');
      }

      const chatId = normalizedNumber.includes('@c.us') 
        ? normalizedNumber 
        : `${normalizedNumber}@c.us`;

      this.isDashboardMessage = true;

      await this.client.sendMessage(chatId, message);

      const msgData = {
        id: `${Date.now()}-dashboard`,
        chatId: chatId,
        chatName: normalizedNumber,
        body: message,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
        isRead: 1
      };

      dbHelpers.saveMessage(msgData);

      this.io.emit('new_message', msgData);

      console.log(`✅ Message sent to ${normalizedNumber}`);
      return { success: true, chatId, message };
    } catch (err) {
      console.error('❌ Error sending message:', err);
      throw err;
    }
  }

  getStatus() {
    return {
      isConnected: this.isReady,
      hasQR: !!this.qrCode,
      qrCode: this.qrCode
    };
  }

  async logout() {
    try {
      await this.client.logout();
      await this.client.destroy();
      this.isReady = false;
      this.qrCode = null;
      this.openChats.clear();
      console.log('✅ Logged out successfully');
    } catch (err) {
      console.error('❌ Error logging out:', err);
      throw err;
    }
  }
}

module.exports = WhatsAppClient;

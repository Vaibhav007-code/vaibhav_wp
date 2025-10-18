const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { dbHelpers } = require('./database');
const fs = require('fs');

class WhatsAppClient {
  constructor(io) {
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.io = io;
    this.openChats = new Set();
    this.isDashboardMessage = false;
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
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

  findChromiumPath() {
    const paths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];

    for (const path of paths) {
      if (path && fs.existsSync(path)) {
        console.log(`✅ Found Chromium at: ${path}`);
        return path;
      }
    }

    console.warn('⚠️ No Chromium found, using default');
    return undefined;
  }

  initClient() {
    console.log('🔄 Initializing WhatsApp Client...');
    
    const chromiumPath = this.findChromiumPath();

    const puppeteerConfig = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio'
      ]
    };

    if (chromiumPath) {
      puppeteerConfig.executablePath = chromiumPath;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth',
        clientId: 'wbridge-client'
      }),
      puppeteer: puppeteerConfig,
      authTimeoutMs: 0,
      qrTimeoutMs: 0,
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('qr', async (qr) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.isReady = false;
        console.log('📱 QR Code generated successfully');
        this.io.emit('qr', this.qrCode);
        this.io.emit('status_update', {
          isConnected: false,
          hasQR: true,
          qrCode: this.qrCode
        });
      } catch (err) {
        console.error('❌ QR Code generation error:', err);
      }
    });

    this.client.on('authenticated', () => {
      console.log('✅ Client authenticated successfully!');
      this.qrCode = null;
      this.reconnectAttempts = 0;
      this.io.emit('authenticated');
      this.io.emit('status_update', {
        isConnected: false,
        hasQR: false,
        qrCode: null,
        message: 'Authenticated, loading WhatsApp...'
      });
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log(`⏳ Loading: ${percent}% - ${message}`);
      this.io.emit('loading_screen', { percent, message });
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      this.isInitializing = false;
      this.reconnectAttempts = 0;
      console.log('✅✅✅ WhatsApp Client is READY! ✅✅✅');
      
      this.io.emit('ready');
      this.io.emit('status_update', {
        isConnected: true,
        hasQR: false,
        qrCode: null
      });
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      this.isReady = false;
      this.qrCode = null;
      this.reconnectAttempts++;

      this.io.emit('auth_failure', msg);
      this.io.emit('status_update', {
        isConnected: false,
        hasQR: false,
        qrCode: null,
        error: 'Authentication failed. Please scan QR code again.'
      });

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`🔄 Retrying... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.initialize();
        }, 5000);
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 Client disconnected:', reason);
      this.isReady = false;
      this.qrCode = null;
      this.io.emit('disconnected', reason);
      this.io.emit('status_update', {
        isConnected: false,
        hasQR: false,
        qrCode: null
      });
    });

    this.client.on('change_state', (state) => {
      console.log('🔄 WhatsApp state changed:', state);
    });

    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('message_create', async (message) => {
      if (message.fromMe) {
        console.log('📤 Message sent from this device');
      }
    });
  }

  async handleMessage(message) {
    try {
      if (this.isDashboardMessage) {
        this.isDashboardMessage = false;
        return;
      }

      if (message.fromMe) {
        return;
      }

      const contact = await message.getContact();
      const chat = await message.getChat();
      const isGroup = chat.isGroup;

      const chatId = message.from;
      const chatName = isGroup ? chat.name : (contact.pushname || contact.name || contact.number);

      const msgData = {
        id: message.id._serialized,
        chatId: chatId,
        chatName: chatName,
        body: message.body,
        fromMe: false,
        timestamp: message.timestamp,
        isRead: 0
      };

      dbHelpers.saveMessage(msgData);

      const isFromOpenChat = this.openChats.has(chatId);

      this.io.emit('new_message', {
        ...msgData,
        isFromOpenChat
      });

      console.log(`📨 New message from ${chatName}`);

      const wbridgeEnabled = dbHelpers.getSetting('wbridgeEnabled') === 'true';
      if (!wbridgeEnabled) {
        console.log('🔕 WBridge auto-reply is disabled');
        return;
      }

      const contactAutoReply = dbHelpers.getContactAutoReply(chatId);
      if (contactAutoReply && contactAutoReply.enabled) {
        console.log(`🤖 Sending custom auto-reply to ${chatName}`);
        setTimeout(async () => {
          try {
            await chat.sendMessage(contactAutoReply.customMessage);
            console.log('✅ Custom auto-reply sent');
          } catch (err) {
            console.error('❌ Failed to send custom auto-reply:', err);
          }
        }, 2000);
        return;
      }

      const autoReplyEnabled = dbHelpers.getSetting('autoReplyEnabled') === 'true';
      if (autoReplyEnabled) {
        const autoReplyMessage = dbHelpers.getSetting('autoReplyMessage') || 
          'Thank you for your message! I will get back to you soon.';
        console.log(`🤖 Sending global auto-reply to ${chatName}`);
        setTimeout(async () => {
          try {
            await chat.sendMessage(autoReplyMessage);
            console.log('✅ Global auto-reply sent');
          } catch (err) {
            console.error('❌ Failed to send auto-reply:', err);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('❌ Error handling message:', err);
    }
  }

  async initialize() {
    if (this.isInitializing) {
      console.log('⚠️ Already initializing, skipping...');
      return;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 Starting WhatsApp client initialization...');
      console.log('⏰ Note: This may take 1-3 minutes on first connection...');
      await this.client.initialize();
    } catch (err) {
      console.error('❌ Error initializing client:', err);
      this.isInitializing = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`🔄 Retrying initialization... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.initialize();
        }, 10000);
      } else {
        throw err;
      }
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
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
      }
      this.isReady = false;
      this.qrCode = null;
      this.openChats.clear();
      this.isInitializing = false;
      this.reconnectAttempts = 0;
      console.log('✅ Logged out successfully');
    } catch (err) {
      console.error('❌ Error logging out:', err);
      throw err;
    }
  }
}

module.exports = WhatsAppClient;

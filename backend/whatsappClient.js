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

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // ✅ Fixed: use env path
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('qr', async (qr) => {
      console.log('📱 QR Code received - scan with WhatsApp');
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.io.emit('qr', this.qrCode);
      } catch (err) {
        console.error('❌ Error generating QR code:', err);
      }
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp Client is ready!');
      this.isReady = true;
      this.qrCode = null;
      this.io.emit('ready', { message: 'WhatsApp connected successfully' });
    });

    this.client.on('authenticated', () => {
      console.log('✅ Authenticated successfully');
      this.io.emit('authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failure:', msg);
      this.isReady = false;
      this.io.emit('auth_failure', { message: msg });
    });

    this.client.on('disconnected', (reason) => {
      console.log('❌ Client disconnected:', reason);
      this.isReady = false;
      this.io.emit('disconnected', { reason });
    });

    this.client.on('message_create', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log(`⏳ Loading: ${percent}% - ${message}`);
    });
  }

  async handleMessage(message) {
    // ... Your existing handleMessage logic remains unchanged ...
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
    // ... Your existing sendMessage logic remains unchanged ...
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

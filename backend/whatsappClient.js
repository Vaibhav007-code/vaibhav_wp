const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { dbHelpers } = require('./database');
const puppeteer = require('puppeteer'); // ✅ Import Puppeteer for bundled Chromium

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
        executablePath: puppeteer.executablePath(), // ✅ Use Puppeteer's bundled Chromium
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
    // ... All your existing event handlers remain unchanged ...
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


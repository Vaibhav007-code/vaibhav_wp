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
    // Remove everything except digits
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
    try {
      if (message.from === 'status@broadcast') {
        return;
      }

      const contact = await message.getContact();
      const chat = await message.getChat();
      
      const sender = contact.number || contact.id.user;
      let senderName = chat.name || contact.pushname || contact.name || contact.verifiedName || sender;
      
      if (chat.isGroup && !message.fromMe) {
        try {
          const participant = message.author || message.from;
          const participantContact = await this.client.getContactById(participant);
          senderName = participantContact.pushname || participantContact.name || participantContact.verifiedName || participant;
        } catch (err) {
          console.log('Could not get participant name:', err.message);
        }
      }

      let messageBody = message.body;
      let mediaType = null;
      let mediaData = null;

      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            mediaType = media.mimetype.split('/')[0];
            mediaData = `data:${media.mimetype};base64,${media.data}`;
            messageBody = message.body || `[${mediaType.toUpperCase()}]`;
            console.log(`📎 Media received: ${mediaType} from ${senderName}`);
          }
        } catch (err) {
          console.error('Error downloading media:', err);
          messageBody = '[Media - could not download]';
        }
      }

      const chatId = chat.id._serialized;
      const direction = message.fromMe ? 'outgoing' : 'incoming';
      const isGroup = chat.isGroup;

      if (message.fromMe && !this.isDashboardMessage) {
        console.log('⚠️ Message sent from phone/web detected - resetting streak!');
        const result = dbHelpers.resetStreak();
        this.io.emit('streak_reset', result);
      }

      const messageId = dbHelpers.insertMessage(
        sender,
        senderName,
        messageBody,
        direction,
        chatId,
        this.isDashboardMessage ? 1 : 0,
        mediaType,
        mediaData
      );

      this.isDashboardMessage = false;

      this.io.emit('new_message', {
        id: messageId,
        sender,
        senderName,
        message: messageBody,
        timestamp: new Date(),
        direction,
        chatId,
        isRead: 0,
        isGroup,
        mediaType,
        mediaData
      });

      console.log(`📨 ${direction === 'incoming' ? 'Received' : 'Sent'} message from ${senderName}${isGroup ? ' (Group)' : ''}: ${messageBody.substring(0, 50)}...`);

      // AUTO-REPLY LOGIC
      if (!message.fromMe && direction === 'incoming') {
        const wbridgeEnabled = dbHelpers.getSetting('wbridgeEnabled');
        
        if (wbridgeEnabled !== 'true') {
          console.log('⏭️  Skipping auto-reply - WBridge is MASTER DISABLED');
          return;
        }

        const isChatOpen = this.openChats.has(chatId);
        
        if (isChatOpen) {
          console.log(`⏭️  Skipping auto-reply - chat is OPEN in dashboard`);
          return;
        }

        if (isGroup) {
          const myNumber = this.client.info.wid.user;
          const isMentioned = messageBody.includes(`@${myNumber}`) || message.mentionedIds?.includes(this.client.info.wid._serialized);
          
          if (!isMentioned) {
            console.log(`⏭️  Skipping auto-reply - GROUP message without mention`);
            return;
          }
        }

        // NORMALIZE AND CHECK CUSTOM CONTACT
        const normalizedSender = this.normalizePhoneNumber(sender);
        console.log(`\n🔍 ===== AUTO-REPLY CHECK =====`);
        console.log(`📞 Sender: ${senderName} (${sender})`);
        console.log(`🔢 Normalized Sender: ${normalizedSender}`);

        const allContactReplies = dbHelpers.getAllContactAutoReplies();
        console.log(`📋 Total custom contacts in DB: ${allContactReplies.length}`);
        
        allContactReplies.forEach(contact => {
          const normalizedContact = this.normalizePhoneNumber(contact.contactNumber);
          console.log(`   - ${contact.contactName}: ${contact.contactNumber} → Normalized: ${normalizedContact} (Enabled: ${contact.enabled})`);
        });

        const contactAutoReply = allContactReplies.find(contact => {
          const normalizedContact = this.normalizePhoneNumber(contact.contactNumber);
          const matches = normalizedContact === normalizedSender && contact.enabled === 1;
          
          console.log(`   🔄 Comparing: ${normalizedContact} === ${normalizedSender} → ${matches ? '✅ MATCH!' : '❌'}`);
          
          return matches;
        });

        let autoReplyMessage = null;
        let replyType = null;

        if (contactAutoReply) {
          // CUSTOM REPLY FOUND - USE IT (ALWAYS, regardless of global toggle)
          autoReplyMessage = contactAutoReply.customMessage;
          replyType = '🎯 CUSTOM';
          console.log(`✅ CUSTOM REPLY FOUND for ${senderName}!`);
          console.log(`📝 Custom message: "${autoReplyMessage.substring(0, 50)}..."`);
        } else {
          console.log(`❌ No custom reply found for ${normalizedSender}`);
          
          // CHECK GLOBAL TOGGLE
          const globalAutoReplyEnabled = dbHelpers.getSetting('autoReplyEnabled');
          console.log(`🌐 Global auto-reply toggle: ${globalAutoReplyEnabled}`);
          
          if (globalAutoReplyEnabled === 'true') {
            autoReplyMessage = dbHelpers.getSetting('autoReplyMessage');
            replyType = '🌍 GLOBAL';
            console.log(`✅ Using GLOBAL auto-reply`);
            console.log(`📝 Global message: "${autoReplyMessage.substring(0, 50)}..."`);
          } else {
            console.log(`⏭️  SKIPPING - Global toggle is OFF and no custom reply`);
            console.log(`===== END AUTO-REPLY CHECK =====\n`);
            return;
          }
        }

        // SEND AUTO-REPLY
        if (autoReplyMessage) {
          try {
            this.isDashboardMessage = true;
            
            await chat.sendMessage(autoReplyMessage);
            console.log(`\n✅ ${replyType} AUTO-REPLY SENT to ${senderName}`);
            console.log(`===== END AUTO-REPLY CHECK =====\n`);
            
            dbHelpers.insertMessage(
              sender,
              senderName,
              autoReplyMessage,
              'outgoing',
              chatId,
              1
            );

            this.io.emit('new_message', {
              sender,
              senderName,
              message: autoReplyMessage,
              timestamp: new Date(),
              direction: 'outgoing',
              chatId,
              isRead: 1
            });
          } catch (err) {
            console.error('❌ Error sending auto-reply:', err);
            this.isDashboardMessage = false;
          }
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
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      let chatId = number;
      if (!number.includes('@c.us')) {
        const cleanNumber = number.replace(/[^\d+]/g, '');
        chatId = `${cleanNumber}@c.us`;
      }

      this.isDashboardMessage = true;

      await this.client.sendMessage(chatId, message);
      
      const contact = await this.client.getContactById(chatId);
      const chat = await this.client.getChatById(chatId);
      const senderName = chat.name || contact.pushname || contact.name || contact.verifiedName || number;

      dbHelpers.insertMessage(
        number,
        senderName,
        message,
        'outgoing',
        chatId,
        1
      );

      console.log(`✅ Message sent to ${senderName} from dashboard`);

      return { success: true, chatId };
    } catch (err) {
      console.error('❌ Error sending message:', err);
      this.isDashboardMessage = false;
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
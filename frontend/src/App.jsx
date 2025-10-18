import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Login from './components/Login';
import StatusBar from './components/StatusBar';
import ConnectModal from './components/ConnectModal';
import CustomContactsModal from './components/CustomContactsModal';
import ChatList from './components/ChatList';
import MessageList from './components/MessageList';
import SendMessage from './components/SendMessage';
import AutoReplyToggle from './components/AutoReplyToggle';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://vaibhav-wp-34.onrender.com';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCustomContactsModal, setShowCustomContactsModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplyMessage, setAutoReplyMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  axios.defaults.baseURL = API_URL;
  axios.defaults.withCredentials = true;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // FIXED: Added proper Socket.IO configuration
      const newSocket = io(API_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnection: true,
        reconnectionAttempts: 10,
        autoConnect: true
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('🔌 Socket connected:', newSocket.id);
        // Request status immediately after connecting
        newSocket.emit('request_status');
      });

      newSocket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
      });

      newSocket.on('qr', (qr) => {
        console.log('📱 Received QR code via socket');
        setQrCode(qr);
        setShowQRModal(true);
      });

      // ADDED: Listen for status updates
      newSocket.on('status_update', (status) => {
        console.log('📊 Status update received:', status);
        if (status.qrCode) {
          console.log('📱 QR code in status update');
          setQrCode(status.qrCode);
          setShowQRModal(true);
        }
        if (status.isConnected) {
          setIsConnected(true);
          setShowQRModal(false);
        }
      });

      newSocket.on('ready', () => {
        console.log('✅ WhatsApp ready');
        setIsConnected(true);
        setShowQRModal(false);
        setQrCode(null);
        fetchChats();
        fetchAutoReplyStatus();
      });

      newSocket.on('authenticated', () => {
        console.log('✅ WhatsApp authenticated');
      });

      newSocket.on('disconnected', () => {
        console.log('🔌 WhatsApp disconnected');
        setIsConnected(false);
      });

      newSocket.on('new_message', (message) => {
        console.log('📨 New message received:', message);
        
        if (selectedChat) {
          newSocket.emit('chat_opened', selectedChat.chatId);
        }
        
        fetchChats();
        if (selectedChat && message.chatId === selectedChat.chatId) {
          fetchMessages(selectedChat.chatId);
        }
        fetchUnreadCount();
      });

      newSocket.on('streak_updated', (newStreak) => {
        console.log('✅ Streak updated:', newStreak);
      });

      newSocket.on('streak_reset', (data) => {
        console.log('⚠️ Streak reset:', data);
        alert('⚠️ Streak Reset! Detected WhatsApp usage from phone/web.');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

      newSocket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });

      return () => {
        console.log('🔌 Closing socket connection');
        newSocket.close();
      };
    }
  }, [isAuthenticated]);

  // Separate useEffect for selected chat
  useEffect(() => {
    if (socket && selectedChat) {
      socket.emit('chat_opened', selectedChat.chatId);
      markChatAsRead(selectedChat.chatId);
    } else if (socket && !selectedChat) {
      socket.emit('chat_closed');
    }
  }, [selectedChat, socket]);

  useEffect(() => {
    if (isAuthenticated) {
      checkWhatsAppStatus();
      fetchChats();
      fetchAutoReplyStatus();
      fetchUnreadCount();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth-status');
      setIsAuthenticated(response.data.authenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      const response = await axios.get('/api/status');
      console.log('📊 Initial status check:', response.data);
      setIsConnected(response.data.isConnected);
      if (response.data.hasQR && response.data.qrCode) {
        setQrCode(response.data.qrCode);
        setShowQRModal(true);
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const fetchChats = async () => {
    try {
      const response = await axios.get('/api/chats');
      setChats(response.data.chats);
    } catch (error) {
      console.error('Fetch chats failed:', error);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await axios.get(`/api/messages/${chatId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Fetch messages failed:', error);
    }
  };

  const markChatAsRead = async (chatId) => {
    try {
      await axios.post(`/api/chats/${chatId}/read`);
      fetchChats();
      fetchUnreadCount();
    } catch (error) {
      console.error('Mark chat as read failed:', error);
    }
  };

  const fetchAutoReplyStatus = async () => {
    try {
      const response = await axios.get('/api/auto-reply/status');
      setAutoReplyEnabled(response.data.enabled);
      setAutoReplyMessage(response.data.message);
    } catch (error) {
      console.error('Fetch auto-reply failed:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Fetch unread count failed:', error);
    }
  };

  const handleLogin = async (password) => {
    try {
      const response = await axios.post('/api/login', { password });
      if (response.data.success) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      setIsAuthenticated(false);
      setIsConnected(false);
      setChats([]);
      setMessages([]);
      setSelectedChat(null);
      if (socket) {
        socket.close();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.chatId);
  };

  const handleBackToChats = () => {
    setSelectedChat(null);
    setMessages([]);
    fetchChats();
  };

  const handleSendMessage = async (number, message) => {
    try {
      await axios.post('/api/send', { number, message });
      if (selectedChat) {
        fetchMessages(selectedChat.chatId);
      }
      fetchChats();
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Send failed');
    }
  };

  const handleToggleAutoReply = async (enabled) => {
    try {
      await axios.post('/api/auto-reply/toggle', { enabled });
      setAutoReplyEnabled(enabled);
    } catch (error) {
      console.error('Toggle auto-reply failed:', error);
    }
  };

  const handleUpdateAutoReply = async (message) => {
    try {
      await axios.post('/api/auto-reply/message', { message });
      setAutoReplyMessage(message);
    } catch (error) {
      console.error('Update auto-reply failed:', error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const response = await axios.get(`/api/messages/search/${query}`);
        const searchChats = {};
        response.data.messages.forEach(msg => {
          if (!searchChats[msg.chatId]) {
            searchChats[msg.chatId] = {
              chatId: msg.chatId,
              sender: msg.sender,
              senderName: msg.senderName,
              lastMessage: msg.timestamp,
              messageCount: 0,
              unreadCount: 0
            };
          }
          searchChats[msg.chatId].messageCount++;
        });
        setChats(Object.values(searchChats));
      } catch (error) {
        console.error('Search failed:', error);
      }
    } else {
      fetchChats();
    }
  };

  const handleNotificationClick = () => {
    setShowUnreadOnly(!showUnreadOnly);
  };

  const filteredChats = showUnreadOnly 
    ? chats.filter(chat => chat.unreadCount > 0)
    : chats;

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <StatusBar
        isConnected={isConnected}
        unreadCount={unreadCount}
        onLogout={handleLogout}
        onConnect={() => setShowQRModal(true)}
        onNotificationClick={handleNotificationClick}
        showUnreadOnly={showUnreadOnly}
        onOpenCustomContacts={() => setShowCustomContactsModal(true)}
      />

      <div className="main-content">
        <div className={`sidebar ${!selectedChat ? 'active' : ''}`}>
          <div className="sidebar-header">
            <h2>Chats</h2>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
          </div>
          
          <AutoReplyToggle
            enabled={autoReplyEnabled}
            message={autoReplyMessage}
            onToggle={handleToggleAutoReply}
            onUpdateMessage={handleUpdateAutoReply}
          />

          <ChatList
            chats={filteredChats}
            selectedChat={selectedChat}
            onSelectChat={handleSelectChat}
          />
        </div>

        <div className={`chat-area ${selectedChat ? 'active' : ''}`}>
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div className="chat-header-left">
                  <button className="back-button" onClick={handleBackToChats}>
                    ← Back
                  </button>
                  <div className="chat-header-info">
                    <h3>{selectedChat.senderName || selectedChat.sender}</h3>
                    <span className="chat-number">{selectedChat.sender}</span>
                  </div>
                </div>
              </div>
              <MessageList messages={messages} />
              <SendMessage
                chatId={selectedChat.chatId}
                number={selectedChat.sender}
                onSend={handleSendMessage}
              />
            </>
          ) : (
            <div className="no-chat-selected">
              <div className="welcome-message">
                <h2>🌉 Welcome to WBridge</h2>
                <p>Select a chat to view messages</p>
                <p className="subtitle">Stay disconnected, stay informed 💬</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showQRModal && (
        <ConnectModal
          qrCode={qrCode}
          onClose={() => setShowQRModal(false)}
          socket={socket}
        />
      )}

      {showCustomContactsModal && (
        <CustomContactsModal
          isOpen={showCustomContactsModal}
          onClose={() => setShowCustomContactsModal(false)}
        />
      )}
    </div>
  );
}

export default App;

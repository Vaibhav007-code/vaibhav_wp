import React from 'react';
import { MessageCircle } from 'lucide-react';

function ChatList({ chats, selectedChat, onSelectChat }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const truncateMessage = (text, maxLength = 40) => {
    if (!text) return 'No messages yet';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="chat-list">
      {chats.length === 0 ? (
        <div className="no-chats">
          <MessageCircle size={48} />
          <p>No messages yet</p>
          <span>Messages will appear here once you receive them</span>
        </div>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.chatId}
            className={`chat-item ${selectedChat?.chatId === chat.chatId ? 'active' : ''} ${chat.unreadCount > 0 ? 'unread' : ''}`}
            onClick={() => onSelectChat(chat)}
          >
            <div className="chat-avatar">
              <div className="avatar-circle">
                {(chat.senderName || chat.sender).charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div className="chat-info">
              <div className="chat-top">
                <h4 className="chat-name">{chat.senderName || chat.sender}</h4>
                <span className="chat-time">
                  {formatTime(chat.lastMessage)}
                </span>
              </div>
              
              <div className="chat-bottom">
                <p className="chat-preview">
                  {chat.lastMessageDirection === 'outgoing' && (
                    <span className="message-direction">You: </span>
                  )}
                  {truncateMessage(chat.lastMessageText)}
                </p>
                {chat.unreadCount > 0 && (
                  <span className="unread-count">{chat.unreadCount}</span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ChatList;
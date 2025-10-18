import React, { useEffect, useRef } from 'react';
import { Check, CheckCheck, Image, Video, FileAudio, File } from 'lucide-react';

function MessageList({ messages }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(msg => {
      const dateKey = formatDate(msg.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const renderMedia = (message) => {
    if (!message.mediaType || !message.mediaData) {
      return null;
    }

    switch (message.mediaType) {
      case 'image':
        return (
          <div className="message-media">
            <img 
              src={message.mediaData} 
              alt="Shared image" 
              className="media-image"
              loading="lazy"
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="message-media">
            <video 
              src={message.mediaData} 
              controls 
              className="media-video"
            >
              Your browser does not support video playback.
            </video>
          </div>
        );
      
      case 'audio':
        return (
          <div className="message-media">
            <div className="media-audio-container">
              <FileAudio size={20} className="media-icon" />
              <audio 
                src={message.mediaData} 
                controls 
                className="media-audio"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="message-media">
            <div className="media-file">
              <File size={20} className="media-icon" />
              <span>Unsupported media type</span>
            </div>
          </div>
        );
    }
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="no-messages">
          <p>No messages in this chat</p>
        </div>
      ) : (
        <>
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="date-divider">
                <span>{date}</span>
              </div>
              {msgs.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
                >
                  <div className="message-content">
                    {renderMedia(message)}
                    {message.message && (
                      <p className="message-text">{message.message}</p>
                    )}
                    <div className="message-meta">
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                      {message.direction === 'outgoing' && (
                        <span className="message-status">
                          {message.isRead ? (
                            <CheckCheck size={16} className="read" />
                          ) : (
                            <Check size={16} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

export default MessageList;
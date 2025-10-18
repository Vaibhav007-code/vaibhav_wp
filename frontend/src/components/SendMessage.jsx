import React, { useState } from 'react';
import { Send } from 'lucide-react';

function SendMessage({ chatId, number, onSend }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    setSending(true);
    try {
      await onSend(number, message);
      setMessage('');
    } catch (error) {
      alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="send-message">
      <form onSubmit={handleSubmit} className="send-message-form">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="message-input"
          rows="1"
          disabled={sending}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!message.trim() || sending}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

export default SendMessage;
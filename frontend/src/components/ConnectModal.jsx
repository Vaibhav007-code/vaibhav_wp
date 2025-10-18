import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';

function ConnectModal({ qrCode, onClose, socket }) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    if (socket) {
      socket.on('loading_screen', ({ percent, message }) => {
        setLoadingProgress(percent);
        setLoadingMessage(message);
      });

      socket.on('ready', () => {
        setLoadingProgress(100);
        setLoadingMessage('Connected!');
        setTimeout(() => {
          onClose();
        }, 1000);
      });

      return () => {
        socket.off('loading_screen');
        socket.off('ready');
      };
    }
  }, [socket, onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="modal-header">
          <Smartphone size={48} className="modal-icon" />
          <h2>Connect WhatsApp</h2>
          <p>Scan the QR code with your WhatsApp mobile app</p>
        </div>

        <div className="qr-code-container">
          {qrCode && loadingProgress === 0 ? (
            <img src={qrCode} alt="QR Code" className="qr-code" />
          ) : loadingProgress > 0 ? (
            <div className="qr-loading">
              <div className="spinner"></div>
              <p>Connecting to WhatsApp...</p>
              <div style={{ 
                width: '100%', 
                backgroundColor: '#e0e0e0', 
                borderRadius: '10px', 
                marginTop: '20px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${loadingProgress}%`, 
                  backgroundColor: '#25d366', 
                  height: '10px',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
              <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                {loadingProgress}% - {loadingMessage}
              </p>
            </div>
          ) : (
            <div className="qr-loading">
              <div className="spinner"></div>
              <p>Generating QR Code...</p>
              <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                Socket: {socket?.connected ? '✅ Connected' : '❌ Disconnected'}
              </p>
            </div>
          )}
        </div>

        <div className="modal-instructions">
          <h3>How to connect:</h3>
          <ol>
            <li>Open WhatsApp on your phone</li>
            <li>Tap <strong>Menu</strong> or <strong>Settings</strong></li>
            <li>Tap <strong>Linked Devices</strong></li>
            <li>Tap <strong>Link a Device</strong></li>
            <li>Point your phone to this screen to scan the QR code</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default ConnectModal;

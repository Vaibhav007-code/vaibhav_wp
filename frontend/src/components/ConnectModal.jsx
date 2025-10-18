import React from 'react';
import { X, Smartphone } from 'lucide-react';

function ConnectModal({ qrCode, onClose }) {
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
          {qrCode ? (
            <img src={qrCode} alt="QR Code" className="qr-code" />
          ) : (
            <div className="qr-loading">
              <div className="spinner"></div>
              <p>Generating QR Code...</p>
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
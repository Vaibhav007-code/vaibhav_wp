import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, LogOut, QrCode, Bell, BellOff, Flame, Moon, Sun, Power, Users } from 'lucide-react';
import axios from 'axios';

function StatusBar({ isConnected, unreadCount, onLogout, onConnect, onNotificationClick, showUnreadOnly, onOpenCustomContacts }) {
  const [streak, setStreak] = useState(null);
  const [showStreakDetails, setShowStreakDetails] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [wbridgeEnabled, setWbridgeEnabled] = useState(true);

  useEffect(() => {
    fetchStreak();
    fetchWBridgeStatus();
  }, []);

  useEffect(() => {
    // Apply/remove dark class to html element for Tailwind
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const fetchStreak = async () => {
    try {
      const response = await axios.get('/api/streak');
      setStreak(response.data);
    } catch (error) {
      console.error('Failed to fetch streak:', error);
    }
  };

  const fetchWBridgeStatus = async () => {
    try {
      const response = await axios.get('/api/wbridge/status');
      setWbridgeEnabled(response.data.enabled);
    } catch (error) {
      console.error('Failed to fetch WBridge status:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleWBridge = async () => {
    try {
      const newStatus = !wbridgeEnabled;
      await axios.post('/api/wbridge/toggle', { enabled: newStatus });
      setWbridgeEnabled(newStatus);
    } catch (error) {
      console.error('Failed to toggle WBridge:', error);
      alert('Failed to toggle WBridge');
    }
  };

  return (
    <div className="status-bar bg-gradient-to-r from-green-700 to-green-600 dark:from-gray-800 dark:to-gray-900">
      <div className="status-left">
        <div className="logo-section">
          <span className="logo">🌉</span>
          <h1 className="text-white">WBridge</h1>
        </div>
        
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? (
            <>
              <Wifi size={18} />
              <span>Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={18} />
              <span>Disconnected</span>
            </>
          )}
        </div>

        <button 
          className={`wbridge-toggle ${wbridgeEnabled ? 'enabled' : 'disabled'}`}
          onClick={toggleWBridge}
          title={wbridgeEnabled ? "WBridge ON - Auto-replies active" : "WBridge OFF - No auto-replies"}
        >
          <Power size={18} />
          <span>{wbridgeEnabled ? 'WBridge ON' : 'WBridge OFF'}</span>
        </button>

        {streak && (
          <div 
            className="streak-badge"
            onMouseEnter={() => setShowStreakDetails(true)}
            onMouseLeave={() => setShowStreakDetails(false)}
          >
            <Flame className="streak-flame" size={20} />
            <span className="streak-count">{streak.currentStreak}</span>
            <span className="streak-label">day streak</span>

            {showStreakDetails && (
              <div className="streak-tooltip bg-gradient-to-br from-gray-700 to-green-800 dark:from-gray-900 dark:to-gray-800">
                <div className="tooltip-row">
                  <span className="tooltip-label">🔥 Current:</span>
                  <span className="tooltip-value">{streak.currentStreak} days</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">🏆 Best:</span>
                  <span className="tooltip-value">{streak.longestStreak} days</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">📅 Total:</span>
                  <span className="tooltip-value">{streak.totalDaysDetox} days</span>
                </div>
                <div className="tooltip-warning bg-orange-500/20">
                  ⚠️ Open WhatsApp on phone? Streak resets!
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="status-right">
        <button
          className="custom-contacts-button"
          onClick={onOpenCustomContacts}
          title="Manage Custom Contact Auto-Replies"
        >
          <Users size={18} />
          <span>Custom Replies</span>
        </button>

        <button 
          className="dark-mode-toggle"
          onClick={toggleDarkMode}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {unreadCount > 0 && (
          <button 
            className={`unread-badge ${showUnreadOnly ? 'active' : ''}`}
            onClick={onNotificationClick}
            title={showUnreadOnly ? "Show all chats" : "Show unread only"}
          >
            {showUnreadOnly ? <BellOff size={18} /> : <Bell size={18} />}
            <span className="badge">{unreadCount}</span>
          </button>
        )}

        {!isConnected && (
          <button className="connect-button" onClick={onConnect}>
            <QrCode size={18} />
            <span>Connect WhatsApp</span>
          </button>
        )}

        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default StatusBar;
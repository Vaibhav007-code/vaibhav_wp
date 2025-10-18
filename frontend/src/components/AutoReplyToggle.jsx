import React, { useState } from 'react';
import { Bot, Edit2, Check, X } from 'lucide-react';

function AutoReplyToggle({ enabled, message, onToggle, onUpdateMessage }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(message);

  const handleToggle = () => {
    onToggle(!enabled);
  };

  const handleSave = () => {
    onUpdateMessage(editedMessage);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedMessage(message);
    setIsEditing(false);
  };

  return (
    <div className="px-5 py-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-orange-600" />
          <span className="font-semibold text-gray-800 text-sm">Global Auto Reply</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
        </label>
      </div>

      {enabled && (
        <div>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows="3"
                placeholder="Default message for all contacts..."
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white py-1.5 px-3 rounded-md hover:bg-green-600 transition-colors text-xs"
                >
                  <Check size={14} /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 py-1.5 px-3 rounded-md hover:bg-gray-300 transition-colors text-xs"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-800 mb-2 whitespace-pre-wrap line-clamp-2">
                {message}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                <Edit2 size={12} /> Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AutoReplyToggle;
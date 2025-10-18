import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Users, Check, X as XIcon } from 'lucide-react';
import axios from 'axios';

function CustomContactsModal({ isOpen, onClose }) {
  const [contactAutoReplies, setContactAutoReplies] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    contactNumber: '',
    contactName: '',
    customMessage: '',
    enabled: true
  });

  useEffect(() => {
    if (isOpen) {
      fetchContactAutoReplies();
    }
  }, [isOpen]);

  const fetchContactAutoReplies = async () => {
    try {
      const response = await axios.get('/api/contact-auto-replies');
      setContactAutoReplies(response.data.contacts);
    } catch (error) {
      console.error('Failed to fetch contact auto-replies:', error);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.contactNumber || !newContact.customMessage) {
      alert('Please fill in contact number and custom message');
      return;
    }

    try {
      await axios.post('/api/contact-auto-replies', newContact);
      setNewContact({ contactNumber: '', contactName: '', customMessage: '', enabled: true });
      setShowAddContact(false);
      fetchContactAutoReplies();
      alert('✅ Custom auto-reply added! This contact will receive their personalized message.');
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact');
    }
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Delete this custom auto-reply? This contact will receive the global message instead.')) return;
    
    try {
      await axios.delete(`/api/contact-auto-replies/${id}`);
      fetchContactAutoReplies();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleToggleContact = async (id, currentEnabled) => {
    try {
      await axios.post(`/api/contact-auto-replies/${id}/toggle`, { enabled: !currentEnabled });
      fetchContactAutoReplies();
    } catch (error) {
      console.error('Failed to toggle contact:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Custom Contact Auto-Replies</h2>
              <p className="text-sm text-white/80">Set personalized messages for specific contacts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Contact Button */}
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="w-full mb-4 flex items-center justify-center gap-2 bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium shadow-md"
          >
            <UserPlus size={20} />
            <span>Add New Custom Contact</span>
          </button>

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="mb-6 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border-2 border-green-200 space-y-3">
              <h3 className="font-semibold text-gray-800 mb-3">Add Custom Auto-Reply</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g., 1234567890 or +1-234-567-890"
                  value={newContact.contactNumber}
                  onChange={(e) => setNewContact({...newContact, contactNumber: e.target.value})}
                  className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">
                  ℹ️ Enter in any format - system will match automatically
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={newContact.contactName}
                  onChange={(e) => setNewContact({...newContact, contactName: e.target.value})}
                  className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Auto-Reply Message *
                </label>
                <textarea
                  placeholder="This message will ONLY be sent to this specific contact when you're offline..."
                  value={newContact.customMessage}
                  onChange={(e) => setNewContact({...newContact, customMessage: e.target.value})}
                  className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows="4"
                />
                <p className="text-xs text-green-700 mt-1 font-medium">
                  ✅ Only this contact will receive this message (not the global one)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddContact}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-2.5 px-4 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Check size={18} /> Save Contact
                </button>
                <button
                  onClick={() => setShowAddContact(false)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <XIcon size={18} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Contact List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                Saved Contacts ({contactAutoReplies.length})
              </h3>
            </div>

            {contactAutoReplies.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <Users size={48} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium mb-2">No custom contacts yet</p>
                <p className="text-sm text-gray-500">
                  Add contacts to send them personalized auto-reply messages!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contactAutoReplies.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-green-300 transition-all shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-800">
                            {contact.contactName || contact.contactNumber}
                          </h4>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            Custom Reply
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">📱 {contact.contactNumber}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={contact.enabled === 1}
                            onChange={() => handleToggleContact(contact.id, contact.enabled)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Custom Message */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border-l-4 border-green-500">
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        Their Custom Message:
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {contact.customMessage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2.5 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomContactsModal;
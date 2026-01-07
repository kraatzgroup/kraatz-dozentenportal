import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Message } from '../store/messageStore';
import { useNavigate } from 'react-router-dom';

interface UnreadMessagePopupProps {
  messages: Message[];
  onClose: () => void;
  onMarkAsRead: (messageId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
}

export function UnreadMessagePopup({ messages, onClose, onMarkAsRead, onMarkAllAsRead }: UnreadMessagePopupProps) {
  const navigate = useNavigate();

  const handleViewMessages = () => {
    navigate('/messages');
    onClose();
  };

  const handleMarkAllAsRead = async () => {
    await onMarkAllAsRead();
    onClose();
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nachrichten</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-500 text-center py-4">Keine ungelesenen Nachrichten</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 text-primary mr-2" />
                <h3 className="text-lg font-medium text-gray-900">
                  Ungelesene Nachrichten ({messages.length})
                </h3>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {message.sender?.full_name || 'Unbekannt'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex space-x-3">
              <button
                onClick={handleViewMessages}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
              >
                Alle anzeigen
              </button>
              <button
                onClick={handleMarkAllAsRead}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Alle als gelesen markieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
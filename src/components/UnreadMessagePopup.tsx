import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Message, useMessageStore } from '../store/messageStore';
import { useNavigate } from 'react-router-dom';

interface UnreadMessagePopupProps {
  message: Message;
  onClose: () => void;
}

export function UnreadMessagePopup({ message, onClose }: UnreadMessagePopupProps) {
  const navigate = useNavigate();
  const markAsRead = useMessageStore(state => state.markAsRead);

  // Mark message as read when popup is first displayed
  useEffect(() => {
    markAsRead(message.id);
  }, [message.id, markAsRead]);

  const handleViewMessage = () => {
    navigate('/messages');
    onClose();
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm w-full animate-slide-up">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Neue Nachricht von {message.sender.full_name}
          </h3>
          <p className="text-xs text-gray-500">
            {new Date(message.created_at).toLocaleString('de-DE')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        {message.content}
      </p>
      <button
        onClick={handleViewMessage}
        className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        Zur Nachricht
      </button>
    </div>
  );
}
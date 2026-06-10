import React from 'react';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { VbConversation } from '../../hooks/useVbConversations';
import { VbMessage } from '../../hooks/useVbMessages';

interface VbChatWindowProps {
  conversation: VbConversation | null;
  messages: VbMessage[];
  participants: any[];
  loading?: boolean;
  hasMoreMessages?: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  onEditMessage: (messageId: string, newContent: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<boolean>;
  onLoadMoreMessages: () => void;
  onLeaveConversation?: () => void;
  onBack?: () => void;
}

export const VbChatWindow: React.FC<VbChatWindowProps> = ({
  conversation,
  messages,
  participants,
  loading = false,
  hasMoreMessages = false,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onLoadMoreMessages,
  onLeaveConversation,
  onBack
}) => {
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);
    try {
      const success = await onSendMessage(message.trim());
      if (success) {
        setMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Willkommen im Chat</h3>
          <p className="text-sm text-gray-600">
            Wähle eine Unterhaltung aus der Liste
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="font-semibold text-gray-900">{conversation.title || 'Unterhaltung'}</h2>
            <p className="text-sm text-gray-500">{participants.length} Teilnehmer</p>
          </div>
        </div>
        {onLeaveConversation && (
          <button
            onClick={onLeaveConversation}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Verlassen
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Noch keine Nachrichten</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === conversation.created_by ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  msg.sender_id === conversation.created_by
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.sender && (
                  <p className="text-xs font-medium mb-1 opacity-75">
                    {msg.sender.first_name} {msg.sender.last_name}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-50">
                  {new Date(msg.created_at).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nachricht schreiben..."
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

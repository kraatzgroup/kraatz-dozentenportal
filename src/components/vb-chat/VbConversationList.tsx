import React, { useState } from 'react';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { VbConversation } from '../../hooks/useVbConversations';

interface VbConversationListProps {
  conversations: VbConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  loading?: boolean;
}

export const VbConversationList: React.FC<VbConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(conversation => {
    return !searchTerm || 
      conversation.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversation.last_message?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-full flex-shrink-0 min-h-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
          <button
            onClick={onNewChat}
            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
            title="Neue Unterhaltung starten"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Unterhaltungen durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">Noch keine Unterhaltungen</p>
          </div>
        ) : (
          filteredConversations.map(conversation => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
              className={`w-full border-b border-l-4 border-gray-100 p-3 sm:p-4 text-left transition-colors ${
                conversation.id === activeConversationId
                  ? 'border-l-primary bg-primary/10'
                  : conversation.unread_count > 0
                  ? 'border-l-red-500 bg-red-50/30 hover:bg-red-50'
                  : 'border-l-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className={`min-w-0 truncate text-gray-900 ${conversation.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}>
                  {conversation.title || 'Unterhaltung'}
                </h3>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {conversation.last_message_at && (
                    <span className="whitespace-nowrap text-xs text-gray-500">
                      {new Date(conversation.last_message_at).toLocaleDateString('de-DE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                  {conversation.unread_count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
                      {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 truncate text-sm text-gray-500">
                {conversation.last_message || 'Keine Nachrichten'}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

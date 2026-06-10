import React, { useState, useEffect } from 'react';
import { useVbChat } from '../../hooks/useVbChat';
import { VbConversationList } from './VbConversationList';
import { VbChatWindow } from './VbChatWindow';

export const VbChatLayout: React.FC = () => {
  const [participants, setParticipants] = useState<any[]>([]);
  
  const {
    conversations,
    activeConversation,
    selectConversation,
    startConversation,
    leaveConversation,
    getConversationParticipants,
    getFilteredChatPartners,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages,
    loading,
    error
  } = useVbChat();

  useEffect(() => {
    const loadParticipants = async () => {
      if (activeConversation) {
        const participantData = await getConversationParticipants(activeConversation.id);
        setParticipants(participantData);
      } else {
        setParticipants([]);
      }
    };
    loadParticipants();
  }, [activeConversation, getConversationParticipants]);

  const handleSelectConversation = async (conversationId: string) => {
    try {
      await selectConversation(conversationId);
    } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  };

  const handleStartConversation = async (userIds: string[]) => {
    try {
      const chatPartners = await getFilteredChatPartners();
      const selectedUsers = chatPartners.filter(user => userIds.includes(user.id));
      
      if (selectedUsers.length > 0) {
        await startConversation(selectedUsers);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleLeaveConversation = async () => {
    if (!activeConversation) return;
    
    try {
      const success = await leaveConversation(activeConversation.id);
      if (!success) {
        alert('Fehler beim Verlassen der Unterhaltung.');
      }
    } catch (error) {
      console.error('Error leaving conversation:', error);
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600">
          <h3 className="text-lg font-medium mb-2">Fehler beim Laden des Chats</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-100">
      <div className={`${activeConversation ? 'hidden md:block' : 'block'}`}>
        <VbConversationList
          conversations={conversations}
          activeConversationId={activeConversation?.id || ''}
          onSelectConversation={handleSelectConversation}
          onStartConversation={handleStartConversation}
          loading={loading}
        />
      </div>

      <div className={`flex-1 ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <VbChatWindow
          conversation={activeConversation}
          messages={messages}
          participants={participants}
          loading={loading}
          hasMoreMessages={hasMoreMessages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onLoadMoreMessages={loadMoreMessages}
          onLeaveConversation={handleLeaveConversation}
          onBack={() => selectConversation(null)}
        />
      </div>
    </div>
  );
};

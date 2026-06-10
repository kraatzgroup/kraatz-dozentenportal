import { useState, useCallback } from 'react';
import { useVbConversations } from './useVbConversations';
import { useVbMessages } from './useVbMessages';
import { useAuthStore } from '../store/authStore';

export const useVbChat = () => {
  const user = useAuthStore(state => state.user);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    createConversation,
    leaveConversation,
    getConversationParticipants,
    getAvailableChatPartners: fetchChatPartners
  } = useVbConversations();

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages
  } = useVbMessages(activeConversationId);

  const selectConversation = useCallback(async (conversationId: string | null) => {
    setActiveConversationId(conversationId);
    if (conversationId) {
      // Mark as read logic would go here
    }
  }, []);

  const startConversation = useCallback(async (targetUsers: any[]): Promise<string | null> => {
    if (!user || targetUsers.length === 0) return null;

    setIsCreatingConversation(true);

    try {
      const conversationId = await createConversation(
        targetUsers.map(u => u.id),
        targetUsers.length === 1 ? `${targetUsers[0].first_name} ${targetUsers[0].last_name}` : 'Gruppenchat',
        'group'
      );

      if (conversationId) {
        setActiveConversationId(conversationId);
      }

      return conversationId;
    } catch (error) {
      console.error('Error starting VB conversation:', error);
      throw error;
    } finally {
      setIsCreatingConversation(false);
    }
  }, [user, createConversation]);

  const getFilteredChatPartners = useCallback(async (): Promise<any[]> => {
    if (!user) return [];
    return await fetchChatPartners();
  }, [user, fetchChatPartners]);

  const activeConversation = conversations.find(conv => conv.id === activeConversationId) || null;

  return {
    conversations,
    activeConversation,
    activeConversationId,
    selectConversation,
    startConversation,
    leaveConversation,
    isCreatingConversation,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages: hasMore,
    getFilteredChatPartners,
    getConversationParticipants,
    loading: conversationsLoading || messagesLoading,
    error: conversationsError || messagesError
  };
};

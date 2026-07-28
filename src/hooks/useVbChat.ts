import { useState, useCallback, useEffect } from 'react';
import { useVbConversations } from './useVbConversations';
import { useVbMessages } from './useVbMessages';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export const useVbChat = () => {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    createConversation,
    leaveConversation,
    getConversationParticipants,
    markAsRead,
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
      await markAsRead(conversationId);
    }
  }, [markAsRead]);

  // Keep the open conversation marked as read when new messages arrive
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, messages.length, markAsRead]);

  const startConversation = useCallback(async (targetUsers: any[]): Promise<string | null> => {
    if (!user || targetUsers.length === 0) return null;

    setIsCreatingConversation(true);

    try {
      const isTeilnehmer = userRole === 'teilnehmer';
      const conversationId = await createConversation(
        targetUsers.map(u => u.id),
        isTeilnehmer
          ? 'Support-Anfrage'
          : targetUsers.length === 1 ? `${targetUsers[0].first_name} ${targetUsers[0].last_name}` : 'Gruppenchat',
        isTeilnehmer ? 'support' : 'group'
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
  }, [user, userRole, createConversation]);

  // Draft flow: create the conversation only when the first message is sent
  const sendFirstMessage = useCallback(async (targetUser: any, content: string): Promise<boolean> => {
    if (!user || !targetUser || !content.trim()) return false;

    try {
      const conversationId = await startConversation([targetUser]);
      if (!conversationId) return false;

      const { data, error } = await supabase
        .from('vb_chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text'
        })
        .select()
        .single();

      if (error) throw error;

      // Notify other participants via email (fire-and-forget)
      supabase.functions.invoke('vb-notify-chat-message', {
        body: {
          type: 'INSERT',
          record: {
            id: data.id,
            conversation_id: data.conversation_id,
            sender_id: data.sender_id,
            content: data.content,
            created_at: data.created_at
          }
        }
      }).catch((notifyError) => {
        console.error('Error sending chat notification:', notifyError);
      });

      return true;
    } catch (error) {
      console.error('Error sending first VB message:', error);
      return false;
    }
  }, [user, startConversation]);

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
    sendFirstMessage,
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

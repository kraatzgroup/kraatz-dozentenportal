import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface VbConversation {
  id: string;
  created_at: string;
  updated_at: string;
  type: 'support' | 'group';
  title: string | null;
  created_by: string;
  participant_count: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface VbConversationParticipant {
  id: string;
  conversation_id: string;
  profile_id: string;
  joined_at: string;
  last_read_at: string;
  profile?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    profile_picture_url?: string;
  };
}

export const useVbConversations = () => {
  const user = useAuthStore(state => state.user);
  const [conversations, setConversations] = useState<VbConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load conversations from vb_conversation_details view
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('vb_conversation_details')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching VB conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create new conversation using vb-create-conversation edge function
  const createConversation = useCallback(async (
    participantIds: string[],
    title?: string,
    type: 'support' | 'group' = 'group'
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('vb-create-conversation', {
        body: {
          title,
          type,
          participantIds
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create conversation');
      }

      await fetchConversations();
      return data.conversationId;
    } catch (err) {
      console.error('Error creating VB conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      return null;
    }
  }, [user, fetchConversations]);

  // Leave conversation
  const leaveConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('vb_conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('profile_id', user.id);

      if (error) throw error;

      await fetchConversations();
      return true;
    } catch (err) {
      console.error('Error leaving VB conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave conversation');
      return false;
    }
  }, [user, fetchConversations]);

  // Get conversation participants
  const getConversationParticipants = useCallback(async (conversationId: string): Promise<VbConversationParticipant[]> => {
    try {
      const { data: participantsData, error } = await supabase
        .from('vb_conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId);

      if (error) throw error;
      if (!participantsData || participantsData.length === 0) return [];

      const profileIds = participantsData.map(p => p.profile_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, profile_picture_url')
        .in('id', profileIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const participants: VbConversationParticipant[] = participantsData.map(participant => ({
        ...participant,
        profile: profileMap.get(participant.profile_id) || {
          id: participant.profile_id,
          email: 'Unknown',
          first_name: 'Unknown',
          last_name: 'User',
          role: 'teilnehmer'
        }
      }));

      return participants;
    } catch (err) {
      console.error('Error fetching VB participants:', err);
      return [];
    }
  }, []);

  // Mark as read
  const markAsRead = useCallback(async (conversationId: string): Promise<void> => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('vb_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('profile_id', user.id);

      if (error) throw error;

      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [user]);

  // Get available chat partners (profiles with videobesprechung role)
  const getAvailableChatPartners = useCallback(async (): Promise<any[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, profile_picture_url, additional_roles')
        .neq('id', user.id)
        .contains('additional_roles', '["videobesprechung"]');

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('Error fetching VB chat partners:', err);
      return [];
    }
  }, [user]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const conversationSubscription = supabase
      .channel(`vb_conversations_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vb_conversations'
        },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vb_conversation_participants'
        },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vb_chat_messages'
        },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      conversationSubscription.unsubscribe();
    };
  }, [user, fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    createConversation,
    leaveConversation,
    getConversationParticipants,
    markAsRead,
    getAvailableChatPartners,
    refetch: fetchConversations
  };
};

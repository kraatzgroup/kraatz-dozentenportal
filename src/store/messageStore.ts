import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  sender: {
    full_name: string;
  };
}

interface MessageState {
  messages: Message[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchMessages: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setupMessageSubscription: () => () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  setupMessageSubscription: () => {
    const subscription = supabase
      .channel('message-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, async () => {
        await get().fetchMessages();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  fetchMessages: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user found, skipping message fetch');
        set({ 
          messages: [],
          unreadCount: 0,
          isLoading: false,
          error: null
        });
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name)
        `)
        .eq('receiver_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update both messages and unread count atomically to prevent flickering
      set({ 
        messages: data || [],
        unreadCount: data?.length || 0,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      set({ 
        error: error.message,
        isLoading: false,
        messages: [],
        unreadCount: 0
      });
    }
  },

  markAsRead: async (messageId: string) => {
    try {
      // Update local state immediately for better UX
      set(state => {
        const updatedMessages = state.messages.filter(msg => msg.id !== messageId);
        return {
          messages: updatedMessages,
          unreadCount: updatedMessages.length
        };
      });

      // Then update the database
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        // If there's an error, refresh the messages to ensure consistency
        await get().fetchMessages();
        throw error;
      }
    } catch (error: any) {
      console.error('Error marking message as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Update local state immediately
      set({ 
        messages: [],
        unreadCount: 0
      });

      // Then update the database
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) {
        // If there's an error, refresh the messages to ensure consistency
        await get().fetchMessages();
        throw error;
      }
    } catch (error: any) {
      console.error('Error marking all messages as read:', error);
      await get().fetchMessages();
    }
  }
}));
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

interface ChatState {
  messages: Message[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchMessages: (contactId: string | null) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  sendMessage: (message: { content: string; receiver_id: string }) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchUnreadCount: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      set({ unreadCount: count || 0 });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
    }
  },

  fetchMessages: async (contactId: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name)
        `);

      if (contactId) {
        // Fetch messages for specific contact
        query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`);
      } else {
        // Fetch only unread messages for notifications
        query = query
          .eq('receiver_id', user.id)
          .is('read_at', null);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      const messages = data || [];
      set({ messages });

      // Mark messages as read if viewing specific contact
      if (contactId) {
        const unreadMessages = messages.filter(msg => 
          msg.receiver_id === user.id && !msg.read_at
        );

        for (const msg of unreadMessages) {
          await get().markAsRead(msg.id);
        }

        // Update unread count after marking messages as read
        await get().fetchUnreadCount();
      }
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error fetching messages:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (message: { content: string; receiver_id: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert([{
          content: message.content,
          sender_id: user.id,
          receiver_id: message.receiver_id
        }])
        .select()
        .single();

      if (error) throw error;
      // Fetch messages again to update the chat
      await get().fetchMessages(message.receiver_id);

      // Send email notification asynchronously (don't await)
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messageId: newMessage.id,
          senderId: user.id,
          receiverId: message.receiver_id,
          content: message.content
        }),
      }).then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          console.log('Message notification sent successfully:', result);
        } else {
          console.warn('Message notification failed:', await response.text());
        }
      }).catch((notificationError) => {
        console.warn('Failed to send message notification:', notificationError);
      });
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error sending message:', error);
    }
  },

  markAsRead: async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      const { messages } = get();
      const updatedMessages = messages.map(msg =>
        msg.id === messageId ? { ...msg, read_at: new Date().toISOString() } : msg
      );
      set({ messages: updatedMessages });

      // Update unread count
      await get().fetchUnreadCount();
    } catch (error: any) {
      console.error('Error marking message as read:', error);
    }
  }
}));
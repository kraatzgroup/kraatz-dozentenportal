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

      let data;
      let error;

      if (contactId) {
        // Fetch messages for specific contact - messages sent by user to contact OR sent by contact to user
        // Fetch in two queries to avoid template literals, then merge
        const [sentMessages, receivedMessages] = await Promise.all([
          // Messages sent by user to contact
          supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(full_name)
            `)
            .eq('sender_id', user.id)
            .eq('receiver_id', contactId)
            .order('created_at', { ascending: true }),
          // Messages sent by contact to user
          supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(full_name)
            `)
            .eq('sender_id', contactId)
            .eq('receiver_id', user.id)
            .order('created_at', { ascending: true })
        ]);

        if (sentMessages.error) throw sentMessages.error;
        if (receivedMessages.error) throw receivedMessages.error;

        // Merge and sort by created_at
        const allMessages = [...(sentMessages.data || []), ...(receivedMessages.data || [])]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        data = allMessages;
        error = null;
      } else {
        // Fetch only unread messages for notifications
        const result = await query
          .eq('receiver_id', user.id)
          .is('read_at', null)
          .order('created_at', { ascending: true });
        
        data = result.data;
        error = result.error;
      }

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

      const { error } = await supabase
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

      // Send email notification to recipient
      try {
        console.log('📧 Attempting to send email notification...');
        
        // Fetch sender and recipient profiles
        const [senderProfile, recipientProfile] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).single(),
          supabase.from('profiles').select('full_name, email').eq('id', message.receiver_id).single()
        ]);

        console.log('👤 Sender profile:', senderProfile.data);
        console.log('👤 Recipient profile:', recipientProfile.data);

        if (senderProfile.error) {
          console.error('❌ Error fetching sender profile:', senderProfile.error);
        }
        if (recipientProfile.error) {
          console.error('❌ Error fetching recipient profile:', recipientProfile.error);
        }

        if (senderProfile.data && recipientProfile.data) {
          const origin = window.location.origin;
          
          console.log('📤 Calling new-message-notify edge function with:', {
            recipientEmail: recipientProfile.data.email,
            recipientName: recipientProfile.data.full_name,
            senderName: senderProfile.data.full_name,
            messageLength: message.content.length,
            origin
          });
          
          // Call the new-message-notify edge function
          const { data, error } = await supabase.functions.invoke('new-message-notify', {
            body: {
              recipientEmail: recipientProfile.data.email,
              recipientName: recipientProfile.data.full_name,
              senderName: senderProfile.data.full_name,
              messageContent: message.content,
              recipientId: message.receiver_id,
              origin
            }
          });

          if (error) {
            console.error('❌ Edge function error:', error);
          } else {
            console.log('✅ Email notification sent successfully:', data);
          }
        } else {
          console.warn('⚠️ Skipping notification - missing profile data');
        }
      } catch (notifyError) {
        // Don't fail the message send if notification fails
        console.error('❌ Error sending notification email:', notifyError);
      }
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
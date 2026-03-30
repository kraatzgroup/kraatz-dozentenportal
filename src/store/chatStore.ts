import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
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
  fetchGroupMessages: (groupId: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  sendMessage: (message: { content: string; receiver_id: string }) => Promise<void>;
  sendGroupMessage: (message: { content: string; group_id: string; file_url?: string | null; file_name?: string | null; file_type?: string | null; file_size?: number | null }) => Promise<void>;
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

      // Count unread direct messages
      const { count: directCount, error: directError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (directError) throw directError;

      // Get user's groups
      const { data: userGroups, error: groupsError } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (groupsError) throw groupsError;

      let groupCount = 0;
      if (userGroups && userGroups.length > 0) {
        const groupIds = userGroups.map(g => g.group_id);
        
        // Count unread group messages (messages sent by others in user's groups)
        const { count: groupMessagesCount, error: groupMessagesError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .neq('sender_id', user.id)
          .is('read_at', null);

        if (groupMessagesError) throw groupMessagesError;
        groupCount = groupMessagesCount || 0;
      }

      const totalCount = (directCount || 0) + groupCount;
      set({ unreadCount: totalCount });
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
        // Fetch all messages (sent and received) to show all conversations
        const [sentMessages, receivedMessages] = await Promise.all([
          // Messages sent by user
          supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(full_name)
            `)
            .eq('sender_id', user.id)
            .is('group_id', null)
            .order('created_at', { ascending: true }),
          // Messages received by user
          supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(full_name)
            `)
            .eq('receiver_id', user.id)
            .is('group_id', null)
            .order('created_at', { ascending: true })
        ]);

        if (sentMessages.error) throw sentMessages.error;
        if (receivedMessages.error) throw receivedMessages.error;

        // Merge and sort by created_at
        const allMessages = [...(sentMessages.data || []), ...(receivedMessages.data || [])]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        data = allMessages;
        error = null;
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

  sendMessage: async (message: { 
    content: string; 
    receiver_id: string;
    file_url?: string | null;
    file_name?: string | null;
    file_type?: string | null;
    file_size?: number | null;
  }) => {
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
          receiver_id: message.receiver_id,
          file_url: message.file_url,
          file_name: message.file_name,
          file_type: message.file_type,
          file_size: message.file_size
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
          
          // Handle file-only messages (empty content)
          const messageText = message.content || '[Dateianhang]';
          
          console.log('📤 Calling new-message-notify edge function with:', {
            recipientEmail: recipientProfile.data.email,
            recipientName: recipientProfile.data.full_name,
            senderName: senderProfile.data.full_name,
            messageLength: messageText.length,
            origin
          });
          
          // Call the new-message-notify edge function
          const { data, error } = await supabase.functions.invoke('new-message-notify', {
            body: {
              recipientEmail: recipientProfile.data.email,
              recipientName: recipientProfile.data.full_name,
              senderName: senderProfile.data.full_name,
              messageContent: messageText,
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

  fetchGroupMessages: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({ messages: data || [] });

      // Mark unread group messages as read
      const unreadMessages = (data || []).filter(msg => 
        msg.sender_id !== user.id && !msg.read_at
      );

      for (const msg of unreadMessages) {
        await get().markAsRead(msg.id);
      }

      // Update unread count after marking messages as read
      if (unreadMessages.length > 0) {
        await get().fetchUnreadCount();
      }
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error fetching group messages:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  sendGroupMessage: async (message: { 
    content: string; 
    group_id: string;
    file_url?: string | null;
    file_name?: string | null;
    file_type?: string | null;
    file_size?: number | null;
  }) => {
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
          group_id: message.group_id,
          receiver_id: null,
          file_url: message.file_url,
          file_name: message.file_name,
          file_type: message.file_type,
          file_size: message.file_size
        }])
        .select();

      if (error) throw error;
      
      // Fetch messages again to update the chat
      await get().fetchGroupMessages(message.group_id);

      // Send email notifications to group members
      try {
        console.log('📧 Attempting to send group notification emails...');
        
        // Fetch sender profile and group details
        const [senderProfile, groupData] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).single(),
          supabase.from('chat_groups').select('name').eq('id', message.group_id).single()
        ]);

        console.log('👤 Sender profile:', senderProfile.data);
        console.log('👥 Group data:', groupData.data);

        if (senderProfile.error) {
          console.error('❌ Error fetching sender profile:', senderProfile.error);
        }
        if (groupData.error) {
          console.error('❌ Error fetching group data:', groupData.error);
        }

        if (senderProfile.data && groupData.data) {
          const origin = window.location.origin;
          
          // Handle file-only messages (empty content)
          const messageText = message.content || '[Dateianhang]';
          
          console.log('📤 Calling group-message-notify edge function with:', {
            groupId: message.group_id,
            groupName: groupData.data.name,
            senderName: senderProfile.data.full_name,
            senderId: user.id,
            messageLength: messageText.length,
            origin
          });
          
          // Call the group-message-notify edge function
          const { data, error } = await supabase.functions.invoke('group-message-notify', {
            body: {
              groupId: message.group_id,
              groupName: groupData.data.name,
              senderName: senderProfile.data.full_name,
              senderId: user.id,
              messageContent: messageText,
              origin
            }
          });

          if (error) {
            console.error('❌ Edge function error:', error);
          } else {
            console.log('✅ Group notification emails sent successfully:', data);
          }
        } else {
          console.warn('⚠️ Skipping notifications - missing profile or group data');
        }
      } catch (notifyError) {
        // Don't fail the message send if notification fails
        console.error('❌ Error sending group notification emails:', notifyError);
      }
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error sending group message:', error);
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
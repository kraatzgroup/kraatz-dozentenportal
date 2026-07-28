import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface VbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_deleted?: boolean;
  message_type: 'text' | 'system' | 'file' | 'image';
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_type?: string | null;
  sender?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

export const useVbMessages = (conversationId: string | null) => {
  const user = useAuthStore(state => state.user);
  const [messages, setMessages] = useState<VbMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  const MESSAGES_PER_PAGE = 50;

  const fetchMessages = useCallback(async (reset = false) => {
    if (!conversationId || !user) return;

    try {
      setLoading(true);
      setError(null);

      const startIndex = reset ? 0 : page * MESSAGES_PER_PAGE;
      const endIndex = startIndex + MESSAGES_PER_PAGE - 1;

      const { data: messagesData, error: fetchError } = await supabase
        .from('vb_chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          edited_at,
          message_type,
          attachment_url,
          attachment_name,
          attachment_size,
          attachment_type
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (fetchError) throw fetchError;

      const newMessages: VbMessage[] = [];
      if (messagesData) {
        for (const message of messagesData) {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role')
            .eq('id', message.sender_id)
            .single();

          newMessages.push({
            ...message,
            sender: senderData || {
              id: message.sender_id,
              email: 'Unknown',
              first_name: 'Unknown',
              last_name: 'User',
              role: 'teilnehmer'
            }
          });
        }
      }

      if (reset) {
        setMessages(newMessages.reverse());
        setPage(1);
      } else {
        setMessages(prev => [...newMessages.reverse(), ...prev]);
        setPage(prev => prev + 1);
      }

      setHasMore(newMessages.length === MESSAGES_PER_PAGE);
      
      if (newMessages.length > 0) {
        const latestMessage = reset ? newMessages[newMessages.length - 1] : newMessages[0];
        setLastMessageId(latestMessage.id);
      }
    } catch (err) {
      console.error('Error fetching VB messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, page, messages.length]);

  const sendMessage = useCallback(async (content: string, attachment?: any): Promise<boolean> => {
    if (!conversationId || !user || (!content.trim() && !attachment)) return false;

    try {
      let messageType: 'text' | 'file' | 'image' = 'text';
      if (attachment) {
        messageType = attachment.fileType?.startsWith('image/') ? 'image' : 'file';
      }

      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim() || (attachment ? `📎 ${attachment.fileName}` : ''),
        message_type: messageType
      };

      if (attachment) {
        messageData.attachment_url = attachment.fileUrl;
        messageData.attachment_name = attachment.fileName;
        messageData.attachment_size = attachment.fileSize;
        messageData.attachment_type = attachment.fileType;
      }

      const { data, error } = await supabase
        .from('vb_chat_messages')
        .insert(messageData)
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

      const { data: senderData } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .eq('id', user.id)
        .single();

      const messageWithSender = {
        ...data,
        sender: senderData || {
          id: user.id,
          email: user.email || 'Unknown',
          first_name: 'Unknown',
          last_name: 'User',
          role: 'teilnehmer'
        }
      };

      setMessages(prev => {
        const exists = prev.some(msg => msg.id === messageWithSender.id);
        if (exists) return prev;
        return [...prev, messageWithSender];
      });
      
      setLastMessageId(data.id);
      return true;
    } catch (err) {
      console.error('Error sending VB message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return false;
    }
  }, [conversationId, user]);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    if (!user || !newContent.trim()) return false;

    try {
      const { error } = await supabase
        .from('vb_chat_messages')
        .update({ 
          content: newContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent.trim(), edited_at: new Date().toISOString() }
          : msg
      ));

      return true;
    } catch (error) {
      console.error('Error editing VB message:', error);
      return false;
    }
  }, [user]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('vb_chat_messages')
        .update({ 
          is_deleted: true,
          content: '[Nachricht gelöscht]'
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: '[Nachricht gelöscht]', is_deleted: true }
          : msg
      ));

      return true;
    } catch (error) {
      console.error('Error deleting VB message:', error);
      return false;
    }
  }, [user]);

  const loadMoreMessages = useCallback(() => {
    if (!loading && hasMore) {
      fetchMessages(false);
    }
  }, [loading, hasMore, fetchMessages]);

  useEffect(() => {
    if (conversationId) {
      setMessages([]);
      setPage(0);
      setHasMore(true);
      setError(null);
      setLastMessageId(null);
      fetchMessages(true);
    } else {
      setMessages([]);
      setLoading(false);
      setError(null);
      setHasMore(false);
      setLastMessageId(null);
    }
  }, [conversationId]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId || !user) return;

    const messageSubscription = supabase
      .channel(`vb_messages_${conversationId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vb_chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload: any) => {
          const { data: messageData } = await supabase
            .from('vb_chat_messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name, role')
              .eq('id', messageData.sender_id)
              .single();

            const messageWithSender = {
              ...messageData,
              sender: senderData
            };

            setMessages(prev => {
              const exists = prev.some(msg => msg.id === messageWithSender.id);
              if (exists) return prev;
              
              if (messageWithSender.sender_id === user.id) {
                return prev;
              }
              
              setLastMessageId(messageWithSender.id);
              return [...prev, messageWithSender];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vb_chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload: any) => {
          const { data: messageData } = await supabase
            .from('vb_chat_messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name, role')
              .eq('id', messageData.sender_id)
              .single();

            const messageWithSender = {
              ...messageData,
              sender: senderData
            };

            setMessages(prev => 
              prev.map(msg => msg.id === messageWithSender.id ? messageWithSender : msg)
            );
          }
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [conversationId, user]);

  return {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    refetch: () => fetchMessages(true)
  };
};

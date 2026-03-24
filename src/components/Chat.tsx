import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck, Search, Plus, X, Users, Trash2, Paperclip, Download, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore'; 
import { ProfilePicture } from './ProfilePicture';
import { Logo } from './Logo';

interface Contact {
  id: string;
  full_name: string;
  role: string;
  profile_picture_url: string | null;
}

interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export function Chat() {
  const navigate = useNavigate();
  const { user, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb, userRole } = useAuthStore();
  const { messages, fetchMessages, sendMessage, fetchGroupMessages, sendGroupMessage, fetchUnreadCount } = useChatStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearchQuery, setNewChatSearchQuery] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [groupSettingsTab, setGroupSettingsTab] = useState<'info' | 'members'>('info');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [groupMembers, setGroupMembers] = useState<Contact[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Contact[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Contact | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [fileTypeWarning, setFileTypeWarning] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchContacts();
    fetchGroups();
    loadAllMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAllMessages = async () => {
    if (!user) return;
    try {
      const [sentMessages, receivedMessages] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('sender_id', user.id)
          .is('group_id', null),
        supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', user.id)
          .is('group_id', null)
      ]);
      
      const allMsgs = [...(sentMessages.data || []), ...(receivedMessages.data || [])];
      setAllMessages(allMsgs);
    } catch (error) {
      console.error('Error loading all messages:', error);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages(selectedGroup.id);
    } else if (selectedContact) {
      fetchMessages(selectedContact.id);
    } else {
      fetchMessages(null);
    }
    
    const subscription = supabase
      .channel('chat-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`,
      }, () => {
        if (selectedContact) {
          fetchMessages(selectedContact.id);
        } else {
          fetchMessages(null);
        }
        loadAllMessages();
        fetchUnreadCount();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${selectedGroup?.id}`,
      }, () => {
        if (selectedGroup) {
          fetchGroupMessages(selectedGroup.id);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedContact, selectedGroup, user?.id]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      // Determine who the user can message based on their role
      if (userRole === 'teilnehmer') {
        // Teilnehmer (Elite-Kleingruppe students) can only message their assigned dozenten and verwaltung
        const allContacts: Contact[] = [];
        const seenIds = new Set<string>();
        
        // Get teilnehmer data to find assigned dozenten
        const { data: teilnehmerData } = await supabase
          .from('teilnehmer')
          .select('dozent_zivilrecht_id, dozent_strafrecht_id, dozent_oeffentliches_recht_id, elite_kleingruppe_id')
          .eq('profile_id', user?.id)
          .single();
        
        if (teilnehmerData) {
          const dozentIds = new Set<string>();
          
          // Add individual dozent assignments
          if (teilnehmerData.dozent_zivilrecht_id) dozentIds.add(teilnehmerData.dozent_zivilrecht_id);
          if (teilnehmerData.dozent_strafrecht_id) dozentIds.add(teilnehmerData.dozent_strafrecht_id);
          if (teilnehmerData.dozent_oeffentliches_recht_id) dozentIds.add(teilnehmerData.dozent_oeffentliches_recht_id);
          
          // Add Elite-Kleingruppe dozenten
          if (teilnehmerData.elite_kleingruppe_id) {
            const { data: eliteDozenten } = await supabase
              .from('elite_kleingruppe_dozenten')
              .select('dozent_id')
              .eq('elite_kleingruppe_id', teilnehmerData.elite_kleingruppe_id);
            
            if (eliteDozenten) {
              eliteDozenten.forEach(ed => dozentIds.add(ed.dozent_id));
            }
          }
          
          // Fetch assigned dozenten profiles
          if (dozentIds.size > 0) {
            const { data: dozentenProfiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', Array.from(dozentIds));
            
            if (dozentenProfiles) {
              dozentenProfiles.forEach(d => {
                if (!seenIds.has(d.id)) {
                  seenIds.add(d.id);
                  allContacts.push(d);
                }
              });
            }
          }
        }
        
        // Add only admin (not buchhaltung or verwaltung)
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'admin');
        
        if (adminProfiles) {
          adminProfiles.forEach(p => {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allContacts.push(p);
            }
          });
        }
        
        // Add other teilnehmer from the same Elite-Kleingruppe
        if (teilnehmerData?.elite_kleingruppe_id) {
          const { data: otherTeilnehmer } = await supabase
            .from('teilnehmer')
            .select('profile_id, name')
            .eq('elite_kleingruppe_id', teilnehmerData.elite_kleingruppe_id)
            .neq('profile_id', user?.id);
          
          if (otherTeilnehmer && otherTeilnehmer.length > 0) {
            const teilnehmerProfileIds = otherTeilnehmer.map(t => t.profile_id).filter(Boolean);
            
            if (teilnehmerProfileIds.length > 0) {
              const { data: teilnehmerProfiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', teilnehmerProfileIds);
              
              if (teilnehmerProfiles) {
                teilnehmerProfiles.forEach(p => {
                  if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    allContacts.push(p);
                  }
                });
              }
            }
          }
        }
        
        setContacts(allContacts.filter(contact => contact.id !== user?.id).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      } else if (userRole === 'dozent') {
        // Dozent can message admin-level users and their assigned teilnehmer
        const allContacts: Contact[] = [];
        const seenIds = new Set<string>();
        
        // Add admin and buchhaltung
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'buchhaltung']);
        
        if (adminProfiles) {
          adminProfiles.forEach(p => {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allContacts.push(p);
            }
          });
        }
        
        // Get teilnehmer assigned to this dozent (normal assignments)
        const { data: assignedTeilnehmer } = await supabase
          .from('teilnehmer')
          .select('profile_id')
          .or(`dozent_zivilrecht_id.eq.${user?.id},dozent_strafrecht_id.eq.${user?.id},dozent_oeffentliches_recht_id.eq.${user?.id}`);
        
        if (assignedTeilnehmer) {
          const teilnehmerIds = assignedTeilnehmer
            .map(t => t.profile_id)
            .filter(Boolean);
          
          if (teilnehmerIds.length > 0) {
            const { data: teilnehmerProfiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', teilnehmerIds);
            
            if (teilnehmerProfiles) {
              teilnehmerProfiles.forEach(p => {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  allContacts.push(p);
                }
              });
            }
          }
        }
        
        // Get Elite-Kleingruppe teilnehmer where this dozent is assigned
        const { data: eliteAssignments } = await supabase
          .from('elite_kleingruppe_dozenten')
          .select('elite_kleingruppe_id')
          .eq('dozent_id', user?.id);
        
        if (eliteAssignments && eliteAssignments.length > 0) {
          const eliteGruppenIds = eliteAssignments.map(a => a.elite_kleingruppe_id);
          
          const { data: eliteTeilnehmer } = await supabase
            .from('teilnehmer')
            .select('profile_id')
            .in('elite_kleingruppe_id', eliteGruppenIds);
          
          if (eliteTeilnehmer) {
            const eliteTeilnehmerIds = eliteTeilnehmer
              .map(t => t.profile_id)
              .filter(Boolean);
            
            if (eliteTeilnehmerIds.length > 0) {
              const { data: eliteTeilnehmerProfiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', eliteTeilnehmerIds);
              
              if (eliteTeilnehmerProfiles) {
                eliteTeilnehmerProfiles.forEach(p => {
                  if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    allContacts.push(p);
                  }
                });
              }
            }
          }
        }
        
        setContacts(allContacts.filter(contact => contact.id !== user?.id).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      } else if (userRole === 'vertrieb') {
        // Vertrieb can message admin-level users and other dozenten
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'buchhaltung', 'dozent'])
          .order('full_name');
        if (error) throw error;
        setContacts(data.filter(contact => contact.id !== user?.id) || []);
      } else if (userRole === 'verwaltung') {
        // Verwaltung can message admin-level users
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'buchhaltung'])
          .order('full_name');
        if (error) throw error;
        setContacts(data.filter(contact => contact.id !== user?.id) || []);
      } else {
        // Admin and Buchhaltung can message everyone
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name');
        if (error) throw error;
        setContacts(data.filter(contact => contact.id !== user?.id) || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    
    try {
      // Fetch groups where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('user_id', user.id);
      
      if (memberError) throw memberError;
      
      const groupIds = memberGroups?.map(m => m.group_id) || [];
      
      if (groupIds.length === 0) {
        setGroups([]);
        return;
      }
      
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('chat_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });
      
      if (groupError) throw groupError;
      
      // Count members for each group
      const groupsWithCounts = await Promise.all(
        (groupData || []).map(async (group) => {
          const { count } = await supabase
            .from('chat_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return {
            ...group,
            member_count: count || 0
          };
        })
      );
      
      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  // Supported file types
  const supportedFileTypes = {
    'pdf': { mime: 'application/pdf', label: 'PDF' },
    'doc': { mime: 'application/msword', label: 'DOC' },
    'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
    'xls': { mime: 'application/vnd.ms-excel', label: 'XLS' },
    'xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'XLSX' },
    'png': { mime: 'image/png', label: 'PNG' },
    'jpg': { mime: 'image/jpeg', label: 'JPG' },
    'jpeg': { mime: 'image/jpeg', label: 'JPEG' },
    'heic': { mime: 'image/heic', label: 'HEIC' },
    'heif': { mime: 'image/heif', label: 'HEIF' }
  };

  // Helper function to get MIME type from file extension
  const getMimeTypeFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return supportedFileTypes[ext as keyof typeof supportedFileTypes]?.mime || 'application/octet-stream';
  };

  // Helper function to get file type label
  const getFileTypeLabel = (filename: string): string | null => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return supportedFileTypes[ext as keyof typeof supportedFileTypes]?.label || null;
  };

  // Helper function to check if file type is supported
  const isFileTypeSupported = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? ext in supportedFileTypes : false;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || (!newMessage.trim() && !selectedFile)) return;

    setIsUploading(true);
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      let fileSize = null;

      // Upload file if one is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${user?.id}/${Date.now()}.${fileExt}`;
        
        // Determine content type from file extension first, then browser-provided type
        const detectedType = getMimeTypeFromExtension(selectedFile.name);
        const browserType = selectedFile.type;
        // Use detected type if it's not the default, otherwise use browser type
        const contentType = (detectedType !== 'application/octet-stream') ? detectedType : (browserType || detectedType);
        
        console.log('📎 File upload debug:', {
          fileName: selectedFile.name,
          fileExt,
          browserType,
          detectedType,
          finalContentType: contentType
        });
        
        // Convert file to Blob with correct content type to force Supabase to use it
        const fileBlob = new Blob([selectedFile], { type: contentType });
        
        console.log('📦 Uploading blob with type:', fileBlob.type);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, fileBlob, {
            contentType: contentType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          alert('Fehler beim Hochladen der Datei.');
          setIsUploading(false);
          return;
        }

        // Force content type update by moving file to itself
        try {
          const { error: moveError } = await supabase.storage
            .from('chat-attachments')
            .move(filePath, filePath);

          if (moveError) {
            console.warn('⚠️ Could not move file:', moveError);
          }

          // Now update with correct content type
          const { error: updateError } = await supabase.storage
            .from('chat-attachments')
            .update(filePath, selectedFile, {
              contentType: contentType,
              cacheControl: '3600',
              upsert: true
            });

          if (updateError) {
            console.warn('⚠️ Could not update file metadata:', updateError);
          } else {
            console.log('✅ File metadata updated with content type:', contentType);
          }
        } catch (updateErr) {
          console.warn('⚠️ Error updating file metadata:', updateErr);
        }

        // Verify file metadata in storage
        try {
          const { data: fileList, error: listError } = await supabase.storage
            .from('chat-attachments')
            .list(user?.id || '', {
              limit: 1,
              offset: 0,
              sortBy: { column: 'created_at', order: 'desc' }
            });

          if (!listError && fileList && fileList.length > 0) {
            console.log('🔍 Actual file metadata in storage:', {
              name: fileList[0].name,
              metadata: fileList[0].metadata,
              created_at: fileList[0].created_at
            });
          }
        } catch (verifyErr) {
          console.warn('⚠️ Could not verify file metadata:', verifyErr);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = selectedFile.name;
        fileType = contentType;
        fileSize = selectedFile.size;
      }

      // Send message with or without attachment
      await sendMessage({
        content: newMessage.trim() || '',
        receiver_id: selectedContact.id,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize
      });

      setNewMessage('');
      setSelectedFile(null);
      loadAllMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Fehler beim Senden der Nachricht.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      setDeletingMessageId(messageId);
      
      // First, get the message to check if it has a file attachment
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('file_url')
        .eq('id', messageId)
        .single();

      if (fetchError) {
        console.error('Error fetching message:', fetchError);
        alert('Fehler beim Löschen der Nachricht.');
        return;
      }

      // If message has a file attachment, delete it from storage
      if (message?.file_url) {
        try {
          // Extract file path from URL
          // URL format: https://[project].supabase.co/storage/v1/object/public/chat-attachments/[path]
          const urlParts = message.file_url.split('/chat-attachments/');
          if (urlParts.length === 2) {
            const filePath = urlParts[1];
            
            console.log('🗑️ Deleting file from storage:', filePath);
            
            const { error: storageError } = await supabase.storage
              .from('chat-attachments')
              .remove([filePath]);

            if (storageError) {
              console.error('Error deleting file from storage:', storageError);
              // Continue with message deletion even if file deletion fails
            } else {
              console.log('✅ File deleted from storage successfully');
            }
          }
        } catch (storageError) {
          console.error('Error processing file deletion:', storageError);
          // Continue with message deletion even if file deletion fails
        }
      }

      // Soft delete the message
      const { error } = await supabase
        .from('messages')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting message:', error);
        alert('Fehler beim Löschen der Nachricht.');
      } else {
        // Refresh messages
        if (selectedContact) {
          await fetchMessages(selectedContact.id);
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleDeleteChat = async (contact: Contact) => {
    try {
      const { error: deleteError1 } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', user?.id)
        .eq('receiver_id', contact.id);

      const { error: deleteError2 } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', contact.id)
        .eq('receiver_id', user?.id);

      if (deleteError1 || deleteError2) {
        console.error('Error deleting messages:', deleteError1 || deleteError2);
        return;
      }

      await loadAllMessages();
      
      if (selectedContact?.id === contact.id) {
        setSelectedContact(null);
      }
      
      setShowDeleteChatModal(false);
      setChatToDelete(null);
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleNavigateBack = () => {
    navigate((isAdmin || isBuchhaltung || isVerwaltung || isVertrieb) ? '/admin' : '/dashboard');
  };

  const hasUnreadMessages = (contactId: string) => {
    return allMessages.some(msg => 
      msg.sender_id === contactId && 
      msg.receiver_id === user?.id && 
      !msg.read_at
    );
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Format time
    const time = date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Check if message is from today
    if (date.toDateString() === today.toDateString()) {
      return `Heute, ${time}`;
    }

    // Check if message is from yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Gestern, ${time}`;
    }

    // For older messages, show full date
    return `${date.toLocaleDateString('de-DE')}, ${time}`;
  };

  // Get last message timestamp for a contact
  const getLastMessageTime = (contactId: string) => {
    const contactMessages = allMessages.filter(msg => 
      msg.sender_id === contactId || msg.receiver_id === contactId
    );
    if (contactMessages.length === 0) return new Date(0);
    const lastMessage = contactMessages[contactMessages.length - 1];
    return new Date(lastMessage.created_at);
  };

  // Check if there are any messages with a contact
  const hasMessagesWithContact = (contactId: string) => {
    return allMessages.some(msg => 
      msg.sender_id === contactId || msg.receiver_id === contactId
    );
  };

  // Filter and separate contacts into unread and read, sorted by last message time
  const { unreadContacts, readContacts } = useMemo(() => {
    const filtered = contacts.filter(contact => 
      contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Only show contacts with existing messages UNLESS they are searching
    // When searching, show all available contacts
    const contactsToShow = !searchQuery.trim()
      ? filtered.filter(contact => hasMessagesWithContact(contact.id))
      : filtered;
    
    const unread = contactsToShow.filter(contact => hasUnreadMessages(contact.id));
    const read = contactsToShow.filter(contact => !hasUnreadMessages(contact.id));
    
    // Sort by last message time (newest first)
    unread.sort((a, b) => getLastMessageTime(b.id).getTime() - getLastMessageTime(a.id).getTime());
    read.sort((a, b) => getLastMessageTime(b.id).getTime() - getLastMessageTime(a.id).getTime());
    
    return { unreadContacts: unread, readContacts: read };
  }, [contacts, searchQuery, allMessages, user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Dozenten-Portal</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Portal</span>
              </div> 
            </div>
            <div className="flex items-center">
              <button
                onClick={handleNavigateBack}
                className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">
        <div className="py-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">Nachrichten</h1>
          <div className="bg-white rounded-lg shadow">
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {/* Contacts List */}
              <div className="col-span-1 sm:border-r border-gray-200 border-b sm:border-b-0 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-lg font-medium text-gray-900">Kontakte</h2>
                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-primary transition-colors"
                      title="Neuen Chat starten"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Kontakt suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 max-h-[600px]">
                  {/* Groups Section */}
                  {groups.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Gruppen ({groups.length})
                        </span>
                      </div>
                      {groups
                        .filter(group => 
                          group.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map(group => {
                          const isSelected = selectedGroup?.id === group.id;
                          
                          return (
                            <button
                              key={group.id}
                              onClick={() => {
                                setSelectedGroup(group);
                                setSelectedContact(null);
                              }}
                              className={`w-full text-left p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150 relative ${
                                isSelected ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center min-w-0 gap-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                                  <div className="font-medium text-gray-900">
                                    <span className="truncate block">{group.name}</span>
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {group.member_count} Mitglieder
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </>
                  )}
                  
                  {/* Unread Section */}
                  {unreadContacts.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                          Ungelesen ({unreadContacts.length})
                        </span>
                      </div>
                      {unreadContacts.map(contact => {
                        const isSelected = selectedContact?.id === contact.id;
                        const unreadCount = messages.filter(msg => 
                          msg.sender_id === contact.id && 
                          msg.receiver_id === user?.id && 
                          !msg.read_at
                        ).length;
                        
                        return (
                          <div key={contact.id} className="relative group">
                            <button
                              onClick={() => {
                                setSelectedContact(contact);
                                setSelectedGroup(null);
                              }}
                              className={`w-full text-left p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150 relative border-l-4 border-red-500 ${
                                isSelected ? 'bg-blue-50' : 'bg-red-50/30'
                              }`}
                            >
                              <div className="flex items-center min-w-0 gap-2">
                                <ProfilePicture
                                  userId={contact.id}
                                  url={contact.profile_picture_url} 
                                  size="sm"
                                  editable={false}
                                  isAdmin={contact.role === 'admin'}
                                  fullName={contact.full_name}
                                />
                                <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900">
                                    <span className="truncate block">{contact.full_name}</span>
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {contact.role === 'admin' ? 'Administrator' : 
                                     contact.role === 'buchhaltung' ? 'Buchhaltung' :
                                     contact.role === 'verwaltung' ? 'Verwaltung' :
                                     contact.role === 'vertrieb' ? 'Vertrieb' :
                                     contact.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                                  </div>
                                </div>
                                <div className="ml-2 flex-shrink-0">
                                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatToDelete(contact);
                                setShowDeleteChatModal(true);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity z-10"
                              title="Chat löschen"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                  
                  {/* Read Section */}
                  {readContacts.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {unreadContacts.length > 0 ? 'Gelesen' : 'Offene Chats'} ({readContacts.length})
                        </span>
                      </div>
                      {readContacts.map(contact => {
                        const isSelected = selectedContact?.id === contact.id;
                        
                        return (
                          <div key={contact.id} className="relative group">
                            <button
                              onClick={() => {
                                setSelectedContact(contact);
                                setSelectedGroup(null);
                              }}
                              className={`w-full text-left p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150 relative ${
                                isSelected ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center min-w-0 gap-2">
                                <ProfilePicture
                                  userId={contact.id}
                                  url={contact.profile_picture_url} 
                                  size="sm"
                                  editable={false}
                                  isAdmin={contact.role === 'admin'}
                                  fullName={contact.full_name}
                                />
                                <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                                  <div className="font-medium text-gray-900">
                                    <span className="truncate block">{contact.full_name}</span>
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {contact.role === 'admin' ? 'Administrator' : 
                                     contact.role === 'buchhaltung' ? 'Buchhaltung' :
                                     contact.role === 'verwaltung' ? 'Verwaltung' :
                                     contact.role === 'vertrieb' ? 'Vertrieb' :
                                     contact.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                                  </div>
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatToDelete(contact);
                                setShowDeleteChatModal(true);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity z-10"
                              title="Chat löschen"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                  
                  {/* No results */}
                  {unreadContacts.length === 0 && readContacts.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {searchQuery ? 'Keine Kontakte gefunden' : 'Keine Kontakte verfügbar'}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div className="col-span-1 sm:col-span-2 flex flex-col">
                {selectedGroup ? (
                  <>
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-base sm:text-lg font-medium text-gray-900">
                              {selectedGroup.name}
                            </h2>
                            <p className="text-xs text-gray-500">
                              {selectedGroup.member_count} Mitglieder
                            </p>
                          </div>
                        </div>
                        {(isAdmin || userRole === 'dozent') && (
                          <button
                            onClick={() => {
                              setEditGroupName(selectedGroup.name);
                              setEditGroupDescription(selectedGroup.description || '');
                              setShowGroupSettingsModal(true);
                              setGroupSettingsTab('info');
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Gruppeneinstellungen"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 h-[300px] sm:h-auto">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-sm">Noch keine Nachrichten in dieser Gruppe</p>
                          <p className="text-xs text-gray-400 mt-1">Schreibe die erste Nachricht!</p>
                        </div>
                      ) : (
                        messages.map(message => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                message.sender_id === user?.id 
                                  ? 'bg-[#2a83bf] text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              {message.sender_id !== user?.id && (
                                <p className={`text-xs font-semibold mb-1 ${
                                  message.sender_id === user?.id ? 'text-blue-100' : 'text-gray-600'
                                }`}>
                                  {message.sender.full_name}
                                </p>
                              )}
                              <p>{message.content}</p>
                              <div className="flex items-center justify-end mt-1 space-x-1">
                                <span className={`text-xs ${
                                  message.sender_id === user?.id
                                    ? 'text-blue-100'
                                    : 'text-gray-500'
                                }`}>
                                  {formatMessageTime(message.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedGroup || !newMessage.trim()) return;
                      await sendGroupMessage({
                        content: newMessage,
                        group_id: selectedGroup.id
                      });
                      setNewMessage('');
                    }} className="p-3 sm:p-4 border-t border-gray-200">
                      <div className="flex space-x-2 sm:space-x-4">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Nachricht an die Gruppe schreiben..."
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                        />
                        <button
                          type="submit"
                          disabled={!newMessage.trim()}
                          className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#2a83bf] hover:bg-[#2a83bf]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a83bf] disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  </>
                ) : selectedContact ? (
                  <>
                    <div className="p-4 border-b border-gray-200">
                      <h2 className="text-base sm:text-lg font-medium text-gray-900">
                        Chat mit {selectedContact.full_name}
                      </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 max-h-[600px]">
                      {messages.map(message => (
                        <div
                          key={message.id}
                          className={`flex group relative ${
                            message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.is_deleted
                                ? 'bg-gray-100 text-gray-600'
                                : message.sender_id === user?.id 
                                ? 'bg-[#2a83bf] text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {message.is_deleted ? (
                              <p className="text-xs italic text-gray-600">Nachricht gelöscht</p>
                            ) : (
                              <>
                                {message.file_url && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(message.file_url);
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = message.file_name || 'download';
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                      } catch (error) {
                                        console.error('Download error:', error);
                                        alert('Fehler beim Herunterladen der Datei.');
                                      }
                                    }}
                                    className={`flex items-center gap-2 p-2 rounded mb-2 w-full text-left cursor-pointer ${
                                      message.sender_id === user?.id
                                        ? 'bg-white/20 hover:bg-white/30'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                                  >
                                    <FileText className="h-5 w-5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{message.file_name}</p>
                                      {message.file_size && (
                                        <p className={`text-xs ${
                                          message.sender_id === user?.id ? 'text-blue-100' : 'text-gray-500'
                                        }`}>
                                          {(message.file_size / 1024).toFixed(1)} KB
                                        </p>
                                      )}
                                    </div>
                                    <Download className="h-4 w-4 flex-shrink-0" />
                                  </button>
                                )}
                                {message.content && <p>{message.content}</p>}
                              </>
                            )}
                            <div className="flex items-center justify-end mt-1 space-x-1">
                              <span className={`text-xs ${
                                message.is_deleted
                                  ? 'text-gray-500'
                                  : message.sender_id === user?.id
                                  ? 'text-blue-100'
                                  : 'text-gray-500'
                              }`}>
                                {formatMessageTime(message.created_at)}
                              </span>
                              {message.sender_id === user?.id && !message.is_deleted && (
                                <span className="text-blue-100">
                                  {message.read_at ? (
                                    <CheckCheck className="h-4 w-4" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {message.sender_id === user?.id && !message.is_deleted && (
                            <button
                              onClick={() => {
                                setMessageToDelete(message.id);
                                setShowDeleteMessageModal(true);
                              }}
                              disabled={deletingMessageId === message.id}
                              className="ml-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity self-center"
                              title="Nachricht löschen"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200">
                      {fileTypeWarning && (
                        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                          <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-red-800 font-medium">Dateityp nicht unterstützt</p>
                            <p className="text-xs text-red-600 mt-1">{fileTypeWarning}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFileTypeWarning(null)}
                            className="p-1 hover:bg-red-100 rounded flex-shrink-0"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      )}
                      {selectedFile && (
                        <div className="mb-2 p-2 bg-gray-50 rounded-md flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700 block truncate">{selectedFile.name}</span>
                                {getFileTypeLabel(selectedFile.name) && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                                    getFileTypeLabel(selectedFile.name) === 'PDF' 
                                      ? 'text-red-600 bg-red-50' 
                                      : 'text-blue-600 bg-blue-50'
                                  }`}>
                                    {getFileTypeLabel(selectedFile.name)}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      )}
                      <div className="flex space-x-2 sm:space-x-4">
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.heic,.heif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (isFileTypeSupported(file.name)) {
                                setSelectedFile(file);
                                setFileTypeWarning(null);
                              } else {
                                setFileTypeWarning(`Dateityp nicht unterstützt. Bitte wählen Sie: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG oder HEIC`);
                                setSelectedFile(null);
                              }
                            }
                          }}
                        />
                        <label
                          htmlFor="file-upload"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <Paperclip className="h-4 w-4" />
                        </label>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Nachricht schreiben..."
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                        />
                        <button
                          type="submit"
                          disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                          className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#2a83bf] hover:bg-[#2a83bf]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a83bf] disabled:opacity-50"
                        >
                          {isUploading ? (
                            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 p-4">
                    <div className="text-center">
                      <span className="text-sm sm:text-base">Wählen Sie einen Kontakt aus, um den Chat zu starten</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Neuen Chat starten</h3>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatSearchQuery('');
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create Group Button (Admin and Dozent only) */}
            {(isAdmin || userRole === 'dozent') && (
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setShowCreateGroupModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Users className="h-5 w-5" />
                  <span className="font-medium">Neue Gruppe erstellen</span>
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Person suchen..."
                  value={newChatSearchQuery}
                  onChange={(e) => setNewChatSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto">
              {/* Groups Section */}
              {groups.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Gruppen ({groups.length})
                    </span>
                  </div>
                  {groups
                    .filter(group => 
                      group.name.toLowerCase().includes(newChatSearchQuery.toLowerCase())
                    )
                    .map(group => (
                      <button
                        key={group.id}
                        onClick={() => {
                          setSelectedGroup(group);
                          setSelectedContact(null);
                          setShowNewChatModal(false);
                          setNewChatSearchQuery('');
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {group.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {group.member_count} Mitglieder
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              )}
              
              {/* Contacts Section */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Alle Kontakte ({contacts.length})
                </span>
              </div>
              {contacts
                .filter(contact => 
                  contact.full_name.toLowerCase().includes(newChatSearchQuery.toLowerCase())
                )
                .map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContact(contact);
                      setSelectedGroup(null);
                      setShowNewChatModal(false);
                      setNewChatSearchQuery('');
                    }}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <ProfilePicture
                        userId={contact.id}
                        url={contact.profile_picture_url}
                        size="sm"
                        editable={false}
                        isAdmin={contact.role === 'admin'}
                        fullName={contact.full_name}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {contact.full_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {contact.role === 'admin' ? 'Administrator' : 
                           contact.role === 'buchhaltung' ? 'Buchhaltung' :
                           contact.role === 'verwaltung' ? 'Verwaltung' :
                           contact.role === 'vertrieb' ? 'Vertrieb' :
                           contact.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              {contacts.filter(contact => 
                contact.full_name.toLowerCase().includes(newChatSearchQuery.toLowerCase())
              ).length === 0 && groups.filter(group =>
                group.name.toLowerCase().includes(newChatSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  {newChatSearchQuery ? 'Keine Kontakte oder Gruppen gefunden' : 'Keine Kontakte verfügbar'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Neue Gruppe erstellen</h3>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setSelectedGroupMembers([]);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gruppenname *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="z.B. Elite-Kleingruppe 2025/2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Group Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung (optional)
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Beschreiben Sie den Zweck dieser Gruppe..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mitglieder auswählen ({selectedGroupMembers.length} ausgewählt)
                </label>
                <div className="border border-gray-300 rounded-md max-h-64 overflow-y-auto">
                  {contacts.map(contact => (
                    <label
                      key={contact.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupMembers.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupMembers([...selectedGroupMembers, contact.id]);
                          } else {
                            setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== contact.id));
                          }
                        }}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center gap-3 flex-1">
                        <ProfilePicture
                          userId={contact.id}
                          url={contact.profile_picture_url}
                          size="sm"
                          editable={false}
                          isAdmin={contact.role === 'admin'}
                          fullName={contact.full_name}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {contact.full_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {contact.role === 'admin' ? 'Administrator' : 
                             contact.role === 'buchhaltung' ? 'Buchhaltung' :
                             contact.role === 'verwaltung' ? 'Verwaltung' :
                             contact.role === 'vertrieb' ? 'Vertrieb' :
                             contact.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setSelectedGroupMembers([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  if (!newGroupName.trim()) {
                    alert('Bitte geben Sie einen Gruppennamen ein.');
                    return;
                  }
                  if (selectedGroupMembers.length === 0) {
                    alert('Bitte wählen Sie mindestens ein Mitglied aus.');
                    return;
                  }

                  try {
                    // Create the group
                    const { data: group, error: groupError } = await supabase
                      .from('chat_groups')
                      .insert({
                        name: newGroupName,
                        description: newGroupDescription || null,
                        created_by: user?.id
                      })
                      .select()
                      .single();

                    if (groupError) throw groupError;

                    // Add members to the group (including the creator)
                    const membersToAdd = [...selectedGroupMembers, user?.id].filter(Boolean);
                    const { error: membersError } = await supabase
                      .from('chat_group_members')
                      .insert(
                        membersToAdd.map(userId => ({
                          group_id: group.id,
                          user_id: userId
                        }))
                      );

                    if (membersError) throw membersError;

                    // Close modal and reset form
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                    setNewGroupDescription('');
                    setSelectedGroupMembers([]);

                    alert('Gruppe erfolgreich erstellt!');
                    
                    // Refresh contacts/groups list
                    fetchContacts();
                    fetchGroups();
                  } catch (error) {
                    console.error('Error creating group:', error);
                    alert('Fehler beim Erstellen der Gruppe. Bitte versuchen Sie es erneut.');
                  }
                }}
                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gruppe erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showGroupSettingsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Gruppeneinstellungen</h3>
              <button
                onClick={() => {
                  setShowGroupSettingsModal(false);
                  setGroupSettingsTab('info');
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setGroupSettingsTab('info')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  groupSettingsTab === 'info'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Gruppeninfo
              </button>
              <button
                onClick={async () => {
                  setGroupSettingsTab('members');
                  // Fetch group members
                  try {
                    const { data: memberData, error: memberError } = await supabase
                      .from('chat_group_members')
                      .select('user_id, profiles:user_id(id, full_name, role, profile_picture_url)')
                      .eq('group_id', selectedGroup.id);
                    
                    if (memberError) throw memberError;
                    
                    const members = memberData?.map((m: any) => ({
                      id: m.profiles.id,
                      full_name: m.profiles.full_name,
                      role: m.profiles.role,
                      profile_picture_url: m.profiles.profile_picture_url
                    })) || [];
                    
                    setGroupMembers(members);
                    
                    // Get available members (not in group)
                    const memberIds = members.map(m => m.id);
                    const available = contacts.filter(c => !memberIds.includes(c.id));
                    setAvailableMembers(available);
                  } catch (error) {
                    console.error('Error fetching group members:', error);
                  }
                }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  groupSettingsTab === 'members'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mitglieder ({selectedGroup.member_count})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {groupSettingsTab === 'info' ? (
                <div className="space-y-4">
                  {/* Group Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gruppenname
                    </label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* Group Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beschreibung (optional)
                    </label>
                    <textarea
                      value={editGroupDescription}
                      onChange={(e) => setEditGroupDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('chat_groups')
                          .update({
                            name: editGroupName,
                            description: editGroupDescription || null
                          })
                          .eq('id', selectedGroup.id);
                        
                        if (error) throw error;
                        
                        alert('Gruppe erfolgreich aktualisiert!');
                        setShowGroupSettingsModal(false);
                        fetchGroups();
                        
                        // Update selected group
                        setSelectedGroup({
                          ...selectedGroup,
                          name: editGroupName,
                          description: editGroupDescription || null
                        });
                      } catch (error) {
                        console.error('Error updating group:', error);
                        alert('Fehler beim Aktualisieren der Gruppe.');
                      }
                    }}
                    disabled={!editGroupName.trim()}
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Änderungen speichern
                  </button>

                  {/* Delete Group */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        if (!confirm('Möchten Sie diese Gruppe wirklich löschen? Alle Nachrichten werden ebenfalls gelöscht.')) {
                          return;
                        }
                        
                        try {
                          const { error } = await supabase
                            .from('chat_groups')
                            .delete()
                            .eq('id', selectedGroup.id);
                          
                          if (error) throw error;
                          
                          alert('Gruppe erfolgreich gelöscht!');
                          setShowGroupSettingsModal(false);
                          setSelectedGroup(null);
                          fetchGroups();
                        } catch (error) {
                          console.error('Error deleting group:', error);
                          alert('Fehler beim Löschen der Gruppe.');
                        }
                      }}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Gruppe löschen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Members */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Aktuelle Mitglieder</h4>
                    <div className="space-y-2">
                      {groupMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <ProfilePicture
                              userId={member.id}
                              url={member.profile_picture_url}
                              size="sm"
                              editable={false}
                              isAdmin={member.role === 'admin'}
                              fullName={member.full_name}
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                              <div className="text-xs text-gray-500">
                                {member.role === 'admin' ? 'Administrator' : 
                                 member.role === 'buchhaltung' ? 'Buchhaltung' :
                                 member.role === 'verwaltung' ? 'Verwaltung' :
                                 member.role === 'vertrieb' ? 'Vertrieb' :
                                 member.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                              </div>
                            </div>
                          </div>
                          {member.id !== selectedGroup.created_by && (
                            <button
                              onClick={async () => {
                                if (!confirm(`${member.full_name} aus der Gruppe entfernen?`)) {
                                  return;
                                }
                                
                                try {
                                  const { error } = await supabase
                                    .from('chat_group_members')
                                    .delete()
                                    .eq('group_id', selectedGroup.id)
                                    .eq('user_id', member.id);
                                  
                                  if (error) throw error;
                                  
                                  // Update local state
                                  setGroupMembers(groupMembers.filter(m => m.id !== member.id));
                                  setAvailableMembers([...availableMembers, member]);
                                  
                                  // Update group
                                  setSelectedGroup({
                                    ...selectedGroup,
                                    member_count: (selectedGroup.member_count || 0) - 1
                                  });
                                  
                                  fetchGroups();
                                } catch (error) {
                                  console.error('Error removing member:', error);
                                  alert('Fehler beim Entfernen des Mitglieds.');
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Aus Gruppe entfernen"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Members */}
                  {availableMembers.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Mitglieder hinzufügen</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {availableMembers.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <ProfilePicture
                                userId={member.id}
                                url={member.profile_picture_url}
                                size="sm"
                                editable={false}
                                isAdmin={member.role === 'admin'}
                                fullName={member.full_name}
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                                <div className="text-xs text-gray-500">
                                  {member.role === 'admin' ? 'Administrator' : 
                                   member.role === 'buchhaltung' ? 'Buchhaltung' :
                                   member.role === 'verwaltung' ? 'Verwaltung' :
                                   member.role === 'vertrieb' ? 'Vertrieb' :
                                   member.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('chat_group_members')
                                    .insert({
                                      group_id: selectedGroup.id,
                                      user_id: member.id
                                    });
                                  
                                  if (error) throw error;
                                  
                                  // Update local state
                                  setGroupMembers([...groupMembers, member]);
                                  setAvailableMembers(availableMembers.filter(m => m.id !== member.id));
                                  
                                  // Update group
                                  setSelectedGroup({
                                    ...selectedGroup,
                                    member_count: (selectedGroup.member_count || 0) + 1
                                  });
                                  
                                  fetchGroups();
                                } catch (error) {
                                  console.error('Error adding member:', error);
                                  alert('Fehler beim Hinzufügen des Mitglieds.');
                                }
                              }}
                              className="px-3 py-1 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Hinzufügen
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {showDeleteMessageModal && messageToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowDeleteMessageModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nachricht löschen?</h3>
            <p className="text-gray-600 mb-4">
              Möchten Sie diese Nachricht wirklich löschen? Die Nachricht wird als "Nachricht gelöscht" angezeigt.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteMessageModal(false);
                  setMessageToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (messageToDelete) {
                    handleDeleteMessage(messageToDelete);
                    setShowDeleteMessageModal(false);
                    setMessageToDelete(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {showDeleteChatModal && chatToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowDeleteChatModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chat löschen?</h3>
            <p className="text-gray-600 mb-4">
              Möchten Sie den Chat mit <strong>{chatToDelete.full_name}</strong> wirklich löschen? Alle Nachrichten werden unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteChatModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (chatToDelete) {
                    handleDeleteChat(chatToDelete);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck, Search, Plus, X, Users } from 'lucide-react';
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

  useEffect(() => {
    fetchContacts();
    fetchGroups();
  }, []);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newMessage.trim()) return;

    await sendMessage({
      content: newMessage,
      receiver_id: selectedContact.id
    });
    setNewMessage('');
  };

  const handleNavigateBack = () => {
    navigate((isAdmin || isBuchhaltung || isVerwaltung || isVertrieb) ? '/admin' : '/dashboard');
  };

  const hasUnreadMessages = (contactId: string) => {
    return messages.some(msg => 
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
    const contactMessages = messages.filter(msg => 
      msg.sender_id === contactId || msg.receiver_id === contactId
    );
    if (contactMessages.length === 0) return new Date(0);
    const lastMessage = contactMessages[contactMessages.length - 1];
    return new Date(lastMessage.created_at);
  };

  // Check if there are any messages with a contact
  const hasMessagesWithContact = (contactId: string) => {
    return messages.some(msg => 
      msg.sender_id === contactId || msg.receiver_id === contactId
    );
  };

  // Filter and separate contacts into unread and read, sorted by last message time
  const { unreadContacts, readContacts } = useMemo(() => {
    const filtered = contacts.filter(contact => 
      contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // For teilnehmer, only show contacts with existing messages UNLESS they are searching
    // When searching, show all available contacts
    const contactsToShow = userRole === 'teilnehmer' && !searchQuery.trim()
      ? filtered.filter(contact => hasMessagesWithContact(contact.id))
      : filtered;
    
    const unread = contactsToShow.filter(contact => hasUnreadMessages(contact.id));
    const read = contactsToShow.filter(contact => !hasUnreadMessages(contact.id));
    
    // Sort by last message time (newest first)
    unread.sort((a, b) => getLastMessageTime(b.id).getTime() - getLastMessageTime(a.id).getTime());
    read.sort((a, b) => getLastMessageTime(b.id).getTime() - getLastMessageTime(a.id).getTime());
    
    return { unreadContacts: unread, readContacts: read };
  }, [contacts, searchQuery, messages, user?.id, userRole]);

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
            <div className="grid grid-cols-1 sm:grid-cols-3 min-h-[400px] sm:min-h-[600px]">
              {/* Contacts List */}
              <div className="col-span-1 sm:border-r border-gray-200 border-b sm:border-b-0">
                <div className="p-4 border-b border-gray-200">
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
                <div className="overflow-y-auto h-[200px] sm:h-[calc(600px-7rem)]">
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
                          <button
                            key={contact.id}
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
                        );
                      })}
                    </>
                  )}
                  
                  {/* Read Section */}
                  {readContacts.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {unreadContacts.length > 0 ? 'Gelesen' : 'Alle Kontakte'} ({readContacts.length})
                        </span>
                      </div>
                      {readContacts.map(contact => {
                        const isSelected = selectedContact?.id === contact.id;
                        
                        return (
                          <button
                            key={contact.id}
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
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 h-[300px] sm:h-auto">
                      {messages.map(message => (
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
                            <p>{message.content}</p>
                            <div className="flex items-center justify-end mt-1 space-x-1">
                              <span className={`text-xs ${
                                message.sender_id === user?.id
                                  ? 'text-blue-100'
                                  : 'text-gray-500'
                              }`}>
                                {formatMessageTime(message.created_at)}
                              </span>
                              {message.sender_id === user?.id && (
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
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200">
                      <div className="flex space-x-2 sm:space-x-4">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Nachricht schreiben..."
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
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="flex items-center">
                      <span>Wählen Sie einen Kontakt aus, um den Chat zu starten</span>
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
    </div>
  );
}
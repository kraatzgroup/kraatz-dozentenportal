import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck, Search } from 'lucide-react';
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

export function Chat() {
  const navigate = useNavigate();
  const { user, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb, userRole } = useAuthStore();
  const { messages, fetchMessages, sendMessage, fetchUnreadCount } = useChatStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (selectedContact) {
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
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedContact, user?.id]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*');
      
      // Determine who the user can message based on their role
      if (userRole === 'dozent') {
        // Dozent can message admin-level users
        query = query.in('role', ['admin', 'buchhaltung']);
      } else if (userRole === 'vertrieb') {
        // Vertrieb can message admin-level users and other dozenten
        query = query.in('role', ['admin', 'buchhaltung', 'dozent']);
      } else if (userRole === 'verwaltung') {
        // Verwaltung can message admin-level users
        query = query.in('role', ['admin', 'buchhaltung']);
      } else {
        // Admin and Buchhaltung can message everyone
        // No filter needed
      }

      const { data, error } = await query.order('full_name');
      if (error) throw error;
      
      setContacts(data.filter(contact => contact.id !== user?.id) || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
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

  // Filter and separate contacts into unread and read
  const { unreadContacts, readContacts } = useMemo(() => {
    const filtered = contacts.filter(contact => 
      contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const unread = filtered.filter(contact => hasUnreadMessages(contact.id));
    const read = filtered.filter(contact => !hasUnreadMessages(contact.id));
    
    return { unreadContacts: unread, readContacts: read };
  }, [contacts, searchQuery, messages, user?.id]);

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
                  <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Kontakte</h2>
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
                            onClick={() => setSelectedContact(contact)}
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
                                   contact.role === 'vertrieb' ? 'Vertrieb' : 'Dozent'}
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
                            onClick={() => setSelectedContact(contact)}
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
                                   contact.role === 'vertrieb' ? 'Vertrieb' : 'Dozent'}
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
                {selectedContact ? (
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
    </div>
  );
}
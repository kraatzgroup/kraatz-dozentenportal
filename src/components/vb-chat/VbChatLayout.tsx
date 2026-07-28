import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useVbChat } from '../../hooks/useVbChat';
import { useAuthStore } from '../../store/authStore';
import { VbConversationList } from './VbConversationList';
import { VbChatWindow } from './VbChatWindow';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const VbChatLayout: React.FC = () => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [showPartnerPicker, setShowPartnerPicker] = useState(false);
  const [chatPartners, setChatPartners] = useState<any[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [draftPartner, setDraftPartner] = useState<any | null>(null);

  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const additionalRoles = useAuthStore(state => state.additionalRoles);

  const {
    conversations,
    activeConversation,
    selectConversation,
    sendFirstMessage,
    leaveConversation,
    getConversationParticipants,
    getFilteredChatPartners,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages,
    loading,
    error
  } = useVbChat();

  const isTeilnehmer = userRole === 'teilnehmer' && additionalRoles.includes('videobesprechung');

  useEffect(() => {
    const loadParticipants = async () => {
      if (activeConversation) {
        const participantData = await getConversationParticipants(activeConversation.id);
        setParticipants(participantData);
      } else {
        setParticipants([]);
      }
    };
    loadParticipants();
  }, [activeConversation, getConversationParticipants]);

  const handleSelectConversation = async (conversationId: string) => {
    try {
      setDraftPartner(null);
      await selectConversation(conversationId);
    } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  };

  const handleOpenNewChat = async () => {
    setShowPartnerPicker(true);
    setPartnersLoading(true);
    try {
      const partners = await getFilteredChatPartners();
      setChatPartners(partners);
    } catch (error) {
      console.error('Error loading chat partners:', error);
      setChatPartners([]);
    } finally {
      setPartnersLoading(false);
    }
  };

  // Open a draft conversation. Nothing is created server-side and no
  // emails are sent until the user actually sends the first message.
  const handleSelectPartner = async (partner: any) => {
    setDraftPartner(partner);
    setShowPartnerPicker(false);
    setChatPartners([]);
    await selectConversation(null);
  };

  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (draftPartner) {
      const success = await sendFirstMessage(draftPartner, content);
      if (success) {
        setDraftPartner(null);
      } else {
        alert('Nachricht konnte nicht gesendet werden.');
      }
      return success;
    }
    return sendMessage(content);
  };

  const handleLeaveConversation = async () => {
    if (!activeConversation) return;

    try {
      const success = await leaveConversation(activeConversation.id);
      if (!success) {
        alert('Fehler beim Verlassen der Unterhaltung.');
      }
    } catch (error) {
      console.error('Error leaving conversation:', error);
    }
  };

  // Draft conversation: exists only locally until the first message is sent
  const draftConversation = draftPartner ? {
    id: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: (isTeilnehmer ? 'support' : 'group') as 'support' | 'group',
    title: isTeilnehmer
      ? `Support-Anfrage: ${draftPartner.first_name} ${draftPartner.last_name}`
      : `${draftPartner.first_name} ${draftPartner.last_name}`,
    created_by: user?.id || '',
    participant_count: 2,
    last_message: null,
    last_message_at: null,
    unread_count: 0
  } : null;

  const displayedConversation = activeConversation || draftConversation;
  const displayedMessages = activeConversation ? messages : [];
  const displayedParticipants = activeConversation ? participants : (draftPartner ? [draftPartner, user] : []);

  // Header: show the other party (name + role), not the conversation title
  const otherPartyProfile = activeConversation
    ? participants.find(p => p.profile_id !== user?.id)?.profile
    : draftPartner;
  const otherPartyName = otherPartyProfile
    ? `${otherPartyProfile.first_name || ''} ${otherPartyProfile.last_name || ''}`.trim()
    : '';
  const isGroupChat = displayedParticipants.length > 2;
  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    verwaltung: 'Verwaltung',
    dozent: 'Dozent',
    teilnehmer: 'Teilnehmer'
  };
  const headerTitle = !isGroupChat && otherPartyName ? otherPartyName : undefined;
  const headerSubtitle = !isGroupChat && otherPartyProfile?.role
    ? roleLabels[otherPartyProfile.role] || otherPartyProfile.role
    : undefined;

  // Teilnehmer send rule (mirrors vb_can_send_message() in the DB):
  // in dozent conversations they may reply anytime if the last message is
  // from someone else, or re-send within 7 days of their own last message.
  let canSend = true;
  let sendDisabledReason: string | undefined;
  if (isTeilnehmer && activeConversation && activeConversation.type !== 'support') {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    if (!lastMessage) {
      canSend = false;
      sendDisabledReason = 'Du kannst schreiben, sobald der Dozent die Unterhaltung beginnt.';
    } else if (
      lastMessage.sender_id === user?.id &&
      Date.now() - new Date(lastMessage.created_at).getTime() > SEVEN_DAYS_MS
    ) {
      canSend = false;
      sendDisabledReason = 'Du kannst erneut schreiben, sobald der Dozent antwortet (oder innerhalb von 7 Tagen nach deiner letzten Nachricht).';
    }
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600">
          <h3 className="text-lg font-medium mb-2">Fehler beim Laden des Chats</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-white relative">
      <div className={`h-full ${displayedConversation ? 'hidden md:block' : 'block'}`}>
        <VbConversationList
          conversations={conversations}
          activeConversationId={activeConversation?.id || ''}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleOpenNewChat}
          loading={loading}
        />
      </div>

      <div className={`flex-1 ${!displayedConversation ? 'hidden md:flex' : 'flex'}`}>
        <VbChatWindow
          conversation={displayedConversation}
          messages={displayedMessages}
          participants={displayedParticipants}
          loading={loading}
          hasMoreMessages={hasMoreMessages}
          onSendMessage={handleSendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onLoadMoreMessages={loadMoreMessages}
          onLeaveConversation={activeConversation ? handleLeaveConversation : undefined}
          onBack={() => { setDraftPartner(null); selectConversation(null); }}
          canSend={canSend}
          sendDisabledReason={sendDisabledReason}
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          currentUserId={user?.id}
        />
      </div>

      {showPartnerPicker && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {isTeilnehmer ? 'Support kontaktieren' : 'Neue Unterhaltung'}
              </h3>
              <button
                onClick={() => { setShowPartnerPicker(false); setChatPartners([]); }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {partnersLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : chatPartners.length === 0 ? (
                <p className="text-sm text-gray-500 text-center p-8">
                  Keine Kontakte verfügbar.
                </p>
              ) : (
                chatPartners.map(partner => (
                  <button
                    key={partner.id}
                    onClick={() => handleSelectPartner(partner)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                      {(partner.first_name?.[0] || '?')}{(partner.last_name?.[0] || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {partner.first_name} {partner.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {partner.role === 'admin' ? 'Admin' : partner.role === 'verwaltung' ? 'Verwaltung' : partner.role === 'dozent' ? 'Dozent' : 'Teilnehmer'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

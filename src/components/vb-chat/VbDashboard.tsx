import React, { useState } from 'react';
import { MessageSquare, BookOpen, Video, Home } from 'lucide-react';
import { VbChatLayout } from './VbChatLayout';
import { VbCaseStudyDashboard } from './VbCaseStudyDashboard';

type VbTab = 'overview' | 'chat' | 'case-studies' | 'video-lessons';

export const VbDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<VbTab>('overview');

  const tabs = [
    { id: 'overview' as VbTab, label: 'Übersicht', icon: Home },
    { id: 'chat' as VbTab, label: 'Chat', icon: MessageSquare },
    { id: 'case-studies' as VbTab, label: 'Fallstudien', icon: BookOpen },
    { id: 'video-lessons' as VbTab, label: 'Video-Lektionen', icon: Video },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Videoklausurenkorrektur</h1>
        <p className="text-sm text-gray-600 mt-1">Ihre Lernplattform für Fallstudien und Video-Lektionen</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Fallstudien</h3>
                    <p className="text-sm text-gray-500">Ihre aktiven Fälle</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500 mt-2">Noch keine Fallstudien</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Video className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Video-Lektionen</h3>
                    <p className="text-sm text-gray-500">Verfügbare Videos</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500 mt-2">Noch keine Videos</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Chat</h3>
                    <p className="text-sm text-gray-500">Unterhaltungen</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500 mt-2">Noch keine Chats</p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="mt-6 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Willkommen bei Videoklausurenkorrektur!</h2>
              <p className="text-gray-600">
                Dies ist Ihre persönliche Lernplattform. Hier können Sie Fallstudien bearbeiten, 
                Video-Lektionen ansehen und mit anderen Teilnehmern chatten.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setActiveTab('case-studies')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Fallstudien ansehen
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Chat öffnen
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full">
            <VbChatLayout />
          </div>
        )}

        {activeTab === 'case-studies' && (
          <div className="p-6">
            <VbCaseStudyDashboard />
          </div>
        )}

        {activeTab === 'video-lessons' && (
          <div className="p-6">
            <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Video-Lektionen</h2>
              <p className="text-gray-600 mb-4">
                Diese Funktion wird noch migriert. Bitte haben Sie etwas Geduld.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

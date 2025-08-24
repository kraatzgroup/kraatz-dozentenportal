import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PreviewBannerProps {
  isPreviewMode: boolean;
  previewedRole: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | null;
  onTogglePreview: () => void;
  onChangeRole: (role: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent') => void;
}

export function PreviewBanner({ isPreviewMode, previewedRole, onTogglePreview, onChangeRole }: PreviewBannerProps) {
  if (!isPreviewMode) return null;

  return (
    <div className="bg-blue-600 text-white py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="font-medium">Vorschau-Modus:</span>
          <select
            value={previewedRole || ''}
            onChange={(e) => onChangeRole(e.target.value as 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent')}
            className="bg-blue-700 text-white border border-blue-400 rounded px-2 py-1"
          >
            <option value="admin">Administrator</option>
            <option value="buchhaltung">Buchhaltung</option>
            <option value="verwaltung">Verwaltung</option>
            <option value="vertrieb">Vertrieb</option>
            <option value="dozent">Dozent</option>
          </select>
        </div>
        <button
          onClick={onTogglePreview}
          className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
        >
          {isPreviewMode ? (
            <>
              <EyeOff className="h-4 w-4" />
              <span>Vorschau beenden</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span>Vorschau starten</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
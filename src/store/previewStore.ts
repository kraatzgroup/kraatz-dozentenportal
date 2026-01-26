import { create } from 'zustand';

interface PreviewState {
  isPreviewMode: boolean;
  previewedRole: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | 'elite_kleingruppe' | null;
  togglePreview: () => void;
  setPreviewedRole: (role: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | 'elite_kleingruppe') => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  isPreviewMode: false,
  previewedRole: null,
  togglePreview: () => set((state) => ({ 
    isPreviewMode: !state.isPreviewMode,
    previewedRole: !state.isPreviewMode ? 'dozent' : null
  })),
  setPreviewedRole: (role) => set({ previewedRole: role }),
}));
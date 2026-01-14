import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Folder {
  id: string;
  name: string;
  user_id: string;
  is_system: boolean;
  created_at: string;
}

interface FolderState {
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  fetchFolders: (userId?: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  isLoading: false,
  error: null,

  fetchFolders: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user');
        }
        userId = user.id;
      }

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ folders: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createFolder: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { error } = await supabase
        .from('folders')
        .insert([{ 
          name,
          user_id: user.id,
          is_system: false
        }]);

      if (error) throw error;
      await get().fetchFolders();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateFolder: async (id: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('folders')
        .update({ name })
        .eq('id', id)
        .eq('is_system', false); // Only allow updating non-system folders

      if (error) throw error;
      await get().fetchFolders();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteFolder: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id)
        .eq('is_system', false); // Only allow deleting non-system folders

      if (error) throw error;
      await get().fetchFolders();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));
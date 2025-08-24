import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface File {
  id: string;
  name: string;
  folder_id: string;
  file_path: string;
  uploaded_by: string;
  created_at: string;
  assigned_month?: number;
  assigned_year?: number;
  teilnehmer_id?: string;
  teilnehmer?: {
    name: string;
  };
}

interface FileState {
  files: File[];
  isLoading: boolean;
  error: string | null;
  undownloadedCount: number;
  subscription: RealtimeChannel | null;
  fetchFiles: (folderId: string) => Promise<void>;
  uploadFile: (file: Blob, name: string, folderId: string) => Promise<void>;
  downloadFile: (filePath: string, fileName: string) => Promise<void>;
  markFileAsDownloaded: (fileId: string) => Promise<void>;
  getUndownloadedFilesCount: () => Promise<number>;
  fetchUndownloadedCount: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  updateFileAssignment: (id: string, month: number, year: number) => Promise<void>;
  assignFileToTeilnehmer: (id: string, teilnehmerId: string | null) => Promise<void>;
  setupRealtimeSubscription: (folderId?: string) => void;
  cleanupSubscription: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  isLoading: false,
  error: null,
  undownloadedCount: 0,
  subscription: null,

  setupRealtimeSubscription: (folderId?: string) => {
    const { subscription } = get();
    if (subscription) {
      console.log('🔄 Files subscription already exists, cleaning up first');
      subscription.unsubscribe();
    }

    console.log('🔔 Setting up files real-time subscription for folder:', folderId);
    const newSubscription = supabase
      .channel('files-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'files'
      }, (payload) => {
        console.log('🔔 Files change detected:', payload);
        // If we have a specific folder, only refresh if the change affects that folder
        if (folderId) {
          const affectedFolderId = payload.new?.folder_id || payload.old?.folder_id;
          if (affectedFolderId === folderId) {
            console.log('🔄 Refreshing files for folder:', folderId);
            get().fetchFiles(folderId);
          }
        } else {
          // Refresh undownloaded count for admin dashboard
          get().fetchUndownloadedCount();
        }
      })
      .subscribe();

    set({ subscription: newSubscription });
  },

  cleanupSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🧹 Cleaning up files subscription');
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  fetchFiles: async (folderId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching files for folder:', folderId);
      
      // Check if we're in admin context by looking at current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      // Check if current user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const isAdmin = profile?.role === 'admin';
      
      // Use different query based on user role
      let query = supabase
        .from('files')
        .select(`
          *,
          teilnehmer:teilnehmer(name)
        `)
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });
      
      // If admin, don't apply RLS restrictions by using the admin client
      if (isAdmin) {
        const { supabaseAdmin } = await import('../lib/supabase');
        const { data, error } = await supabaseAdmin
          .from('files')
          .select(`
            *,
            teilnehmer:teilnehmer(name)
          `)
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        console.log('Files fetched (admin):', data?.length || 0);
        set({ files: data || [] });
        return;
      }
      
      const { data, error } = await supabase
        .from('files')
        .select(`
          *,
          teilnehmer:teilnehmer(name)
        `)
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Files fetched:', data?.length || 0);
      set({ files: data || [] });
    } catch (error: any) {
      console.error('Error fetching files:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFile: async (file: Blob, name: string, folderId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Sanitize filename to remove invalid characters for storage keys
      const sanitizedName = name
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
      
      // Upload file to storage
      const filePath = `${folderId}/${Date.now()}-${sanitizedName}`;
      
      console.log('Attempting to upload file to path:', filePath);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);


      // Create file record in database
      const { data: newFile, error: dbError } = await supabase
        .from('files')
        .insert([{
          name,
          folder_id: folderId,
          file_path: filePath,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_month: null,
          assigned_year: null
        }])
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        // If database insert fails, try to clean up the uploaded file
        await supabase.storage.from('files').remove([filePath]);
        throw new Error(`Database update failed: ${dbError.message}`);
      }

      // Update local state immediately for instant feedback
      set(state => ({
        files: [newFile, ...state.files]
      }));

      // Send email notification asynchronously after successful upload and UI update
      setTimeout(async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log('Sending upload notification for file:', newFile.id);
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-upload-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                fileId: newFile.id,
                uploadedBy: user.id,
                fileName: name,
                fileSize: file.size,
                folderId: folderId
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log('Upload notification sent successfully:', result);
            } else {
              const errorText = await response.text();
              console.warn('Upload notification failed:', errorText);
            }
          }
        } catch (notificationError) {
          console.warn('Failed to send upload notification:', notificationError);
        }
      }, 100); // Small delay to ensure UI has updated

    } catch (error: any) {
      console.error('Upload process error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  downloadFile: async (filePath: string, fileName: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Attempting to download file:', filePath);
      
      const { data, error } = await supabase.storage
        .from('files')
        .download(filePath);

      if (error) {
        console.error('Download error:', error);
        throw error;
      }

      // Create download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download process error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  markFileAsDownloaded: async (fileId: string) => {
    try {
      const { data, error } = await supabase.rpc('mark_file_as_downloaded', {
        file_id: fileId
      });

      if (error) throw error;
      
      console.log('File marked as downloaded:', fileId);
      return data;
    } catch (error: any) {
      console.error('Error marking file as downloaded:', error);
      // Don't throw error as this is not critical for user experience
    }
  },

  getUndownloadedFilesCount: async () => {
    try {
      const { data, error } = await supabase.rpc('get_undownloaded_files_count');
      
      if (error) throw error;
      return data || 0;
    } catch (error: any) {
      console.error('Error getting undownloaded files count:', error);
      return 0;
    }
  },

  fetchUndownloadedCount: async () => {
    try {
      const count = await get().getUndownloadedFilesCount();
      console.log('Undownloaded files count:', count);
      set({ undownloadedCount: count });
    } catch (error: any) {
      console.error('Error fetching undownloaded count:', error);
      set({ undownloadedCount: 0 });
    }
  },

  deleteFile: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // First get the file to get the file_path
      const { data: fileData, error: fetchError } = await supabase
        .from('files')
        .select('file_path')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (fileData?.file_path) {
        // Delete from storage first
        const { error: storageError } = await supabase.storage
          .from('files')
          .remove([fileData.file_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
          throw storageError;
        }
      }

      // Then delete the database record
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
      
      const { files } = get();
      set({ files: files.filter(file => file.id !== id) });
    } catch (error: any) {
      console.error('Delete process error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateFileAssignment: async (id: string, month: number, year: number) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('files')
        .update({ 
          assigned_month: month,
          assigned_year: year 
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Update assignment error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  assignFileToTeilnehmer: async (id: string, teilnehmerId: string | null) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ teilnehmer_id: teilnehmerId })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state immediately
      set(state => ({
        files: state.files.map(file =>
          file.id === id ? { ...file, teilnehmer_id: teilnehmerId } : file
        )
      }));
    } catch (error: any) {
      console.error('Update teilnehmer assignment error:', error);
      set({ error: error.message });
      throw error;
    }
  },
}));
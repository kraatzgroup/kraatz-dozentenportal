import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';

interface ProfilePictureProps {
  userId: string;
  url: string | null;
  size?: 'sm' | 'md' | 'lg';
  onUpdate?: (url: string) => void;
  editable?: boolean;
  isAdmin?: boolean;
  fullName?: string;
}

export function ProfilePicture({ 
  userId, 
  url, 
  size = 'md', 
  onUpdate, 
  editable = false, 
  isAdmin = false,
  fullName = ''
}: ProfilePictureProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24'
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Delete existing avatar if any
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(existingFiles.map(f => `${userId}/${f.name}`));
      }

      // Upload new avatar
      const filePath = `${userId}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl }, error: urlError } = await supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (urlError) throw urlError;

      // Validate the generated URL uses the correct domain
      if (!publicUrl.includes('gkkveloqajxghhflkfru.supabase.co')) {
        console.error('❌ Generated avatar URL uses wrong domain:', publicUrl);
        throw new Error('Avatar URL generated with wrong domain. Please check Supabase configuration.');
      }
      
      console.log('✅ Avatar URL generated successfully:', publicUrl);

      // Update the profile with the new URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      if (onUpdate) {
        onUpdate(publicUrl);
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setError(error.message || 'Error uploading avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [userId, onUpdate]);

  // Function to validate and fix profile picture URLs
  const getValidatedImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    
    // Check if URL contains old domain and fix it
    if (imageUrl.includes('wukwktuvwvklmpaoawej.supabase.co')) {
      console.warn('⚠️ Found old domain in profile picture URL, fixing...', imageUrl);
      // Extract the path after the domain and rebuild with new domain
      const pathMatch = imageUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
      if (pathMatch) {
        const newUrl = `https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/${pathMatch[1]}`;
        console.log('✅ Fixed profile picture URL:', newUrl);
        return newUrl;
      }
    }
    
    // Check if URL uses correct domain (new Supabase instance)
    if (imageUrl.includes('gkkveloqajxghhflkfru.supabase.co')) {
      return imageUrl;
    }
    
    // Check if URL uses old correct domain
    if (imageUrl.includes('baxmpvbwvtlbrzchabfw.supabase.co')) {
      // Migrate to new domain
      return imageUrl.replace('baxmpvbwvtlbrzchabfw.supabase.co', 'gkkveloqajxghhflkfru.supabase.co');
    }
    
    // If it's a relative path or other format, try to construct proper URL
    if (imageUrl.startsWith('/') || !imageUrl.includes('http')) {
      const cleanPath = imageUrl.replace(/^\/+/, '');
      return `https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/${cleanPath}`;
    }
    
    // Return as-is for any other format
    return imageUrl;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1,
    disabled: !editable || isUploading || isAdmin
  });

  // Get validated image URL
  const validatedUrl = getValidatedImageUrl(url);

  const content = isAdmin ? (
    <div className={`${sizeClasses[size]} rounded-full bg-white flex items-center justify-center p-1 overflow-hidden`}>
      <Logo />
    </div>
  ) : validatedUrl ? (
    <div className={`${sizeClasses[size]} rounded-full relative overflow-hidden flex-shrink-0`}>
      <img
        src={validatedUrl} 
        alt="Profile"
        className="w-full h-full rounded-full object-cover"
        onError={(e) => {
          // Hide the broken image
          e.currentTarget.style.display = 'none';
          // Show fallback
          const fallback = e.currentTarget.nextElementSibling;
          if (fallback) {
            (fallback as HTMLElement).style.display = 'flex';
          }
        }}
        onLoad={(e) => {
          // Hide fallback when image loads successfully
          const fallback = (e.currentTarget as HTMLImageElement).nextElementSibling;
          if (fallback) {
            (fallback as HTMLElement).style.display = 'none';
          }
        }}
      />
      {/* Fallback initials - positioned exactly the same as image */}
      <div 
        className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center absolute inset-0"
        style={{ display: 'none' }}
      >
        <span className="text-primary font-medium text-lg">
          {fullName ? getInitials(fullName) : userId.charAt(0).toUpperCase()}
        </span>
      </div>
    </div>
  ) : (
    <div className={`${sizeClasses[size]} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      <span className="text-primary font-medium text-lg">
        {fullName ? getInitials(fullName) : userId.charAt(0).toUpperCase()}
      </span>
    </div>
  );

  if (!editable || isAdmin) {
    return (
      <div className="flex-shrink-0">
        {content}
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <div
        {...getRootProps()}
        className={`relative cursor-pointer group ${sizeClasses[size]} flex-shrink-0`}
      >
        <input {...getInputProps()} />
        {content}
        <div className={`
          absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center
          opacity-0 group-hover:opacity-100 transition-opacity
          ${isUploading ? 'opacity-100' : ''}
        `}>
          {isUploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
      </div>
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 text-sm text-red-500 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
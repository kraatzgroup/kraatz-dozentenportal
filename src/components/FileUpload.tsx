import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function FileUpload({ onUpload, disabled = false }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && !disabled && !isUploading) {
      setIsUploading(true);
      try {
        await onUpload(acceptedFiles[0]);
      } finally {
        setIsUploading(false);
      }
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: disabled || isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${disabled || isUploading 
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
          : isDragActive 
            ? 'border-blue-500 bg-blue-50 cursor-pointer' 
            : 'border-gray-300 hover:border-blue-500 cursor-pointer'
        }`}
    >
      <input {...getInputProps()} disabled={disabled || isUploading} />
      {isUploading ? (
        <div className="animate-spin rounded-full h-8 w-8 mx-auto border-2 border-blue-600 border-t-transparent" />
      ) : (
        <Upload className={`h-8 w-8 mx-auto ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
      )}
      <p className="mt-2 text-sm text-gray-600">
        {isUploading
          ? 'Datei wird hochgeladen...'
          : disabled
          ? 'Upload nicht verfügbar'
          : isDragActive
          ? 'Datei hier ablegen...'
          : 'Datei hierher ziehen oder klicken zum Auswählen'}
      </p>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

export function PDFViewerModal({ isOpen, onClose, fileUrl, fileName }: PDFViewerModalProps) {
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoadError(false);
      setIsLoading(true);
    }
  }, [isOpen, fileUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('Error loading PDF in iframe:', fileUrl);
    setLoadError(true);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-75">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white w-full max-w-6xl h-[90vh] rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {fileName}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                title="PDF herunterladen"
              >
                <Download className="h-4 w-4 mr-2" />
                Herunterladen
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                title="In neuem Tab öffnen"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Neuer Tab
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full p-2"
                title="Schließen"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 relative">
            {loadError ? (
              /* Error fallback */
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center p-8 max-w-md">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">PDF konnte nicht geladen werden</h3>
                  <p className="text-gray-600 mb-6">
                    Das PDF kann in diesem Browser nicht angezeigt werden. Sie können es herunterladen oder in einem neuen Tab öffnen.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={handleDownload}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF herunterladen
                    </button>
                    <button
                      onClick={handleOpenInNewTab}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      In neuem Tab öffnen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Loading indicator */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">PDF wird geladen...</p>
                    </div>
                  </div>
                )}
                
                {/* PDF iframe */}
                <iframe
                  src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
                  className="w-full h-full border-0"
                  title={fileName}
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  style={{ display: isLoading ? 'none' : 'block' }}
                />
              </>
            )}
          </div>

          {/* Footer with keyboard shortcuts */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <span>Tastenkürzel:</span>
                <span><kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> Schließen</span>
                <span><kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+D</kbd> Herunterladen</span>
              </div>
              {!loadError && (
                <div>
                  PDF Viewer - Verwenden Sie die Browser-Steuerelemente zum Zoomen und Navigieren
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
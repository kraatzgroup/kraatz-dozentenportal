import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center space-x-4 text-xs text-gray-500">
          <a 
            href="https://kraatz-group.de/impressum/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-gray-700 transition-colors"
          >
            Impressum
          </a>
          <a 
            href="https://kraatz-group.de/datenschutzerklaerung/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-gray-700 transition-colors"
          >
            Datenschutz
          </a>
        </div>
      </div>
    </footer>
  );
}
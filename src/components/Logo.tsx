import React from 'react';

export function Logo() {
  return (
    <img 
      src="https://kraatz-group.de/wp-content/uploads/2023/05/KraatzGroup_Logo_web.png"
      alt="Kraatz Group" 
      className="h-6 sm:h-8"
      onError={(e) => {
        console.error('Failed to load logo image');
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
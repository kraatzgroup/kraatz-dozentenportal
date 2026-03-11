interface LogoProps {
  onClick?: () => void;
}

export function Logo({ onClick }: LogoProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Use window.location for navigation to work outside Router context
      window.location.href = '/dashboard?tab=dashboard';
    }
  };

  return (
    <img 
      src="https://kraatz-group.de/wp-content/uploads/2023/05/KraatzGroup_Logo_web.png"
      alt="Kraatz Group" 
      className="h-6 sm:h-8 w-auto object-contain cursor-pointer"
      onClick={handleClick}
      onError={(e) => {
        console.error('Failed to load logo image');
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
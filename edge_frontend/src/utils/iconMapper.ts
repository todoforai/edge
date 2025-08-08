import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

// Create image component for local logos with error handling
const createImageIcon = (imagePath: string, alt: string) => {
  return ({ size = 24, className }: IconProps) => {
    const [imageError, setImageError] = React.useState(false);
    
    // If image fails to load, show a colored fallback
    if (imageError) {
      return React.createElement('div', {
        className,
        style: {
          width: size,
          height: size,
          backgroundColor: '#3b82f6',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: Math.max(8, size * 0.4),
          fontWeight: 'bold'
        }
      }, alt.charAt(0));
    }
    
    return React.createElement('img', {
      src: imagePath,
      alt,
      width: size,
      height: size,
      className,
      style: { 
        objectFit: 'contain',
        filter: 'none'
      },
      onError: () => {
        console.warn(`Failed to load image: ${imagePath}`);
        setImageError(true);
      },
      onLoad: () => console.log(`Successfully loaded: ${imagePath}`)
    });
  };
};

// Create SVG icon component for UI icons
const createSVGIcon = (svgContent: string) => {
  return ({ size = 24, className, color = 'currentColor' }: IconProps) =>
    React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      dangerouslySetInnerHTML: { __html: svgContent }
    });
};

// Lucide icons mapping
const lucideIcons: Record<string, React.ComponentType<IconProps>> = {
  'lucide:server': createSVGIcon('<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>'),
  'lucide:cloud-sun': createSVGIcon('<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>'),
  'lucide:terminal': createSVGIcon('<polyline points="4,17 10,11 4,5"/><line x1="12" x2="20" y1="19" y2="19"/>'),
  'lucide:settings': createSVGIcon('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  'lucide:trash-2': createSVGIcon('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'),
  'lucide:download': createSVGIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" x2="12" y1="15" y2="3"/>'),
  'lucide:x': createSVGIcon('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>'),
  'lucide:plus': createSVGIcon('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  'lucide:file-text': createSVGIcon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
};

export const getIcon = (iconName: string): React.ComponentType<IconProps> => {
  console.log(`Getting icon for: ${iconName}`);
  
  // If it's a lucide icon, use the SVG version
  if (lucideIcons[iconName]) {
    return lucideIcons[iconName];
  }
  
  // If it starts with /logos/, it's a local image path
  if (iconName.startsWith('/logos/')) {
    const filename = iconName.split('/').pop() || '';
    const alt = filename.split('.')[0] || 'Logo';
    return createImageIcon(iconName, alt.charAt(0).toUpperCase() + alt.slice(1));
  }
  
  // Default fallback to server icon
  console.warn(`Icon not found: ${iconName}, using fallback`);
  return lucideIcons['lucide:server'];
};

// Icon component wrapper
export const Icon: React.FC<{
  icon: string;
  size?: number;
  className?: string;
  color?: string;
}> = ({ icon, size = 24, className, color }) => {
  const IconComponent = getIcon(icon);
  return React.createElement(IconComponent, { size, className, color });
};
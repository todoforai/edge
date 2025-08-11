import React from 'react';
import {
  Server,
  Terminal,
  Settings,
  Trash2,
  CloudSun,
  Download,
  X,
  Mail,
  CreditCard,
  Music,
  Globe,
  Smartphone,
  Monitor,
  Bot,
  Database,
  Leaf,
  Microscope,
  FileText,
  Search,
  Filter,
  Eye,
  User,
  LogOut,
  Plus,
  AlertTriangle,
  Loader,
  CheckCircle,
  Circle,
  XCircle
} from 'lucide-react';

// React Icons imports
import {
  SiGmail,
  SiStripe,
  SiSpotify,
  SiBrave,
  SiApple,
  SiPuppeteer,
  SiAirtable,
  SiCucumber
} from 'react-icons/si';
import { FaFilePdf, FaWindows } from 'react-icons/fa';

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

// Wrapper components to normalize props
const createLucideWrapper = (LucideIcon: React.ComponentType<any>) => {
  return ({ size = 24, className, color }: IconProps) =>
    React.createElement(LucideIcon, { size, className, color });
};

const createReactIconWrapper = (ReactIcon: React.ComponentType<any>) => {
  return ({ size = 24, className, color }: IconProps) =>
    React.createElement(ReactIcon, { size, className, color });
};

// Icon mapping with fallbacks
const iconMap: Record<string, React.ComponentType<IconProps>> = {
  // Lucide icons (UI)
  'lucide:server': createLucideWrapper(Server),
  'lucide:terminal': createLucideWrapper(Terminal),
  'lucide:settings': createLucideWrapper(Settings),
  'lucide:trash-2': createLucideWrapper(Trash2),
  'lucide:cloud-sun': createLucideWrapper(CloudSun),
  'lucide:download': createLucideWrapper(Download),
  'lucide:x': createLucideWrapper(X),
  'lucide:mail': createLucideWrapper(Mail),
  'lucide:credit-card': createLucideWrapper(CreditCard),
  'lucide:music': createLucideWrapper(Music),
  'lucide:globe': createLucideWrapper(Globe),
  'lucide:smartphone': createLucideWrapper(Smartphone),
  'lucide:monitor': createLucideWrapper(Monitor),
  'lucide:bot': createLucideWrapper(Bot),
  'lucide:database': createLucideWrapper(Database),
  'lucide:leaf': createLucideWrapper(Leaf),
  'lucide:microscope': createLucideWrapper(Microscope),
  'lucide:file-text': createLucideWrapper(FileText),
  'lucide:search': createLucideWrapper(Search),
  'lucide:filter': createLucideWrapper(Filter),
  'lucide:eye': createLucideWrapper(Eye),
  'lucide:user': createLucideWrapper(User),
  'lucide:log-out': createLucideWrapper(LogOut),
  'lucide:plus': createLucideWrapper(Plus),
  'lucide:alert-triangle': createLucideWrapper(AlertTriangle),
  'lucide:loader': createLucideWrapper(Loader),
  'lucide:check-circle': createLucideWrapper(CheckCircle),
  'lucide:circle': createLucideWrapper(Circle),
  'lucide:x-circle': createLucideWrapper(XCircle),

  // Brand icons (React Icons)
  'logos:gmail': createReactIconWrapper(SiGmail),
  'logos:stripe': createReactIconWrapper(SiStripe),
  'logos:spotify': createReactIconWrapper(SiSpotify),
  'logos:brave': createReactIconWrapper(SiBrave),
  'logos:apple': createReactIconWrapper(SiApple),
  'logos:microsoft-windows': createReactIconWrapper(FaWindows),
  'simple-icons:puppeteer': createReactIconWrapper(SiPuppeteer),
  'simple-icons:airtable': createReactIconWrapper(SiAirtable),
  'simple-icons:cucumber': createReactIconWrapper(SiCucumber),
  'vscode-icons:file-type-pdf2': createReactIconWrapper(FaFilePdf),
  'material-symbols:biotech': createLucideWrapper(Microscope), // fallback to lucide
};

// Fallback mapping
const fallbackMap: Record<string, string> = {
  'logos:gmail': 'lucide:mail',
  'logos:stripe': 'lucide:credit-card',
  'logos:spotify': 'lucide:music',
  'logos:brave': 'lucide:globe',
  'logos:apple': 'lucide:smartphone',
  'logos:microsoft-windows': 'lucide:monitor',
  'simple-icons:puppeteer': 'lucide:bot',
  'simple-icons:airtable': 'lucide:database',
  'simple-icons:cucumber': 'lucide:leaf',
  'material-symbols:biotech': 'lucide:microscope',
  'vscode-icons:file-type-pdf2': 'lucide:file-text',
  'mdi:eye': 'lucide:eye',
  'mdi:code-json': 'lucide:file-text',
};

export const getIcon = (iconName: string): React.ComponentType<IconProps> => {
  console.log(`Getting icon for: ${iconName}`);
  
  // Try direct mapping first
  if (iconMap[iconName]) {
    return iconMap[iconName];
  }

  // If it starts with /logos/, it's a local image path
  if (iconName.startsWith('/logos/')) {
    const filename = iconName.split('/').pop() || '';
    const alt = filename.split('.')[0] || 'Logo';
    return createImageIcon(iconName, alt.charAt(0).toUpperCase() + alt.slice(1));
  }

  // Try fallback
  const fallback = fallbackMap[iconName];
  if (fallback && iconMap[fallback]) {
    return iconMap[fallback];
  }

  // Default fallback
  console.warn(`Icon not found: ${iconName}, using fallback`);
  return iconMap['lucide:server'];
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
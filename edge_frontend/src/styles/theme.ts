// Define the color keys type
export type ColorKey = 'background' | 'foreground' | 'cardBackground' | 'cardHover' | 
  'sidebarBg' | 'navbarBg' | 'primary' | 'primaryHover' | 
  'success' | 'warning' | 'danger' | 'muted' | 'mutedForeground' | 'borderColor';

export const theme = {
  colors: {
    background: 'rgba(26, 26, 26, 1)',
    foreground: '#ffffff',
    cardBackground: '#1a1a1a',
    cardHover: '#2a2a2a',
    sidebarBg: 'rgba(30, 30, 30, 0.95)',
    navbarBg: 'rgba(30, 30, 30, 0.9)',
    primary: '#f96e2e',
    primaryHover: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#6b7280',
    mutedForeground: '#9ca3af',
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  fonts: {
    default: 'var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'var(--font-geist-mono), "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '20px',
    xl: '35px'
  }
};

export type Theme = typeof theme;
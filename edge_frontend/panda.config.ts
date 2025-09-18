import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          // Background colors
          pageBackground: { value: 'rgb(16, 16, 16)' },
          background: { value: 'rgba(26, 26, 26, 1)' },
          backgroundSecondary: { value: 'rgba(40, 40, 40, 1)' },
          backgroundTertiary: { value: 'rgba(60, 60, 60, 1)' },
          foreground: { value: '#ffffff' },
          
          // UI Elements
          cardBackground: { value: '#1a1a1a' },
          cardHover: { value: '#202020' },
          sidebarBg: { value: 'rgba(30, 30, 30, 0.95)' },
          navbarBg: { value: 'rgba(30, 30, 30, 0.9)' },
          
          // Accent colors
          primary: { value: '#f96e2e' },
          primaryHover: { value: '#ff8c40' },
          success: { value: '#22c55e' },
          warning: { value: '#c08114' },
          danger: { value: '#ef4444' },
          muted: { value: '#6b7280' },
          mutedForeground: { value: '#858b94' },
          unemphasized: { value: '#858b94' },
          unemphasizedMedium: { value: '#505050' },
          
          // Borders
          borderColor: { value: 'rgba(255, 255, 255, 0.1)' },
        },
        fonts: {
          default: { value: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif' },
          mono: { value: "'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" },
        },
        shadows: {
          sm: { value: '0 1px 2px rgba(0, 0, 0, 0.1)' },
          md: { value: '0 4px 6px rgba(0, 0, 0, 0.1)' },
          lg: { value: '0 10px 15px rgba(0, 0, 0, 0.1)' },
        },
        radii: {
          xs: { value: '4px' },
          sm: { value: '8px' },
          md: { value: '10px' },
          md2: { value: '16px' },
          lg: { value: '20px' },
          xl: { value: '35px' },
          full: { value: '50%' },
        },
        spacing: {
          xs: { value: '0.25rem' },
          sm: { value: '0.5rem' },
          md: { value: '1rem' },
          lg: { value: '1.5rem' },
          xl: { value: '2rem' },
        },
      },
      semanticTokens: {
        colors: {
          cta: {
            value: {
              base: 'linear-gradient(45deg, #ffa500, #ff6347, #ff4500)',
            }
          }
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  // JSX framework
  jsxFramework: 'react',
});

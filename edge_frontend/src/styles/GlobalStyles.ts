import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';

export const GlobalStyles = createGlobalStyle`
  html, body {
    max-width: 100vw;
    overflow-x: hidden;
    background: ${theme.colors.background};
    color: ${theme.colors.foreground};
    margin: 0;
    padding: 0;
    font-size: 18px;
    height: 100%;
    min-height: 100vh;
  }

  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
    font-family: ${theme.fonts.default};
  }

  /* Update font sizes */
  h1 { font-size: 2.7rem; }
  h2 { font-size: 2.1rem; }
  h3 { font-size: 1.9rem; }
  h4 { font-size: 1.6rem; }
  h5 { font-size: 1.4rem; }
  h6 { font-size: 1.2rem; }

  /* Responsive font sizes */
  @media (max-width: 768px) {
    html, body {
      font-size: 14px;
    }
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  a:hover {
    text-decoration: none;
  }

  /* Remove default focus styles */
  *:focus {
    outline: none !important;
  }

  /* Custom focus styles for interactive elements */
  input:focus, 
  textarea:focus, 
  button:focus,
  [role="button"]:focus,
  a:focus {
    outline: none !important;
  }

  /* Accessible focus styles - only show for keyboard navigation */
  :focus-visible {
    outline: none !important;
  }

  /* Override any other focus styles */
  *:focus {
    outline: none !important;
  }

  /* Global scrollbar styling */
  * {
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(26, 26, 26, 1);
  }

  /* Webkit browsers (Chrome, Safari, etc) */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background: transparent;
  }

  ::-webkit-scrollbar-track {
    background: rgba(26, 26, 26, 1);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  ::-webkit-scrollbar-corner {
    background: rgba(26, 26, 26, 1);
  }

  /* Update monospace elements */
  code, pre, .mono {
    font-family: ${theme.fonts.mono};
  }
`;
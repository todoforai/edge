import '@emotion/react';
import { Theme as AppTheme } from './theme';

declare module '@emotion/react' {
  export interface Theme extends AppTheme {}
}
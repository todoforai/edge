import '@emotion/react';
import { Theme } from './theme';

declare module '@emotion/react' {
  export interface Theme extends Theme {}
}
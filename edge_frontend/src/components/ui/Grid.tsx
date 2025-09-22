import { styled } from '@/styled-system/jsx';

export const Grid = styled('div', {
  base: {
    display: 'grid',
    gap: '20px'
  },
  variants: {
    minWidth: {
      sm: {
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
      },
      md: {
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
      },
      lg: {
        gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))'
      }
    }
  },
  defaultVariants: {
    minWidth: 'md'
  }
});
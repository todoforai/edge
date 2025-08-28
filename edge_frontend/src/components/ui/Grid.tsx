import styled from '@emotion/styled';

export const Grid = styled.div<{ minWidth?: string; gap?: string }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${props => props.minWidth || '400px'}, 1fr));
  gap: ${props => props.gap || '20px'};
`;
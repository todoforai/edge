import React from 'react';
import { styled } from '../../../../../../styled-system/jsx';
import { Plus } from 'lucide-react';

const Card = styled('div', {
  base: {
    border: '1px dashed var(--border-color)',
    outlineOffset: '-3px',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    background: 'var(--background)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minHeight: '120px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',

    '&:hover': {
      borderColor: 'var(--primary)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }
  }
});

const IconContainer = styled('div', {
  base: {
    flexShrink: 0,
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(59, 130, 246, 0.1)',
    color: 'var(--primary)'
  }
});

const Content = styled('div', {
  base: {
    flex: 1
  }
});

const TitleRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  }
});

const Title = styled('h3', {
  base: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0
  }
});

const Description = styled('p', {
  base: {
    fontSize: '14px',
    color: 'var(--muted)',
    margin: 0,
    lineHeight: 1.5
  }
});

interface ExtensionAddCardProps {
  onClick: () => void;
}

export const ExtensionAddCard: React.FC<ExtensionAddCardProps> = ({ onClick }) => {
  return (
    <Card onClick={onClick}>
      <Content>
        <TitleRow>
          <IconContainer>
            <Plus size={24} />
          </IconContainer>
          <Title>Add new Extension</Title>
        </TitleRow>
        <Description>
          Browse and install MCP servers from the registry to extend your AI capabilities
        </Description>
      </Content>
    </Card>
  );
};
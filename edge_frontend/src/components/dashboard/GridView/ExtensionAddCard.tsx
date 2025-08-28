import React from 'react';
import styled from '@emotion/styled';
import { Plus } from 'lucide-react';

const Card = styled.div`
  border: 1px dashed var(--border-color);
  outline-offset: -3px;
  border-radius: var(--radius-lg);
  padding: 28px;
  background: var(--background);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 120px;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const IconContainer = styled.div`
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
`;

const Content = styled.div`
  flex: 1;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
`;

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
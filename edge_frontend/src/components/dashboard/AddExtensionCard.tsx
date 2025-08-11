import React from 'react';
import styled from 'styled-components';
import { Plus } from 'lucide-react';

const Card = styled.div`
  border: 1px dashed ${props => props.theme.colors.borderColor};
  outline-offset: -3px;
  border-radius: ${props => props.theme.radius.lg};
  padding: 28px;
  background: ${props => props.theme.colors.background};
  cursor: pointer;
  transition: all 0.2s;
  min-height: 120px;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
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
  border-radius: ${props => props.theme.radius.md};
  background: rgba(59, 130, 246, 0.1);
  color: ${props => props.theme.colors.primary};
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
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
  line-height: 1.5;
`;

interface AddExtensionCardProps {
  onClick: () => void;
}

export const AddExtensionCard: React.FC<AddExtensionCardProps> = ({ onClick }) => {
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
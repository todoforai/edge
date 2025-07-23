import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import { MCPServer } from './types/MCPServer';

interface MCPServerJSONViewProps {
  servers: MCPServer[];
  onServersChange: (servers: MCPServer[]) => void;
}

export const MCPServerJSONView: React.FC<MCPServerJSONViewProps> = ({
  servers,
  onServersChange
}) => {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize JSON content only when switching to JSON view for the first time
  useEffect(() => {
    if (jsonContent === '') {
      setJsonContent(JSON.stringify(servers, null, 2));
    }
  }, [servers]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(600, textareaRef.current.scrollHeight) + 'px';
    }
  }, [jsonContent]);

  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    setJsonError('');
    
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // Validate that each item has required fields
        const isValid = parsed.every(item => 
          item && typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.description === 'string'
        );
        
        if (isValid) {
          onServersChange(parsed);
        } else {
          setJsonError('Invalid server structure. Each server must have id, name, and description fields.');
        }
      } else {
        setJsonError('JSON must be an array of servers.');
      }
    } catch (error) {
      setJsonError('Invalid JSON syntax');
    }
  };

  return (
    <Container>
      <Header>
        <Title>AI Extensions (JSON View)</Title>
        <Subtitle>Raw JSON data of AI extensions - editable in real-time</Subtitle>
      </Header>
      
      {jsonError && (
        <JsonError>
          <Icon icon="lucide:alert-triangle" />
          {jsonError}
        </JsonError>
      )}

      <JsonContainer>
        <JsonTextArea
          ref={textareaRef}
          value={jsonContent}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder="Enter JSON data..."
          spellCheck={false}
        />
      </JsonContainer>
    </Container>
  );
};

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
`;

const JsonError = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
  margin-bottom: 20px;
`;

const JsonContainer = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  overflow: hidden;
`;

const JsonTextArea = styled.textarea`
  width: 100%;
  min-height: 600px;
  padding: 20px;
  border: none;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  outline: none;

  &:focus {
    background: rgba(59, 130, 246, 0.02);
  }
`;
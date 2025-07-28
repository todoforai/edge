import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPInstance } from '../../shared/REST_types_shared';

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
  border-radius: ${props => props.theme.radius.md2};
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

interface MCPServerJSONViewProps {
  instances: MCPInstance[];
  onInstancesChange: (instances: MCPInstance[]) => void;
}

export const MCPServerJSONView: React.FC<MCPServerJSONViewProps> = ({
  instances,
  onInstancesChange
}) => {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize JSON content only when switching to JSON view for the first time
  useEffect(() => {
    if (jsonContent === '') {
      setJsonContent(JSON.stringify(instances, null, 2));
    }
  }, [instances]);

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
        // Validate that each item has required MCPInstance fields
        const isValid = parsed.every(item => 
          item && typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.serverId === 'string' &&
          typeof item.enabled === 'boolean' &&
          item.session && typeof item.session === 'object'
        );
        
        if (isValid) {
          onInstancesChange(parsed);
        } else {
          setJsonError('Invalid instance structure. Each instance must have id, serverId, enabled, and session fields.');
        }
      } else {
        setJsonError('JSON must be an array of MCP instances.');
      }
    } catch (error) {
      setJsonError('Invalid JSON syntax');
    }
  };

  return (
    <>
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
    </>
  );
};


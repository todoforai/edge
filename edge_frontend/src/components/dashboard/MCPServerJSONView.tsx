import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../types';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';

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
  instances: MCPEdgeExecutable[];
  onInstancesChange: (instances: MCPEdgeExecutable[]) => void;
}

export const MCPServerJSONView: React.FC<MCPServerJSONViewProps> = ({
  instances: _instances
}) => {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useEdgeConfigStore();

  // Initialize JSON content with raw mcp_json.mcpServers
  useEffect(() => {
    if (jsonContent === '') {
      const mcpServers = config.mcp_json?.mcpServers || {};
      setJsonContent(JSON.stringify(mcpServers, null, 2));
    }
  }, [config.mcp_json, jsonContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(600, textareaRef.current.scrollHeight) + 'px';
    }
  }, [jsonContent]);

  const handleJsonChange = async (value: string) => {
    setJsonContent(value);
    setJsonError('');
    
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Direct update - no conversion needed
        const updatedMcpJson = {
          ...config.mcp_json,
          mcpServers: parsed
        };

        // Save to backend via store
        await useEdgeConfigStore.getState().saveConfigToBackend({
          mcp_json: updatedMcpJson
        });

        console.log('Updated mcp_json from JSON editor');
      } else {
        setJsonError('JSON must be an object with serverId as keys.');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setJsonError('Invalid JSON syntax');
      } else {
        setJsonError('Error updating configuration');
        console.error('Failed to update mcp_json:', error);
      }
    }
  };

  return (
    <>
      {jsonError && (
        <JsonError>
          <AlertTriangle size={16} />
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


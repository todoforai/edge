import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '../../utils/iconMapper';
import type { MCPEdgeExecutable } from '../../shared/REST_types_shared';
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
  instances
}) => {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Convert instances to configurable-only format with serverId as key
  const getConfigurableData = (instances: MCPEdgeExecutable[]) => {
    const result: Record<string, any> = {};
    instances.forEach(instance => {
      // Use serverId as key instead of id
      result[instance.serverId || instance.id] = {
        env: instance.env
      };
    });
    return result;
  };

  // Initialize JSON content only when switching to JSON view for the first time
  useEffect(() => {
    if (jsonContent === '') {
      const configurableData = getConfigurableData(instances);
      setJsonContent(JSON.stringify(configurableData, null, 2));
    }
  }, [instances, jsonContent]);

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
        // Convert the parsed data back to mcp_json format
        const mcpServers: Record<string, any> = {};
        
        Object.entries(parsed).forEach(([serverId, configData]: [string, any]) => {
          // Find original instance to get command/args if available
          const originalInstance = instances.find(inst => inst.serverId === serverId);
          
          mcpServers[serverId] = {
            command: originalInstance?.command || 'node',
            args: originalInstance?.args || [],
            env: configData.env || {}
          };
        });

        // Update mcp_json in the config
        const updatedMcpJson = {
          mcpServers
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
          <Icon icon="lucide:alert-triangle" size={16} />
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


import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPInstance, MCPRunningStatus } from '../../shared/REST_types_shared';
import { MOCK_MCP_REGISTRY } from './data/mcpServersData';

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
  // Convert instances to configurable-only format with serverId as key
  const getConfigurableData = (instances: MCPInstance[]) => {
    const result: Record<string, any> = {};
    instances.forEach(instance => {
      result[instance.serverId] = {
        MCPRegistryID: instance.MCPRegistryID,
        env: instance.env,
        conf: instance.conf,
        enabled: instance.enabled
      };
    });
    return result;
  };

  // Convert configurable data back to full instances
  const mergeWithExistingData = (configurableData: Record<string, any>, originalInstances: MCPInstance[]) => {
    const usedOriginalIds = new Set<string>();
    
    const result = Object.entries(configurableData).map(([serverId, configData]) => {
      // Try to find existing instance to reuse its ID and session
      let originalInstance = originalInstances.find(inst => !usedOriginalIds.has(inst.id));
      
      if (!originalInstance) {
        // Create new instance if no existing ones available
        originalInstance = {
          id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          serverId: serverId,
          MCPRegistryID: serverId,
          tools: [],
          env: {},
          conf: {},
          session: {
            id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            MCPInstanceID: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            status: 'STOPPED' as MCPRunningStatus
          },
          enabled: true
        };
      }
      
      usedOriginalIds.add(originalInstance.id);
      
      return {
        ...originalInstance,
        serverId: serverId, // Use key as serverId (allows changing server type)
        MCPRegistryID: configData.MCPRegistryID || serverId,
        env: configData.env || {},
        conf: configData.conf || {},
        enabled: configData.enabled
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
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Validate that each entry has required configurable fields
        const isValid = Object.entries(parsed).every(([serverId, item]) => 
          item && typeof item === 'object' &&
          typeof item.enabled === 'boolean' &&
          typeof serverId === 'string'
        );
        
        if (isValid) {
          try {
            const mergedInstances = mergeWithExistingData(parsed, instances);
            onInstancesChange(mergedInstances);
          } catch (mergeError) {
            setJsonError(mergeError instanceof Error ? mergeError.message : 'Error merging data');
          }
        } else {
          setJsonError('Invalid instance structure. Each instance must have enabled field.');
        }
      } else {
        setJsonError('JSON must be an object with serverId as keys.');
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


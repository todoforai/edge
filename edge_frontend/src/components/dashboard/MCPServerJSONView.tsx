import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import { MCPRunningStatus, type MCPEdgeExecutable } from '../../shared/REST_types_shared';

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
  instances,
  onInstancesChange
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
        env: instance.env,
        conf: instance.conf,
        enabled: instance.enabled,
        status: instance.status
      };
    });
    return result;
  };

  // Convert configurable data back to full instances
  const mergeWithExistingData = (configurableData: Record<string, any>, originalInstances: MCPEdgeExecutable[]) => {
    const usedOriginalIds = new Set<string>();
    
    const result = Object.entries(configurableData).map(([serverId, configData]) => {
      // Try to find existing instance by serverId first, then by unused id
      let originalInstance = originalInstances.find(inst => 
        inst.serverId === serverId || (!usedOriginalIds.has(inst.id) && !inst.serverId)
      );
      
      if (!originalInstance) {
        // Create new instance if no existing ones available
        originalInstance = {
          id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          serverId: serverId,
          name: serverId.charAt(0).toUpperCase() + serverId.slice(1),
          description: `${serverId} MCP Server`,
          tools: [],
          env: {},
          conf: {},
          status: MCPRunningStatus.STOPPED,
          enabled: true,
          installed: true
        };
      }
      
      usedOriginalIds.add(originalInstance.id);
      
      const newStatus = configData.status || MCPRunningStatus.STOPPED;
      
      return {
        ...originalInstance,
        serverId: serverId, // Use key as serverId (allows changing server type)
        env: configData.env || {},
        conf: configData.conf || {},
        enabled: configData.enabled,
        status: newStatus,
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
          typeof (item as any).enabled === 'boolean' &&
          typeof (item as any).installed === 'boolean' &&
          typeof (item as any).status === 'string' &&
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


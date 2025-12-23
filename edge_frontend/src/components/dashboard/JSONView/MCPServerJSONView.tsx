import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../edge/types';
import { useEdgeConfigStore } from '../../../store/edgeConfigStore';
import { cva } from "class-variance-authority";

const jsonErrorClass = cva([
  "flex items-center gap-2 p-3 px-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm mb-5"
]);

const jsonContainerClass = cva([
  "border border-border rounded-md overflow-hidden"
]);

const jsonTextAreaClass = cva([
  "w-full min-h-[600px] p-5 border-none bg-background text-foreground font-mono text-sm leading-relaxed resize-y outline-none focus:bg-primary/5"
]);

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
        <div className={jsonErrorClass()}>
          <AlertTriangle size={16} />
          {jsonError}
        </div>
      )}

      <div className={jsonContainerClass()}>
        <textarea
          ref={textareaRef}
          className={jsonTextAreaClass()}
          value={jsonContent}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder="Enter JSON data..."
          spellCheck={false}
        />
      </div>
    </>
  );
};


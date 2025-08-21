import { useState, useMemo } from 'react';
import { getMCPByCommandArgs } from '../utils/mcpRegistry';
import type { MCPEdgeExecutable } from '../types';

export const useMCPFilters = (instances: MCPEdgeExecutable[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = instances.map(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      return registryServer?.category?.[0] || 'Unknown';
    });
    return ['All', 'Built-in', ...Array.from(new Set(cats))];
  }, [instances]);

  const filteredInstances = useMemo(() => {
    // Add built-in TODOforAI MCP
    const todoforaiMCP: MCPEdgeExecutable = {
      id: 'todoforai-builtin',
      serverId: 'todoforai',
      command: 'builtin',
      args: [],
      env: {},
      tools: [
        {
          name: 'create_file',
          description: 'Create a new file with specified content',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'modify_file',
          description: 'Modify an existing file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'New content' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'execute_shell',
          description: 'Execute shell command',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command to execute' }
            },
            required: ['command']
          }
        }
      ]
    };

    const allInstances = [todoforaiMCP, ...instances];

    return allInstances.filter(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      const category = instance.serverId === 'todoforai' ? 'Built-in' : (registryServer?.category?.[0] || 'Unknown');
      const name = instance.serverId === 'todoforai' ? 'TODOforAI' : (registryServer?.name || `${instance.command} ${instance.args?.join(' ') || ''}`);
      const description = instance.serverId === 'todoforai' ? 'Built-in file and shell operations' : (registryServer?.description || '');
      
      const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
      const matchesSearch = 
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.serverId?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesCategory && matchesSearch;
    });
  }, [instances, selectedCategory, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredInstances,
    categories
  };
};
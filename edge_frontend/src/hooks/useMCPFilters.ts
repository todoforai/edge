import { useState, useMemo } from 'react';
import { getMCPByCommandArgs } from '../data/mcpServersRegistry';
import type { MCPEdgeExecutable } from '@todoforai/shared-fbe';

// Helper function to create fallback display info for unknown MCPs
const createFallbackMCPInfo = (instance: MCPEdgeExecutable) => ({
  registryId: `unknown-${instance.serverId}`,
  name: `Custom MCP (${instance.command})`,
  description: `${instance.command} ${instance.args?.join(' ') || ''}`,
  command: instance.command,
  args: instance.args || [],
  icon: '/logos/default.svg', // generic fallback icon
  env: instance.env || {},
  category: ['Custom'],
  aliases: [instance.serverId],
  repository: {
    url: '',
    source: 'custom',
    id: instance.serverId
  },
  version_detail: {
    version: 'unknown',
    release_date: 'unknown',
    is_latest: true
  }
});

export const useMCPFilters = (instances: MCPEdgeExecutable[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = instances.map(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      return registryServer?.category?.[0] || 'Custom'; // Changed from 'Unknown' to 'Custom'
    });
    return ['All', 'Built-in', ...Array.from(new Set(cats))];
  }, [instances]);

  const filteredInstances = useMemo(() => {
    // Add built-in TODOforAI MCP - now it will get data from registry
    const todoforaiMCP: MCPEdgeExecutable = {
      id: 'todoforai-builtin',
      registryId: 'todoforai',
      serverId: 'todoforai',
      command: 'builtin',
      args: [],
      env: {}
    };

    const allInstances = [todoforaiMCP, ...instances];

    return allInstances.filter(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      
      // If not found in registry, create fallback info
      const displayInfo = registryServer || createFallbackMCPInfo(instance);
      
      const category = displayInfo.category?.[0] || 'Custom';
      const name = displayInfo.name || instance.serverId || 'Unknown';
      const description = displayInfo.description || '';
      
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
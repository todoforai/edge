import { useState, useMemo } from 'react';
import { getMCPByCommandArgs } from '../data/mcpServersData';
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
    // Add built-in TODOforAI MCP - now it will get data from registry
    const todoforaiMCP: MCPEdgeExecutable = {
      id: 'todoforai-builtin',
      serverId: 'todoforai',
      command: 'builtin',
      args: [],
      env: {}
    };

    const allInstances = [todoforaiMCP, ...instances];

    return allInstances.filter(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      if (!registryServer) return false;
      
      const category = registryServer.category?.[0] || 'Unknown';
      const name = registryServer.name || instance.serverId || 'Unknown';
      const description = registryServer.description || '';
      
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
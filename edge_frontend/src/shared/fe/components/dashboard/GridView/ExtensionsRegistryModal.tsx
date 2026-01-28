'use client';
import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import type { MCPRegistry } from '@shared/fbe';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

const modalBody = "flex flex-col gap-6 flex-1 min-h-0";
const grid = "grid gap-4 grid-cols-1 lg:grid-cols-2";
const controls = "flex gap-3 items-center";
const extensionCard = "flex items-start gap-4 p-6 border border-border rounded-lg bg-card transition-colors hover:border-primary hover:shadow-sm";
const extensionIcon = "flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-accent";
const extensionInfo = "flex-1 min-w-0 flex flex-col gap-2";
const extensionHeader = "flex items-start justify-between gap-3";
const extensionTitleSection = "flex flex-col gap-1 min-w-0 flex-1";
const extensionName = "text-lg font-semibold text-foreground m-0 leading-tight";
const extensionDescription = "text-sm text-muted-foreground m-0 leading-relaxed";
const extensionCategory = "text-xs text-primary bg-primary/10 px-2 py-1 rounded-md inline-block w-fit";

interface ExtensionsRegistryModalProps {
  servers: MCPRegistry[];
  onClose: () => void;
  onInstall?: (server: MCPRegistry) => void;
}

export const ExtensionsRegistryModal: React.FC<ExtensionsRegistryModalProps> = ({ servers, onClose, onInstall }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          servers.flatMap((s) => s.category || ['Other'])
        )
      ),
    ],
    [servers]
  );

  const filteredServers = servers.filter((server) => {
    if (server.registryId === 'todoai') return false;

    const serverCategories = server.category || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch =
      (server.name || server.registryId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (server.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = (server: MCPRegistry) => {
    onInstall?.(server);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl h-[80vh] flex flex-col p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle>Add New Integrations</DialogTitle>
            <DialogDescription>
              Browse and install MCP integrations
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={modalBody} style={{ padding: '0 24px 24px 24px' }}>
          <div className={controls}>
            <Input
              placeholder="Search available integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48 flex-shrink-0">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className={grid}>
              {filteredServers.map((server, index) => {
                const serverId = server.registryId || `server-${index}`;
                return (
                  <div key={serverId} className={extensionCard}>
                    <div className={extensionIcon}>
                      <img src={server.icon || '/logos/default.png'} alt={server.name || serverId} width={48} height={48} className="rounded-lg" />
                    </div>
                    <div className={extensionInfo}>
                      <div className={extensionHeader}>
                        <div className={extensionTitleSection}>
                          <h3 className={extensionName}>{server.name || server.registryId}</h3>
                          <span className={extensionCategory}>{server.category?.[0] || 'Other'}</span>
                        </div>
                        <Button size="sm" onClick={() => handleInstall(server)} className="flex-shrink-0">
                          <Download size={14} />
                          Install
                        </Button>
                      </div>
                      <p className={extensionDescription}>{server.description || 'No description available'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useMemo } from 'react';
import { styled } from '@/../styled-system/jsx';
import { Download } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { getMCPByRegistryID } from '../../../data/mcpServersRegistry';
import type { MCPRegistry } from '../../../types/mcp.types';
import { ModalOverlay } from '../../ui/ModalOverlay';

const DialogContent = styled(Dialog.Content, {
  base: {
    background: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    width: 'min(900px, 90vw)',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    position: 'fixed',
    inset: 0,
    margin: 'auto',
    zIndex: 1001
  }
});

const ModalHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 600
  }
});

const CloseButton = styled(Dialog.Close, {
  base: {
    border: '1px solid var(--border-color)',
    background: 'transparent',
    color: 'var(--foreground)',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',

    '&:hover': {
      background: 'var(--background-secondary)'
    }
  }
});

const ModalBody = styled('div', {
  base: {
    padding: '20px'
  }
});

const Grid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px'
  },
  variants: {
    minWidth: {
      '400px': { gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }
    },
    gap: {
      '20px': { gap: '20px' },
      '24px': { gap: '24px' }
    }
  }
});

const Controls = styled('div', {
  base: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',

    '& input, & select': {
      border: '1px solid var(--border-color)',
      background: 'var(--background-secondary)',
      color: 'var(--foreground)',
      borderRadius: '8px',
      padding: '8px 10px',

      '&:focus': {
        outline: 'none',
        borderColor: 'var(--primary)'
      }
    }
  }
});

const ExtensionCard = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    background: 'var(--background)',
    transition: 'border-color 0.2s',

    '&:hover': {
      borderColor: 'var(--primary)'
    }
  }
});

const ExtensionIcon = styled('div', {
  base: {
    flexShrink: 0,
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 1px var(--border-color)',

    '& img': {
      borderRadius: '8px'
    }
  }
});

const ExtensionInfo = styled('div', {
  base: {
    flex: 1,
    minWidth: 0
  }
});

const ExtensionHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px'
  }
});

const ExtensionName = styled('h3', {
  base: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0
  }
});

const ExtensionDescription = styled('p', {
  base: {
    fontSize: '14px',
    color: 'var(--muted)',
    margin: 0,
    lineHeight: 1.4
  }
});

const ExtensionCategory = styled('span', {
  base: {
    fontSize: '12px',
    color: 'var(--primary)',
    background: 'rgba(59, 130, 246, 0.1)',
    padding: '2px 8px',
    borderRadius: '6px',
    flexShrink: 0
  }
});

const InstallButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,

    '&:hover': {
      opacity: 0.9
    }
  }
});

const VisuallyHidden = styled('span', {
  base: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    width: '1px',
    whiteSpace: 'nowrap',
    wordWrap: 'normal'
  }
});

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
          servers.flatMap((s) => {
            const registry = getMCPByRegistryID(s.registryId);
            return registry?.category || ['Other'];
          })
        )
      ),
    ],
    [servers]
  );

  const filteredServers = servers.filter((server) => {
    if (server.registryId === 'todoforai') return false;
    
    const registry = getMCPByRegistryID(server.registryId);
    const serverCategories = registry?.category || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch =
      (registry?.name || server.registryId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (registry?.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = (server: MCPRegistry) => {
    onInstall?.(server);
    onClose();
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <ModalOverlay />
        <DialogContent>
          <Dialog.Title>
            <VisuallyHidden>Add New Integrations</VisuallyHidden>
          </Dialog.Title>
          <Dialog.Description>
            <VisuallyHidden>Browse and install MCP integrations</VisuallyHidden>
          </Dialog.Description>

          <ModalHeader>
            <div>Add New Integrations</div>
            <CloseButton>Close</CloseButton>
          </ModalHeader>
          <ModalBody>
            <Controls>
              <input placeholder="Search available integrations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Controls>

            <Grid gap="24px">
              {filteredServers.map((server, index) => {
                const registry = getMCPByRegistryID(server.registryId);
                const serverId = server.registryId || `server-${index}`;
                return (
                  <ExtensionCard key={serverId}>
                    <ExtensionIcon>
                      <img src={registry?.icon || '/logos/default.png'} alt={registry?.name || serverId} width={48} height={48} />
                    </ExtensionIcon>
                    <ExtensionInfo>
                      <ExtensionHeader>
                        <ExtensionName>{registry?.name || server.registryId}</ExtensionName>
                        <ExtensionCategory>{registry?.category?.[0] || 'Other'}</ExtensionCategory>
                      </ExtensionHeader>
                      <ExtensionDescription>{registry?.description || 'No description available'}</ExtensionDescription>
                    </ExtensionInfo>
                    <InstallButton onClick={() => handleInstall(server)}>
                      <Download size={16} />
                      Install
                    </InstallButton>
                  </ExtensionCard>
                );
              })}
            </Grid>
          </ModalBody>
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

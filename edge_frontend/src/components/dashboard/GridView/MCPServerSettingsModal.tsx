import React, { useState } from 'react';
import { styled } from '@/../styled-system/jsx';
import { AlertCircle, Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type { MCPEdgeExecutable } from '../../../types/mcp.types';
import { ModalOverlay } from '@/shared/ModalStyles';

const DialogContent = styled(Dialog.Content, {
  base: {
    background: 'var(--card-background)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: 0,
    width: 'min(900px, 90vw)',
    maxHeight: '80vh',
    position: 'fixed',
    inset: 0,
    margin: 'auto',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }
});

const ModalHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 600,
  }
});

const CloseButton = styled(Dialog.Close, {
  base: {
    border: '1px solid var(--border-color)',
    background: 'var(--background-secondary)',
    color: 'var(--foreground)',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'var(--card-hover)',
      borderColor: 'var(--primary)'
    }
  }
});

const ModalBody = styled('div', {
  base: {
    padding: '20px',
    flex: 1,
    overflow: 'auto'
  }
});

const SettingsContent = styled('div', {
  base: {
    flex: 1
  }
});

const FormGroup = styled('div', {
  base: {
    marginBottom: '20px'
  }
});

const FormLabel = styled('label', {
  base: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: '8px'
  }
});

const FormInput = styled('input', {
  base: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    background: 'var(--background-secondary)',
    color: 'var(--foreground)',
    fontSize: '14px',

    '&:focus': {
      outline: 'none',
      borderColor: 'var(--primary)',
      background: 'var(--background-secondary)'
    },

    '&:disabled': {
      background: 'var(--background-tertiary)',
      color: 'var(--muted)',
      cursor: 'not-allowed'
    }
  },
  variants: {
    hasError: {
      true: {
        borderColor: '#ef4444',
        '&:focus': { borderColor: '#ef4444' }
      },
      false: {}
    }
  }
});

const ErrorMessage = styled('div', {
  base: {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }
});

const ArgumentsList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }
});

const ArgumentRow = styled('div', {
  base: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  }
});

const EnvList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }
});

const EnvRow = styled('div', {
  base: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center'
  }
});

const RemoveButton = styled('button', {
  base: {
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,

    '&:hover': {
      background: 'rgba(239, 68, 68, 0.1)',
      borderColor: '#ef4444',
      color: '#ef4444'
    }
  }
});

const AddButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'transparent',
    border: '1px dashed var(--border-color)',
    borderRadius: '6px',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',

    '&:hover': {
      borderColor: 'var(--primary)',
      color: 'var(--primary)',
      background: 'rgba(59, 130, 246, 0.05)'
    }
  }
});

const ModalActions = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 0 0 0',
    borderTop: '1px solid var(--border-color)',
    marginTop: '20px'
  }
});

const CancelButton = styled('button', {
  base: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontSize: '14px',

    '&:hover': {
      background: 'rgba(0, 0, 0, 0.05)'
    }
  }
});

const ConfirmButton = styled('button', {
  base: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px'
  },
  variants: {
    disabled: {
      true: {
        background: 'var(--muted)',
        color: 'var(--muted)',
        cursor: 'not-allowed',
        '&:hover': { opacity: 1 }
      },
      false: {
        background: 'var(--primary)',
        color: 'white',
        cursor: 'pointer',
        '&:hover': { opacity: 0.9 }
      }
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

interface MCPServerSettingsModalProps {
  instance: MCPEdgeExecutable;
  isOpen: boolean;
  onClose: () => void;
  onSave: (instance: MCPEdgeExecutable) => void;
}

export const MCPServerSettingsModal: React.FC<MCPServerSettingsModalProps> = ({
  instance,
  isOpen,
  onClose,
  onSave
}) => {
  const [editingInstance, setEditingInstance] = useState<MCPEdgeExecutable>(() => {
    // Pre-fill environment variables from registry if this is a new installation
    const isNewInstallation = (instance.id || '').startsWith('temp-');
    if (isNewInstallation && instance.env) {
      // Convert array of env var names to key-value pairs with empty values
      const envObject: Record<string, string> = {};
      if (Array.isArray(instance.env)) {
        instance.env.forEach(envVar => {
          envObject[envVar] = '';
        });
      } else {
        // If it's already an object, use it as-is
        Object.assign(envObject, instance.env);
      }
      return { ...instance, env: envObject };
    }
    return { ...instance };
  });

  const isNewInstallation = (instance.id || '').startsWith('temp-');
  const hasServerIdError = editingInstance.serverId.includes('_');

  const handleSave = () => {
    if (hasServerIdError) return;
    onSave(editingInstance);
    onClose();
  };

  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...editingInstance.env };
    newEnv[key] = value;
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const handleEnvKeyChange = (oldKey: string, newKey: string) => {
    const newEnv = { ...editingInstance.env };
    const value = newEnv[oldKey];
    delete newEnv[oldKey];
    if (newKey) newEnv[newKey] = value;
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const handleArgsChange = (index: number, value: string) => {
    const newArgs = [...(editingInstance.args || [])];
    newArgs[index] = value;
    setEditingInstance({ ...editingInstance, args: newArgs });
  };

  const addEnvVariable = () => {
    setEditingInstance({ 
      ...editingInstance, 
      env: { ...editingInstance.env, '': '' }
    });
  };

  const addArgument = () => {
    setEditingInstance({ 
      ...editingInstance, 
      args: [...(editingInstance.args || []), '']
    });
  };

  const removeArgument = (index: number) => {
    const newArgs = [...(editingInstance.args || [])];
    newArgs.splice(index, 1);
    setEditingInstance({ ...editingInstance, args: newArgs });
  };

  const removeEnvVariable = (key: string) => {
    const newEnv = { ...editingInstance.env };
    delete newEnv[key];
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const title = `${isNewInstallation ? 'Install' : 'Settings'} - ${instance.serverId}`;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <ModalOverlay />
        <DialogContent>
          <Dialog.Title>
            <VisuallyHidden>{title}</VisuallyHidden>
          </Dialog.Title>
          <Dialog.Description>
            <VisuallyHidden>Configure MCP server settings</VisuallyHidden>
          </Dialog.Description>

          <ModalHeader>
            <div>{title}</div>
            <CloseButton>Close</CloseButton>
          </ModalHeader>

          <ModalBody>
            <SettingsContent>
              <FormGroup>
                <FormLabel>Server ID</FormLabel>
                <FormInput
                  type="text"
                  value={editingInstance.serverId}
                  onChange={(e) => setEditingInstance({ ...editingInstance, serverId: e.target.value })}
                  placeholder="Server identifier"
                  hasError={hasServerIdError}
                />
                {hasServerIdError && (
                  <ErrorMessage>
                    <AlertCircle size={14} />
                    Underscore (_) characters are not allowed in Server ID
                  </ErrorMessage>
                )}
                {isNewInstallation && !hasServerIdError && (
                  <FormLabel style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    Customize the server ID to install multiple instances
                  </FormLabel>
                )}
              </FormGroup>

              <FormGroup>
                <FormLabel>Command</FormLabel>
                <FormInput
                  type="text"
                  value={editingInstance.command || ''}
                  onChange={(e) => setEditingInstance({ ...editingInstance, command: e.target.value })}
                  placeholder="e.g., node, python, npx"
                />
              </FormGroup>

              <FormGroup>
                <FormLabel>Arguments</FormLabel>
                <ArgumentsList>
                  {(editingInstance.args || []).map((arg, index) => (
                    <ArgumentRow key={index}>
                      <FormInput
                        type="text"
                        value={arg}
                        onChange={(e) => handleArgsChange(index, e.target.value)}
                        placeholder={`Argument ${index + 1}`}
                      />
                      <RemoveButton onClick={() => removeArgument(index)}>
                        <X size={16} />
                      </RemoveButton>
                    </ArgumentRow>
                  ))}
                  <AddButton onClick={addArgument}>
                    <Plus size={16} />
                    Add Argument
                  </AddButton>
                </ArgumentsList>
              </FormGroup>

              <FormGroup>
                <FormLabel>Environment Variables</FormLabel>
                <EnvList>
                  {Object.entries(editingInstance.env || {}).map(([key, value]) => (
                    <EnvRow key={key}>
                      <FormInput
                        type="text"
                        value={key}
                        onChange={(e) => handleEnvKeyChange(key, e.target.value)}
                        placeholder="Variable name"
                      />
                      <FormInput
                        type="text"
                        value={String(value)}
                        onChange={(e) => handleEnvChange(key, e.target.value)}
                        placeholder="Variable value"
                      />
                      <RemoveButton onClick={() => removeEnvVariable(key)}>
                        <X size={16} />
                      </RemoveButton>
                    </EnvRow>
                  ))}
                  <AddButton onClick={addEnvVariable}>
                    <Plus size={16} />
                    Add Environment Variable
                  </AddButton>
                </EnvList>
              </FormGroup>
            </SettingsContent>

            <ModalActions>
              <CancelButton onClick={onClose}>
                Cancel
              </CancelButton>
              <ConfirmButton onClick={handleSave} disabled={hasServerIdError}>
                {isNewInstallation ? 'Install Server' : 'Save Changes'}
              </ConfirmButton>
            </ModalActions>
          </ModalBody>
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
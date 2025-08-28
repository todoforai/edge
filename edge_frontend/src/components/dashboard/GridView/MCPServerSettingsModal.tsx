import React, { useState } from 'react';
import styled from '@emotion/styled';
import { AlertCircle, Plus, X } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types/mcp.types';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalCard = styled.div`
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: min(900px, 90vw);
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
`;

const CloseButton = styled.button`
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--foreground);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
`;

const ModalBody = styled.div`
  padding: 20px;
`;

const SettingsContent = styled.div`
  flex: 1;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
  margin-bottom: 8px;
`;

const FormInput = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.hasError ? '#ef4444' : 'var(--border-color)'};
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--foreground);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#ef4444' : 'var(--primary)'};
    background: var(--background-secondary);
  }

  &:disabled {
    background: var(--background-tertiary);
    color: var(--muted);
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ArgumentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ArgumentRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const EnvList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EnvRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
`;

const RemoveButton = styled.button`
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--muted);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(59, 130, 246, 0.05);
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 0 0 0;
  border-top: 1px solid var(--border-color);
  margin-top: 20px;
`;

const CancelButton = styled.button`
  padding: 10px 20px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--foreground);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
`;

const ConfirmButton = styled.button<{ disabled?: boolean }>`
  padding: 10px 20px;
  background: ${props => props.disabled ? 'var(--muted)' : 'var(--primary)'};
  border: none;
  border-radius: 6px;
  color: ${props => props.disabled ? 'var(--muted)' : 'white'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 14px;

  &:hover {
    opacity: ${props => props.disabled ? 1 : 0.9};
  }
`;

interface MCPServerSettingsModalProps {
  instance: MCPEdgeExecutable;
  onClose: () => void;
  onSave: (instance: MCPEdgeExecutable) => void;
}

export const MCPServerSettingsModal: React.FC<MCPServerSettingsModalProps> = ({
  instance,
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
    <Overlay>
      <ModalCard>
        <ModalHeader>
          <div>{title}</div>
          <CloseButton onClick={onClose}>Close</CloseButton>
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
      </ModalCard>
    </Overlay>
  );
};
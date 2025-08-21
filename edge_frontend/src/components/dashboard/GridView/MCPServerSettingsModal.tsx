import React, { useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, Plus, X } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { Modal } from '../../ui/Modal';

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
  color: ${props => props.theme.colors.foreground};
  margin-bottom: 8px;
`;

const FormInput = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.$hasError ? '#ef4444' : props.theme.colors.borderColor};
  border-radius: 6px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? '#ef4444' : props.theme.colors.primary};
  }

  &:disabled {
    background: ${props => props.theme.colors.muted};
    color: ${props => props.theme.colors.mutedForeground};
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
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 4px;
  color: ${props => props.theme.colors.mutedForeground};
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
  border: 1px dashed ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
    background: rgba(59, 130, 246, 0.05);
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 0 0 0;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  margin-top: 20px;
`;

const CancelButton = styled.button`
  padding: 10px 20px;
  background: transparent;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  color: ${props => props.theme.colors.foreground};
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
`;

const ConfirmButton = styled.button<{ disabled?: boolean }>`
  padding: 10px 20px;
  background: ${props => props.disabled ? props.theme.colors.muted : props.theme.colors.primary};
  border: none;
  border-radius: 6px;
  color: ${props => props.disabled ? props.theme.colors.mutedForeground : 'white'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 14px;

  &:hover {
    background: ${props => props.disabled ? props.theme.colors.muted : `${props.theme.colors.primary}dd`};
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
  const [editingInstance, setEditingInstance] = useState<MCPEdgeExecutable>({ ...instance });
  const isNewInstallation = (instance.id || '').startsWith('temp-');

  // Add validation state
  const hasServerIdError = editingInstance.serverId.includes('_');

  const handleSave = () => {
    // Prevent saving if there are validation errors
    if (hasServerIdError) {
      return;
    }
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
    if (newKey) {
      newEnv[newKey] = value;
    }
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
    <Modal title={title} onClose={onClose}>
      <SettingsContent>
        <FormGroup>
          <FormLabel>Server ID</FormLabel>
          <FormInput
            type="text"
            value={editingInstance.serverId}
            onChange={(e) => setEditingInstance({ ...editingInstance, serverId: e.target.value })}
            placeholder="Server identifier"
            $hasError={hasServerIdError}
          />
          {hasServerIdError && (
            <ErrorMessage>
              <AlertCircle size={14} />
              Underscore (_) characters are not allowed in Server ID
            </ErrorMessage>
          )}
          {isNewInstallation && !hasServerIdError && (
            <FormLabel style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
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
    </Modal>
  );
};
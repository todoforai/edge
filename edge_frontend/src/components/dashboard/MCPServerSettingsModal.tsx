import React, { useState } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPEdgeExecutable } from '../../shared/REST_types_shared';


// ... existing styled components from the original file ...
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const SettingsModal = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const SettingsContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const SettingsSection = styled.div`
  margin-bottom: 24px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  overflow: hidden;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(59, 130, 246, 0.05);
  cursor: pointer;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:hover {
    background: rgba(59, 130, 246, 0.1);
  }
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const SectionToggle = styled.div<{ $expanded: boolean }>`
  transform: ${props => props.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform 0.2s;
  color: ${props => props.theme.colors.mutedForeground};
`;

const SectionContent = styled.div`
  padding: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.foreground};
  margin-bottom: 6px;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
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
  padding: 20px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
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

const ConfirmButton = styled.button`
  padding: 10px 20px;
  background: ${props => props.theme.colors.primary};
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: ${props => props.theme.colors.primary}dd;
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    env: true, // Environment variables expanded by default
    conf: true, // Configuration expanded by default
    basic: false // Basic info collapsed by default
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSave = () => {
    onSave(editingInstance);
    onClose();
  };

  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...editingInstance.env };
    if (value === '') {
      delete newEnv[key];
    } else {
      newEnv[key] = value;
    }
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const handleConfChange = (key: string, value: string) => {
    const newConf = { ...editingInstance.conf };
    if (value === '') {
      delete newConf[key];
    } else {
      newConf[key] = value;
    }
    setEditingInstance({ ...editingInstance, conf: newConf });
  };

  const addEnvVariable = () => {
    setEditingInstance({ 
      ...editingInstance, 
      env: { ...editingInstance.env, '': '' }
    });
  };

  const addConfVariable = () => {
    setEditingInstance({ 
      ...editingInstance, 
      conf: { ...editingInstance.conf, '': '' }
    });
  };

  return (
    <ModalOverlay onClick={onClose}>
      <SettingsModal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Settings - {instance.serverId}</ModalTitle>
          <CloseButton onClick={onClose}>
            <Icon icon="lucide:x" />
          </CloseButton>
        </ModalHeader>

        <SettingsContent>
          {/* Environment Variables */}
          <SettingsSection>
            <SectionHeader onClick={() => toggleSection('env')}>
              <SectionTitle>Environment Variables</SectionTitle>
              <SectionToggle $expanded={expandedSections.env}>
                <Icon icon="lucide:chevron-down" width={20} height={20} />
              </SectionToggle>
            </SectionHeader>
            {expandedSections.env && (
              <SectionContent>
                {Object.entries(editingInstance.env || {}).map(([key, value]) => (
                  <EnvRow key={key}>
                    <FormInput
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        const newEnv = { ...editingInstance.env };
                        delete newEnv[key];
                        if (newKey) newEnv[newKey] = value;
                        setEditingInstance({ ...editingInstance, env: newEnv });
                      }}
                      placeholder="Variable name"
                    />
                    <FormInput
                      type="text"
                      value={String(value)}
                      onChange={(e) => handleEnvChange(key, e.target.value)}
                      placeholder="Variable value"
                    />
                    <RemoveButton onClick={() => handleEnvChange(key, '')}>
                      <Icon icon="lucide:x" width={16} height={16} />
                    </RemoveButton>
                  </EnvRow>
                ))}
                <AddButton onClick={addEnvVariable}>
                  <Icon icon="lucide:plus" width={16} height={16} />
                  Add Environment Variable
                </AddButton>
              </SectionContent>
            )}
          </SettingsSection>

          {/* Configuration Variables */}
          <SettingsSection>
            <SectionHeader onClick={() => toggleSection('conf')}>
              <SectionTitle>Configuration</SectionTitle>
              <SectionToggle $expanded={expandedSections.conf}>
                <Icon icon="lucide:chevron-down" width={20} height={20} />
              </SectionToggle>
            </SectionHeader>
            {expandedSections.conf && (
              <SectionContent>
                {Object.entries(editingInstance.conf || {}).map(([key, value]) => (
                  <EnvRow key={key}>
                    <FormInput
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        const newConf = { ...editingInstance.conf };
                        delete newConf[key];
                        if (newKey) newConf[newKey] = value;
                        setEditingInstance({ ...editingInstance, conf: newConf });
                      }}
                      placeholder="Config key"
                    />
                    <FormInput
                      type="text"
                      value={String(value)}
                      onChange={(e) => handleConfChange(key, e.target.value)}
                      placeholder="Config value"
                    />
                    <RemoveButton onClick={() => handleConfChange(key, '')}>
                      <Icon icon="lucide:x" width={16} height={16} />
                    </RemoveButton>
                  </EnvRow>
                ))}
                <AddButton onClick={addConfVariable}>
                  <Icon icon="lucide:plus" width={16} height={16} />
                  Add Configuration
                </AddButton>
              </SectionContent>
            )}
          </SettingsSection>

          {/* Basic Information */}
          <SettingsSection>
            <SectionHeader onClick={() => toggleSection('basic')}>
              <SectionTitle>Basic Information</SectionTitle>
              <SectionToggle $expanded={expandedSections.basic}>
                <Icon icon="lucide:chevron-down" width={20} height={20} />
              </SectionToggle>
            </SectionHeader>
            {expandedSections.basic && (
              <SectionContent>
                <FormGroup>
                  <FormLabel>Instance ID</FormLabel>
                  <FormInput
                    type="text"
                    value={editingInstance.id}
                    onChange={(e) => setEditingInstance({ ...editingInstance, id: e.target.value })}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Server ID</FormLabel>
                  <FormInput
                    type="text"
                    value={editingInstance.serverId}
                    onChange={(e) => setEditingInstance({ ...editingInstance, serverId: e.target.value })}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Enabled</FormLabel>
                  <FormInput
                    type="checkbox"
                    checked={editingInstance.enabled}
                    onChange={(e) => setEditingInstance({ ...editingInstance, enabled: e.target.checked })}
                  />
                </FormGroup>
              </SectionContent>
            )}
          </SettingsSection>
        </SettingsContent>

        <ModalActions>
          <CancelButton onClick={onClose}>
            Cancel
          </CancelButton>
          <ConfirmButton onClick={handleSave}>
            Save Changes
          </ConfirmButton>
        </ModalActions>
      </SettingsModal>
    </ModalOverlay>
  );
};
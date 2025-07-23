import React, { useState } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import { MCPServer } from './types/MCPServer';

interface MCPServerSettingsModalProps {
  server: MCPServer;
  onClose: () => void;
  onSave: (server: MCPServer) => void;
}

export const MCPServerSettingsModal: React.FC<MCPServerSettingsModalProps> = ({
  server,
  onClose,
  onSave
}) => {
  const [editingServer, setEditingServer] = useState<MCPServer>({ ...server });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    env: true, // Environment variables expanded by default
    basic: false, // Basic info collapsed by default
    command: false // Command config collapsed by default
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSave = () => {
    onSave(editingServer);
    onClose();
  };

  const handleFieldChange = (field: keyof MCPServer, value: any) => {
    setEditingServer({ ...editingServer, [field]: value });
  };

  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...editingServer.env };
    if (value === '') {
      delete newEnv[key];
    } else {
      newEnv[key] = value;
    }
    setEditingServer({ ...editingServer, env: newEnv });
  };

  const addEnvVariable = () => {
    setEditingServer({ 
      ...editingServer, 
      env: { ...editingServer.env, '': '' }
    });
  };

  const handleArgsChange = (index: number, value: string) => {
    const newArgs = [...editingServer.args];
    newArgs[index] = value;
    setEditingServer({ ...editingServer, args: newArgs });
  };

  const addArg = () => {
    setEditingServer({ 
      ...editingServer, 
      args: [...editingServer.args, '']
    });
  };

  const removeArg = (index: number) => {
    const newArgs = editingServer.args.filter((_, i) => i !== index);
    setEditingServer({ ...editingServer, args: newArgs });
  };

  return (
    <ModalOverlay onClick={onClose}>
      <SettingsModal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Settings - {server.name}</ModalTitle>
          <CloseButton onClick={onClose}>
            <Icon icon="lucide:x" />
          </CloseButton>
        </ModalHeader>

        <SettingsContent>
          {/* Environment Variables - Most Important, at top and expanded by default */}
          <SettingsSection>
            <SectionHeader onClick={() => toggleSection('env')}>
              <SectionTitle>Environment Variables</SectionTitle>
              <SectionToggle $expanded={expandedSections.env}>
                <Icon icon="lucide:chevron-down" width={20} height={20} />
              </SectionToggle>
            </SectionHeader>
            {expandedSections.env && (
              <SectionContent>
                {Object.entries(editingServer.env).map(([key, value]) => (
                  <EnvRow key={key}>
                    <FormInput
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        const newEnv = { ...editingServer.env };
                        delete newEnv[key];
                        if (newKey) newEnv[newKey] = value;
                        setEditingServer({ ...editingServer, env: newEnv });
                      }}
                      placeholder="Variable name"
                    />
                    <FormInput
                      type="text"
                      value={value}
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

          {/* Command Configuration - Collapsed by default */}
          <SettingsSection>
            <SectionHeader onClick={() => toggleSection('command')}>
              <SectionTitle>Command Configuration</SectionTitle>
              <SectionToggle $expanded={expandedSections.command}>
                <Icon icon="lucide:chevron-down" width={20} height={20} />
              </SectionToggle>
            </SectionHeader>
            {expandedSections.command && (
              <SectionContent>
                <FormGroup>
                  <FormLabel>Command</FormLabel>
                  <FormInput
                    type="text"
                    value={editingServer.command}
                    onChange={(e) => handleFieldChange('command', e.target.value)}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Arguments</FormLabel>
                  {editingServer.args.map((arg, index) => (
                    <ArgRow key={index}>
                      <FormInput
                        type="text"
                        value={arg}
                        onChange={(e) => handleArgsChange(index, e.target.value)}
                        placeholder={`Argument ${index + 1}`}
                      />
                      <RemoveButton onClick={() => removeArg(index)}>
                        <Icon icon="lucide:x" width={16} height={16} />
                      </RemoveButton>
                    </ArgRow>
                  ))}
                  <AddButton onClick={addArg}>
                    <Icon icon="lucide:plus" width={16} height={16} />
                    Add Argument
                  </AddButton>
                </FormGroup>
              </SectionContent>
            )}
          </SettingsSection>

          {/* Basic Information - Collapsed by default */}
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
                  <FormLabel>Server ID</FormLabel>
                  <FormInput
                    type="text"
                    value={editingServer.id}
                    onChange={(e) => handleFieldChange('id', e.target.value)}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Name</FormLabel>
                  <FormInput
                    type="text"
                    value={editingServer.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Description</FormLabel>
                  <FormTextArea
                    value={editingServer.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={3}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Icon</FormLabel>
                  <FormInput
                    type="text"
                    value={editingServer.icon}
                    onChange={(e) => handleFieldChange('icon', e.target.value)}
                    placeholder="e.g., logos:gmail"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Category</FormLabel>
                  <FormInput
                    type="text"
                    value={editingServer.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
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

const FormTextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-size: 14px;
  resize: vertical;

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

const ArgRow = styled.div`
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
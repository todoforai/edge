import React, { useState } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPServer } from './types/MCPServer';

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

const Modal = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
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

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
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

const FormHelp = styled.p`
  font-size: 12px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 6px 0 0 0;
`;

const ConfigPreview = styled.div`
  margin-top: 20px;
`;

const PreviewTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const CodeBlock = styled.pre`
  background: #1a1a1a;
  color: #ffffff;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre;
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

interface MCPServerInstallModalProps {
  server: MCPServer;
  onClose: () => void;
  onInstall: (customId: string) => void;
}

export const MCPServerInstallModal: React.FC<MCPServerInstallModalProps> = ({
  server,
  onClose,
  onInstall
}) => {
  const [customId, setCustomId] = useState<string>('');

  const handleConfirmInstall = () => {
    onInstall(customId);
  };

  return (
    <ModalOverlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Install {server.name}</ModalTitle>
          <CloseButton onClick={onClose}>
            <Icon icon="lucide:x" />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <FormGroup>
            <FormLabel>Custom Server ID</FormLabel>
            <FormInput
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g., gmail@user@domain.com"
            />
            <FormHelp>
              Customize the server ID to install multiple instances (e.g., different Gmail accounts)
            </FormHelp>
          </FormGroup>

          <ConfigPreview>
            <PreviewTitle>Configuration Preview:</PreviewTitle>
            <CodeBlock>
              {JSON.stringify({
                [customId || server.id]: {
                  command: server.command,
                  args: server.args,
                  env: server.env
                }
              }, null, 2)}
            </CodeBlock>
          </ConfigPreview>
        </ModalContent>

        <ModalActions>
          <CancelButton onClick={onClose}>
            Cancel
          </CancelButton>
          <ConfirmButton onClick={handleConfirmInstall}>
            Install Server
          </ConfirmButton>
        </ModalActions>
      </Modal>
    </ModalOverlay>
  );
};
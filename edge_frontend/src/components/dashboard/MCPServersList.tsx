import React, { useState } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  installed: boolean;
  category: string;
}

// Fake data for MCP servers - eventually this will come from a registry/API
const FAKE_MCP_SERVERS: MCPServer[] = [
  {
    id: 'gmail',
    name: 'Gmail MCP',
    description: 'Access and manage Gmail emails with full authentication support',
    icon: 'logos:gmail',
    command: 'npx',
    args: ['@gongrzhe/server-gmail-autoauth-mcp'],
    env: {
      'GMAIL_CREDENTIALS_PATH': '/path/to/credentials.json'
    },
    installed: false,
    category: 'Communication'
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer MCP',
    description: 'Web automation and scraping using Puppeteer browser control',
    icon: 'simple-icons:puppeteer',
    command: 'node',
    args: ['/path/to/puppeteer-mcp-server/dist/index.js'],
    env: {},
    installed: true,
    category: 'Web Automation'
  },
  {
    id: 'pdf-filler',
    name: 'PDF Filler',
    description: 'Fill PDF forms with Claude Desktop integration',
    icon: 'vscode-icons:file-type-pdf2',
    command: 'npx',
    args: ['@pdf-filler/mcp-server'],
    env: {},
    installed: false,
    category: 'Documents'
  },
  {
    id: 'windows-mcp',
    name: 'Windows MCP',
    description: 'Lightweight MCP Server that enables Claude to interact with Windows OS',
    icon: 'logos:microsoft-windows',
    command: 'npx',
    args: ['@windows-mcp/server'],
    env: {},
    installed: false,
    category: 'System'
  },
  {
    id: 'macos-control',
    name: 'Control your Mac',
    description: 'Execute AppleScript to automate tasks on macOS',
    icon: 'logos:apple',
    command: 'npx',
    args: ['@macos-control/mcp-server'],
    env: {},
    installed: false,
    category: 'System'
  },
  {
    id: 'spotify-applescript',
    name: 'Spotify (AppleScript)',
    description: 'Control Spotify via AppleScript',
    icon: 'logos:spotify',
    command: 'npx',
    args: ['@spotify-applescript/mcp-server'],
    env: {},
    installed: false,
    category: 'Media'
  },
  {
    id: 'enrichr-mcp',
    name: 'Enrichr MCP Server',
    description: 'Gene set enrichment analysis using Enrichr API with multi-library support',
    icon: 'material-symbols:biotech',
    command: 'npx',
    args: ['@enrichr/mcp-server'],
    env: {},
    installed: false,
    category: 'Science'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Manage resources in your Stripe account and search the Stripe documentation',
    icon: 'logos:stripe',
    command: 'npx',
    args: ['@stripe/mcp-server'],
    env: {
      'STRIPE_API_KEY': 'your_stripe_api_key'
    },
    installed: false,
    category: 'Finance'
  },
  {
    id: 'brave-applescript',
    name: 'Brave (AppleScript)',
    description: 'Control Brave Browser tabs, windows, and navigation',
    icon: 'logos:brave',
    command: 'npx',
    args: ['@brave-applescript/mcp-server'],
    env: {},
    installed: false,
    category: 'Web Automation'
  },
  {
    id: 'airtable-mcp',
    name: 'Airtable MCP Server',
    description: 'Read and write access to Airtable databases via the Model Context Protocol',
    icon: 'simple-icons:airtable',
    command: 'npx',
    args: ['@airtable/mcp-server'],
    env: {
      'AIRTABLE_API_KEY': 'your_airtable_api_key'
    },
    installed: false,
    category: 'Database'
  },
  {
    id: 'cucumber-studio',
    name: 'Cucumber Studio MCP',
    description: 'MCP server for Cucumber Studio API integration - access test scenarios, features, and projects',
    icon: 'simple-icons:cucumber',
    command: 'npx',
    args: ['@cucumber-studio/mcp-server'],
    env: {
      'CUCUMBER_STUDIO_API_TOKEN': 'your_api_token'
    },
    installed: false,
    category: 'Testing'
  },
  {
    id: 'socket-mcp',
    name: 'Socket MCP Server',
    description: 'Socket MCP server for scanning dependencies and security analysis',
    icon: 'material-symbols:security',
    command: 'npx',
    args: ['@socket/mcp-server'],
    env: {},
    installed: false,
    category: 'Security'
  }
];

const MCPServersList: React.FC = () => {
  const [servers] = useState<MCPServer[]>(FAKE_MCP_SERVERS);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInstallModal, setShowInstallModal] = useState<MCPServer | null>(null);
  const [customId, setCustomId] = useState<string>('');

  // Get unique categories
  const categories = ['All', ...Array.from(new Set(servers.map(s => s.category)))];

  // Filter servers
  const filteredServers = servers.filter(server => {
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = (server: MCPServer) => {
    setCustomId(server.id);
    setShowInstallModal(server);
  };

  const handleConfirmInstall = () => {
    // TODO: Implement actual installation logic
    console.log('Installing MCP server:', showInstallModal?.id, 'with custom ID:', customId);
    setShowInstallModal(null);
    setCustomId('');
  };

  const handleUninstall = (server: MCPServer) => {
    // TODO: Implement actual uninstallation logic
    console.log('Uninstalling MCP server:', server.id);
  };

  return (
    <Container>
      <Header>
        <Title>MCP Server Registry</Title>
        <Subtitle>Discover and install Model Context Protocol servers to extend agent capabilities</Subtitle>
      </Header>

      <Controls>
        <SearchContainer>
          <Icon icon="lucide:search" />
          <SearchInput
            type="text"
            placeholder="Search MCP servers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchContainer>

        <CategoryTabs>
          {categories.map(category => (
            <CategoryTab
              key={category}
              $active={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </CategoryTab>
          ))}
        </CategoryTabs>
      </Controls>

      <ServersGrid>
        {filteredServers.map(server => (
          <ServerCard key={server.id} $installed={server.installed}>
            <ServerHeader>
              <ServerIcon>
                <Icon icon={server.icon} width={32} height={32} />
              </ServerIcon>
              <ServerInfo>
                <ServerName>{server.name}</ServerName>
                <ServerCategory>{server.category}</ServerCategory>
              </ServerInfo>
              <StatusBadge $installed={server.installed}>
                {server.installed ? 'Installed' : 'Available'}
              </StatusBadge>
            </ServerHeader>

            <ServerDescription>{server.description}</ServerDescription>

            <ServerDetails>
              <DetailRow>
                <DetailLabel>Command:</DetailLabel>
                <DetailValue>{server.command}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Args:</DetailLabel>
                <DetailValue>{server.args.join(' ')}</DetailValue>
              </DetailRow>
              {Object.keys(server.env).length > 0 && (
                <DetailRow>
                  <DetailLabel>Environment:</DetailLabel>
                  <DetailValue>{Object.keys(server.env).join(', ')}</DetailValue>
                </DetailRow>
              )}
            </ServerDetails>

            <ServerActions>
              {server.installed ? (
                <UninstallButton onClick={() => handleUninstall(server)}>
                  <Icon icon="lucide:trash-2" />
                  Uninstall
                </UninstallButton>
              ) : (
                <InstallButton onClick={() => handleInstall(server)}>
                  <Icon icon="lucide:download" />
                  Install
                </InstallButton>
              )}
            </ServerActions>
          </ServerCard>
        ))}
      </ServersGrid>

      {/* Install Modal */}
      {showInstallModal && (
        <ModalOverlay onClick={() => setShowInstallModal(null)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Install {showInstallModal.name}</ModalTitle>
              <CloseButton onClick={() => setShowInstallModal(null)}>
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
                    [customId || showInstallModal.id]: {
                      command: showInstallModal.command,
                      args: showInstallModal.args,
                      env: showInstallModal.env
                    }
                  }, null, 2)}
                </CodeBlock>
              </ConfigPreview>
            </ModalContent>

            <ModalActions>
              <CancelButton onClick={() => setShowInstallModal(null)}>
                Cancel
              </CancelButton>
              <ConfirmButton onClick={handleConfirmInstall}>
                Install Server
              </ConfirmButton>
            </ModalActions>
          </Modal>
        </ModalOverlay>
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
`;

const SearchContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  max-width: 400px;

  svg {
    position: absolute;
    left: 12px;
    color: ${props => props.theme.colors.mutedForeground};
    z-index: 1;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const CategoryTab = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border: 1px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.borderColor};
  border-radius: 20px;
  background: ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.$active ? 'white' : props.theme.colors.foreground};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: ${props => props.$active ? props.theme.colors.primary : 'rgba(59, 130, 246, 0.1)'};
  }
`;

const ServersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
`;

const ServerCard = styled.div<{ $installed: boolean }>`
  border: 1px solid ${props => props.$installed ? '#4CAF50' : props.theme.colors.borderColor};
  border-radius: 12px;
  padding: 20px;
  background: ${props => props.theme.colors.background};
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.$installed ? '#4CAF50' : props.theme.colors.primary};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ServerHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
`;

const ServerIcon = styled.div`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.1);
`;

const ServerInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ServerName = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 4px 0;
`;

const ServerCategory = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.mutedForeground};
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
`;

const StatusBadge = styled.span<{ $installed: boolean }>`
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 12px;
  background: ${props => props.$installed ? '#4CAF50' : '#9E9E9E'};
  color: white;
  flex-shrink: 0;
`;

const ServerDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  line-height: 1.5;
  margin: 0 0 16px 0;
`;

const ServerDetails = styled.div`
  margin-bottom: 20px;
`;

const DetailRow = styled.div`
  display: flex;
  margin-bottom: 8px;
  font-size: 12px;
`;

const DetailLabel = styled.span`
  font-weight: 500;
  color: ${props => props.theme.colors.foreground};
  min-width: 80px;
  flex-shrink: 0;
`;

const DetailValue = styled.span`
  color: ${props => props.theme.colors.mutedForeground};
  font-family: 'Monaco', 'Menlo', monospace;
  word-break: break-all;
`;

const ServerActions = styled.div`
  display: flex;
  gap: 8px;
`;

const InstallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.theme.colors.primaryHover || '#2563eb'};
  }
`;

const UninstallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  color: #f44336;
  border: 1px solid #f44336;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f44336;
    color: white;
  }
`;

// Modal Styles
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

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const ModalContent = styled.div`
  padding: 20px;
  flex: 1;
  overflow-y: auto;
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

const FormInput = styled.input`
  width: 100%;
  padding: 12px;
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
  margin: 4px 0 0 0;
`;

const ConfigPreview = styled.div`
  margin-top: 20px;
`;

const PreviewTitle = styled.h4`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const CodeBlock = styled.pre`
  background: ${props => props.theme.colors.muted || '#f5f5f5'};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  color: ${props => props.theme.colors.foreground};
  overflow-x: auto;
  white-space: pre-wrap;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  background: transparent;
  color: ${props => props.theme.colors.mutedForeground};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const ConfirmButton = styled.button`
  padding: 8px 16px;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.theme.colors.primaryHover || '#2563eb'};
  }
`;

export default MCPServersList;
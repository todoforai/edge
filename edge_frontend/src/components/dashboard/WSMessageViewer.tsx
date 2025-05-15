import React, { useEffect } from 'react';
import { useWSMessageStore } from '../../store/wsMessageStore';
import styled from 'styled-components';
import pythonService from '@/services/python-service';
import { useCachedState } from '@/utils/useCachedState';
import MessageListCard from './MessageListCard';

// Format object to YAML-like string
const formatYamlLike = (obj: any, indent = 0): string => {
  if (obj === null || obj === undefined) return 'null';
  
  // For primitive types
  if (typeof obj !== 'object') {
    return String(obj);
  }
  
  // For arrays and objects
  const spaces = ' '.repeat(indent);
  const nextIndent = indent + 2;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- \n${formatYamlLike(item, nextIndent)}`;
      }
      return `${spaces}- ${formatYamlLike(item)}`;
    }).join('\n');
  }
  
  // For objects
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  
  return entries.map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return `${spaces}${key}:\n${formatYamlLike(value, nextIndent)}`;
    }
    return `${spaces}${key}: ${formatYamlLike(value)}`;
  }).join('\n');
};

const WSMessageViewer: React.FC = () => {
  const { messages, isVisible, toggleVisibility, clearMessages, addMessage } = useWSMessageStore();
  
  // Use cached state for ignored message types
  const [ignoredTypes, setIgnoredTypes] = useCachedState<string[]>(
    [], // Default to no ignored types
    'ws-message-ignored-types'
  );
  
  // Get unique message types for filter dropdown
  const messageTypes = Array.from(new Set(messages.map(msg => msg.type)));
  
  // Filter messages based on ignored types
  const filteredMessages = messages.filter(msg => 
    !ignoredTypes.includes(msg.type) && msg.type !== 'file_sync'
  );

  useEffect(() => {
    // Set up event listener for all messages using the wildcard listener
    const removeListener = pythonService.onAny((event) => {
      addMessage(event);
    });

    // Clean up listener when component unmounts
    return () => removeListener();
  }, [addMessage]);

  // Toggle a message type in the filter
  const toggleMessageType = (type: string) => {
    setIgnoredTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  // Render a message item
  const renderMessageItem = (msg: any, _index: number, style: React.CSSProperties) => {
    return (
      <MessageItem style={style}>
        <MessageType>{msg.type}</MessageType>
        <MessageContent>
          {formatYamlLike(msg.payload)}
        </MessageContent>
        {msg.timestamp && (
          <MessageTimestamp>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </MessageTimestamp>
        )}
      </MessageItem>
    );
  };

  // Filter dropdown component
  const filterActions = (
    <>
      <FilterDropdown>
        <FilterButton>Filter</FilterButton>
        <DropdownContent>
          {messageTypes.map(type => (
            <FilterItem key={type}>
              <FilterCheckbox 
                type="checkbox" 
                checked={!ignoredTypes.includes(type)}
                onChange={() => toggleMessageType(type)}
              />
              <span>{type}</span>
            </FilterItem>
          ))}
        </DropdownContent>
      </FilterDropdown>
      <ActionButton onClick={clearMessages}>Clear</ActionButton>
      <ActionButton onClick={toggleVisibility}>{isVisible ? 'Hide Details' : 'Show Details'}</ActionButton>
    </>
  );

  return (
    <MessageListCard
      title="WebSocket Messages"
      messages={filteredMessages}
      renderItem={renderMessageItem}
      itemSize={150}
      emptyMessage="No messages received yet"
      actions={filterActions}
    />
  );
};

// Styled Components
const ActionButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.colors.foreground};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.sm};
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const FilterDropdown = styled.div`
  position: relative;
  display: inline-block;
`;

const FilterButton = styled(ActionButton)`
  &:hover + div {
    display: block;
  }
`;

const DropdownContent = styled.div`
  display: none;
  position: absolute;
  right: 0;
  background-color: ${props => props.theme.colors.cardBackground};
  min-width: 160px;
  box-shadow: ${props => props.theme.shadows.md};
  z-index: 1;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  padding: 8px 0;
  
  &:hover {
    display: block;
  }
`;

const FilterItem = styled.label`
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
`;

const FilterCheckbox = styled.input`
  cursor: pointer;
`;

const MessageItem = styled.div`
  margin: 0 0 8px 0;
  padding: 10px;
  background-color: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.radius.md};
  border: 1px solid ${props => props.theme.colors.borderColor};
  position: relative;
  overflow: hidden;
`;

const MessageType = styled.div`
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 6px;
  color: ${props => props.theme.colors.primary};
`;

const MessageContent = styled.pre`
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${props => props.theme.colors.foreground};
  max-height: 100px;
  overflow-y: auto;
`;

const MessageTimestamp = styled.div`
  font-size: 11px;
  color: ${props => props.theme.colors.muted};
  position: absolute;
  top: 10px;
  right: 10px;
`;

export default WSMessageViewer;

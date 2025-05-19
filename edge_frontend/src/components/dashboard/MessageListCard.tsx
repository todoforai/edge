import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface MessageListCardProps {
  title: string;
  messages: any[];
  renderItem: (item: any, index: number, style: React.CSSProperties) => React.ReactNode;
  itemSize?: number;
  emptyMessage?: string;
  actions?: React.ReactNode;
  customCount?: string; // New prop for custom count display
}

const MessageListCard: React.FC<MessageListCardProps> = ({
  title,
  messages = [],
  renderItem,
  itemSize = 50,
  emptyMessage = 'No messages to display',
  actions,
  customCount
}) => {
  const listRef = useRef<List>(null);

  // Effect to scroll to top when new messages are added
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(0);
    }
  }, [messages.length]);

  // Virtualized row renderer
  const RowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    return renderItem(messages[index], index, style);
  };

  // Display count based on whether customCount is provided
  const displayTitle = customCount ? `${title} (${customCount})` : `${title} (${messages.length})`;

  return (
    <Card>
      <CardTitle>
        {displayTitle}
        {actions && <ButtonGroup>{actions}</ButtonGroup>}
      </CardTitle>
      
      <ListContainer>
        {messages.length > 0 ? (
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                width={width}
                itemCount={messages.length}
                itemSize={itemSize}
                overscanCount={5}
              >
                {RowRenderer}
              </List>
            )}
          </AutoSizer>
        ) : (
          <EmptyState>{emptyMessage}</EmptyState>
        )}
      </ListContainer>
    </Card>
  );
};

// Styled Components
const Card = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: ${props => props.theme.radius.lg};
  box-shadow: ${props => props.theme.shadows.sm};
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  height: 800px; /* Doubled from 400px to 800px */
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
`;

const CardTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: ${props => props.theme.colors.foreground};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  padding-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const ListContainer = styled.div`
  flex-grow: 1;
  width: 100%;
  height: calc(100% - 50px); /* Adjust based on your card title height */
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 20px;
  color: ${props => props.theme.colors.muted};
  font-style: italic;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default MessageListCard;
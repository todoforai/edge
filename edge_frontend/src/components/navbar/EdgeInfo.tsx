import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { renameEdge } from '../../services/edge-service';
import { cva } from 'class-variance-authority';

const infoContainer = cva(['flex items-center gap-2 px-2.5 py-1.5 bg-card rounded-2xl border border-border']);

const infoItem = cva(['flex items-center gap-1.5']);

const separator = cva(['w-px h-4 bg-border mx-1']);

const label = cva(['text-xs text-muted-foreground font-medium']);

const value = cva(['text-xs text-foreground font-semibold flex items-center gap-1']);

const copyableValue = cva(['text-xs font-semibold flex items-center gap-1 cursor-pointer select-all'], {
  variants: {
    copied: {
      true: 'text-green-400',
      false: 'text-foreground',
    },
  },
});

const editableValue = cva([
  'text-xs text-foreground font-semibold flex items-center gap-1 cursor-pointer select-none px-1 py-0.5 rounded transition-colors hover:bg-accent',
]);

const editInput = cva([
  'text-xs text-foreground font-semibold bg-accent border border-border rounded px-1.5 py-0.5 outline-none w-30 focus:border-primary focus:shadow-[0_0_0_2px_rgba(255,165,0,0.1)]',
]);

const statusDot = cva(['w-2 h-2 rounded-full mr-1.5 flex-shrink-0'], {
  variants: {
    color: {
      green: 'bg-green-500',
      gray: 'bg-gray-500',
      orange: 'bg-orange-500',
    },
  },
});

export const EdgeInfo: React.FC = () => {
  const { user, apiUrl } = useAuthStore();
  const { config } = useEdgeConfigStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingName, setEditingName] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // Use either the API URL from the user object or from the store
  const displayUrl = user?.apiUrl || apiUrl || 'Unknown';

  // Get edge info from config - using correct field names
  const edgeName = config.name || 'Unknown Edge';
  const edgeStatus = config.status || 'OFFLINE';

  const handleEdgeIdDoubleClick = async () => {
    try {
      await navigator.clipboard.writeText(config.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy edge ID to clipboard:', err);
    }
  };

  const handleEdgeNameClick = () => {
    setIsEditing(true);
    setEditingName(edgeName);
  };

  const handleNameSubmit = async () => {
    if (editingName.trim() && editingName.trim() !== edgeName) {
      try {
        const response = await renameEdge(editingName.trim());
        console.log('Edge renamed successfully', response);
      } catch (error) {
        console.error('Failed to rename edge:', error);
        // Reset to original name on error
        setEditingName(edgeName);
      }
    }
    setIsEditing(false);
  };

  const handleNameCancel = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const getStatusColor = (status: string): 'green' | 'gray' | 'orange' => {
    switch (status.toUpperCase()) {
      case 'ONLINE':
        return 'green';
      case 'OFFLINE':
        return 'gray';
      case 'CONNECTING':
        return 'orange';
      default:
        return 'gray';
    }
  };

  return (
    <div className={infoContainer()}>
      <div className={infoItem()}>
        <span className={label()}>API:</span>
        <span className={value()}>{displayUrl}</span>
      </div>
      <div className={separator()} />
      <div className={infoItem()}>
        <span className={label()}>Edge:</span>
        <div className={statusDot({ color: getStatusColor(edgeStatus) })} title={`Status: ${edgeStatus}`} />
        <span className={value()}>
          {isEditing ? (
            <input
              className={editInput()}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleKeyPress}
              autoFocus
              maxLength={50}
            />
          ) : (
            <span className={editableValue()} onClick={handleEdgeNameClick} title="Click to rename">
              {edgeName}
            </span>
          )}
        </span>
      </div>
      <div className={separator()} />
      <div className={infoItem()}>
        <span className={label()}>ID:</span>
        <span
          className={copyableValue({ copied })}
          onDoubleClick={handleEdgeIdDoubleClick}
          title={copied ? 'Copied!' : 'Double-click to copy'}
        >
          {copied ? 'Copied!' : config.id.length > 8 ? `${config.id.substring(0, 8)}...` : config.id}
        </span>
      </div>
    </div>
  );
};

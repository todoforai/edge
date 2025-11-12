import React from 'react';
import { Plus } from 'lucide-react';
import { cva } from "class-variance-authority";

const card = cva([
  "border border-dashed border-border rounded-lg p-7 bg-card cursor-pointer transition-all duration-200 min-h-[120px] flex items-center gap-3",
  "hover:border-primary hover:shadow-md"
]);

const iconContainer = cva([
  "flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-md bg-primary/10 text-primary"
]);

const content = cva([
  "flex-1"
]);

const titleRow = cva([
  "flex items-center gap-3 mb-3"
]);

const title = cva([
  "text-xl font-semibold text-foreground m-0"
]);

const description = cva([
  "text-sm text-muted-foreground m-0 leading-relaxed"
]);

interface ExtensionAddCardProps {
  onClick: () => void;
}

export const ExtensionAddCard: React.FC<ExtensionAddCardProps> = ({ onClick }) => {
  return (
    <div className={card()} onClick={onClick}>
      <div className={content()}>
        <div className={titleRow()}>
          <div className={iconContainer()}>
            <Plus size={24} />
          </div>
          <h3 className={title()}>Add new integration</h3>
        </div>
        <p className={description()}>
          Browse and install MCP servers from the registry to extend your AI capabilities
        </p>
      </div>
    </div>
  );
};
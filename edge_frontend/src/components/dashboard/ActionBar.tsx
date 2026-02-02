import React from 'react';
import { Search, Filter, Eye, Braces, X, RefreshCw } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ButtonGroup } from '../ui/button-group';
import { cn } from '@/lib/utils';

interface ActionBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selectedCategory: string;
  categories: string[];
  onCategoryChange: (category: string) => void;
  viewMode?: 'visual' | 'json';
  onViewModeChange?: (mode: 'visual' | 'json') => void;
  showViewPicker?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  selectedCategory,
  categories,
  onCategoryChange,
  viewMode,
  onViewModeChange,
  showViewPicker = false,
  onRefresh,
  isRefreshing = false
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState<boolean>(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = React.useState<boolean>(false);
  
  const filterRef = useClickOutside<HTMLDivElement>(
    () => setShowCategoryDropdown(false),
    showCategoryDropdown
  );

  return (
    <div className="flex items-center gap-3 max-w-[600px]">
      <div className={cn(
        "relative flex items-center transition-all duration-300",
        isSearchExpanded ? "flex-1" : "flex-none"
      )}>
        {!isSearchExpanded ? (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSearchExpanded(true)}
          >
            <Search size={20} />
          </Button>
        ) : (
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => {
                if (!searchTerm) {
                  setIsSearchExpanded(false);
                }
              }}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => {
                  onSearchChange('');
                  setIsSearchExpanded(false);
                }}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={filterRef}>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          className={cn(
            selectedCategory !== 'All' && "border-primary bg-primary/10 text-primary"
          )}
        >
          <Filter size={20} />
          {selectedCategory !== 'All' && (
            <span className="absolute -top-1 -right-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md max-w-20 overflow-hidden text-ellipsis whitespace-nowrap">
              {selectedCategory}
            </span>
          )}
        </Button>
        
        {showCategoryDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-[100] min-w-[150px]">
            {categories.map(category => (
              <button
                key={category}
                className={cn(
                  "w-full py-3 px-4 cursor-pointer bg-transparent text-foreground text-sm hover:bg-primary/10 first:rounded-t-sm last:rounded-b-sm text-left",
                  selectedCategory === category && "bg-primary/10 text-primary"
                )}
                onClick={() => {
                  onCategoryChange(category);
                  setShowCategoryDropdown(false);
                }}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh MCP Configuration"
        >
          <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
        </Button>
      )}

      {showViewPicker && viewMode && onViewModeChange && (
        <ButtonGroup>
          <Button
            variant={viewMode === 'visual' ? 'default' : 'outline'}
            size="icon"
            onClick={() => onViewModeChange('visual')}
            title="Visual View"
          >
            <Eye size={20} />
          </Button>
          <Button
            variant={viewMode === 'json' ? 'default' : 'outline'}
            size="icon"
            onClick={() => onViewModeChange('json')}
            title="JSON View"
          >
            <Braces size={20} />
          </Button>
        </ButtonGroup>
      )}
    </div>
  );
};
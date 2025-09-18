import React from 'react';
import { styled } from '../../../styled-system/jsx';
import { Search, Filter, Eye, Braces, X, RefreshCw } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

// Styled Components
const Container = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '600px',
  },
});

const SearchContainer = styled('div', {
  base: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.3s ease',

    '& svg': {
      position: 'absolute',
      left: '12px',
      width: '20px',
      height: '20px',
      color: 'token(colors.mutedForeground)',
      zIndex: '1',
    },
  },
  variants: {
    expanded: {
      true: {
        flex: '1',
      },
      false: {
        flex: '0 0 auto',
      },
    },
  },
});

const SearchButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: '0',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    background: 'token(colors.background)',
    color: 'token(colors.foreground)',
    cursor: 'pointer',
    transition: 'all 0.2s',

    '& svg': {
      position: 'static !important',
      width: '20px',
      height: '20px',
    },

    '&:hover': {
      borderColor: 'token(colors.primary)',
      background: 'rgba(59, 130, 246, 0.1)',
    },
  },
});

const SearchInput = styled('input', {
  base: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    background: 'token(colors.background)',
    color: 'token(colors.foreground)',
    fontSize: '14px',

    '&:focus': {
      outline: 'none',
      borderColor: 'token(colors.primary)',
    },
  },
});

const ClearButton = styled('button', {
  base: {
    position: 'absolute',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: 'token(radii.sm)',
    background: 'transparent',
    color: 'token(colors.mutedForeground)',
    cursor: 'pointer',
    transition: 'all 0.2s',

    '&:hover': {
      background: 'rgba(0, 0, 0, 0.1)',
      color: 'token(colors.foreground)',
    },
  },
});

const FilterContainer = styled('div', {
  base: {
    position: 'relative',
  },
});

const FilterButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    height: '40px',
    width: '40px',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    background: 'token(colors.background)',
    color: 'token(colors.foreground)',
    cursor: 'pointer',
    transition: 'all 0.2s',

    '& svg': {
      width: '20px',
      height: '20px',
      color: 'token(colors.mutedForeground)',
    },

    '&:hover': {
      borderColor: 'token(colors.primary)',
      background: 'rgba(59, 130, 246, 0.1)',
    },
  },
  variants: {
    active: {
      true: {
        borderColor: 'token(colors.primary)',
        background: 'rgba(59, 130, 246, 0.1)',
        color: 'token(colors.primary)',

        '& svg': {
          color: 'token(colors.primary)',
        },
      },
    },
  },
});

const FilterBadge = styled('span', {
  base: {
    fontSize: '12px',
    background: 'token(colors.primary)',
    color: 'white',
    padding: '2px 6px',
    borderRadius: 'token(radii.md)',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

const FilterDropdown = styled('div', {
  base: {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    marginTop: '4px',
    background: 'token(colors.background)',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: '100',
    minWidth: '150px',
  },
});

const FilterOption = styled('div', {
  base: {
    padding: '12px 16px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'token(colors.foreground)',
    fontSize: '14px',

    '&:hover': {
      background: 'rgba(59, 130, 246, 0.1)',
    },

    '&:first-child': {
      borderRadius: 'token(radii.sm) token(radii.sm) 0 0',
    },

    '&:last-child': {
      borderRadius: '0 0 token(radii.sm) token(radii.sm)',
    },
  },
  variants: {
    active: {
      true: {
        background: 'rgba(59, 130, 246, 0.1)',
        color: 'token(colors.primary)',
      },
    },
  },
});

const RefreshButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: '0',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    background: 'token(colors.background)',
    color: 'token(colors.foreground)',
    cursor: 'pointer',
    transition: 'all 0.2s',

    '& svg': {
      width: '20px',
      height: '20px',
      transition: 'transform 0.3s ease',
    },

    '&:hover': {
      borderColor: 'token(colors.primary)',
      background: 'rgba(59, 130, 246, 0.1)',
    },

    '&:disabled': {
      opacity: '0.5',
      cursor: 'not-allowed',
    },

    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  },
  variants: {
    refreshing: {
      true: {
        '& svg': {
          animation: 'spin 1s linear infinite',
        },
      },
    },
  },
});

const ViewPicker = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    height: '40px',
    background: 'token(colors.background)',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    overflow: 'hidden',
  },
});

const ViewButton = styled('button', {
  base: {
    background: 'transparent',
    border: 'none',
    borderRadius: 'token(radii.sm)',
    padding: '0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'token(colors.mutedForeground)',
    transition: 'all 0.2s ease',
    width: '40px',
    height: '40px',

    '& svg': {
      width: '24px',
      height: '24px',
    },

    '&:hover': {
      background: 'rgba(59, 130, 246, 0.1)',
      color: 'token(colors.primary)',
    },
  },
  variants: {
    active: {
      true: {
        background: 'token(colors.primary)',
        color: '#ffffff',

        '&:hover': {
          background: 'token(colors.primary)',
          color: '#ffffff',
        },
      },
    },
  },
});

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
    <Container>
      <SearchContainer expanded={isSearchExpanded}>
        {!isSearchExpanded ? (
          <SearchButton onClick={() => setIsSearchExpanded(true)}>
            <Search size={20} />
          </SearchButton>
        ) : (
          <>
            <Search size={20} />
            <SearchInput
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => {
                if (!searchTerm) {
                  setIsSearchExpanded(false);
                }
              }}
              autoFocus
            />
            {searchTerm && (
              <ClearButton 
                onClick={() => {
                  onSearchChange('');
                  setIsSearchExpanded(false);
                }}
              >
                <X size={16} />
              </ClearButton>
            )}
          </>
        )}
      </SearchContainer>

      <FilterContainer ref={filterRef}>
        <FilterButton 
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          active={selectedCategory !== 'All'}
        >
          <Filter size={20} />
          {selectedCategory !== 'All' && <FilterBadge>{selectedCategory}</FilterBadge>}
        </FilterButton>
        
        {showCategoryDropdown && (
          <FilterDropdown>
            {categories.map(category => (
              <FilterOption
                key={category}
                active={selectedCategory === category}
                onClick={() => {
                  onCategoryChange(category);
                  setShowCategoryDropdown(false);
                }}
              >
                {category}
              </FilterOption>
            ))}
          </FilterDropdown>
        )}
      </FilterContainer>

      {onRefresh && (
        <RefreshButton
          onClick={onRefresh}
          disabled={isRefreshing}
          refreshing={isRefreshing}
          title="Refresh MCP Configuration"
        >
          <RefreshCw size={20} />
        </RefreshButton>
      )}

      {showViewPicker && viewMode && onViewModeChange && (
        <ViewPicker>
          <ViewButton
            active={viewMode === 'visual'}
            onClick={() => onViewModeChange('visual')}
            title="Visual View"
          >
            <Eye size={20} />
          </ViewButton>
          <ViewButton
            active={viewMode === 'json'}
            onClick={() => onViewModeChange('json')}
            title="JSON View"
          >
            <Braces size={20} />
          </ViewButton>
        </ViewPicker>
      )}
    </Container>
  );
};
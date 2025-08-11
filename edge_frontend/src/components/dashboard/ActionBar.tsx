import React from 'react';
import styled from 'styled-components';
import { Search, Filter, Eye, Braces, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

// Styled Components
const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 600px;
`;

const SearchContainer = styled.div<{ $expanded: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  flex: ${props => props.$expanded ? '1' : '0 0 auto'};
  transition: all 0.3s ease;

  svg {
    position: absolute;
    left: 12px;
    width: 20px;
    height: 20px;
    color: ${props => props.theme.colors.mutedForeground};
    z-index: 1;
  }
`;

const SearchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  cursor: pointer;
  transition: all 0.2s;

  svg {
    position: static !important;
    width: 20px;
    height: 20px;
  }

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: rgba(59, 130, 246, 0.1);
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 40px 12px 40px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.foreground};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: ${props => props.theme.radius.sm};
  background: transparent;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: ${props => props.theme.colors.foreground};
  }
`;

const FilterContainer = styled.div`
  position: relative;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 40px;
  width: 40px;
  border: 1px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  background: ${props => props.$active ? 'rgba(59, 130, 246, 0.1)' : props.theme.colors.background};
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.foreground};
  cursor: pointer;
  transition: all 0.2s;

  svg {
    width: 20px;
    height: 20px;
    color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.mutedForeground};
  }

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: rgba(59, 130, 246, 0.1);
    
  }
`;

const FilterBadge = styled.span`
  font-size: 12px;
  background: ${props => props.theme.colors.primary};
  color: white;
  padding: 2px 6px;
  border-radius: ${props => props.theme.radius.md};
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FilterDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 150px;
`;

const FilterOption = styled.div<{ $active: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  background: ${props => props.$active ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.foreground};
  font-size: 14px;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  &:first-child {
    border-radius: ${props => props.theme.radius.sm} ${props => props.theme.radius.sm} 0 0;
  }

  &:last-child {
    border-radius: 0 0 ${props => props.theme.radius.sm} ${props => props.theme.radius.sm};
  }
`;

const ViewPicker = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  overflow: hidden;
`;

const ViewButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$active ? '#ffffff' : props.theme.colors.mutedForeground};
  transition: all 0.2s ease;
  width: 40px;
  height: 40px;

  &:hover {
    background: ${props => props.$active ? props.theme.colors.primary : 'rgba(59, 130, 246, 0.1)'};
    color: ${props => props.$active ? '#ffffff' : props.theme.colors.primary};
  }

  svg {
    width: 24px;
    height: 24px;
  }
`;

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
  showViewPicker = false
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState<boolean>(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = React.useState<boolean>(false);
  
  const filterRef = useClickOutside<HTMLDivElement>(
    () => setShowCategoryDropdown(false),
    showCategoryDropdown
  );

  return (
    <Container>
      <SearchContainer $expanded={isSearchExpanded}>
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
          $active={selectedCategory !== 'All'}
        >
          <Filter size={20} />
          {selectedCategory !== 'All' && <FilterBadge>{selectedCategory}</FilterBadge>}
        </FilterButton>
        
        {showCategoryDropdown && (
          <FilterDropdown>
            {categories.map(category => (
              <FilterOption
                key={category}
                $active={selectedCategory === category}
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

      {showViewPicker && viewMode && onViewModeChange && (
        <ViewPicker>
          <ViewButton
            $active={viewMode === 'visual'}
            onClick={() => onViewModeChange('visual')}
            title="Visual View"
          >
            <Eye size={20} />
          </ViewButton>
          <ViewButton
            $active={viewMode === 'json'}
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
export type ViewMode = 'visual' | 'json';

export interface FilterState {
  searchTerm: string;
  selectedCategory: string;
}

export interface ModalState {
  isOpen: boolean;
  data?: any;
}
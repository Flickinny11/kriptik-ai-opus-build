/**
 * Open Source Studio Store
 * 
 * Manages state for the HuggingFace model browser and Model Dock.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

export type ModelTask =
  | 'text-generation'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-classification'
  | 'token-classification'
  | 'question-answering'
  | 'translation'
  | 'summarization'
  | 'fill-mask'
  | 'sentence-similarity'
  | 'text-to-speech'
  | 'automatic-speech-recognition'
  | 'image-classification'
  | 'object-detection'
  | 'image-segmentation'
  | 'depth-estimation'
  | 'video-classification'
  | 'zero-shot-classification'
  | 'feature-extraction';

export interface HuggingFaceModel {
  id: string;
  modelId: string;
  author: string;
  sha: string;
  lastModified: string;
  private: boolean;
  gated: boolean;
  disabled: boolean;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: ModelTask;
  library_name?: string;
  config?: {
    model_type?: string;
    architectures?: string[];
  };
  cardData?: {
    license?: string;
    language?: string[];
    datasets?: string[];
  };
  siblings?: Array<{
    rfilename: string;
    size?: number;
  }>;
}

export interface ModelWithRequirements extends HuggingFaceModel {
  estimatedVRAM?: number;
  estimatedSize?: number;
  canBeModified?: boolean;
}

export interface ModelDockItem {
  model: ModelWithRequirements;
  addedAt: string;
  position: number;
}

export interface SearchFilters {
  task?: ModelTask;
  library?: string;
  minDownloads?: number;
  license?: string;
  sort?: 'downloads' | 'likes' | 'lastModified';
}

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface OpenSourceStudioState {
  // UI State
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Search State
  searchQuery: string;
  searchFilters: SearchFilters;
  searchResults: ModelWithRequirements[];
  hasMoreResults: boolean;
  currentPage: number;
  
  // Selection State
  selectedModel: ModelWithRequirements | null;
  
  // Model Dock (max 5 models)
  dock: ModelDockItem[];
  
  // HuggingFace Connection
  hfConnected: boolean;
  hfUsername: string | null;
  hfAvatarUrl: string | null;
  
  // Actions
  setOpen: (isOpen: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: SearchFilters) => void;
  setSearchResults: (results: ModelWithRequirements[], append?: boolean) => void;
  clearSearchResults: () => void;
  setHasMoreResults: (hasMore: boolean) => void;
  nextPage: () => void;
  resetPage: () => void;
  
  selectModel: (model: ModelWithRequirements | null) => void;
  
  addToDock: (model: ModelWithRequirements) => boolean;
  removeFromDock: (modelId: string) => void;
  reorderDock: (fromIndex: number, toIndex: number) => void;
  clearDock: () => void;
  
  setHfConnection: (connected: boolean, username?: string | null, avatarUrl?: string | null) => void;
  
  reset: () => void;
}

// =============================================================================
// DEFAULT STATE
// =============================================================================

const DEFAULT_STATE = {
  isOpen: false,
  isLoading: false,
  error: null,
  searchQuery: '',
  searchFilters: { sort: 'downloads' as const },
  searchResults: [],
  hasMoreResults: true,
  currentPage: 0,
  selectedModel: null,
  dock: [],
  hfConnected: false,
  hfUsername: null,
  hfAvatarUrl: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useOpenSourceStudioStore = create<OpenSourceStudioState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setOpen: (isOpen) => set({ isOpen }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchFilters: (searchFilters) => set((state) => ({
        searchFilters: { ...state.searchFilters, ...searchFilters },
      })),
      setSearchResults: (results, append = false) => set((state) => ({
        searchResults: append ? [...state.searchResults, ...results] : results,
      })),
      clearSearchResults: () => set({ searchResults: [], currentPage: 0, hasMoreResults: true }),
      setHasMoreResults: (hasMoreResults) => set({ hasMoreResults }),
      nextPage: () => set((state) => ({ currentPage: state.currentPage + 1 })),
      resetPage: () => set({ currentPage: 0 }),

      selectModel: (selectedModel) => set({ selectedModel }),

      addToDock: (model) => {
        const state = get();
        
        // Max 5 models in dock
        if (state.dock.length >= 5) {
          return false;
        }
        
        // Don't add duplicates
        if (state.dock.some(item => item.model.modelId === model.modelId)) {
          return false;
        }
        
        const newItem: ModelDockItem = {
          model,
          addedAt: new Date().toISOString(),
          position: state.dock.length,
        };
        
        set({ dock: [...state.dock, newItem] });
        return true;
      },

      removeFromDock: (modelId) => {
        set((state) => ({
          dock: state.dock
            .filter(item => item.model.modelId !== modelId)
            .map((item, index) => ({ ...item, position: index })),
        }));
      },

      reorderDock: (fromIndex, toIndex) => {
        set((state) => {
          const newDock = [...state.dock];
          const [removed] = newDock.splice(fromIndex, 1);
          newDock.splice(toIndex, 0, removed);
          return {
            dock: newDock.map((item, index) => ({ ...item, position: index })),
          };
        });
      },

      clearDock: () => set({ dock: [] }),

      setHfConnection: (hfConnected, hfUsername = null, hfAvatarUrl = null) => set({
        hfConnected,
        hfUsername,
        hfAvatarUrl,
      }),

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'kriptik-open-source-studio',
      partialize: (state) => ({
        // Only persist dock and HF connection
        dock: state.dock,
        hfConnected: state.hfConnected,
        hfUsername: state.hfUsername,
        hfAvatarUrl: state.hfAvatarUrl,
        searchFilters: state.searchFilters,
      }),
    }
  )
);

export default useOpenSourceStudioStore;

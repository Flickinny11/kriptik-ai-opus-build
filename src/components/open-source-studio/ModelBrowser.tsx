/**
 * Model Browser - HuggingFace Model Search & Filter
 * 
 * Search and filter HuggingFace models with real-time results.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelTask, type SearchFilters, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import { authenticatedFetch } from '@/lib/api-config';
import { ModelCard } from './ModelCard';
import './ModelBrowser.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const TASK_OPTIONS: { value: ModelTask | ''; label: string }[] = [
  { value: '', label: 'All Tasks' },
  { value: 'text-generation', label: 'Text Generation' },
  { value: 'text-to-image', label: 'Text to Image' },
  { value: 'image-to-image', label: 'Image to Image' },
  { value: 'text-classification', label: 'Text Classification' },
  { value: 'question-answering', label: 'Question Answering' },
  { value: 'translation', label: 'Translation' },
  { value: 'summarization', label: 'Summarization' },
  { value: 'automatic-speech-recognition', label: 'Speech Recognition' },
  { value: 'text-to-speech', label: 'Text to Speech' },
  { value: 'image-classification', label: 'Image Classification' },
  { value: 'object-detection', label: 'Object Detection' },
  { value: 'feature-extraction', label: 'Feature Extraction' },
];

const LIBRARY_OPTIONS = [
  { value: '', label: 'All Libraries' },
  { value: 'transformers', label: 'Transformers' },
  { value: 'diffusers', label: 'Diffusers' },
  { value: 'sentence-transformers', label: 'Sentence Transformers' },
  { value: 'timm', label: 'TIMM' },
  { value: 'peft', label: 'PEFT' },
];

const SORT_OPTIONS = [
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'likes', label: 'Most Likes' },
  { value: 'lastModified', label: 'Recently Updated' },
];

// =============================================================================
// ICONS
// =============================================================================

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 6h16M7 12h10M10 18h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="oss-spinner" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="31.4"
      strokeDashoffset="10"
      strokeLinecap="round"
    />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function ModelBrowser() {
  const {
    searchQuery,
    setSearchQuery,
    searchFilters,
    setSearchFilters,
    searchResults,
    setSearchResults,
    isLoading,
    setLoading,
    error,
    setError,
    hasMoreResults,
    setHasMoreResults,
    currentPage,
    nextPage,
    resetPage,
    clearSearchResults,
  } = useOpenSourceStudioStore();

  const [showFilters, setShowFilters] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
        resetPage();
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [localQuery, searchQuery, setSearchQuery, resetPage]);

  // Perform search
  const performSearch = useCallback(async (append = false) => {
    if (!searchQuery.trim() && !searchFilters.task) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (searchFilters.task) params.append('task', searchFilters.task);
      if (searchFilters.library) params.append('library', searchFilters.library);
      if (searchFilters.sort) params.append('sort', searchFilters.sort);
      params.append('page', String(currentPage));
      params.append('limit', '20');

      const response = await authenticatedFetch(`/api/open-source-studio/models?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to search models');
      }

      const data = await response.json();
      const models: ModelWithRequirements[] = data.models || [];
      
      setSearchResults(models, append);
      setHasMoreResults(models.length === 20);
    } catch (err) {
      console.error('[ModelBrowser] Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchFilters, currentPage, setLoading, setError, setSearchResults, setHasMoreResults]);

  // Search when query or filters change
  useEffect(() => {
    if (searchQuery || searchFilters.task) {
      performSearch(false);
    } else {
      clearSearchResults();
    }
  }, [searchQuery, searchFilters.task, searchFilters.library, searchFilters.sort]);

  // Load more when page changes
  useEffect(() => {
    if (currentPage > 0) {
      performSearch(true);
    }
  }, [currentPage]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!resultsRef.current || isLoading || !hasMoreResults) return;

    const { scrollTop, scrollHeight, clientHeight } = resultsRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      nextPage();
    }
  }, [isLoading, hasMoreResults, nextPage]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: string) => {
    setSearchFilters({ [key]: value || undefined });
    resetPage();
  }, [setSearchFilters, resetPage]);

  return (
    <div className="model-browser">
      {/* Search Header */}
      <div className="model-browser-header">
        <div className="model-browser-search">
          <SearchIcon />
          <input
            type="text"
            className="model-browser-input"
            placeholder="Search HuggingFace models..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
          />
          {localQuery && (
            <button
              className="model-browser-clear"
              onClick={() => {
                setLocalQuery('');
                setSearchQuery('');
                clearSearchResults();
              }}
            >
              ×
            </button>
          )}
        </div>

        <button
          className={`model-browser-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FilterIcon />
          <span>Filters</span>
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="model-browser-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="model-browser-filter-group">
              <label>Task Type</label>
              <select
                value={searchFilters.task || ''}
                onChange={(e) => handleFilterChange('task', e.target.value)}
              >
                {TASK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="model-browser-filter-group">
              <label>Library</label>
              <select
                value={searchFilters.library || ''}
                onChange={(e) => handleFilterChange('library', e.target.value)}
              >
                {LIBRARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="model-browser-filter-group">
              <label>Sort By</label>
              <select
                value={searchFilters.sort || 'downloads'}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div
        className="model-browser-results"
        ref={resultsRef}
        onScroll={handleScroll}
      >
        {/* Loading State */}
        {isLoading && searchResults.length === 0 && (
          <div className="model-browser-loading">
            <LoadingSpinner />
            <span>Searching models...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="model-browser-error">
            <span>{error}</span>
            <button onClick={() => performSearch()}>Retry</button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && searchResults.length === 0 && searchQuery && (
          <div className="model-browser-empty">
            <span>No models found for "{searchQuery}"</span>
            <p>Try a different search term or adjust filters</p>
          </div>
        )}

        {/* Initial State */}
        {!isLoading && !error && searchResults.length === 0 && !searchQuery && (
          <div className="model-browser-initial">
            <span>Search for HuggingFace models</span>
            <p>Try "llama", "stable-diffusion", or "whisper"</p>
          </div>
        )}

        {/* Results Grid */}
        <div className="model-browser-grid">
          <AnimatePresence>
            {searchResults.map((model, index) => (
              <ModelCard
                key={model.modelId}
                model={model}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Load More */}
        {isLoading && searchResults.length > 0 && (
          <div className="model-browser-loading-more">
            <LoadingSpinner />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelBrowser;

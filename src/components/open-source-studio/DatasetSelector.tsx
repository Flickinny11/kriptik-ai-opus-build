/**
 * Dataset Selector - Training Data Selection UI
 * 
 * Browse and select HuggingFace datasets for model training.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL, authenticatedFetch } from '@/lib/api-config';
import './DatasetSelector.css';

// =============================================================================
// TYPES
// =============================================================================

export interface HuggingFaceDataset {
  id: string;
  author: string;
  name: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  size: number | null;
  cardData?: {
    license?: string;
    language?: string[];
    task_categories?: string[];
    size_categories?: string[];
  };
  lastModified: string;
}

interface DatasetSelectorProps {
  onSelect: (dataset: HuggingFaceDataset) => void;
  selectedDataset: HuggingFaceDataset | null;
  modelTask?: string;
}

// =============================================================================
// ICONS
// =============================================================================

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2" />
    <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="dataset-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const TASK_TO_DATASET_CATEGORIES: Record<string, string[]> = {
  'text-generation': ['text-generation', 'language-modeling'],
  'text-classification': ['text-classification', 'sentiment-analysis'],
  'question-answering': ['question-answering', 'extractive-qa'],
  'summarization': ['summarization', 'text-summarization'],
  'translation': ['translation', 'machine-translation'],
  'token-classification': ['token-classification', 'named-entity-recognition'],
  'image-classification': ['image-classification'],
  'object-detection': ['object-detection'],
  'image-to-text': ['image-captioning', 'image-to-text'],
  'text-to-image': ['text-to-image'],
};

// =============================================================================
// COMPONENT
// =============================================================================

export function DatasetSelector({
  onSelect,
  selectedDataset,
  modelTask,
}: DatasetSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [datasets, setDatasets] = useState<HuggingFaceDataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadTab, setUploadTab] = useState<'browse' | 'upload'>('browse');

  // Get recommended categories based on model task
  const recommendedCategories = useMemo(() => {
    if (!modelTask) return [];
    return TASK_TO_DATASET_CATEGORIES[modelTask] || [];
  }, [modelTask]);

  // Fetch datasets
  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '50',
        sort: 'downloads',
      });
      if (searchTerm) {
        params.set('search', searchTerm);
      }
      if (recommendedCategories.length > 0 && !searchTerm) {
        params.set('filter', recommendedCategories.join(','));
      }

      const response = await authenticatedFetch(`${API_URL}/api/open-source-studio/datasets/search?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch datasets');
      }

      const data = await response.json();
      setDatasets(data);
    } catch (err) {
      console.error('[DatasetSelector] Fetch error:', err);
      setError('Failed to load datasets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, recommendedCategories]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectDataset = (dataset: HuggingFaceDataset) => {
    onSelect(dataset);
  };

  // Format size
  const formatSize = (size: number | null): string => {
    if (size === null) return 'Unknown';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="dataset-selector">
      {/* Header */}
      <div className="dataset-selector-header">
        <div className="dataset-selector-title-row">
          <DatabaseIcon />
          <h3 className="dataset-selector-title">Select Training Dataset</h3>
        </div>
        
        {/* Tabs */}
        <div className="dataset-selector-tabs">
          <button
            className={`dataset-selector-tab ${uploadTab === 'browse' ? 'active' : ''}`}
            onClick={() => setUploadTab('browse')}
          >
            Browse HuggingFace
          </button>
          <button
            className={`dataset-selector-tab ${uploadTab === 'upload' ? 'active' : ''}`}
            onClick={() => setUploadTab('upload')}
          >
            Upload Custom
          </button>
        </div>
      </div>

      {/* Browse Tab */}
      {uploadTab === 'browse' && (
        <>
          {/* Search */}
          <div className="dataset-selector-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={handleSearch}
              className="dataset-selector-input"
            />
          </div>

          {/* Recommended Categories */}
          {recommendedCategories.length > 0 && !searchTerm && (
            <div className="dataset-selector-hint">
              Showing datasets for: {recommendedCategories.join(', ')}
            </div>
          )}

          {/* Dataset List */}
          <div className="dataset-selector-list">
            {isLoading ? (
              <div className="dataset-selector-feedback">
                <LoadingSpinner />
                <span>Loading datasets...</span>
              </div>
            ) : error ? (
              <div className="dataset-selector-feedback error">
                <span>{error}</span>
              </div>
            ) : datasets.length === 0 ? (
              <div className="dataset-selector-feedback">
                <span>No datasets found. Try a different search.</span>
              </div>
            ) : (
              <AnimatePresence>
                {datasets.map((dataset) => (
                  <motion.div
                    key={dataset.id}
                    className={`dataset-card ${selectedDataset?.id === dataset.id ? 'selected' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={() => handleSelectDataset(dataset)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="dataset-card-header">
                      <div className="dataset-card-name">{dataset.name || dataset.id.split('/')[1]}</div>
                      {selectedDataset?.id === dataset.id && (
                        <span className="dataset-card-selected-badge">
                          <CheckIcon />
                        </span>
                      )}
                    </div>
                    <div className="dataset-card-author">by {dataset.author}</div>
                    {dataset.description && (
                      <div className="dataset-card-description">
                        {dataset.description.slice(0, 100)}{dataset.description.length > 100 ? '...' : ''}
                      </div>
                    )}
                    <div className="dataset-card-stats">
                      <span className="dataset-card-stat">
                        <DownloadIcon />
                        {dataset.downloads.toLocaleString()}
                      </span>
                      <span className="dataset-card-stat">
                        <HeartIcon />
                        {dataset.likes.toLocaleString()}
                      </span>
                      <span className="dataset-card-stat">
                        {formatSize(dataset.size)}
                      </span>
                    </div>
                    {dataset.tags && dataset.tags.length > 0 && (
                      <div className="dataset-card-tags">
                        {dataset.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="dataset-card-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </>
      )}

      {/* Upload Tab */}
      {uploadTab === 'upload' && (
        <div className="dataset-selector-upload">
          <div className="dataset-upload-dropzone">
            <UploadIcon />
            <h4>Upload Custom Dataset</h4>
            <p>Drag & drop your dataset files here, or click to browse</p>
            <p className="dataset-upload-formats">Supported: JSONL, CSV, Parquet, text files</p>
            <input
              type="file"
              className="dataset-upload-input"
              accept=".jsonl,.json,.csv,.parquet,.txt"
              multiple
              onChange={(e) => {
                // Handle file upload - will be implemented in backend integration
                console.log('Files selected:', e.target.files);
              }}
            />
          </div>

          <div className="dataset-upload-info">
            <h5>Dataset Format Guidelines</h5>
            <ul>
              <li><strong>Text Generation:</strong> JSONL with "text" or "prompt"/"completion" fields</li>
              <li><strong>Classification:</strong> CSV with "text" and "label" columns</li>
              <li><strong>Q&A:</strong> JSONL with "question" and "answer" fields</li>
            </ul>
          </div>
        </div>
      )}

      {/* Selected Dataset Summary */}
      {selectedDataset && (
        <motion.div
          className="dataset-selector-selected"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="dataset-selected-badge">
            <CheckIcon />
            <span>Selected</span>
          </div>
          <div className="dataset-selected-info">
            <span className="dataset-selected-name">{selectedDataset.name || selectedDataset.id}</span>
            <span className="dataset-selected-size">{formatSize(selectedDataset.size)}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default DatasetSelector;

/**
 * Model Library Component
 *
 * Displays user's favorite models, recently used models, and collections.
 * Part of the Open Source Studio with 3D liquid glass styling.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModelLibrary } from '@/hooks/useModelLibrary';
import './ModelLibrary.css';

// =============================================================================
// ICONS (Custom SVG - No Lucide React)
// =============================================================================

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
);

const ClockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
    </svg>
);

const FolderIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3,6 5,6 21,6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const ChevronIcon = ({ direction = 'down' }: { direction?: 'up' | 'down' | 'left' | 'right' }) => {
    const rotations = { up: 180, down: 0, left: 90, right: -90 };
    return (
        <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: `rotate(${rotations[direction]}deg)` }}
        >
            <polyline points="6,9 12,15 18,9" />
        </svg>
    );
};

const GridIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

const ListIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface ModelLibraryProps {
    onSelectModel?: (modelId: string, modelName: string, author: string) => void;
    onDragModel?: (model: { modelId: string; modelName: string; author: string }) => void;
}

type TabType = 'favorites' | 'recent' | 'collections';
type ViewMode = 'grid' | 'list';

// =============================================================================
// COMPONENT
// =============================================================================

export function ModelLibrary({ onSelectModel, onDragModel }: ModelLibraryProps) {
    const {
        favorites,
        recent,
        collections,
        isLoading,
        error,
        toggleFavorite,
        clearHistory,
        createCollection,
        deleteCollection,
        refresh,
    } = useModelLibrary();

    const [activeTab, setActiveTab] = useState<TabType>('favorites');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    const handleModelClick = useCallback((modelId: string, modelName: string, author: string) => {
        onSelectModel?.(modelId, modelName, author);
    }, [onSelectModel]);

    const handleDragStart = useCallback((
        e: React.DragEvent,
        model: { modelId: string; modelName: string; author: string }
    ) => {
        e.dataTransfer.setData('application/json', JSON.stringify(model));
        e.dataTransfer.effectAllowed = 'copy';
        onDragModel?.(model);
    }, [onDragModel]);

    const handleCreateCollection = useCallback(async () => {
        if (!newCollectionName.trim()) return;
        
        await createCollection(newCollectionName.trim());
        setNewCollectionName('');
        setIsCreatingCollection(false);
    }, [newCollectionName, createCollection]);

    const toggleCollectionExpand = useCallback((collectionId: string) => {
        setExpandedCollections(prev => {
            const next = new Set(prev);
            if (next.has(collectionId)) {
                next.delete(collectionId);
            } else {
                next.add(collectionId);
            }
            return next;
        });
    }, []);

    // ==========================================================================
    // RENDER HELPERS
    // ==========================================================================

    const renderModelCard = (
        model: { modelId: string; modelName: string; author: string; task?: string; estimatedVram?: number },
        type: 'favorite' | 'recent',
        extraInfo?: string
    ) => (
        <motion.div
            key={model.modelId}
            className={`ml-model-card ml-model-card--${viewMode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            draggable
            onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, model)}
            onClick={() => handleModelClick(model.modelId, model.modelName, model.author)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            <div className="ml-model-card__header">
                <span className="ml-model-card__name">{model.modelName}</span>
                {type === 'favorite' && (
                    <button
                        className="ml-model-card__favorite-btn ml-model-card__favorite-btn--active"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite({
                                modelId: model.modelId,
                                modelName: model.modelName,
                                author: model.author,
                            });
                        }}
                        title="Remove from favorites"
                    >
                        <StarIcon filled />
                    </button>
                )}
            </div>
            <div className="ml-model-card__author">{model.author}</div>
            {model.task && (
                <div className="ml-model-card__task">{model.task}</div>
            )}
            {extraInfo && (
                <div className="ml-model-card__extra">{extraInfo}</div>
            )}
            {model.estimatedVram && (
                <div className="ml-model-card__vram">{model.estimatedVram}GB VRAM</div>
            )}
            <div className="ml-model-card__drag-hint">Drag to Dock</div>
        </motion.div>
    );

    const renderFavorites = () => (
        <div className={`ml-models-grid ml-models-grid--${viewMode}`}>
            <AnimatePresence mode="popLayout">
                {favorites.length === 0 ? (
                    <motion.div
                        className="ml-empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <StarIcon />
                        <p>No favorite models yet</p>
                        <span>Star models while browsing to save them here</span>
                    </motion.div>
                ) : (
                    favorites.map((fav) => renderModelCard(fav, 'favorite'))
                )}
            </AnimatePresence>
        </div>
    );

    const renderRecent = () => (
        <div className={`ml-models-grid ml-models-grid--${viewMode}`}>
            <AnimatePresence mode="popLayout">
                {recent.length === 0 ? (
                    <motion.div
                        className="ml-empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <ClockIcon />
                        <p>No recently used models</p>
                        <span>Models you use will appear here</span>
                    </motion.div>
                ) : (
                    recent.map((usage) => renderModelCard(
                        usage,
                        'recent',
                        `${usage.usageType} - ${new Date(usage.usedAt).toLocaleDateString()}`
                    ))
                )}
            </AnimatePresence>
            {recent.length > 0 && (
                <button className="ml-clear-history-btn" onClick={clearHistory}>
                    <TrashIcon />
                    Clear History
                </button>
            )}
        </div>
    );

    const renderCollections = () => (
        <div className="ml-collections">
            <AnimatePresence mode="popLayout">
                {collections.length === 0 && !isCreatingCollection ? (
                    <motion.div
                        className="ml-empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <FolderIcon />
                        <p>No collections yet</p>
                        <span>Create collections to organize your models</span>
                    </motion.div>
                ) : (
                    collections.map((collection) => (
                        <motion.div
                            key={collection.id}
                            className="ml-collection"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div
                                className="ml-collection__header"
                                onClick={() => toggleCollectionExpand(collection.id)}
                            >
                                <div className="ml-collection__info">
                                    {collection.icon && (
                                        <span className="ml-collection__icon">{collection.icon}</span>
                                    )}
                                    <span
                                        className="ml-collection__color"
                                        style={{ backgroundColor: collection.color || '#FFD21E' }}
                                    />
                                    <span className="ml-collection__name">{collection.name}</span>
                                    <span className="ml-collection__count">{collection.itemCount}</span>
                                </div>
                                <div className="ml-collection__actions">
                                    <button
                                        className="ml-collection__delete"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteCollection(collection.id);
                                        }}
                                        title="Delete collection"
                                    >
                                        <TrashIcon />
                                    </button>
                                    <ChevronIcon direction={expandedCollections.has(collection.id) ? 'up' : 'down'} />
                                </div>
                            </div>
                            {expandedCollections.has(collection.id) && (
                                <motion.div
                                    className="ml-collection__items"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                >
                                    {collection.itemCount === 0 ? (
                                        <div className="ml-collection__empty">
                                            Drag models here to add them
                                        </div>
                                    ) : (
                                        <div className="ml-collection__loading">
                                            Loading items...
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    ))
                )}
            </AnimatePresence>

            {/* Create Collection Form */}
            {isCreatingCollection ? (
                <motion.div
                    className="ml-create-collection"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <input
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="Collection name..."
                        className="ml-create-collection__input"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateCollection();
                            if (e.key === 'Escape') setIsCreatingCollection(false);
                        }}
                    />
                    <div className="ml-create-collection__actions">
                        <button
                            className="ml-create-collection__cancel"
                            onClick={() => setIsCreatingCollection(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="ml-create-collection__save"
                            onClick={handleCreateCollection}
                            disabled={!newCollectionName.trim()}
                        >
                            Create
                        </button>
                    </div>
                </motion.div>
            ) : (
                <button
                    className="ml-add-collection-btn"
                    onClick={() => setIsCreatingCollection(true)}
                >
                    <PlusIcon />
                    New Collection
                </button>
            )}
        </div>
    );

    // ==========================================================================
    // MAIN RENDER
    // ==========================================================================

    return (
        <div className="model-library">
            {/* Header */}
            <div className="model-library__header">
                <h3 className="model-library__title">My Models</h3>
                <div className="model-library__controls">
                    <button
                        className={`model-library__view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Grid view"
                    >
                        <GridIcon />
                    </button>
                    <button
                        className={`model-library__view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="List view"
                    >
                        <ListIcon />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="model-library__tabs">
                <button
                    className={`model-library__tab ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('favorites')}
                >
                    <StarIcon filled={activeTab === 'favorites'} />
                    Favorites
                    {favorites.length > 0 && (
                        <span className="model-library__tab-count">{favorites.length}</span>
                    )}
                </button>
                <button
                    className={`model-library__tab ${activeTab === 'recent' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recent')}
                >
                    <ClockIcon />
                    Recent
                    {recent.length > 0 && (
                        <span className="model-library__tab-count">{recent.length}</span>
                    )}
                </button>
                <button
                    className={`model-library__tab ${activeTab === 'collections' ? 'active' : ''}`}
                    onClick={() => setActiveTab('collections')}
                >
                    <FolderIcon />
                    Collections
                    {collections.length > 0 && (
                        <span className="model-library__tab-count">{collections.length}</span>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="model-library__content">
                {isLoading ? (
                    <div className="model-library__loading">
                        <div className="model-library__spinner" />
                        Loading...
                    </div>
                ) : error ? (
                    <div className="model-library__error">
                        <p>{error}</p>
                        <button onClick={refresh}>Retry</button>
                    </div>
                ) : (
                    <>
                        {activeTab === 'favorites' && renderFavorites()}
                        {activeTab === 'recent' && renderRecent()}
                        {activeTab === 'collections' && renderCollections()}
                    </>
                )}
            </div>
        </div>
    );
}

export default ModelLibrary;

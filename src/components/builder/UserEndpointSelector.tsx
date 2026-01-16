/**
 * User Endpoint Selector Component
 *
 * Allows users to select their deployed models from Open Source Studio
 * when building apps in the Builder View.
 *
 * Features:
 * - Lists user's deployed endpoints
 * - Filters by modality (LLM, Image, Video, Audio)
 * - Shows status and connection info
 * - Integrates with chat prompt
 *
 * 3D Photorealistic Liquid Glass Design System
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserEndpoints, type UserEndpoint } from '@/hooks/useUserEndpoints';
import './UserEndpointSelector.css';

// =============================================================================
// ICONS (Custom SVG)
// =============================================================================

const LLMIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
);

const ImageIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
        <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const VideoIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="15" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M17 8l5-2v12l-5-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const AudioIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

const ChevronIcon = ({ direction = 'down' }: { direction?: 'up' | 'down' }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: direction === 'up' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
    >
        <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const StatusDot = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        active: '#22C55E',
        idle: '#F59E0B',
        provisioning: '#3B82F6',
        error: '#EF4444',
        terminated: '#6B7280',
    };
    return (
        <span
            className="user-endpoint-selector__status-dot"
            style={{ backgroundColor: colors[status] || '#6B7280' }}
        />
    );
};

// =============================================================================
// TYPES
// =============================================================================

interface UserEndpointSelectorProps {
    onSelect: (endpoint: UserEndpoint) => void;
    selectedId?: string;
    modalityFilter?: 'llm' | 'image' | 'video' | 'audio';
    compact?: boolean;
}

type ModalityFilter = 'all' | 'llm' | 'image' | 'video' | 'audio';

// =============================================================================
// COMPONENT
// =============================================================================

export function UserEndpointSelector({
    onSelect,
    selectedId,
    modalityFilter,
    compact = false,
}: UserEndpointSelectorProps) {
    const { endpoints, isLoading, error, refresh } = useUserEndpoints();
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<ModalityFilter>(modalityFilter || 'all');

    // ==========================================================================
    // FILTERED ENDPOINTS
    // ==========================================================================

    const filteredEndpoints = useMemo(() => {
        let filtered = endpoints;
        if (filter !== 'all') {
            filtered = endpoints.filter(e => e.modality === filter);
        }
        // Sort by most recently active
        return filtered.sort((a, b) => {
            const dateA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
            const dateB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [endpoints, filter]);

    const selectedEndpoint = useMemo(() => {
        return endpoints.find(e => e.id === selectedId);
    }, [endpoints, selectedId]);

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    const handleSelect = useCallback((endpoint: UserEndpoint) => {
        onSelect(endpoint);
        setIsOpen(false);
    }, [onSelect]);

    const getModalityIcon = (modality: string) => {
        switch (modality) {
            case 'llm': return <LLMIcon />;
            case 'image': return <ImageIcon />;
            case 'video': return <VideoIcon />;
            case 'audio': return <AudioIcon />;
            default: return <LLMIcon />;
        }
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (compact) {
        // Compact dropdown mode
        return (
            <div className="user-endpoint-selector user-endpoint-selector--compact">
                <button
                    className="user-endpoint-selector__trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isLoading}
                >
                    {selectedEndpoint ? (
                        <>
                            {getModalityIcon(selectedEndpoint.modality)}
                            <span className="user-endpoint-selector__trigger-text">
                                {selectedEndpoint.modelName}
                            </span>
                        </>
                    ) : (
                        <span className="user-endpoint-selector__trigger-placeholder">
                            Select your deployed model...
                        </span>
                    )}
                    <ChevronIcon direction={isOpen ? 'up' : 'down'} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="user-endpoint-selector__dropdown"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {filteredEndpoints.length === 0 ? (
                                <div className="user-endpoint-selector__empty">
                                    {isLoading ? 'Loading...' : 'No deployed models found'}
                                </div>
                            ) : (
                                filteredEndpoints.map(endpoint => (
                                    <button
                                        key={endpoint.id}
                                        className={`user-endpoint-selector__option ${endpoint.id === selectedId ? 'user-endpoint-selector__option--selected' : ''}`}
                                        onClick={() => handleSelect(endpoint)}
                                    >
                                        {getModalityIcon(endpoint.modality)}
                                        <span className="user-endpoint-selector__option-name">
                                            {endpoint.modelName}
                                        </span>
                                        <StatusDot status={endpoint.status} />
                                        {endpoint.id === selectedId && <CheckIcon />}
                                    </button>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Full panel mode
    return (
        <div className="user-endpoint-selector">
            <div className="user-endpoint-selector__header">
                <h4 className="user-endpoint-selector__title">Your Deployed Models</h4>
                <p className="user-endpoint-selector__subtitle">
                    Select a model to use in your app
                </p>
            </div>

            {/* Modality Filter Tabs */}
            {!modalityFilter && (
                <div className="user-endpoint-selector__filters">
                    {(['all', 'llm', 'image', 'video', 'audio'] as ModalityFilter[]).map(mod => (
                        <button
                            key={mod}
                            className={`user-endpoint-selector__filter-btn ${filter === mod ? 'user-endpoint-selector__filter-btn--active' : ''}`}
                            onClick={() => setFilter(mod)}
                        >
                            {mod === 'all' ? 'All' : mod.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="user-endpoint-selector__error">
                    <p>{error}</p>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="user-endpoint-selector__loading">
                    <div className="user-endpoint-selector__spinner" />
                    Loading models...
                </div>
            )}

            {/* Endpoints List */}
            {!isLoading && !error && (
                <div className="user-endpoint-selector__list">
                    {filteredEndpoints.length === 0 ? (
                        <div className="user-endpoint-selector__empty-state">
                            <p>No deployed models found</p>
                            <span>
                                Deploy models from Open Source Studio to use them here
                            </span>
                        </div>
                    ) : (
                        filteredEndpoints.map(endpoint => (
                            <motion.button
                                key={endpoint.id}
                                className={`user-endpoint-selector__card ${endpoint.id === selectedId ? 'user-endpoint-selector__card--selected' : ''}`}
                                onClick={() => handleSelect(endpoint)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="user-endpoint-selector__card-icon" data-modality={endpoint.modality}>
                                    {getModalityIcon(endpoint.modality)}
                                </div>
                                <div className="user-endpoint-selector__card-info">
                                    <div className="user-endpoint-selector__card-name">
                                        {endpoint.modelName}
                                    </div>
                                    <div className="user-endpoint-selector__card-meta">
                                        <StatusDot status={endpoint.status} />
                                        <span>{endpoint.status}</span>
                                        <span className="user-endpoint-selector__card-provider">
                                            {endpoint.provider}
                                        </span>
                                    </div>
                                    {endpoint.modelDescription && (
                                        <div className="user-endpoint-selector__card-desc">
                                            {endpoint.modelDescription}
                                        </div>
                                    )}
                                </div>
                                {endpoint.id === selectedId && (
                                    <div className="user-endpoint-selector__card-check">
                                        <CheckIcon />
                                    </div>
                                )}
                            </motion.button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default UserEndpointSelector;

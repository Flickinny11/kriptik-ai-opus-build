/**
 * Model Library Hook
 *
 * Manages user's favorite models, recently used models, and collections.
 * Provides real-time sync with backend and optimistic updates.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/useUserStore';

// =============================================================================
// TYPES
// =============================================================================

export interface ModelFavorite {
    id: string;
    userId: string;
    modelId: string;
    modelName: string;
    author: string;
    task?: string;
    library?: string;
    downloads?: number;
    likes?: number;
    estimatedVram?: number;
    license?: string;
    userNotes?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ModelUsage {
    id: string;
    userId: string;
    modelId: string;
    modelName: string;
    author: string;
    usageType: 'deploy' | 'finetune' | 'train' | 'browse' | 'compare';
    projectId?: string;
    trainingJobId?: string;
    endpointId?: string;
    task?: string;
    library?: string;
    estimatedVram?: number;
    usedAt: string;
}

export interface ModelCollection {
    id: string;
    userId: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    isPublic: boolean;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CollectionItem {
    id: string;
    collectionId: string;
    modelId: string;
    modelName: string;
    author: string;
    sortOrder: number;
    addedAt: string;
}

export interface ModelMetadata {
    modelId: string;
    modelName: string;
    author: string;
    task?: string;
    library?: string;
    downloads?: number;
    likes?: number;
    estimatedVram?: number;
    license?: string;
}

export interface LibraryOverview {
    favorites: { items: ModelFavorite[]; total: number };
    recent: { items: ModelUsage[]; total: number };
    collections: { items: ModelCollection[]; total: number };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

const API_BASE = '/api/model-library';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    return response;
}

// =============================================================================
// HOOK
// =============================================================================

export function useModelLibrary() {
    const { isAuthenticated } = useUserStore();
    const [favorites, setFavorites] = useState<ModelFavorite[]>([]);
    const [recent, setRecent] = useState<ModelUsage[]>([]);
    const [collections, setCollections] = useState<ModelCollection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ==========================================================================
    // LOAD OVERVIEW
    // ==========================================================================

    const loadOverview = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetchWithAuth(`${API_BASE}/overview`);
            if (!response.ok) {
                throw new Error('Failed to load library');
            }
            const data: LibraryOverview = await response.json();
            setFavorites(data.favorites.items);
            setRecent(data.recent.items);
            setCollections(data.collections.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Load on mount and auth change
    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    // ==========================================================================
    // FAVORITES
    // ==========================================================================

    const addFavorite = useCallback(async (
        model: ModelMetadata,
        options?: { userNotes?: string; tags?: string[] }
    ): Promise<ModelFavorite | null> => {
        setError(null);

        // Optimistic update
        const tempFavorite: ModelFavorite = {
            id: `temp-${Date.now()}`,
            userId: '',
            ...model,
            userNotes: options?.userNotes,
            tags: options?.tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setFavorites(prev => [tempFavorite, ...prev]);

        try {
            const response = await fetchWithAuth(`${API_BASE}/favorites`, {
                method: 'POST',
                body: JSON.stringify({ ...model, ...options }),
            });

            if (!response.ok) {
                throw new Error('Failed to add favorite');
            }

            const data = await response.json();
            
            // Replace temp with real
            setFavorites(prev =>
                prev.map(f => f.id === tempFavorite.id ? data.favorite : f)
            );

            return data.favorite;
        } catch (err) {
            // Rollback optimistic update
            setFavorites(prev => prev.filter(f => f.id !== tempFavorite.id));
            setError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        }
    }, []);

    const removeFavorite = useCallback(async (modelId: string): Promise<boolean> => {
        setError(null);

        // Optimistic update
        const previousFavorites = favorites;
        setFavorites(prev => prev.filter(f => f.modelId !== modelId));

        try {
            const response = await fetchWithAuth(
                `${API_BASE}/favorites/${encodeURIComponent(modelId)}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                throw new Error('Failed to remove favorite');
            }

            return true;
        } catch (err) {
            // Rollback
            setFavorites(previousFavorites);
            setError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, [favorites]);

    const isFavorited = useCallback((modelId: string): boolean => {
        return favorites.some(f => f.modelId === modelId);
    }, [favorites]);

    const toggleFavorite = useCallback(async (
        model: ModelMetadata
    ): Promise<boolean> => {
        if (isFavorited(model.modelId)) {
            return removeFavorite(model.modelId);
        } else {
            const result = await addFavorite(model);
            return result !== null;
        }
    }, [isFavorited, addFavorite, removeFavorite]);

    // ==========================================================================
    // RECENTLY USED
    // ==========================================================================

    const trackUsage = useCallback(async (
        model: ModelMetadata,
        usageType: ModelUsage['usageType'],
        context?: {
            projectId?: string;
            trainingJobId?: string;
            endpointId?: string;
        }
    ): Promise<ModelUsage | null> => {
        try {
            const response = await fetchWithAuth(`${API_BASE}/recent`, {
                method: 'POST',
                body: JSON.stringify({
                    ...model,
                    usageType,
                    ...context,
                }),
            });

            if (!response.ok) {
                console.error('Failed to track model usage');
                return null;
            }

            const data = await response.json();

            // Update local state - add to front and deduplicate
            setRecent(prev => {
                const filtered = prev.filter(r => r.modelId !== model.modelId);
                return [data.usage, ...filtered].slice(0, 20);
            });

            return data.usage;
        } catch (err) {
            console.error('Error tracking model usage:', err);
            return null;
        }
    }, []);

    const clearHistory = useCallback(async (): Promise<boolean> => {
        setError(null);

        try {
            const response = await fetchWithAuth(`${API_BASE}/recent`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to clear history');
            }

            setRecent([]);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, []);

    // ==========================================================================
    // COLLECTIONS
    // ==========================================================================

    const createCollection = useCallback(async (
        name: string,
        options?: {
            description?: string;
            icon?: string;
            color?: string;
            isPublic?: boolean;
        }
    ): Promise<ModelCollection | null> => {
        setError(null);

        try {
            const response = await fetchWithAuth(`${API_BASE}/collections`, {
                method: 'POST',
                body: JSON.stringify({ name, ...options }),
            });

            if (!response.ok) {
                throw new Error('Failed to create collection');
            }

            const data = await response.json();
            const newCollection = { ...data.collection, itemCount: 0 };
            setCollections(prev => [newCollection, ...prev]);
            return newCollection;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        }
    }, []);

    const deleteCollection = useCallback(async (collectionId: string): Promise<boolean> => {
        setError(null);

        const previousCollections = collections;
        setCollections(prev => prev.filter(c => c.id !== collectionId));

        try {
            const response = await fetchWithAuth(
                `${API_BASE}/collections/${collectionId}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                throw new Error('Failed to delete collection');
            }

            return true;
        } catch (err) {
            setCollections(previousCollections);
            setError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, [collections]);

    const addToCollection = useCallback(async (
        collectionId: string,
        model: ModelMetadata
    ): Promise<boolean> => {
        setError(null);

        try {
            const response = await fetchWithAuth(
                `${API_BASE}/collections/${collectionId}/items`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        modelId: model.modelId,
                        modelName: model.modelName,
                        author: model.author,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                if (response.status === 409) {
                    // Already in collection - not an error
                    return true;
                }
                throw new Error(data.error || 'Failed to add to collection');
            }

            // Update collection item count
            setCollections(prev =>
                prev.map(c =>
                    c.id === collectionId
                        ? { ...c, itemCount: c.itemCount + 1, updatedAt: new Date().toISOString() }
                        : c
                )
            );

            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, []);

    const removeFromCollection = useCallback(async (
        collectionId: string,
        modelId: string
    ): Promise<boolean> => {
        setError(null);

        try {
            const response = await fetchWithAuth(
                `${API_BASE}/collections/${collectionId}/items/${encodeURIComponent(modelId)}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                throw new Error('Failed to remove from collection');
            }

            // Update collection item count
            setCollections(prev =>
                prev.map(c =>
                    c.id === collectionId
                        ? { ...c, itemCount: Math.max(0, c.itemCount - 1) }
                        : c
                )
            );

            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, []);

    const getCollectionItems = useCallback(async (
        collectionId: string
    ): Promise<CollectionItem[]> => {
        try {
            const response = await fetchWithAuth(
                `${API_BASE}/collections/${collectionId}`
            );

            if (!response.ok) {
                throw new Error('Failed to get collection items');
            }

            const data = await response.json();
            return data.items;
        } catch (err) {
            console.error('Error getting collection items:', err);
            return [];
        }
    }, []);

    // ==========================================================================
    // COMPUTED VALUES
    // ==========================================================================

    const favoriteModelIds = useMemo(() => {
        return new Set(favorites.map(f => f.modelId));
    }, [favorites]);

    const recentModelIds = useMemo(() => {
        return recent.map(r => r.modelId);
    }, [recent]);

    // ==========================================================================
    // RETURN
    // ==========================================================================

    return {
        // State
        favorites,
        recent,
        collections,
        isLoading,
        error,

        // Favorites
        addFavorite,
        removeFavorite,
        isFavorited,
        toggleFavorite,
        favoriteModelIds,

        // Recent
        trackUsage,
        clearHistory,
        recentModelIds,

        // Collections
        createCollection,
        deleteCollection,
        addToCollection,
        removeFromCollection,
        getCollectionItems,

        // Refresh
        refresh: loadOverview,
    };
}

export default useModelLibrary;

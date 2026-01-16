/**
 * User Endpoints Hook
 *
 * Provides access to user's deployed model endpoints from Open Source Studio.
 * Used in Builder to let users select their trained/deployed models for app creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '@/store/useUserStore';

// =============================================================================
// TYPES
// =============================================================================

export interface UserEndpoint {
    id: string;
    modelName: string;
    modelDescription?: string;
    modality: 'llm' | 'image' | 'video' | 'audio';
    baseModelId?: string;
    huggingFaceRepoUrl?: string;
    provider: 'runpod' | 'modal';
    endpointUrl?: string;
    endpointType: 'serverless' | 'dedicated';
    gpuType?: string;
    status: 'provisioning' | 'active' | 'scaling' | 'idle' | 'error' | 'terminated';
    lastActiveAt?: string;
    createdAt: string;
    sourceType: 'training' | 'open_source_studio' | 'imported';
}

export interface EndpointSummary {
    total: number;
    active: number;
    byModality: Record<string, number>;
    byProvider: Record<string, number>;
    totalRequests: number;
    totalCreditsUsed: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

const API_BASE = '/api/endpoints';

async function fetchWithAuth(url: string): Promise<Response> {
    return fetch(url, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

// =============================================================================
// HOOK
// =============================================================================

export function useUserEndpoints(options?: {
    modality?: string;
    status?: string;
    sourceType?: string;
}) {
    const { isAuthenticated } = useUserStore();
    const [endpoints, setEndpoints] = useState<UserEndpoint[]>([]);
    const [summary, setSummary] = useState<EndpointSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ==========================================================================
    // LOAD ENDPOINTS
    // ==========================================================================

    const loadEndpoints = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        setError(null);

        try {
            // Build query params
            const params = new URLSearchParams();
            if (options?.modality) params.set('modality', options.modality);
            if (options?.status) params.set('status', options.status);
            if (options?.sourceType) params.set('sourceType', options.sourceType);

            const queryString = params.toString();
            const url = `${API_BASE}/user${queryString ? `?${queryString}` : ''}`;

            const response = await fetchWithAuth(url);
            if (!response.ok) {
                throw new Error('Failed to load endpoints');
            }

            const data = await response.json();
            setEndpoints(data.endpoints || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, options?.modality, options?.status, options?.sourceType]);

    // ==========================================================================
    // LOAD SUMMARY
    // ==========================================================================

    const loadSummary = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const response = await fetchWithAuth(`${API_BASE}/summary`);
            if (response.ok) {
                const data = await response.json();
                setSummary(data.summary || null);
            }
        } catch (err) {
            console.error('[useUserEndpoints] Failed to load summary:', err);
        }
    }, [isAuthenticated]);

    // ==========================================================================
    // EFFECTS
    // ==========================================================================

    useEffect(() => {
        loadEndpoints();
        loadSummary();
    }, [loadEndpoints, loadSummary]);

    // ==========================================================================
    // FILTER HELPERS
    // ==========================================================================

    const getEndpointsByModality = useCallback((modality: string) => {
        return endpoints.filter(e => e.modality === modality);
    }, [endpoints]);

    const getActiveEndpoints = useCallback(() => {
        return endpoints.filter(e => e.status === 'active' || e.status === 'idle');
    }, [endpoints]);

    const getEndpointById = useCallback((id: string) => {
        return endpoints.find(e => e.id === id);
    }, [endpoints]);

    // ==========================================================================
    // RETURN
    // ==========================================================================

    return {
        endpoints,
        summary,
        isLoading,
        error,
        refresh: loadEndpoints,
        getEndpointsByModality,
        getActiveEndpoints,
        getEndpointById,
    };
}

export default useUserEndpoints;

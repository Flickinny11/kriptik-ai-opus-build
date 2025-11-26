/**
 * Workflow Management Hook
 * 
 * Provides functions to create, modify, and deploy AI model workflows.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelRecommendation {
    modelId: string;
    name: string;
    source: 'huggingface' | 'replicate' | 'together' | 'ollama';
    task: string;
    reasoning: string;
    requirements: {
        gpu: string;
        vram: number;
        estimatedLatency: number;
    };
    popularity: {
        downloads: number;
        likes: number;
        trending: boolean;
    };
}

export interface WorkflowStep {
    id: string;
    type: 'model' | 'transform' | 'condition' | 'input' | 'output';
    name: string;
    description: string;
    model?: ModelRecommendation;
    position: { x: number; y: number };
}

export interface CostEstimate {
    setupCost: number;
    hourlyRunningCost: number;
    estimatedMonthlyCost: number;
    currency: string;
}

export interface WorkflowPlan {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    totalEstimatedCost: CostEstimate;
    requiredCredentials: string[];
    deploymentTargets: { id: string; provider: string }[];
    dataFlow: { source: string; target: string; sourceOutput: string; targetInput: string }[];
}

export interface WorkflowValidation {
    valid: boolean;
    errors: { stepId?: string; type: string; message: string }[];
    warnings: { stepId?: string; type: string; message: string }[];
}

// ============================================================================
// HOOK
// ============================================================================

export function useWorkflow() {
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeploying] = useState(false);
    
    const [models, setModels] = useState<ModelRecommendation[]>([]);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [workflow, setWorkflow] = useState<WorkflowPlan | null>(null);
    const [validation, setValidation] = useState<WorkflowValidation | null>(null);
    
    const { toast } = useToast();
    
    // Search for models
    const searchModels = useCallback(async (requirement: string, options?: {
        sources?: string[];
        maxResults?: number;
        taskType?: string;
    }) => {
        setIsSearching(true);
        setModels([]);
        
        try {
            const response = await fetch('/api/workflows/models/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirement,
                    ...options,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to search models');
            }
            
            const data = await response.json();
            setModels(data.recommendations || []);
            
            toast({
                title: 'Models Found',
                description: `Found ${data.recommendations?.length || 0} models for your requirement`,
            });
            
            return data.recommendations || [];
        } catch (error) {
            toast({
                title: 'Search Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            return [];
        } finally {
            setIsSearching(false);
        }
    }, [toast]);
    
    // Select/deselect a model
    const toggleModelSelection = useCallback((modelId: string) => {
        setSelectedModels(prev => {
            if (prev.includes(modelId)) {
                return prev.filter(id => id !== modelId);
            }
            return [...prev, modelId];
        });
    }, []);
    
    // Create workflow from description
    const createWorkflow = useCallback(async (description: string, options?: {
        preferredModels?: string[];
        maxCost?: number;
        deploymentTarget?: string;
    }) => {
        setIsCreating(true);
        
        try {
            const response = await fetch('/api/workflows/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    preferredModels: options?.preferredModels || selectedModels,
                    ...options,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create workflow');
            }
            
            const data = await response.json();
            setWorkflow(data.workflow);
            
            toast({
                title: 'Workflow Created',
                description: `"${data.workflow.name}" with ${data.workflow.steps.length} steps`,
            });
            
            return data.workflow;
        } catch (error) {
            toast({
                title: 'Creation Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            return null;
        } finally {
            setIsCreating(false);
        }
    }, [selectedModels, toast]);
    
    // Validate workflow
    const validateWorkflow = useCallback(async (availableCredentials: string[] = []) => {
        if (!workflow) return null;
        
        try {
            const response = await fetch('/api/workflows/workflows/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflow,
                    availableCredentials,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to validate workflow');
            }
            
            const data = await response.json();
            setValidation(data);
            
            return data;
        } catch (error) {
            toast({
                title: 'Validation Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            return null;
        }
    }, [workflow, toast]);
    
    // Modify workflow
    const modifyWorkflow = useCallback(async (modification: {
        type: 'add-step' | 'remove-step' | 'modify-step' | 'reorder' | 'add-connection' | 'remove-connection';
        stepId?: string;
        newStep?: Partial<WorkflowStep>;
        position?: number;
        connection?: { source: string; target: string };
    }) => {
        if (!workflow) return null;
        
        try {
            const response = await fetch('/api/workflows/workflows/modify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflow,
                    modification,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to modify workflow');
            }
            
            const data = await response.json();
            setWorkflow(data.workflow);
            
            return data.workflow;
        } catch (error) {
            toast({
                title: 'Modification Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            return null;
        }
    }, [workflow, toast]);
    
    // Get cost estimate
    const getCostEstimate = useCallback(async () => {
        if (!workflow) return null;
        
        try {
            const response = await fetch('/api/workflows/workflows/cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to get cost estimate');
            }
            
            const data = await response.json();
            setWorkflow(prev => prev ? { ...prev, totalEstimatedCost: data } : null);
            
            return data;
        } catch (error) {
            console.error('Cost estimation failed:', error);
            return null;
        }
    }, [workflow]);
    
    // Generate deployment artifacts
    const generateArtifacts = useCallback(async () => {
        if (!workflow) return null;
        
        try {
            const [dockerfileRes, requirementsRes] = await Promise.all([
                fetch('/api/workflows/workflows/dockerfile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workflow }),
                }),
                fetch('/api/workflows/workflows/requirements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workflow }),
                }),
            ]);
            
            const dockerfile = await dockerfileRes.json();
            const requirements = await requirementsRes.json();
            
            return {
                dockerfile: dockerfile.dockerfile,
                requirements: requirements.requirements,
            };
        } catch (error) {
            toast({
                title: 'Artifact Generation Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            return null;
        }
    }, [workflow, toast]);
    
    // Reset state
    const reset = useCallback(() => {
        setModels([]);
        setSelectedModels([]);
        setWorkflow(null);
        setValidation(null);
    }, []);
    
    return {
        // State
        isSearching,
        isCreating,
        isDeploying,
        models,
        selectedModels,
        workflow,
        validation,
        
        // Actions
        searchModels,
        toggleModelSelection,
        setSelectedModels,
        createWorkflow,
        validateWorkflow,
        modifyWorkflow,
        getCostEstimate,
        generateArtifacts,
        setWorkflow,
        reset,
    };
}


/**
 * Training Store - Zustand state management for training UI
 *
 * Manages training jobs, progress, and UI state.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

// Re-export types for convenience
export type ModelModality = 'llm' | 'image' | 'video' | 'audio' | 'multimodal';
export type TrainingMethod = 'lora' | 'qlora' | 'full' | 'dreambooth' | 'textual_inversion' | 'dpo' | 'rlhf' | 'voice_clone' | 'style_transfer';

export interface DatasetConfig {
  source: 'upload' | 'huggingface';
  huggingfaceId?: string;
  format: 'jsonl' | 'csv' | 'parquet' | 'images' | 'audio' | 'video';
  promptColumn?: string;
  responseColumn?: string;
  imageColumn?: string;
  captionColumn?: string;
  videoColumn?: string;
  validationSplit: number;
  maxSamples?: number;
  uploadedFiles?: string[];
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  warmupSteps: number;
  maxSteps?: number;
  gradientAccumulation: number;
  gradientCheckpointing: boolean;
  fp16: boolean;
  bf16: boolean;
  loraR?: number;
  loraAlpha?: number;
  loraDropout?: number;
  targetModules?: string[];
  maxSeqLength?: number;
  useUnsloth?: boolean;
  quantization?: '4bit' | '8bit' | 'none';
  scheduler: 'cosine' | 'linear' | 'constant' | 'constant_with_warmup';
  hubPrivate: boolean;
  pushToHub: boolean;
  hubModelId?: string;
  gpuType?: string;
  gpuCount: number;
}

export interface GPURecommendation {
  gpuType: string;
  gpuCount: number;
  vramRequired: number;
  estimatedCost: number;
  estimatedTime: string;
  provider: 'runpod' | 'modal' | 'both';
  reasoning: string;
}

export interface TrainingProgress {
  jobId: string;
  status: 'pending' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  loss: number;
  learningRate: number;
  eta: string;
  gpuUtilization: number;
  gpuMemoryUsed: number;
  gpuMemoryTotal: number;
  logs: LogEntry[];
  metrics: MetricsHistory;
  cost: CostTracking;
  startedAt?: string;
  completedAt?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface MetricsHistory {
  loss: { step: number; value: number }[];
  learningRate: { step: number; value: number }[];
  gradNorm?: { step: number; value: number }[];
  evalLoss?: { step: number; value: number }[];
}

export interface CostTracking {
  gpuCost: number;
  platformFee: number;
  totalCost: number;
  creditsUsed: number;
  estimatedRemaining: number;
}

export interface TrainingJob {
  id: string;
  name: string;
  modality: ModelModality;
  method: TrainingMethod;
  baseModel: string;
  datasetConfig: DatasetConfig;
  trainingConfig: TrainingConfig;
  progress?: TrainingProgress;
  result?: TrainingResult;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingResult {
  jobId: string;
  status: 'completed' | 'failed';
  modelPath?: string;
  huggingfaceUrl?: string;
  finalLoss?: number;
  totalEpochs: number;
  totalSteps: number;
  trainingTime: number;
  totalCost: number;
  reportUrl?: string;
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  author: string;
  description?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  modelSize?: string;
  license?: string;
  lastModified?: string;
  private?: boolean;
}

// Wizard step type - includes budget step for cost controls
type WizardStep = 'modality' | 'model' | 'dataset' | 'config' | 'budget' | 'review';

interface TrainingState {
  // Wizard state
  wizardStep: WizardStep;
  wizardData: {
    modality?: ModelModality;
    method?: TrainingMethod;
    baseModel?: string;
    baseModelInfo?: ModelInfo;
    datasetConfig?: DatasetConfig;
    trainingConfig?: TrainingConfig;
    gpuRecommendation?: GPURecommendation;
    jobName?: string;
    // Budget controls
    budgetLimit?: number; // in cents
    autoSaveToHub?: boolean;
    hubRepoName?: string;
  };

  // Jobs list
  jobs: TrainingJob[];
  activeJobId: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Model search
  modelSearchQuery: string;
  modelSearchResults: ModelInfo[];
  isSearching: boolean;

  // Progress streaming
  progressEventSource: EventSource | null;

  // Actions
  setWizardStep: (step: WizardStep) => void;
  setWizardData: (data: Partial<TrainingState['wizardData']>) => void;
  resetWizard: () => void;

  searchModels: (query: string, modality: ModelModality) => Promise<void>;
  selectModel: (model: ModelInfo) => void;

  getGPURecommendation: () => Promise<void>;

  createJob: () => Promise<string | null>;
  startJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  stopJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;

  fetchJobs: () => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  setActiveJob: (jobId: string | null) => void;

  subscribeToProgress: (jobId: string) => void;
  unsubscribeFromProgress: () => void;
  updateProgress: (progress: Partial<TrainingProgress>) => void;

  setError: (error: string | null) => void;
}

const initialWizardData: TrainingState['wizardData'] = {};

export const useTrainingStore = create<TrainingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    wizardStep: 'modality',
    wizardData: initialWizardData,
    jobs: [],
    activeJobId: null,
    isLoading: false,
    error: null,
    modelSearchQuery: '',
    modelSearchResults: [],
    isSearching: false,
    progressEventSource: null,

    // Wizard actions
    setWizardStep: (step) => set({ wizardStep: step }),

    setWizardData: (data) => set((state) => ({
      wizardData: { ...state.wizardData, ...data },
    })),

    resetWizard: () => set({
      wizardStep: 'modality',
      wizardData: initialWizardData,
      modelSearchQuery: '',
      modelSearchResults: [],
    }),

    // Model search
    searchModels: async (query, modality) => {
      set({ modelSearchQuery: query, isSearching: true });

      try {
        const response = await authenticatedFetch(
          `/api/training/search-models?query=${encodeURIComponent(query)}&modality=${modality}`
        );

        if (!response.ok) {
          throw new Error('Failed to search models');
        }

        const data = await response.json();
        set({ modelSearchResults: data.models || [] });
      } catch (error) {
        console.error('Model search error:', error);
        set({ modelSearchResults: [] });
      } finally {
        set({ isSearching: false });
      }
    },

    selectModel: (model) => {
      set((state) => ({
        wizardData: {
          ...state.wizardData,
          baseModel: model.id,
          baseModelInfo: model,
        },
      }));
    },

    // GPU recommendation
    getGPURecommendation: async () => {
      const { wizardData } = get();

      if (!wizardData.modality || !wizardData.method || !wizardData.baseModel) {
        return;
      }

      set({ isLoading: true });

      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/recommend-gpu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modality: wizardData.modality,
            method: wizardData.method,
            baseModel: wizardData.baseModel,
            datasetConfig: wizardData.datasetConfig,
            trainingConfig: wizardData.trainingConfig,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get GPU recommendation');
        }

        const recommendation = await response.json();
        set((state) => ({
          wizardData: { ...state.wizardData, gpuRecommendation: recommendation },
        }));
      } catch (error) {
        console.error('GPU recommendation error:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    // Job management
    createJob: async () => {
      const { wizardData } = get();

      if (!wizardData.modality || !wizardData.method || !wizardData.baseModel ||
          !wizardData.datasetConfig || !wizardData.trainingConfig) {
        set({ error: 'Missing required configuration' });
        return null;
      }

      set({ isLoading: true, error: null });

      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/jobs/multimodal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: wizardData.jobName || `${wizardData.modality}-${Date.now()}`,
            modality: wizardData.modality,
            method: wizardData.method,
            baseModel: wizardData.baseModel,
            datasetConfig: wizardData.datasetConfig,
            trainingConfig: wizardData.trainingConfig,
            // Budget and auto-save options
            budgetLimitCents: wizardData.budgetLimit,
            autoSaveToHub: wizardData.autoSaveToHub ?? true,
            hubRepoName: wizardData.hubRepoName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create job');
        }

        const job = await response.json();

        set((state) => ({
          jobs: [job, ...state.jobs],
          activeJobId: job.id,
        }));

        return job.id;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to create job' });
        return null;
      } finally {
        set({ isLoading: false });
      }
    },

    startJob: async (jobId) => {
      set({ isLoading: true, error: null });

      try {
        const response = await authenticatedFetch(`/api/training/jobs/${jobId}/start`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to start job');
        }

        // Subscribe to progress updates
        get().subscribeToProgress(jobId);

        // Refresh job data
        await get().fetchJob(jobId);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to start job' });
      } finally {
        set({ isLoading: false });
      }
    },

    pauseJob: async (jobId) => {
      try {
        const response = await authenticatedFetch(`/api/training/jobs/${jobId}/pause`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to pause job');
        }

        await get().fetchJob(jobId);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to pause job' });
      }
    },

    resumeJob: async (jobId) => {
      try {
        const response = await authenticatedFetch(`/api/training/jobs/${jobId}/resume`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to resume job');
        }

        await get().fetchJob(jobId);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to resume job' });
      }
    },

    stopJob: async (jobId) => {
      try {
        get().unsubscribeFromProgress();

        const response = await authenticatedFetch(`/api/training/jobs/${jobId}/stop`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to stop job');
        }

        await get().fetchJob(jobId);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to stop job' });
      }
    },

    deleteJob: async (jobId) => {
      try {
        const response = await authenticatedFetch(`/api/training/jobs/${jobId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete job');
        }

        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== jobId),
          activeJobId: state.activeJobId === jobId ? null : state.activeJobId,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete job' });
      }
    },

    fetchJobs: async () => {
      set({ isLoading: true });

      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/jobs`);

        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }

        const jobs = await response.json();
        set({ jobs });
      } catch (error) {
        console.error('Fetch jobs error:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    fetchJob: async (jobId) => {
      try {
        const response = await authenticatedFetch(`/api/training/jobs/${jobId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch job');
        }

        const job = await response.json();

        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === jobId ? job : j)),
        }));
      } catch (error) {
        console.error('Fetch job error:', error);
      }
    },

    setActiveJob: (jobId) => set({ activeJobId: jobId }),

    // Progress streaming
    subscribeToProgress: (jobId) => {
      const { progressEventSource } = get();

      // Close existing connection
      if (progressEventSource) {
        progressEventSource.close();
      }

      // Create new SSE connection
      const eventSource = new EventSource(`/api/training/jobs/${jobId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          get().updateProgress(data);
        } catch {
          console.error('Failed to parse progress event');
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        eventSource.close();
        set({ progressEventSource: null });
      };

      set({ progressEventSource: eventSource });
    },

    unsubscribeFromProgress: () => {
      const { progressEventSource } = get();
      if (progressEventSource) {
        progressEventSource.close();
        set({ progressEventSource: null });
      }
    },

    updateProgress: (progress) => {
      const { activeJobId, jobs } = get();

      if (!activeJobId) return;

      set({
        jobs: jobs.map((job) => {
          if (job.id === activeJobId) {
            return {
              ...job,
              progress: {
                ...job.progress,
                ...progress,
              } as TrainingProgress,
            };
          }
          return job;
        }),
      });
    },

    setError: (error) => set({ error }),
  }))
);

// Selectors
export const selectActiveJob = (state: TrainingState) =>
  state.jobs.find((j) => j.id === state.activeJobId);

export const selectJobsByStatus = (status: TrainingProgress['status']) => (state: TrainingState) =>
  state.jobs.filter((j) => j.progress?.status === status);

export const selectRunningJobs = (state: TrainingState) =>
  state.jobs.filter((j) => j.progress?.status === 'running');

export const selectCompletedJobs = (state: TrainingState) =>
  state.jobs.filter((j) => j.progress?.status === 'completed');

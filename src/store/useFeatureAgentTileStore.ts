import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type FeatureAgentTileStatus =
  | 'intent_lock'
  | 'awaiting_plan_approval'
  | 'awaiting_credentials'
  | 'implementing'
  | 'verifying'
  | 'complete'
  | 'failed'
  | 'paused'
  | 'ghost_mode';

export interface StreamMessage {
  type: 'thinking' | 'action' | 'result' | 'status' | 'plan' | 'credentials' | 'verification';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ImplementationPlan {
  intentSummary: string;
  whatIsDone: string;
  phases: ImplementationPhase[];
  requiredCredentials: RequiredCredential[];
  estimatedTokenUsage: number;
  estimatedCostUSD: number;
  parallelAgentsNeeded: number;
  frontendFirst: boolean;
  backendFirst: boolean;
  parallelFrontendBackend: boolean;
}

export interface ImplementationPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  steps: PhaseStep[];
  approved: boolean;
  modified: boolean;
  userModification: string | null;
}

export interface PhaseStep {
  id: string;
  description: string;
  type: 'frontend' | 'backend' | 'integration' | 'testing' | 'verification';
  parallelAgents: string[];
  estimatedTokens: number;
}

export interface RequiredCredential {
  id: string;
  name: string;
  description: string;
  envVariableName: string;
  platformName: string;
  platformUrl: string;
  required: boolean;
  value: string | null;
}

export interface FeatureAgentTileState {
  agentId: string;
  minimized: boolean;
  position: { x: number; y: number };
  status: FeatureAgentTileStatus;
  modelName?: string;
  agentName?: string;
  messages: StreamMessage[];
  progress?: number;
  currentPhase?: string;
  implementationPlan?: ImplementationPlan;
  requiredCredentials?: RequiredCredential[];
  lastUpdatedAt: number;
}

interface FeatureAgentTileStore {
  tiles: Record<string, FeatureAgentTileState>;
  order: string[];

  openTile: (agentId: string, opts?: Partial<Pick<FeatureAgentTileState, 'position' | 'agentName' | 'modelName'>>) => void;
  minimizeTile: (agentId: string) => void;
  restoreTile: (agentId: string) => void;
  closeTile: (agentId: string) => void;
  setTilePosition: (agentId: string, pos: { x: number; y: number }) => void;
  setTileStatus: (agentId: string, status: FeatureAgentTileStatus) => void;
  setImplementationPlan: (agentId: string, plan: ImplementationPlan) => void;
  setRequiredCredentials: (agentId: string, credentials: RequiredCredential[]) => void;
  addMessage: (agentId: string, msg: StreamMessage) => void;
  updateProgress: (agentId: string, progress: number, currentPhase?: string) => void;
}

const DEFAULT_POSITION = { x: 80, y: 120 };

export const useFeatureAgentTileStore = create<FeatureAgentTileStore>()(
  devtools(
    (set, get) => ({
      tiles: {},
      order: [],

      openTile: (agentId, opts) => {
        const existing = get().tiles[agentId];
        const now = Date.now();

        set((state) => {
          const nextTiles = { ...state.tiles };

          nextTiles[agentId] = {
            agentId,
            minimized: false,
            position: opts?.position || existing?.position || DEFAULT_POSITION,
            status: existing?.status || 'implementing',
            modelName: opts?.modelName ?? existing?.modelName,
            agentName: opts?.agentName ?? existing?.agentName,
            messages: existing?.messages || [],
            progress: existing?.progress,
            currentPhase: existing?.currentPhase,
            lastUpdatedAt: now,
          };

          const nextOrder = state.order.includes(agentId) ? state.order : [...state.order, agentId];
          return { tiles: nextTiles, order: nextOrder };
        }, false, { type: 'featureAgentTile/openTile', agentId });
      },

      minimizeTile: (agentId) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, minimized: true, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/minimize', agentId });
      },

      restoreTile: (agentId) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, minimized: false, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/restore', agentId });
      },

      closeTile: (agentId) => {
        set((state) => {
          if (!state.tiles[agentId]) return state;
          const nextTiles = { ...state.tiles };
          delete nextTiles[agentId];
          return {
            tiles: nextTiles,
            order: state.order.filter((id) => id !== agentId),
          };
        }, false, { type: 'featureAgentTile/close', agentId });
      },

      setTilePosition: (agentId, pos) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, position: pos, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/position', agentId });
      },

      setTileStatus: (agentId, status) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, status, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/status', agentId, status });
      },

      setImplementationPlan: (agentId, plan) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, implementationPlan: plan, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/plan', agentId });
      },

      setRequiredCredentials: (agentId, credentials) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: { ...tile, requiredCredentials: credentials, lastUpdatedAt: Date.now() },
            },
          };
        }, false, { type: 'featureAgentTile/credentials', agentId });
      },

      addMessage: (agentId, msg) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: {
                ...tile,
                messages: [...tile.messages, msg].slice(-1200),
                lastUpdatedAt: Date.now(),
              },
            },
          };
        }, false, { type: 'featureAgentTile/message', agentId });
      },

      updateProgress: (agentId, progress, currentPhase) => {
        set((state) => {
          const tile = state.tiles[agentId];
          if (!tile) return state;
          return {
            ...state,
            tiles: {
              ...state.tiles,
              [agentId]: {
                ...tile,
                progress,
                currentPhase: currentPhase ?? tile.currentPhase,
                lastUpdatedAt: Date.now(),
              },
            },
          };
        }, false, { type: 'featureAgentTile/progress', agentId });
      },
    }),
    { name: 'FeatureAgentTileStore' }
  )
);



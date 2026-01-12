/**
 * Neural Canvas Store
 *
 * Zustand store for managing Neural Canvas orchestration UI state.
 * Tracks thoughts, code generation, diffs, agents, and build phases.
 *
 * Features:
 * - Real-time thought streaming from AI
 * - Code generation tracking with syntax info
 * - File diff management
 * - Parallel agent status
 * - Build phase progression
 */

import { create } from 'zustand';
import type { AgentActivityEvent } from '../types/agent-activity';
import type { NeuralIconName } from '../components/neural-canvas/icons/NeuralIcons';

// ============================================================================
// TYPES
// ============================================================================

/** Thought item in the consciousness stream */
export interface ThoughtItem {
  id: string;
  type: 'reasoning' | 'analyzing' | 'generating' | 'error' | 'complete';
  content: string;
  timestamp: number;
  isActive: boolean;
  agentId?: string;
  agentName?: string;
}

/** Code line with syntax info */
export interface CodeLine {
  lineNumber: number;
  content: string;
  isHighlighted: boolean;
  isNew: boolean;
  isRemoved: boolean;
}

/** Active code generation */
export interface CodeGeneration {
  id: string;
  filename: string;
  filepath: string;
  language: string;
  lines: CodeLine[];
  isComplete: boolean;
  timestamp: number;
}

/** Diff line */
export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** Diff hunk */
export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

/** File diff */
export interface FileDiff {
  id: string;
  filename: string;
  operation: 'add' | 'modify' | 'delete';
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  timestamp: number;
}

/** Agent status */
export type AgentStatus = 'pending' | 'active' | 'complete' | 'error';

/** Agent info */
export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  task: string;
  status: AgentStatus;
  progress: number;
  iconName?: NeuralIconName;
  startTime?: number;
  endTime?: number;
}

/** Phase status */
export type PhaseStatus = 'pending' | 'active' | 'complete' | 'error';

/** Phase info */
export interface PhaseInfo {
  id: string;
  name: string;
  description?: string;
  status: PhaseStatus;
  duration?: number;
  iconName?: NeuralIconName;
}

/** Canvas mode */
export type NeuralCanvasMode = 'compact' | 'standard' | 'expanded';

/** Visible sections */
export type NeuralCanvasSection = 'thoughts' | 'code' | 'diff' | 'agents' | 'timeline';

// ============================================================================
// STORE STATE
// ============================================================================

interface NeuralCanvasStore {
  // Mode and visibility
  mode: NeuralCanvasMode;
  visibleSections: Set<NeuralCanvasSection>;
  isActive: boolean;

  // Thought stream
  thoughts: ThoughtItem[];
  maxThoughts: number;

  // Code generation
  activeCode: CodeGeneration | null;
  codeHistory: CodeGeneration[];

  // Diffs
  activeDiff: FileDiff | null;
  diffHistory: FileDiff[];

  // Agents
  agents: Map<string, AgentInfo>;

  // Phases
  phases: PhaseInfo[];
  currentPhaseId: string | null;
  totalProgress: number;

  // Session
  sessionId: string | null;
  sessionStartTime: number | null;

  // Actions - Mode & Visibility
  setMode: (mode: NeuralCanvasMode) => void;
  toggleSection: (section: NeuralCanvasSection) => void;
  setSectionVisible: (section: NeuralCanvasSection, visible: boolean) => void;
  setActive: (active: boolean) => void;

  // Actions - Thoughts
  addThought: (thought: Omit<ThoughtItem, 'id' | 'timestamp'>) => void;
  updateThought: (id: string, updates: Partial<ThoughtItem>) => void;
  clearThoughts: () => void;
  setMaxThoughts: (max: number) => void;

  // Actions - Code
  startCodeGeneration: (filename: string, filepath: string, language: string) => void;
  addCodeLine: (line: Omit<CodeLine, 'lineNumber'>) => void;
  updateCodeLine: (lineNumber: number, updates: Partial<CodeLine>) => void;
  completeCodeGeneration: () => void;
  setActiveCode: (code: CodeGeneration | null) => void;

  // Actions - Diffs
  addDiff: (diff: Omit<FileDiff, 'id' | 'timestamp'>) => void;
  setActiveDiff: (diff: FileDiff | null) => void;
  clearDiffs: () => void;

  // Actions - Agents
  addAgent: (agent: Omit<AgentInfo, 'startTime'>) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  removeAgent: (id: string) => void;
  clearAgents: () => void;

  // Actions - Phases
  setPhases: (phases: PhaseInfo[]) => void;
  updatePhase: (id: string, updates: Partial<PhaseInfo>) => void;
  setCurrentPhase: (id: string | null) => void;
  setTotalProgress: (progress: number) => void;

  // Actions - Session
  startSession: () => void;
  endSession: () => void;

  // Actions - Event Processing
  processAgentEvent: (event: AgentActivityEvent) => void;

  // Actions - Reset
  reset: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `nc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapEventTypeToThoughtType(eventType: string): ThoughtItem['type'] {
  switch (eventType) {
    case 'thinking':
      return 'reasoning';
    case 'file_read':
    case 'file_write':
    case 'file_edit':
      return 'generating';
    case 'tool_call':
      return 'analyzing';
    case 'verification':
      return 'complete';
    case 'error':
      return 'error';
    default:
      return 'reasoning';
  }
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useNeuralCanvasStore = create<NeuralCanvasStore>((set, get) => ({
  // Initial state
  mode: 'standard',
  visibleSections: new Set(['thoughts', 'code', 'agents', 'timeline']),
  isActive: false,

  thoughts: [],
  maxThoughts: 100,

  activeCode: null,
  codeHistory: [],

  activeDiff: null,
  diffHistory: [],

  agents: new Map(),

  phases: [],
  currentPhaseId: null,
  totalProgress: 0,

  sessionId: null,
  sessionStartTime: null,

  // Mode & Visibility Actions
  setMode: (mode) => set({ mode }),

  toggleSection: (section) => set((state) => {
    const newSections = new Set(state.visibleSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    return { visibleSections: newSections };
  }),

  setSectionVisible: (section, visible) => set((state) => {
    const newSections = new Set(state.visibleSections);
    if (visible) {
      newSections.add(section);
    } else {
      newSections.delete(section);
    }
    return { visibleSections: newSections };
  }),

  setActive: (active) => set({ isActive: active }),

  // Thought Actions
  addThought: (thought) => set((state) => {
    const newThought: ThoughtItem = {
      ...thought,
      id: generateId(),
      timestamp: Date.now(),
    };

    // Mark previous active thoughts as inactive
    const updatedThoughts = state.thoughts.map(t =>
      t.isActive ? { ...t, isActive: false } : t
    );

    // Add new thought, respecting max limit
    const thoughts = [...updatedThoughts, newThought];
    if (thoughts.length > state.maxThoughts) {
      thoughts.shift();
    }

    return { thoughts };
  }),

  updateThought: (id, updates) => set((state) => ({
    thoughts: state.thoughts.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ),
  })),

  clearThoughts: () => set({ thoughts: [] }),

  setMaxThoughts: (max) => set({ maxThoughts: max }),

  // Code Actions
  startCodeGeneration: (filename, filepath, language) => set((state) => {
    const newCode: CodeGeneration = {
      id: generateId(),
      filename,
      filepath,
      language,
      lines: [],
      isComplete: false,
      timestamp: Date.now(),
    };

    // Move current active code to history if exists
    const codeHistory = state.activeCode
      ? [...state.codeHistory, state.activeCode]
      : state.codeHistory;

    return { activeCode: newCode, codeHistory };
  }),

  addCodeLine: (line) => set((state) => {
    if (!state.activeCode) return state;

    const newLine: CodeLine = {
      ...line,
      lineNumber: state.activeCode.lines.length + 1,
    };

    return {
      activeCode: {
        ...state.activeCode,
        lines: [...state.activeCode.lines, newLine],
      },
    };
  }),

  updateCodeLine: (lineNumber, updates) => set((state) => {
    if (!state.activeCode) return state;

    return {
      activeCode: {
        ...state.activeCode,
        lines: state.activeCode.lines.map(l =>
          l.lineNumber === lineNumber ? { ...l, ...updates } : l
        ),
      },
    };
  }),

  completeCodeGeneration: () => set((state) => {
    if (!state.activeCode) return state;

    return {
      activeCode: {
        ...state.activeCode,
        isComplete: true,
      },
    };
  }),

  setActiveCode: (code) => set({ activeCode: code }),

  // Diff Actions
  addDiff: (diff) => set((state) => {
    const newDiff: FileDiff = {
      ...diff,
      id: generateId(),
      timestamp: Date.now(),
    };

    // Move current active diff to history
    const diffHistory = state.activeDiff
      ? [...state.diffHistory, state.activeDiff]
      : state.diffHistory;

    return { activeDiff: newDiff, diffHistory };
  }),

  setActiveDiff: (diff) => set({ activeDiff: diff }),

  clearDiffs: () => set({ activeDiff: null, diffHistory: [] }),

  // Agent Actions
  addAgent: (agent) => set((state) => {
    const newAgents = new Map(state.agents);
    newAgents.set(agent.id, {
      ...agent,
      startTime: Date.now(),
    });
    return { agents: newAgents };
  }),

  updateAgent: (id, updates) => set((state) => {
    const newAgents = new Map(state.agents);
    const existing = newAgents.get(id);
    if (existing) {
      newAgents.set(id, { ...existing, ...updates });
    }
    return { agents: newAgents };
  }),

  removeAgent: (id) => set((state) => {
    const newAgents = new Map(state.agents);
    newAgents.delete(id);
    return { agents: newAgents };
  }),

  clearAgents: () => set({ agents: new Map() }),

  // Phase Actions
  setPhases: (phases) => set({ phases }),

  updatePhase: (id, updates) => set((state) => ({
    phases: state.phases.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ),
  })),

  setCurrentPhase: (id) => set({ currentPhaseId: id }),

  setTotalProgress: (progress) => set({ totalProgress: progress }),

  // Session Actions
  startSession: () => set({
    sessionId: generateId(),
    sessionStartTime: Date.now(),
    isActive: true,
    thoughts: [],
    activeCode: null,
    activeDiff: null,
    agents: new Map(),
    totalProgress: 0,
  }),

  endSession: () => set({
    isActive: false,
  }),

  // Event Processing
  processAgentEvent: (event) => {
    const state = get();

    // Add as thought
    state.addThought({
      type: mapEventTypeToThoughtType(event.type),
      content: event.content,
      isActive: true,
      agentId: event.agentId,
      agentName: event.agentName,
    });

    // Update agent if exists
    if (event.agentId) {
      const agent = state.agents.get(event.agentId);
      if (agent) {
        let statusUpdate: Partial<AgentInfo> = {};

        if (event.type === 'error') {
          statusUpdate = { status: 'error' };
        } else if (event.type === 'verification' && event.metadata?.result === 'success') {
          statusUpdate = { status: 'complete', progress: 100 };
        } else if (event.type === 'thinking') {
          statusUpdate = { status: 'active' };
        }

        if (Object.keys(statusUpdate).length > 0) {
          state.updateAgent(event.agentId, statusUpdate);
        }
      }
    }

    // Handle file operations for code/diff
    if (event.type === 'file_write' && event.metadata?.filePath) {
      const filename = event.metadata.filePath.split('/').pop() || 'unknown';
      const language = getLanguageFromFilename(filename);

      if (!state.activeCode || state.activeCode.filename !== filename) {
        state.startCodeGeneration(filename, event.metadata.filePath, language);
      }
    }

    // Update phase based on event metadata
    if (event.metadata?.phase) {
      const phase = state.phases.find(p =>
        p.name.toLowerCase().includes(event.metadata!.phase!.toLowerCase())
      );
      if (phase && phase.id !== state.currentPhaseId) {
        state.setCurrentPhase(phase.id);
        state.updatePhase(phase.id, { status: 'active' });
      }
    }
  },

  // Reset
  reset: () => set({
    mode: 'standard',
    visibleSections: new Set(['thoughts', 'code', 'agents', 'timeline']),
    isActive: false,
    thoughts: [],
    maxThoughts: 100,
    activeCode: null,
    codeHistory: [],
    activeDiff: null,
    diffHistory: [],
    agents: new Map(),
    phases: [],
    currentPhaseId: null,
    totalProgress: 0,
    sessionId: null,
    sessionStartTime: null,
  }),
}));

// Helper to get language from filename
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'js': return 'javascript';
    case 'jsx': return 'jsx';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
}

export default useNeuralCanvasStore;

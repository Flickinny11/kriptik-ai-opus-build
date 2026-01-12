/**
 * Neural Canvas - Barrel Export
 *
 * Premium orchestration UI component system for AI agent visualization.
 * Provides real-time display of AI thinking, code generation, diffs,
 * parallel agents, and build progress.
 *
 * Usage:
 *   import { NeuralCanvas, useNeuralCanvasStore } from '@/components/neural-canvas';
 *
 * Or import individual components:
 *   import { ThoughtStream, CodeCanvas, DiffViewer } from '@/components/neural-canvas';
 */

// Main container component
export { NeuralCanvas, type NeuralCanvasProps } from './NeuralCanvas';

// Sub-components
export {
  ThoughtStream,
  type ThoughtStreamProps,
  type ThoughtItem,
  type ThoughtType,
} from './ThoughtStream';

export {
  CodeCanvas,
  type CodeCanvasProps,
  type CodeLine,
  type SupportedLanguage,
  normalizeLanguage,
} from './CodeCanvas';

export {
  DiffViewer,
  type DiffViewerProps,
  type DiffLine,
  type DiffHunk,
} from './DiffViewer';

export {
  AgentGrid,
  type AgentGridProps,
  type AgentInfo,
  type AgentStatus,
} from './AgentGrid';

export {
  PhaseTimeline,
  type PhaseTimelineProps,
  type PhaseInfo,
  type PhaseStatus,
} from './PhaseTimeline';

// Icon system
export {
  NeuralIcon,
  getLanguageIcon,
  type NeuralIconName,
  type NeuralIconProps,
} from './icons/NeuralIcons';

// Store (re-exported for convenience)
export {
  useNeuralCanvasStore,
  type CodeGeneration,
  type FileDiff,
  type NeuralCanvasMode,
  type NeuralCanvasSection,
} from '../../store/useNeuralCanvasStore';

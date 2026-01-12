/**
 * Neural Canvas Types
 *
 * Comprehensive TypeScript types for the Neural Canvas system - a premium orchestration UI
 * that displays AI thinking streams, code generation, file diffs, parallel agent grids,
 * and phase timelines.
 *
 * This is the canonical source of truth for all Neural Canvas types.
 * Components should import from this file rather than defining types locally.
 *
 * @module neural-canvas
 */

import type { AgentActivityEvent, AgentActivityPhase } from '../../types/agent-activity';

// =============================================================================
// THOUGHT STREAM TYPES
// =============================================================================

/**
 * Types of thoughts that can be displayed in the ThoughtStream component.
 * Each type represents a different stage or state of AI reasoning.
 */
export type ThoughtType =
  | 'reasoning'   // AI is reasoning through a problem
  | 'analyzing'   // AI is analyzing code, requirements, or context
  | 'generating'  // AI is generating code or content
  | 'error'       // An error occurred during thinking
  | 'complete';   // Thought process completed successfully

/**
 * Represents a single thought item in the AI's thinking stream.
 * Thoughts are displayed in real-time as the AI reasons through problems.
 *
 * Note: timestamp uses number (Unix timestamp) for consistency with the store.
 * Components may convert to Date for display formatting.
 */
export interface ThoughtItem {
  /** Unique identifier for the thought */
  id: string;
  /** Type of thought (reasoning, analyzing, generating, error, complete) */
  type: ThoughtType;
  /** The content/text of the thought */
  content: string;
  /** Unix timestamp (milliseconds) when the thought was created */
  timestamp: number;
  /** Whether this thought is currently being processed/active */
  isActive: boolean;
  /** ID of the agent that generated this thought */
  agentId?: string;
  /** Name of the agent that generated this thought */
  agentName?: string;
  /** Optional expanded content for more detail (shown on click) */
  expandedContent?: string;
}

/**
 * Props for the ThoughtStream component that displays AI thinking in real-time.
 */
export interface ThoughtStreamProps {
  /** Array of thoughts to display */
  thoughts: ThoughtItem[];
  /** Callback when a thought item is clicked */
  onThoughtClick?: (thoughtId: string) => void;
  /** Whether the thought stream is expanded to show full content */
  isExpanded?: boolean;
  /** Maximum height of the thought stream container (number for px, string for CSS value) */
  maxHeight?: number | string;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// CODE CANVAS TYPES
// =============================================================================

/**
 * Types of syntax tokens for syntax highlighting.
 * These map to different visual styles in the code display.
 */
export type SyntaxTokenType =
  | 'keyword'     // Language keywords (const, let, function, if, etc.)
  | 'function'    // Function names and calls
  | 'string'      // String literals
  | 'number'      // Numeric literals
  | 'comment'     // Code comments
  | 'operator'    // Operators (+, -, =, ===, etc.)
  | 'variable'    // Variable names
  | 'class'       // Class names
  | 'property'    // Object properties
  | 'type'        // Type annotations (TypeScript)
  | 'tag'         // HTML/JSX tags
  | 'attribute'   // HTML/JSX attributes
  | 'punctuation' // Brackets, parentheses, semicolons
  | 'plain';      // Default/plain text

/**
 * Represents a single syntax-highlighted token within a line of code.
 */
export interface SyntaxToken {
  /** The type of token for styling purposes */
  type: SyntaxTokenType;
  /** The actual text content of the token */
  content: string;
}

/**
 * Represents a single line of code in the CodeCanvas component.
 */
export interface CodeLine {
  /** The line number (1-indexed) */
  lineNumber: number;
  /** The raw content of the line (before syntax highlighting) */
  content: string;
  /** Whether this line is currently highlighted (focused) */
  isHighlighted?: boolean;
  /** Whether this is a newly added line (for diff visualization) */
  isNew?: boolean;
  /** Whether this line was removed (for diff visualization) */
  isRemoved?: boolean;
  /** Pre-parsed syntax tokens for this line (optional - can be parsed on render) */
  tokens?: SyntaxToken[];
}

/**
 * Supported programming languages for syntax highlighting.
 */
export type CodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'tsx'
  | 'jsx'
  | 'html'
  | 'css'
  | 'scss'
  | 'json'
  | 'markdown'
  | 'python'
  | 'rust'
  | 'go'
  | 'sql'
  | 'bash'
  | 'yaml'
  | 'plaintext'
  | 'plain';

/**
 * Active code generation state (used by the store).
 */
export interface CodeGeneration {
  /** Unique identifier for this code generation session */
  id: string;
  /** The filename being generated */
  filename: string;
  /** Full file path */
  filepath: string;
  /** Programming language */
  language: string;
  /** Lines of code */
  lines: CodeLine[];
  /** Whether generation is complete */
  isComplete: boolean;
  /** Unix timestamp when generation started */
  timestamp: number;
}

/**
 * Props for the CodeCanvas component that displays code with syntax highlighting.
 */
export interface CodeCanvasProps {
  /** The filename being displayed */
  filename: string;
  /** Full file path (for display and navigation) */
  filepath?: string;
  /** Programming language for syntax highlighting */
  language: CodeLanguage;
  /** Array of code lines to display */
  lines: CodeLine[];
  /** Callback when a line is clicked */
  onLineClick?: (line: CodeLine) => void;
  /** Whether to show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Maximum height of the code canvas (number for px, string for CSS value) */
  maxHeight?: number | string;
  /** Whether the code panel can be collapsed */
  isCollapsible?: boolean;
  /** Whether the code panel is currently collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
  /** Callback when expand button is clicked */
  onExpand?: () => void;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// DIFF VIEWER TYPES
// =============================================================================

/**
 * Types of diff line changes.
 */
export type DiffLineType =
  | 'add'      // Line was added
  | 'remove'   // Line was removed
  | 'context'; // Unchanged context line

/**
 * Represents a single line in a diff.
 */
export interface DiffLine {
  /** Type of change (add, remove, or context) */
  type: DiffLineType;
  /** The content of the line */
  content: string;
  /** Line number in the old version (undefined for added lines) */
  oldLineNumber?: number;
  /** Line number in the new version (undefined for removed lines) */
  newLineNumber?: number;
}

/**
 * Represents a hunk (section) of changes in a diff.
 * A diff typically consists of multiple hunks showing different changed areas.
 */
export interface DiffHunk {
  /** The hunk header (e.g., "@@ -1,5 +1,7 @@") */
  header: string;
  /** Starting line in the old version */
  oldStart?: number;
  /** Number of lines in old version */
  oldCount?: number;
  /** Starting line in the new version */
  newStart?: number;
  /** Number of lines in new version */
  newCount?: number;
  /** Lines within this hunk */
  lines: DiffLine[];
}

/**
 * Types of file operations in a diff.
 */
export type DiffOperation =
  | 'add'    // New file added
  | 'modify' // Existing file modified
  | 'delete' // File deleted
  | 'rename'; // File renamed

/**
 * File diff state (used by the store).
 */
export interface FileDiff {
  /** Unique identifier for this diff */
  id: string;
  /** Name of the file being diffed */
  filename: string;
  /** Type of operation performed on the file */
  operation: 'add' | 'modify' | 'delete';
  /** Array of diff hunks */
  hunks: DiffHunk[];
  /** Total number of lines added */
  additions: number;
  /** Total number of lines deleted */
  deletions: number;
  /** Unix timestamp when diff was created */
  timestamp: number;
}

/**
 * Props for the DiffViewer component that displays file changes.
 */
export interface DiffViewerProps {
  /** Name of the file being diffed */
  filename: string;
  /** Full path to the file */
  filepath?: string;
  /** Type of operation performed on the file */
  operation: DiffOperation;
  /** Array of diff hunks to display */
  hunks: DiffHunk[];
  /** Total number of lines added */
  additions: number;
  /** Total number of lines deleted */
  deletions: number;
  /** Callback when expand button is clicked (for collapsed diffs) */
  onExpand?: () => void;
  /** Whether the diff is currently expanded */
  isExpanded?: boolean;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// AGENT GRID TYPES
// =============================================================================

/**
 * Status of an agent in the parallel agent grid.
 */
export type AgentStatus =
  | 'pending'  // Agent is waiting to start
  | 'active'   // Agent is currently working
  | 'complete' // Agent has finished successfully
  | 'error';   // Agent encountered an error

/**
 * Types of agents that can appear in the grid.
 */
export type AgentType =
  | 'coding'       // Writing code
  | 'testing'      // Running tests
  | 'reviewing'    // Code review
  | 'designing'    // UI/UX design work
  | 'analyzing'    // Analysis tasks
  | 'integrating'  // Integration work
  | 'verifying'    // Verification tasks
  | 'documenting'  // Documentation
  | string;        // Allow custom agent types

/**
 * Represents information about a single agent in the grid.
 */
export interface AgentInfo {
  /** Unique identifier for the agent */
  id: string;
  /** Display name of the agent */
  name: string;
  /** Type of work the agent is performing */
  type: string;
  /** Current task description */
  task: string;
  /** Current status of the agent */
  status: AgentStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Name of the icon to display for this agent's avatar */
  iconName?: string;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Unix timestamp when the agent started */
  startTime?: number;
  /** Unix timestamp when the agent completed */
  endTime?: number;
}

/**
 * Props for the AgentGrid component that displays parallel agents.
 */
export interface AgentGridProps {
  /** Array of agents to display in the grid */
  agents: AgentInfo[];
  /** Callback when an agent card is clicked */
  onAgentClick?: (agent: AgentInfo) => void;
  /** Number of columns in the grid (default: 3) */
  columns?: number;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// PHASE TIMELINE TYPES
// =============================================================================

/**
 * Status of a phase in the build timeline.
 */
export type PhaseStatus =
  | 'pending'  // Phase has not started
  | 'active'   // Phase is currently running
  | 'complete' // Phase finished successfully
  | 'error';   // Phase failed with an error

/**
 * Represents information about a single phase in the timeline.
 */
export interface PhaseInfo {
  /** Unique identifier for the phase */
  id: string;
  /** Display name of the phase */
  name: string;
  /** Description of what happens in this phase */
  description?: string;
  /** Current status of the phase */
  status: PhaseStatus;
  /** Duration in milliseconds (for completed phases) */
  duration?: number;
  /** Name of the icon to display for this phase */
  iconName?: string;
  /** Sub-phases or steps within this phase */
  subPhases?: PhaseInfo[];
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Progress percentage within the phase (0-100) */
  progress?: number;
}

/**
 * Props for the PhaseTimeline component that displays build phases.
 */
export interface PhaseTimelineProps {
  /** Array of phases to display in the timeline */
  phases: PhaseInfo[];
  /** ID of the currently active phase */
  currentPhaseId?: string;
  /** Overall progress percentage (0-100) */
  totalProgress: number;
  /** Orientation of the timeline */
  orientation?: 'horizontal' | 'vertical';
  /** Whether to show phase durations */
  showDurations?: boolean;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// NEURAL CANVAS MAIN TYPES
// =============================================================================

/**
 * Display modes for the Neural Canvas container.
 */
export type NeuralCanvasMode =
  | 'compact'   // Minimal view with collapsed sections
  | 'standard'  // Normal view with balanced sections
  | 'expanded'; // Full view with all sections expanded

/**
 * Sections available in the Neural Canvas.
 */
export type NeuralCanvasSection =
  | 'thoughts'  // ThoughtStream section
  | 'code'      // CodeCanvas section
  | 'diff'      // DiffViewer section
  | 'agents'    // AgentGrid section
  | 'timeline'; // PhaseTimeline section

/**
 * Configuration for individual section visibility and state.
 */
export interface SectionConfig {
  /** The section identifier */
  section: NeuralCanvasSection;
  /** Whether the section is visible */
  visible: boolean;
  /** Whether the section is expanded */
  expanded?: boolean;
  /** Order in the layout (lower = higher priority) */
  order?: number;
}

/**
 * Props for the main NeuralCanvas container component.
 */
export interface NeuralCanvasProps {
  /** Display mode of the canvas */
  mode: NeuralCanvasMode;
  /** Array of visible sections */
  visibleSections: NeuralCanvasSection[];
  /** Whether the neural canvas is currently active/animating */
  isActive: boolean;
  /** Callback when a section header is clicked */
  onSectionClick?: (section: NeuralCanvasSection) => void;
  /** Callback when mode changes */
  onModeChange?: (mode: NeuralCanvasMode) => void;
  /** Current thought stream data */
  thoughts?: ThoughtItem[];
  /** Current code canvas data */
  codeData?: {
    filename: string;
    filepath?: string;
    language: CodeLanguage;
    lines: CodeLine[];
  };
  /** Current diff data */
  diffData?: {
    filename: string;
    operation: DiffOperation;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
  };
  /** Current agent grid data */
  agents?: AgentInfo[];
  /** Current phase timeline data */
  phases?: PhaseInfo[];
  /** Current phase ID for timeline */
  currentPhaseId?: string;
  /** Total progress for timeline */
  totalProgress?: number;
  /** CSS class name for additional styling */
  className?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Maps syntax token types to their corresponding CSS color classes.
 * Used for consistent syntax highlighting across the application.
 */
export type SyntaxColorMap = {
  [K in SyntaxTokenType]: string;
};

/**
 * Default color mapping for syntax highlighting.
 * These colors are designed to work with both light and dark themes.
 */
export const DEFAULT_SYNTAX_COLORS: SyntaxColorMap = {
  keyword: 'text-purple-400',
  function: 'text-blue-400',
  string: 'text-green-400',
  number: 'text-orange-400',
  comment: 'text-gray-500',
  operator: 'text-yellow-400',
  variable: 'text-cyan-400',
  class: 'text-yellow-300',
  property: 'text-blue-300',
  type: 'text-teal-400',
  tag: 'text-red-400',
  attribute: 'text-orange-300',
  punctuation: 'text-gray-400',
  plain: 'text-gray-200',
};

/**
 * Maps event types to their corresponding color classes.
 * Used for consistent color coding across the Neural Canvas.
 */
export type EventColorMap = {
  [K in ThoughtType | AgentStatus | PhaseStatus]: string;
};

/**
 * Default color mapping for events, agent status, and phase status.
 * Follows the KripTik design system with amber (#F5A86C) for active states.
 */
export const DEFAULT_EVENT_COLORS: EventColorMap = {
  // Thought types
  reasoning: 'text-blue-400 bg-blue-400/10',
  analyzing: 'text-cyan-400 bg-cyan-400/10',
  generating: 'text-amber-400 bg-amber-400/10',
  error: 'text-red-400 bg-red-400/10',
  complete: 'text-green-400 bg-green-400/10',
  // Agent/Phase status
  pending: 'text-gray-400 bg-gray-400/10',
  active: 'text-amber-400 bg-amber-400/10',
};

/**
 * Type guard to check if a value is a valid ThoughtType.
 */
export function isThoughtType(value: string): value is ThoughtType {
  return ['reasoning', 'analyzing', 'generating', 'error', 'complete'].includes(value);
}

/**
 * Type guard to check if a value is a valid AgentStatus.
 */
export function isAgentStatus(value: string): value is AgentStatus {
  return ['pending', 'active', 'complete', 'error'].includes(value);
}

/**
 * Type guard to check if a value is a valid PhaseStatus.
 */
export function isPhaseStatus(value: string): value is PhaseStatus {
  return ['pending', 'active', 'complete', 'error'].includes(value);
}

/**
 * Type guard to check if a value is a valid SyntaxTokenType.
 */
export function isSyntaxTokenType(value: string): value is SyntaxTokenType {
  return [
    'keyword', 'function', 'string', 'number', 'comment', 'operator',
    'variable', 'class', 'property', 'type', 'tag', 'attribute', 'punctuation', 'plain'
  ].includes(value);
}

/**
 * Type guard to check if a value is a valid CodeLanguage.
 */
export function isCodeLanguage(value: string): value is CodeLanguage {
  return [
    'typescript', 'javascript', 'tsx', 'jsx', 'html', 'css', 'scss',
    'json', 'markdown', 'python', 'rust', 'go', 'sql', 'bash', 'yaml',
    'plaintext', 'plain'
  ].includes(value);
}

/**
 * Extracts the syntax token type from code content based on common patterns.
 * This is a simple heuristic-based approach for quick token classification.
 *
 * @param content - The code content to analyze
 * @param language - The programming language for context
 * @returns The detected syntax token type
 */
export function extractSyntaxTokenType(
  content: string,
  language: CodeLanguage = 'typescript'
): SyntaxTokenType {
  const trimmed = content.trim();

  // Keywords for TypeScript/JavaScript
  const tsKeywords = [
    'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'instanceof', 'import', 'export', 'from', 'default', 'async', 'await',
    'extends', 'implements', 'public', 'private', 'protected', 'static',
    'readonly', 'abstract', 'as', 'is', 'in', 'of', 'null', 'undefined',
    'true', 'false', 'this', 'super', 'void', 'never', 'any', 'unknown'
  ];

  // Check for comments
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return 'comment';
  }

  // Check for strings
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return 'string';
  }

  // Check for numbers
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    return 'number';
  }

  // Check for keywords
  if (tsKeywords.includes(trimmed)) {
    return 'keyword';
  }

  // Check for operators
  if (/^[+\-*/%=<>!&|^~?:]+$/.test(trimmed)) {
    return 'operator';
  }

  // Check for punctuation
  if (/^[{}[\]();,.]$/.test(trimmed)) {
    return 'punctuation';
  }

  // Check for HTML/JSX tags
  if (language === 'tsx' || language === 'jsx' || language === 'html') {
    if (/^<\/?[a-zA-Z][a-zA-Z0-9]*/.test(trimmed)) {
      return 'tag';
    }
  }

  // Check for function calls (ends with parenthesis or arrow)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(trimmed) || trimmed.includes('=>')) {
    return 'function';
  }

  // Check for class names (PascalCase)
  if (/^[A-Z][a-zA-Z0-9]*$/.test(trimmed)) {
    return 'class';
  }

  // Check for type annotations
  if (trimmed.includes(':') || trimmed.includes('<') || trimmed.includes('>')) {
    return 'type';
  }

  // Default to variable
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmed)) {
    return 'variable';
  }

  return 'plain';
}

/**
 * Gets the color class for an event or status type.
 *
 * @param type - The event type, agent status, or phase status
 * @returns The corresponding Tailwind CSS color class
 */
export function getColorForType(
  type: ThoughtType | AgentStatus | PhaseStatus
): string {
  return DEFAULT_EVENT_COLORS[type] || 'text-gray-400 bg-gray-400/10';
}

/**
 * Gets the color class for a syntax token type.
 *
 * @param type - The syntax token type
 * @returns The corresponding Tailwind CSS color class
 */
export function getColorForSyntax(type: SyntaxTokenType): string {
  return DEFAULT_SYNTAX_COLORS[type] || 'text-gray-200';
}

/**
 * Converts a Unix timestamp to a Date object.
 * Useful for components that need Date objects for formatting.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Date object
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp);
}

/**
 * Formats a timestamp for display.
 * Shows relative time for recent thoughts, absolute time for older ones.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return seconds <= 1 ? 'just now' : `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// =============================================================================
// CONVERSION UTILITIES (AgentActivityEvent Integration)
// =============================================================================

/**
 * Converts an AgentActivityEvent to a ThoughtItem for display in ThoughtStream.
 * This bridges the gap between the agent-activity system and the Neural Canvas.
 *
 * @param event - The AgentActivityEvent from the agent-activity system
 * @returns A ThoughtItem for the ThoughtStream component
 */
export function agentEventToThought(event: AgentActivityEvent): ThoughtItem {
  // Map AgentActivityEventType to ThoughtType
  const typeMap: Record<string, ThoughtType> = {
    thinking: 'reasoning',
    file_read: 'analyzing',
    file_write: 'generating',
    file_edit: 'generating',
    tool_call: 'analyzing',
    status: 'reasoning',
    verification: 'complete',
    error: 'error',
  };

  return {
    id: event.id,
    type: typeMap[event.type] || 'reasoning',
    content: event.content,
    timestamp: event.timestamp,
    isActive: event.type === 'thinking' || event.type === 'status',
    agentId: event.agentId,
    agentName: event.agentName,
  };
}

/**
 * Converts an AgentActivityPhase to a PhaseInfo for display in PhaseTimeline.
 *
 * @param phase - The phase name from AgentActivityPhase
 * @param index - The index of the phase (for ID generation)
 * @param currentPhase - The current active phase (for status determination)
 * @returns A PhaseInfo for the PhaseTimeline component
 */
export function activityPhaseToPhaseInfo(
  phase: AgentActivityPhase,
  index: number,
  currentPhase?: AgentActivityPhase | null
): PhaseInfo {
  // Map phase names to display information
  const phaseDetails: Record<AgentActivityPhase, { name: string; description: string; icon: string }> = {
    thinking: { name: 'Thinking', description: 'Analyzing the request and planning approach', icon: 'brain' },
    planning: { name: 'Planning', description: 'Creating implementation strategy', icon: 'clipboard-list' },
    coding: { name: 'Coding', description: 'Writing and generating code', icon: 'code' },
    testing: { name: 'Testing', description: 'Running tests and validations', icon: 'test-tube' },
    verifying: { name: 'Verifying', description: 'Checking quality and completeness', icon: 'check-circle' },
    integrating: { name: 'Integrating', description: 'Merging changes into codebase', icon: 'git-merge' },
    deploying: { name: 'Deploying', description: 'Deploying to production', icon: 'rocket' },
  };

  const details = phaseDetails[phase];

  // Determine status based on current phase
  let status: PhaseStatus = 'pending';
  const phases: AgentActivityPhase[] = ['thinking', 'planning', 'coding', 'testing', 'verifying', 'integrating', 'deploying'];
  const currentIndex = currentPhase ? phases.indexOf(currentPhase) : -1;
  const thisIndex = phases.indexOf(phase);

  if (currentIndex === thisIndex) {
    status = 'active';
  } else if (currentIndex > thisIndex) {
    status = 'complete';
  }

  return {
    id: `phase-${index}-${phase}`,
    name: details.name,
    description: details.description,
    status,
    iconName: details.icon,
  };
}

/**
 * Maps a language string to CodeLanguage type.
 * Handles common variations and extensions.
 *
 * @param language - Language string (e.g., from file extension)
 * @returns Normalized CodeLanguage
 */
export function normalizeLanguage(language: string): CodeLanguage {
  const normalized = language.toLowerCase().trim();

  const languageMap: Record<string, CodeLanguage> = {
    'ts': 'typescript',
    'typescript': 'typescript',
    'js': 'javascript',
    'javascript': 'javascript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
    'py': 'python',
    'python': 'python',
    'rs': 'rust',
    'rust': 'rust',
    'go': 'go',
    'golang': 'go',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'shell': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'txt': 'plaintext',
    'text': 'plaintext',
    'plaintext': 'plaintext',
    'plain': 'plain',
  };

  return languageMap[normalized] || 'plaintext';
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export relevant types from agent-activity for convenience
export type { AgentActivityEvent, AgentActivityPhase } from '../../types/agent-activity';

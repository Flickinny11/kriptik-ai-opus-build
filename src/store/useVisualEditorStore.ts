/**
 * Visual Editor Store - State management for the Visual Property Editor
 *
 * Manages element selection, property editing, point-and-prompt interactions,
 * multi-selection, and visual editor state for the KripTik AI builder.
 *
 * Integrates with:
 * - useEditorStore (file/cursor sync)
 * - Design tokens system
 * - Anti-slop detection
 * - Build loop verification
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { API_URL, authenticatedFetch } from '../lib/api-config';

// ============================================================================
// Types
// ============================================================================

export interface ElementStyles {
  // Layout
  display?: 'flex' | 'grid' | 'block' | 'inline' | 'inline-flex' | 'inline-grid' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;

  // Spacing
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;

  // Sizing
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;

  // Colors
  backgroundColor?: string;
  color?: string;
  borderColor?: string;

  // Typography
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';

  // Borders
  borderWidth?: string;
  borderRadius?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';

  // Effects
  boxShadow?: string;
  opacity?: string;
  backdropFilter?: string;

  // Transitions
  transition?: string;
  transform?: string;
}

export interface SelectedElement {
  id: string;
  tagName: string;
  componentName?: string;
  className?: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn?: number;
  domPath: string;
  reactComponentPath?: string;
  currentStyles: ElementStyles;
  computedStyles?: Record<string, string>;
  tailwindClasses?: string[];
  props?: Record<string, unknown>;
  children?: string[];
  parentElement?: string;
  siblingElements?: string[];
}

export interface PendingStyleChange {
  id: string;
  elementId: string;
  property: keyof ElementStyles;
  oldValue: string | undefined;
  newValue: string;
  tailwindClass?: string;
  timestamp: number;
}

export interface PromptHistoryEntry {
  id: string;
  elementId: string;
  prompt: string;
  response: string;
  appliedChanges: string[];
  timestamp: number;
  success: boolean;
}

export interface AntiSlopWarning {
  type: 'color' | 'gradient' | 'pattern' | 'soul-mismatch';
  message: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

// ============================================================================
// Store Interface
// ============================================================================

interface VisualEditorState {
  // Panel visibility
  isPanelOpen: boolean;
  activeTab: 'properties' | 'props' | 'tree' | 'history';

  // Selection state
  selectionMode: 'single' | 'multi' | 'drag' | 'off';
  selectedElements: SelectedElement[];
  hoveredElement: SelectedElement | null;

  // Point-and-prompt
  isPromptOpen: boolean;
  promptAnchor: { x: number; y: number } | null;
  promptInput: string;
  isPromptProcessing: boolean;
  promptHistory: PromptHistoryEntry[];

  // Property editing
  pendingChanges: PendingStyleChange[];
  isApplyingChanges: boolean;
  lastAppliedChange: PendingStyleChange | null;

  // Drag-and-drop
  dragSource: SelectedElement | null;
  dropTarget: { element: SelectedElement; position: 'before' | 'after' | 'inside' } | null;
  isDragging: boolean;

  // Change history (undo/redo)
  changeHistory: PendingStyleChange[][];
  historyIndex: number;

  // Anti-slop integration
  antiSlopWarnings: AntiSlopWarning[];

  // App soul alignment
  currentAppSoul: string | null;
  soulMismatchWarnings: string[];

  // Design tokens
  designTokens: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
    typography: Record<string, { size: string; lineHeight: string }>;
    borderRadius: Record<string, string>;
  } | null;

  // Connection status
  isConnected: boolean;
  sandboxUrl: string | null;
}

interface VisualEditorActions {
  // Panel actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveTab: (tab: VisualEditorState['activeTab']) => void;

  // Selection actions
  setSelectionMode: (mode: VisualEditorState['selectionMode']) => void;
  selectElement: (element: SelectedElement, additive?: boolean) => void;
  deselectElement: (elementId: string) => void;
  clearSelection: () => void;
  setHoveredElement: (element: SelectedElement | null) => void;

  // Point-and-prompt actions
  openPrompt: (anchor: { x: number; y: number }) => void;
  closePrompt: () => void;
  setPromptInput: (input: string) => void;
  submitPrompt: () => Promise<void>;
  addPromptHistory: (entry: PromptHistoryEntry) => void;

  // Property editing actions
  updateProperty: (elementId: string, property: keyof ElementStyles, value: string) => void;
  addPendingChange: (change: Omit<PendingStyleChange, 'id' | 'timestamp'>) => void;
  removePendingChange: (changeId: string) => void;
  applyPendingChanges: () => Promise<void>;
  revertPendingChanges: () => void;

  // Drag-and-drop actions
  startDrag: (element: SelectedElement) => void;
  updateDropTarget: (target: { element: SelectedElement; position: 'before' | 'after' | 'inside' } | null) => void;
  endDrag: () => void;
  executeDrop: () => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushToHistory: (changes: PendingStyleChange[]) => void;

  // Anti-slop actions
  addAntiSlopWarning: (warning: AntiSlopWarning) => void;
  clearAntiSlopWarnings: () => void;
  checkAntiSlop: (styles: ElementStyles) => AntiSlopWarning[];

  // App soul actions
  setAppSoul: (soul: string | null) => void;
  checkSoulAlignment: (styles: ElementStyles) => string[];

  // Design tokens
  setDesignTokens: (tokens: VisualEditorState['designTokens']) => void;
  getTokenValue: (category: string, key: string) => string | undefined;

  // Connection
  setConnected: (connected: boolean) => void;
  setSandboxUrl: (url: string | null) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: VisualEditorState = {
  isPanelOpen: false,
  activeTab: 'properties',

  selectionMode: 'off',
  selectedElements: [],
  hoveredElement: null,

  isPromptOpen: false,
  promptAnchor: null,
  promptInput: '',
  isPromptProcessing: false,
  promptHistory: [],

  pendingChanges: [],
  isApplyingChanges: false,
  lastAppliedChange: null,

  dragSource: null,
  dropTarget: null,
  isDragging: false,

  changeHistory: [],
  historyIndex: -1,

  antiSlopWarnings: [],

  currentAppSoul: null,
  soulMismatchWarnings: [],

  designTokens: null,

  isConnected: false,
  sandboxUrl: null,
};

// ============================================================================
// Anti-Slop Patterns (from design-validator.ts)
// ============================================================================

const SLOP_PATTERNS = {
  colors: {
    // Purple-to-pink gradients are banned
    purplePink: /from-purple.*to-pink|from-violet.*to-pink|from-fuchsia.*to-pink/i,
    // Blue-to-purple gradients are banned
    bluePurple: /from-blue.*to-purple|from-indigo.*to-purple|from-sky.*to-violet/i,
    // Generic grays without intent
    genericGray: /^#(808080|888888|999999|aaaaaa|bbbbbb|cccccc)$/i,
  },
  patterns: {
    // Flat white/light backgrounds
    flatWhite: /^(#ffffff|#fff|white|#f[0-9a-f]{5})$/i,
  },
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useVisualEditorStore = create<VisualEditorState & VisualEditorActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Panel actions
    openPanel: () => set({ isPanelOpen: true }),
    closePanel: () => set({ isPanelOpen: false }),
    togglePanel: () => set(state => ({ isPanelOpen: !state.isPanelOpen })),
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Selection actions
    setSelectionMode: (mode) => set({ selectionMode: mode }),

    selectElement: (element, additive = false) => set(state => {
      if (additive && state.selectionMode === 'multi') {
        // Check if already selected
        const exists = state.selectedElements.some(el => el.id === element.id);
        if (exists) {
          return {
            selectedElements: state.selectedElements.filter(el => el.id !== element.id),
          };
        }
        return {
          selectedElements: [...state.selectedElements, element],
          isPanelOpen: true,
        };
      }
      return {
        selectedElements: [element],
        isPanelOpen: true,
      };
    }),

    deselectElement: (elementId) => set(state => ({
      selectedElements: state.selectedElements.filter(el => el.id !== elementId),
    })),

    clearSelection: () => set({
      selectedElements: [],
      pendingChanges: [],
    }),

    setHoveredElement: (element) => set({ hoveredElement: element }),

    // Point-and-prompt actions
    openPrompt: (anchor) => set({
      isPromptOpen: true,
      promptAnchor: anchor,
      promptInput: '',
    }),

    closePrompt: () => set({
      isPromptOpen: false,
      promptAnchor: null,
      promptInput: '',
    }),

    setPromptInput: (input) => set({ promptInput: input }),

    submitPrompt: async () => {
      const state = get();
      if (!state.promptInput.trim() || state.selectedElements.length === 0) {
        return;
      }

      set({ isPromptProcessing: true });

      try {
        const response = await authenticatedFetch(`${API_URL}/api/visual-editor/element-prompt`, {
          method: 'POST',
          body: JSON.stringify({
            elements: state.selectedElements.map(el => ({
              id: el.id,
              sourceFile: el.sourceFile,
              sourceLine: el.sourceLine,
              currentStyles: el.currentStyles,
              tailwindClasses: el.tailwindClasses,
              componentName: el.componentName,
            })),
            prompt: state.promptInput,
            appSoul: state.currentAppSoul,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to process prompt');
        }

        const result = await response.json();

        // Add to history
        const historyEntry: PromptHistoryEntry = {
          id: crypto.randomUUID(),
          elementId: state.selectedElements[0].id,
          prompt: state.promptInput,
          response: result.message || 'Changes applied',
          appliedChanges: result.appliedChanges || [],
          timestamp: Date.now(),
          success: result.success !== false,
        };

        set(state => ({
          promptHistory: [historyEntry, ...state.promptHistory].slice(0, 50),
          isPromptOpen: false,
          promptInput: '',
        }));
      } catch (error) {
        console.error('[VisualEditor] Prompt submission failed:', error);

        const historyEntry: PromptHistoryEntry = {
          id: crypto.randomUUID(),
          elementId: state.selectedElements[0]?.id || 'unknown',
          prompt: state.promptInput,
          response: error instanceof Error ? error.message : 'Unknown error',
          appliedChanges: [],
          timestamp: Date.now(),
          success: false,
        };

        set(state => ({
          promptHistory: [historyEntry, ...state.promptHistory].slice(0, 50),
        }));
      } finally {
        set({ isPromptProcessing: false });
      }
    },

    addPromptHistory: (entry) => set(state => ({
      promptHistory: [entry, ...state.promptHistory].slice(0, 50),
    })),

    // Property editing actions
    updateProperty: (elementId, property, value) => {
      const state = get();
      const element = state.selectedElements.find(el => el.id === elementId);
      if (!element) return;

      const oldValue = element.currentStyles[property];

      // Check for anti-slop violations
      const testStyles = { ...element.currentStyles, [property]: value };
      const warnings = get().checkAntiSlop(testStyles);

      set(state => ({
        antiSlopWarnings: warnings,
        selectedElements: state.selectedElements.map(el =>
          el.id === elementId
            ? { ...el, currentStyles: { ...el.currentStyles, [property]: value } }
            : el
        ),
      }));

      // Add to pending changes
      get().addPendingChange({
        elementId,
        property,
        oldValue: oldValue as string | undefined,
        newValue: value,
      });
    },

    addPendingChange: (change) => set(state => ({
      pendingChanges: [
        ...state.pendingChanges.filter(c =>
          !(c.elementId === change.elementId && c.property === change.property)
        ),
        {
          ...change,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

    removePendingChange: (changeId) => set(state => ({
      pendingChanges: state.pendingChanges.filter(c => c.id !== changeId),
    })),

    applyPendingChanges: async () => {
      const state = get();
      if (state.pendingChanges.length === 0) return;

      set({ isApplyingChanges: true });

      try {
        const response = await authenticatedFetch(`${API_URL}/api/visual-editor/apply-styles`, {
          method: 'POST',
          body: JSON.stringify({
            changes: state.pendingChanges,
            elements: state.selectedElements,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to apply changes');
        }

        // Push to history for undo
        get().pushToHistory(state.pendingChanges);

        set({
          pendingChanges: [],
          lastAppliedChange: state.pendingChanges[state.pendingChanges.length - 1],
        });
      } catch (error) {
        console.error('[VisualEditor] Failed to apply changes:', error);
      } finally {
        set({ isApplyingChanges: false });
      }
    },

    revertPendingChanges: () => {
      const state = get();

      // Revert element styles to before pending changes
      set(state => ({
        selectedElements: state.selectedElements.map(el => {
          const changes = state.pendingChanges.filter(c => c.elementId === el.id);
          const revertedStyles = { ...el.currentStyles };

          for (const change of changes) {
            if (change.oldValue !== undefined) {
              revertedStyles[change.property] = change.oldValue as any;
            } else {
              delete revertedStyles[change.property];
            }
          }

          return { ...el, currentStyles: revertedStyles };
        }),
        pendingChanges: [],
        antiSlopWarnings: [],
      }));
    },

    // Drag-and-drop actions
    startDrag: (element) => set({
      dragSource: element,
      isDragging: true,
      selectionMode: 'drag',
    }),

    updateDropTarget: (target) => set({ dropTarget: target }),

    endDrag: () => set({
      dragSource: null,
      dropTarget: null,
      isDragging: false,
      selectionMode: 'single',
    }),

    executeDrop: async () => {
      const state = get();
      if (!state.dragSource || !state.dropTarget) return;

      try {
        await authenticatedFetch(`${API_URL}/api/visual-editor/reorder-elements`, {
          method: 'POST',
          body: JSON.stringify({
            source: {
              sourceFile: state.dragSource.sourceFile,
              sourceLine: state.dragSource.sourceLine,
              domPath: state.dragSource.domPath,
            },
            target: {
              sourceFile: state.dropTarget.element.sourceFile,
              sourceLine: state.dropTarget.element.sourceLine,
              domPath: state.dropTarget.element.domPath,
              position: state.dropTarget.position,
            },
          }),
        });
      } catch (error) {
        console.error('[VisualEditor] Drop operation failed:', error);
      } finally {
        get().endDrag();
      }
    },

    // Undo/Redo
    undo: () => {
      const state = get();
      if (state.historyIndex < 0) return;

      const changesToUndo = state.changeHistory[state.historyIndex];

      // Revert styles
      set(state => ({
        selectedElements: state.selectedElements.map(el => {
          const changes = changesToUndo.filter(c => c.elementId === el.id);
          const revertedStyles = { ...el.currentStyles };

          for (const change of changes) {
            if (change.oldValue !== undefined) {
              revertedStyles[change.property] = change.oldValue as any;
            } else {
              delete revertedStyles[change.property];
            }
          }

          return { ...el, currentStyles: revertedStyles };
        }),
        historyIndex: state.historyIndex - 1,
      }));
    },

    redo: () => {
      const state = get();
      if (state.historyIndex >= state.changeHistory.length - 1) return;

      const changesToRedo = state.changeHistory[state.historyIndex + 1];

      set(state => ({
        selectedElements: state.selectedElements.map(el => {
          const changes = changesToRedo.filter(c => c.elementId === el.id);
          const updatedStyles = { ...el.currentStyles };

          for (const change of changes) {
            updatedStyles[change.property] = change.newValue as any;
          }

          return { ...el, currentStyles: updatedStyles };
        }),
        historyIndex: state.historyIndex + 1,
      }));
    },

    pushToHistory: (changes) => set(state => {
      const newHistory = state.changeHistory.slice(0, state.historyIndex + 1);
      newHistory.push(changes);

      // Keep max 50 history entries
      if (newHistory.length > 50) {
        newHistory.shift();
      }

      return {
        changeHistory: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

    // Anti-slop actions
    addAntiSlopWarning: (warning) => set(state => ({
      antiSlopWarnings: [...state.antiSlopWarnings, warning],
    })),

    clearAntiSlopWarnings: () => set({ antiSlopWarnings: [] }),

    checkAntiSlop: (styles) => {
      const warnings: AntiSlopWarning[] = [];

      // Check background color
      if (styles.backgroundColor) {
        if (SLOP_PATTERNS.patterns.flatWhite.test(styles.backgroundColor)) {
          warnings.push({
            type: 'color',
            message: 'Flat white/light backgrounds are not allowed',
            suggestion: 'Use dark backgrounds like #0a0a0f or rgba(10, 10, 15, 0.95)',
            severity: 'error',
          });
        }
        if (SLOP_PATTERNS.colors.genericGray.test(styles.backgroundColor)) {
          warnings.push({
            type: 'color',
            message: 'Generic gray colors lack design intent',
            suggestion: 'Use themed colors from your design tokens',
            severity: 'warning',
          });
        }
      }

      // Check for banned gradients in className or tailwind classes
      const state = get();
      const element = state.selectedElements[0];
      if (element?.tailwindClasses) {
        const classString = element.tailwindClasses.join(' ');
        if (SLOP_PATTERNS.colors.purplePink.test(classString)) {
          warnings.push({
            type: 'gradient',
            message: 'Purple-to-pink gradients are banned',
            suggestion: 'Use amber/orange gradients: from-amber-500 to-orange-500',
            severity: 'error',
          });
        }
        if (SLOP_PATTERNS.colors.bluePurple.test(classString)) {
          warnings.push({
            type: 'gradient',
            message: 'Blue-to-purple gradients are banned',
            suggestion: 'Use cyan/teal gradients: from-cyan-500 to-teal-500',
            severity: 'error',
          });
        }
      }

      return warnings;
    },

    // App soul actions
    setAppSoul: (soul) => set({ currentAppSoul: soul }),

    checkSoulAlignment: (styles) => {
      const state = get();
      const warnings: string[] = [];

      if (!state.currentAppSoul) return warnings;

      // Soul-specific checks (based on app-soul.ts)
      const soulRules: Record<string, { forbiddenPatterns: RegExp[]; requiredPatterns?: RegExp[] }> = {
        'professional-trust': {
          forbiddenPatterns: [/neon|glow-.*intense|animate-pulse/i],
        },
        'developer-tools': {
          forbiddenPatterns: [/rounded-3xl|rounded-full|animate-bounce/i],
        },
        'gaming-energy': {
          forbiddenPatterns: [/bg-white|text-gray-[1-4]00/i],
        },
      };

      const rules = soulRules[state.currentAppSoul];
      if (rules) {
        const styleString = JSON.stringify(styles);
        for (const pattern of rules.forbiddenPatterns) {
          if (pattern.test(styleString)) {
            warnings.push(`Style conflicts with "${state.currentAppSoul}" app soul`);
          }
        }
      }

      return warnings;
    },

    // Design tokens
    setDesignTokens: (tokens) => set({ designTokens: tokens }),

    getTokenValue: (category, key) => {
      const state = get();
      if (!state.designTokens) return undefined;

      const cat = state.designTokens[category as keyof typeof state.designTokens];
      if (typeof cat === 'object' && cat !== null) {
        return (cat as Record<string, unknown>)[key] as string | undefined;
      }
      return undefined;
    },

    // Connection
    setConnected: (connected) => set({ isConnected: connected }),
    setSandboxUrl: (url) => set({ sandboxUrl: url }),

    // Reset
    reset: () => set(initialState),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectPrimarySelectedElement = (state: VisualEditorState) =>
  state.selectedElements[0] ?? null;

export const selectHasSelection = (state: VisualEditorState) =>
  state.selectedElements.length > 0;

export const selectIsMultiSelect = (state: VisualEditorState) =>
  state.selectedElements.length > 1;

export const selectHasPendingChanges = (state: VisualEditorState) =>
  state.pendingChanges.length > 0;

export const selectCanUndo = (state: VisualEditorState) =>
  state.historyIndex >= 0;

export const selectCanRedo = (state: VisualEditorState) =>
  state.historyIndex < state.changeHistory.length - 1;

export const selectHasAntiSlopErrors = (state: VisualEditorState) =>
  state.antiSlopWarnings.some(w => w.severity === 'error');

export default useVisualEditorStore;

/**
 * Visual Editor - Index
 *
 * Main export file for the Visual Editor system.
 * Provides visual property editing with:
 * - Property controls for styling
 * - Design token integration
 * - Live preview synchronization
 * - Code generation and sync
 * - Point-and-prompt AI assistance
 */

// Main panel component
export { VisualPropertyPanel } from './VisualPropertyPanel';
export { default as VisualPropertyPanelDefault } from './VisualPropertyPanel';

// Control components
export {
  ColorPropertyControl,
  SpacingPropertyControl,
  TypographyControl,
  LayoutControl,
  BorderControl,
  PromptInput,
  AntiSlopWarnings,
  PropsInspector,
} from './controls';

// Control types
export type { PropType, PropDefinition } from './controls';

// Services
export {
  designTokensBridge,
  KRIPTIK_TOKENS,
  livePreviewSync,
  PREVIEW_INJECTION_SCRIPT,
  codeSyncService,
  stylesToTailwind,
  stylesToCSS,
  stylesToInline,
  generateClassName,
} from './services';

// Service types
export type {
  DesignTokens,
  ElementInfo,
  StyleApplicationResult,
  PreviewMessage,
  PreviewMessageType,
  StyleOutputFormat,
  CodeChange,
  StyleToCodeResult,
} from './services';

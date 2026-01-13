/**
 * Builder V2 Components
 *
 * New Replit-style builder interface with:
 * - Split panel layout (Chat + Preview)
 * - Agent browser verification window
 * - Status bar with phase/cost tracking
 * - Premium dark theme with amber accents
 */

// Design tokens
export * from './design-tokens';
export { default as designTokens } from './design-tokens';

// Layout
export { BuilderLayoutV2, default } from './BuilderLayoutV2';

// Panels
export { ChatPanelV2 } from './ChatPanelV2';
export { PreviewPanelV2 } from './PreviewPanelV2';
export { StatusBarV2 } from './StatusBarV2';

// Controls
export { ViewportSelector } from './ViewportSelector';

// Chat Cards
export * from './chat-cards';

// Types
export type { BuildPhase, BuildMode } from './ChatPanelV2';
export type { ViewportType } from './ViewportSelector';

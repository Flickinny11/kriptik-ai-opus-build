/**
 * Glass Component Library
 * 
 * Premium glass morphism components for KripTik AI.
 * Ensures visual consistency across the application with
 * dark and light variants, smooth animations, and premium styling.
 */

// Core Layout Components
export { GlassPanel, default as GlassPanelDefault } from './GlassPanel';
export { GlassCard, default as GlassCardDefault } from './GlassCard';
export { GlassModal, default as GlassModalDefault } from './GlassModal';

// Interactive Components
export { GlassButton, default as GlassButtonDefault } from './GlassButton';

// Form Components
export { GlassInput, default as GlassInputDefault } from './GlassInput';
export { GlassTextarea, default as GlassTextareaDefault } from './GlassTextarea';
export { GlassSelect, default as GlassSelectDefault } from './GlassSelect';
export { GlassToggle, default as GlassToggleDefault } from './GlassToggle';

// Display Components
export { GlassBadge, default as GlassBadgeDefault } from './GlassBadge';

// Re-export types for convenience
export type { } from './GlassPanel';
export type { } from './GlassCard';
export type { } from './GlassButton';
export type { } from './GlassInput';
export type { } from './GlassTextarea';
export type { } from './GlassSelect';
export type { } from './GlassToggle';
export type { } from './GlassModal';
export type { } from './GlassBadge';

// Glass design tokens for external use
export const GLASS_TOKENS = {
  dark: {
    bg: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    bgSubtle: 'linear-gradient(145deg, rgba(25,25,30,0.95) 0%, rgba(15,15,20,0.98) 100%)',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(200,255,100,0.3)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.6)',
  },
  light: {
    bg: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
    bgSubtle: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(248,250,252,0.5) 100%)',
    border: 'rgba(255,255,255,0.4)',
    borderHover: 'rgba(255,180,140,0.5)',
    text: '#1e1e24',
    textMuted: 'rgba(0,0,0,0.6)',
  },
  blur: 'blur(40px) saturate(180%)',
  glowAccent: 'rgba(200,255,100,0.3)',
  glowAmber: 'rgba(255,150,100,0.2)',
  glowCyan: 'rgba(6,182,212,0.2)',
} as const;


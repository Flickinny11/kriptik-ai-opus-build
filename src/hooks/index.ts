/**
 * Hooks Index
 *
 * Exports all custom React hooks.
 */

export { useCredentials } from './useCredentials';
export { useContextSync } from './useContextSync';
export { useWorkflow } from './useWorkflow';

// Responsive and accessibility hooks
export { useResponsiveLayout } from './useResponsiveLayout';
export type {
    DeviceType,
    LayoutMode,
    Orientation,
    ResponsiveLayoutState,
    ResponsiveBreakpoints,
} from './useResponsiveLayout';

export { useReducedMotion } from './useReducedMotion';
export type {
    MotionConfig,
    AnimationProps,
    UseReducedMotionReturn,
} from './useReducedMotion';

export { useSwipeGesture } from './useSwipeGesture';
export type {
    SwipeDirection,
    SwipeConfig,
    SwipeHandlers,
    SwipeGestureReturn,
} from './useSwipeGesture';


/**
 * Premium Animation System for KripTik AI
 *
 * A comprehensive animation library providing consistent,
 * premium-feeling animations across the application.
 *
 * Usage:
 * ```tsx
 * import { fadeInUp, transitionSpring, FadeIn, useScrollAnimation } from '@/lib/animations';
 * ```
 */

// Variants - Predefined animation configurations
export {
  // Entrance animations
  fadeInUp,
  fadeInDown,
  scaleIn,
  slideInLeft,
  slideInRight,

  // Stagger animations
  staggerContainer,
  staggerContainerFast,
  staggerItem,

  // Interactive animations
  hoverScale,
  hoverLift,
  tapScale,
  buttonPress,

  // Glow animations
  pulseGlow,
  warmGlowPulse,

  // Progress animations
  progressFill,
  spinnerRotate,

  // Card animations
  cardFlip,

  // Notification animations
  toastSlideIn,

  // Text animations
  typewriter,
  wordReveal,

  // Loading animations
  skeletonShimmer,

  // Page animations
  pageFade,
  pageSlideUp,
} from './variants';

// Transitions - Timing and easing configurations
export {
  // Easing curves
  EASE_PREMIUM,
  EASE_SNAP,
  EASE_SMOOTH,
  EASE_ELASTIC,
  EASE_SOFT,

  // Transition presets
  transitionDefault,
  transitionFast,
  transitionSlow,
  transitionSpring,
  transitionSpringSoft,
  transitionSpringBouncy,
  transitionSpringStiff,

  // Specialized transitions
  transitionModal,
  transitionDropdown,
  transitionToast,
  transitionPage,
  transitionHover,
  transitionPress,
  transitionSkeleton,
  transitionPulse,
  transitionRotate,

  // Stagger configurations
  staggerDefault,
  staggerFast,
  staggerSlow,
  staggerExit,

  // Constants
  DELAY,
  DURATION,
} from './transitions';

// Hooks - Custom animation hooks
export {
  useScrollAnimation,
  useStaggerAnimation,
  useCounterAnimation,
  useSmoothValue,
  useTypewriter,
  useHoverAnimation,
  useAnimationPreference,
  useAnimationSequence,
} from './hooks';

// Components - Ready-to-use animated components
export {
  FadeIn,
  ScaleIn,
  Stagger,
  StaggerChild,
  Presence,
  ModalAnimation,
  ToastAnimation,
  PageTransition,
  HoverScale,
  Pulse,
  Skeleton,
  LayoutAnimationGroup,
} from './components';


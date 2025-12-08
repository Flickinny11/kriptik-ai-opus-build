/**
 * Premium Transition Presets for KripTik AI
 * 
 * Reusable transition configurations for Framer Motion.
 * Based on professional animation curves used in premium apps.
 */

import type { Transition } from 'framer-motion';

// ============================================
// Easing Curves (Cubic Bezier)
// ============================================

/**
 * Premium ease - smooth deceleration
 * Great for entrances and general UI interactions
 */
export const EASE_PREMIUM: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Snap ease - quick start, smooth end
 * Perfect for button presses and quick interactions
 */
export const EASE_SNAP: [number, number, number, number] = [0.35, 0.68, 0.37, 1];

/**
 * Smooth ease - balanced acceleration/deceleration
 * Good for general-purpose animations
 */
export const EASE_SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];

/**
 * Elastic feel ease - overshoots slightly
 * Adds playfulness to animations
 */
export const EASE_ELASTIC: [number, number, number, number] = [0.175, 0.885, 0.32, 1.275];

/**
 * Soft ease - very gentle
 * For subtle, ambient animations
 */
export const EASE_SOFT: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

// ============================================
// Transition Presets
// ============================================

/**
 * Default transition for general use
 */
export const transitionDefault: Transition = {
  duration: 0.3,
  ease: EASE_PREMIUM,
};

/**
 * Fast transition for micro-interactions
 */
export const transitionFast: Transition = {
  duration: 0.15,
  ease: EASE_SNAP,
};

/**
 * Slow, smooth transition for emphasis
 */
export const transitionSlow: Transition = {
  duration: 0.5,
  ease: EASE_SMOOTH,
};

/**
 * Spring transition for bouncy animations
 */
export const transitionSpring: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
};

/**
 * Soft spring - less bounce
 */
export const transitionSpringSoft: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 200,
};

/**
 * Bouncy spring - more playful
 */
export const transitionSpringBouncy: Transition = {
  type: 'spring',
  damping: 15,
  stiffness: 400,
};

/**
 * Stiff spring - quick and precise
 */
export const transitionSpringStiff: Transition = {
  type: 'spring',
  damping: 35,
  stiffness: 500,
};

// ============================================
// Specialized Transitions
// ============================================

/**
 * Modal entrance
 */
export const transitionModal: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
  duration: 0.4,
};

/**
 * Dropdown menu
 */
export const transitionDropdown: Transition = {
  duration: 0.2,
  ease: EASE_SNAP,
};

/**
 * Toast notification
 */
export const transitionToast: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 400,
};

/**
 * Page transition
 */
export const transitionPage: Transition = {
  duration: 0.45,
  ease: EASE_PREMIUM,
};

/**
 * Hover effect
 */
export const transitionHover: Transition = {
  duration: 0.25,
  ease: EASE_SMOOTH,
};

/**
 * Scale press effect
 */
export const transitionPress: Transition = {
  duration: 0.1,
  ease: EASE_SNAP,
};

/**
 * Skeleton loading shimmer
 */
export const transitionSkeleton: Transition = {
  duration: 1.5,
  repeat: Infinity,
  ease: 'linear',
};

/**
 * Pulse/breathe animation
 */
export const transitionPulse: Transition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut',
};

/**
 * Rotation animation
 */
export const transitionRotate: Transition = {
  duration: 1,
  repeat: Infinity,
  ease: 'linear',
};

// ============================================
// Stagger Configurations
// ============================================

/**
 * Default stagger for lists
 */
export const staggerDefault = {
  staggerChildren: 0.08,
  delayChildren: 0.1,
};

/**
 * Fast stagger for quick reveals
 */
export const staggerFast = {
  staggerChildren: 0.04,
  delayChildren: 0.05,
};

/**
 * Slow stagger for emphasis
 */
export const staggerSlow = {
  staggerChildren: 0.12,
  delayChildren: 0.15,
};

/**
 * Exit stagger (reverse direction)
 */
export const staggerExit = {
  staggerChildren: 0.05,
  staggerDirection: -1,
};

// ============================================
// Delay Presets
// ============================================

export const DELAY = {
  none: 0,
  micro: 0.05,
  short: 0.1,
  medium: 0.2,
  long: 0.3,
  slow: 0.5,
} as const;

// ============================================
// Duration Presets
// ============================================

export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.3,
  medium: 0.4,
  slow: 0.5,
  slower: 0.8,
  slowest: 1,
} as const;


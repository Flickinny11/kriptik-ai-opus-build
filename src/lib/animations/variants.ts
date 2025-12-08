/**
 * Premium Animation Variants for KripTik AI
 * 
 * Reusable Framer Motion animation variants for consistent,
 * premium-feeling animations across the application.
 */

import type { Variants } from 'framer-motion';

// ============================================
// Entrance Animations
// ============================================

/**
 * Fade in with slight upward movement
 * Perfect for page loads and content reveals
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
    },
  },
};

/**
 * Fade in with slight downward movement
 * Good for dropdowns and menus
 */
export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Scale up with fade
 * Perfect for modals and cards
 */
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Slide in from left
 * Good for sidebars and panels
 */
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -40,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Slide in from right
 * Good for sidebars and panels
 */
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 40,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// Stagger Container Animations
// ============================================

/**
 * Container that staggers children animations
 * Use with child items that have their own variants
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

/**
 * Faster stagger for smaller lists
 */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Stagger item animation
 * Use as children of staggerContainer
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// Interactive Animations
// ============================================

/**
 * Hover scale effect
 * Add as whileHover={{ scale: 1.02 }}
 */
export const hoverScale = {
  scale: 1.02,
  transition: {
    duration: 0.2,
    ease: [0.23, 1, 0.32, 1],
  },
};

/**
 * Hover lift effect (scale + y movement)
 */
export const hoverLift = {
  scale: 1.02,
  y: -4,
  transition: {
    duration: 0.3,
    ease: [0.23, 1, 0.32, 1],
  },
};

/**
 * Tap/press effect
 */
export const tapScale = {
  scale: 0.98,
  transition: {
    duration: 0.1,
  },
};

/**
 * Button press animation
 */
export const buttonPress: Variants = {
  initial: { scale: 1 },
  hover: { 
    scale: 1.02,
    y: -2,
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  tap: { 
    scale: 0.98,
    y: 0,
    transition: {
      duration: 0.1,
    },
  },
};

// ============================================
// Glow Animations
// ============================================

/**
 * Pulsing glow effect
 * Use with animate prop
 */
export const pulseGlow = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(200, 255, 100, 0.1)',
      '0 0 40px rgba(200, 255, 100, 0.2)',
      '0 0 20px rgba(200, 255, 100, 0.1)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Warm glow pulse (amber)
 */
export const warmGlowPulse = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(255, 150, 100, 0.1)',
      '0 0 40px rgba(255, 150, 100, 0.25)',
      '0 0 20px rgba(255, 150, 100, 0.1)',
    ],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// Progress Animations
// ============================================

/**
 * Progress bar fill animation
 */
export const progressFill: Variants = {
  initial: { width: '0%' },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: {
      duration: 0.8,
      ease: [0.23, 1, 0.32, 1],
    },
  }),
};

/**
 * Spinner rotation
 */
export const spinnerRotate = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================
// Card Flip Animations
// ============================================

/**
 * 3D card flip
 */
export const cardFlip: Variants = {
  front: {
    rotateY: 0,
    transition: {
      duration: 0.6,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  back: {
    rotateY: 180,
    transition: {
      duration: 0.6,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

// ============================================
// Notification Animations
// ============================================

/**
 * Toast notification slide in
 */
export const toastSlideIn: Variants = {
  hidden: {
    opacity: 0,
    x: 100,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 400,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.9,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// Text Animations
// ============================================

/**
 * Typewriter text reveal
 * Use with LayoutGroup and AnimatePresence
 */
export const typewriter: Variants = {
  hidden: { opacity: 0, width: 0 },
  visible: {
    opacity: 1,
    width: 'auto',
    transition: {
      duration: 0.05,
    },
  },
};

/**
 * Word-by-word reveal
 */
export const wordReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.3,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

// ============================================
// Skeleton Loading
// ============================================

/**
 * Skeleton shimmer effect
 */
export const skeletonShimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================
// Page Transitions
// ============================================

/**
 * Page fade transition
 */
export const pageFade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

/**
 * Page slide up transition
 */
export const pageSlideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
};


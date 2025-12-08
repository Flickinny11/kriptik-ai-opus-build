/**
 * Premium Animation Components for KripTik AI
 *
 * Reusable animated wrapper components for common patterns.
 */

import React, { forwardRef } from 'react';
import { motion, AnimatePresence, HTMLMotionProps, LayoutGroup } from 'framer-motion';
import {
  scaleIn,
  staggerItem,
  toastSlideIn,
  pageSlideUp,
} from './variants';
import { transitionSpring } from './transitions';

// ============================================
// FadeIn Component
// ============================================

interface FadeInProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
}

/**
 * Fade in wrapper with optional directional movement
 */
export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(({
  children,
  delay = 0,
  direction = 'up',
  duration = 0.5,
  ...props
}, ref) => {
  const getInitial = () => {
    const base = { opacity: 0 };
    switch (direction) {
      case 'up': return { ...base, y: 20 };
      case 'down': return { ...base, y: -20 };
      case 'left': return { ...base, x: 20 };
      case 'right': return { ...base, x: -20 };
      default: return base;
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitial()}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: [0.23, 1, 0.32, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

FadeIn.displayName = 'FadeIn';

// ============================================
// ScaleIn Component
// ============================================

interface ScaleInProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
}

/**
 * Scale in with spring animation
 */
export const ScaleIn = forwardRef<HTMLDivElement, ScaleInProps>(({
  children,
  delay = 0,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...transitionSpring, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

ScaleIn.displayName = 'ScaleIn';

// ============================================
// Stagger Container Component
// ============================================

interface StaggerProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
}

/**
 * Container that staggers children animations
 */
export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(({
  children,
  staggerDelay = 0.08,
  initialDelay = 0.1,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
        exit: {
          opacity: 0,
          transition: {
            staggerChildren: staggerDelay / 2,
            staggerDirection: -1,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

Stagger.displayName = 'Stagger';

/**
 * Child item for Stagger container
 */
export const StaggerChild = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(({
  children,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={staggerItem}
      {...props}
    >
      {children}
    </motion.div>
  );
});

StaggerChild.displayName = 'StaggerChild';

// ============================================
// Presence Wrapper Component
// ============================================

interface PresenceProps {
  children: React.ReactNode;
  show: boolean;
  mode?: 'sync' | 'wait' | 'popLayout';
}

/**
 * AnimatePresence wrapper for conditional rendering
 */
export function Presence({ children, show, mode = 'wait' }: PresenceProps) {
  return (
    <AnimatePresence mode={mode}>
      {show && children}
    </AnimatePresence>
  );
}

// ============================================
// Modal Wrapper Component
// ============================================

interface ModalAnimationProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
}

/**
 * Animated modal with backdrop
 */
export function ModalAnimation({
  children,
  isOpen,
  onClose,
  closeOnBackdrop = true,
  ...props
}: ModalAnimationProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          {/* Content */}
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              zIndex: 9999,
            }}
            {...props}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Toast Animation Component
// ============================================

interface ToastAnimationProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

/**
 * Animated toast notification
 */
export const ToastAnimation = forwardRef<HTMLDivElement, ToastAnimationProps>(({
  children,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={toastSlideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  );
});

ToastAnimation.displayName = 'ToastAnimation';

// ============================================
// Page Transition Component
// ============================================

interface PageTransitionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

/**
 * Page transition wrapper
 */
export const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(({
  children,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={pageSlideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  );
});

PageTransition.displayName = 'PageTransition';

// ============================================
// Hover Scale Component
// ============================================

interface HoverScaleProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  scale?: number;
  lift?: number;
}

/**
 * Scale and lift on hover
 */
export const HoverScale = forwardRef<HTMLDivElement, HoverScaleProps>(({
  children,
  scale = 1.02,
  lift = 4,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      whileHover={{
        scale,
        y: -lift,
        transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.1 },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

HoverScale.displayName = 'HoverScale';

// ============================================
// Pulse Component
// ============================================

interface PulseProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  color?: string;
}

/**
 * Pulsing glow animation
 */
export const Pulse = forwardRef<HTMLDivElement, PulseProps>(({
  children,
  color = 'rgba(200, 255, 100, 0.3)',
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      animate={{
        boxShadow: [
          `0 0 20px ${color}`,
          `0 0 40px ${color}`,
          `0 0 20px ${color}`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

Pulse.displayName = 'Pulse';

// ============================================
// Skeleton Loader Component
// ============================================

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

/**
 * Animated skeleton loader
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  className = '',
}: SkeletonProps) {
  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
        backgroundSize: '200% 100%',
      }}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ============================================
// Layout Animation Group
// ============================================

interface LayoutAnimationGroupProps {
  children: React.ReactNode;
  id?: string;
}

/**
 * Group for coordinating layout animations
 */
export function LayoutAnimationGroup({ children, id }: LayoutAnimationGroupProps) {
  return (
    <LayoutGroup id={id}>
      {children}
    </LayoutGroup>
  );
}


/**
 * Premium Animation Hooks for KripTik AI
 * 
 * Custom React hooks for common animation patterns.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useInView, useAnimation, useSpring, useReducedMotion } from 'framer-motion';
import type { AnimationControls, SpringOptions } from 'framer-motion';

// ============================================
// Scroll-based Animation Hook
// ============================================

interface UseScrollAnimationOptions {
  threshold?: number;
  once?: boolean;
  delay?: number;
}

/**
 * Trigger animation when element scrolls into view
 */
export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.3, once = true, delay = 0 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { 
    once, 
    amount: threshold,
  });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        controls.start('visible');
      }, delay * 1000);
      return () => clearTimeout(timer);
    } else if (!once) {
      controls.start('hidden');
    }
  }, [isInView, controls, delay, once]);

  return { ref, controls, isInView };
}

// ============================================
// Stagger Children Animation Hook
// ============================================

interface UseStaggerAnimationOptions {
  staggerDelay?: number;
  startDelay?: number;
  autoPlay?: boolean;
}

/**
 * Orchestrate staggered animations for children
 */
export function useStaggerAnimation(
  itemCount: number,
  options: UseStaggerAnimationOptions = {}
) {
  const { staggerDelay = 0.08, startDelay = 0.1, autoPlay = true } = options;
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = useCallback(async () => {
    setIsAnimating(true);
    await controls.start('visible');
    setIsAnimating(false);
  }, [controls]);

  const resetAnimation = useCallback(async () => {
    setIsAnimating(true);
    await controls.start('hidden');
    setIsAnimating(false);
  }, [controls]);

  useEffect(() => {
    if (autoPlay && itemCount > 0) {
      startAnimation();
    }
  }, [autoPlay, itemCount, startAnimation]);

  const getItemDelay = (index: number) => startDelay + index * staggerDelay;

  return {
    controls,
    isAnimating,
    startAnimation,
    resetAnimation,
    getItemDelay,
  };
}

// ============================================
// Counter Animation Hook
// ============================================

interface UseCounterOptions {
  duration?: number;
  from?: number;
  decimals?: number;
  startOnMount?: boolean;
}

/**
 * Animate a number counting up/down
 */
export function useCounterAnimation(
  to: number,
  options: UseCounterOptions = {}
) {
  const { duration = 1000, from = 0, decimals = 0, startOnMount = true } = options;
  const [value, setValue] = useState(from);
  const [isAnimating, setIsAnimating] = useState(false);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = from + (to - from) * eased;

    setValue(Number(current.toFixed(decimals)));

    if (progress < 1) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
    }
  }, [to, from, duration, decimals]);

  const start = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    startTimeRef.current = undefined;
    frameRef.current = requestAnimationFrame(animate);
  }, [animate, isAnimating]);

  const reset = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    setValue(from);
    setIsAnimating(false);
    startTimeRef.current = undefined;
  }, [from]);

  useEffect(() => {
    if (startOnMount) {
      start();
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [startOnMount, start]);

  return { value, isAnimating, start, reset };
}

// ============================================
// Smooth Spring Value Hook
// ============================================

interface UseSmoothValueOptions extends SpringOptions {
  initialValue?: number;
}

/**
 * Create a smoothly animated value with spring physics
 */
export function useSmoothValue(
  targetValue: number,
  options: UseSmoothValueOptions = {}
) {
  const { 
    initialValue = targetValue,
    stiffness = 300,
    damping = 30,
    mass = 1,
  } = options;
  
  const spring = useSpring(initialValue, { stiffness, damping, mass });

  useEffect(() => {
    spring.set(targetValue);
  }, [spring, targetValue]);

  return spring;
}

// ============================================
// Typewriter Effect Hook
// ============================================

interface UseTypewriterOptions {
  speed?: number;
  startDelay?: number;
  cursor?: boolean;
  loop?: boolean;
  loopDelay?: number;
}

/**
 * Typewriter text animation effect
 */
export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
) {
  const { 
    speed = 50, 
    startDelay = 0, 
    cursor = true,
    loop = false,
    loopDelay = 2000,
  } = options;
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let charIndex = 0;
    setDisplayText('');
    setIsComplete(false);

    const startTyping = () => {
      setIsTyping(true);
      
      const typeChar = () => {
        if (charIndex < text.length) {
          setDisplayText(text.slice(0, charIndex + 1));
          charIndex++;
          timeout = setTimeout(typeChar, speed);
        } else {
          setIsTyping(false);
          setIsComplete(true);
          
          if (loop) {
            timeout = setTimeout(() => {
              charIndex = 0;
              setDisplayText('');
              setIsComplete(false);
              typeChar();
            }, loopDelay);
          }
        }
      };

      typeChar();
    };

    timeout = setTimeout(startTyping, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay, loop, loopDelay]);

  return {
    displayText,
    isTyping,
    isComplete,
    cursor: cursor && isTyping ? '|' : '',
  };
}

// ============================================
// Hover State Hook
// ============================================

/**
 * Track hover state with ref
 */
export function useHoverAnimation() {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleEnter = () => setIsHovered(true);
    const handleLeave = () => setIsHovered(false);

    element.addEventListener('mouseenter', handleEnter);
    element.addEventListener('mouseleave', handleLeave);

    return () => {
      element.removeEventListener('mouseenter', handleEnter);
      element.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return { ref, isHovered };
}

// ============================================
// Reduced Motion Hook
// ============================================

/**
 * Check user's motion preference and provide fallbacks
 */
export function useAnimationPreference() {
  const shouldReduceMotion = useReducedMotion();

  return {
    shouldReduceMotion,
    // Get animation-aware values
    duration: (normal: number) => shouldReduceMotion ? 0 : normal,
    transform: (normal: string, reduced = 'none') => shouldReduceMotion ? reduced : normal,
    transition: (config: Record<string, unknown>) => shouldReduceMotion ? { duration: 0 } : config,
  };
}

// ============================================
// Sequence Animation Hook
// ============================================

interface SequenceStep {
  target: AnimationControls;
  animation: string | object;
  duration?: number;
}

/**
 * Run a sequence of animations
 */
export function useAnimationSequence() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const playSequence = useCallback(async (steps: SequenceStep[]) => {
    setIsPlaying(true);
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      const step = steps[i];
      await step.target.start(step.animation);
    }
    
    setCurrentStep(-1);
    setIsPlaying(false);
  }, []);

  return { playSequence, isPlaying, currentStep };
}


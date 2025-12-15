/**
 * useReducedMotion - Accessibility-aware motion control
 *
 * Respects user's motion preferences and provides safe animation variants.
 * Use this hook to conditionally apply animations based on user preferences.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

interface MotionConfig {
    shouldAnimate: boolean;
    duration: number;
    ease: string;
    springConfig: {
        damping: number;
        stiffness: number;
        mass: number;
    };
}

interface AnimationProps {
    initial?: object;
    animate?: object;
    exit?: object;
    transition?: object;
}

interface UseReducedMotionReturn {
    prefersReducedMotion: boolean;
    motionConfig: MotionConfig;
    getAnimationProps: (fullAnimation: AnimationProps) => AnimationProps;
    getTransition: (duration?: number) => object;
    getDuration: (defaultDuration: number) => number;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Safe defaults for reduced motion
const REDUCED_MOTION_CONFIG: MotionConfig = {
    shouldAnimate: false,
    duration: 0,
    ease: 'linear',
    springConfig: {
        damping: 30,
        stiffness: 500,
        mass: 1,
    },
};

// Full motion defaults
const FULL_MOTION_CONFIG: MotionConfig = {
    shouldAnimate: true,
    duration: 0.3,
    ease: 'cubic-bezier(0.23, 1, 0.32, 1)',
    springConfig: {
        damping: 25,
        stiffness: 300,
        mass: 1,
    },
};

export function useReducedMotion(): UseReducedMotionReturn {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(REDUCED_MOTION_QUERY).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const query = window.matchMedia(REDUCED_MOTION_QUERY);
        setPrefersReducedMotion(query.matches);

        const handler = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
    }, []);

    const motionConfig = useMemo<MotionConfig>(() => {
        return prefersReducedMotion ? REDUCED_MOTION_CONFIG : FULL_MOTION_CONFIG;
    }, [prefersReducedMotion]);

    /**
     * Get animation props with reduced motion fallback
     * Pass full animation config, returns reduced version if user prefers
     */
    const getAnimationProps = useCallback((fullAnimation: AnimationProps): AnimationProps => {
        if (prefersReducedMotion) {
            return {
                initial: fullAnimation.initial ? { opacity: 0 } : undefined,
                animate: fullAnimation.animate ? { opacity: 1 } : undefined,
                exit: fullAnimation.exit ? { opacity: 0 } : undefined,
                transition: { duration: 0 },
            };
        }
        return fullAnimation;
    }, [prefersReducedMotion]);

    /**
     * Get transition config with proper duration
     */
    const getTransition = useCallback((duration: number = 0.3): object => {
        if (prefersReducedMotion) {
            return { duration: 0 };
        }
        return {
            duration,
            ease: FULL_MOTION_CONFIG.ease,
        };
    }, [prefersReducedMotion]);

    /**
     * Get duration value (0 if reduced motion, otherwise default)
     */
    const getDuration = useCallback((defaultDuration: number): number => {
        return prefersReducedMotion ? 0 : defaultDuration;
    }, [prefersReducedMotion]);

    return {
        prefersReducedMotion,
        motionConfig,
        getAnimationProps,
        getTransition,
        getDuration,
    };
}

export type { MotionConfig, AnimationProps, UseReducedMotionReturn };
export default useReducedMotion;

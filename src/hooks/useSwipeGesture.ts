/**
 * useSwipeGesture - Touch gesture handling for mobile navigation
 *
 * Provides velocity-based swipe detection with multi-direction support.
 * Optimized for mobile Builder panel navigation.
 */

import { useRef, useCallback, TouchEvent } from 'react';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeConfig {
    /** Minimum distance in pixels to trigger swipe (default: 50) */
    threshold?: number;
    /** Minimum velocity in px/ms to trigger swipe (default: 0.3) */
    velocityThreshold?: number;
    /** Which directions to detect (default: ['left', 'right']) */
    directions?: SwipeDirection[];
    /** Enable/disable gesture detection (default: true) */
    enabled?: boolean;
    /** Prevent default scroll behavior during swipe (default: false) */
    preventScroll?: boolean;
}

interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onSwipeStart?: (direction: SwipeDirection) => void;
    onSwipeProgress?: (progress: number, direction: SwipeDirection) => void;
    onSwipeCancel?: () => void;
}

interface SwipeState {
    startX: number;
    startY: number;
    startTime: number;
    currentX: number;
    currentY: number;
    isSwiping: boolean;
    direction: SwipeDirection | null;
}

interface SwipeGestureReturn {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
    /** Spread these props onto your element */
    bind: {
        onTouchStart: (e: TouchEvent) => void;
        onTouchMove: (e: TouchEvent) => void;
        onTouchEnd: (e: TouchEvent) => void;
    };
}

const DEFAULT_CONFIG: Required<SwipeConfig> = {
    threshold: 50,
    velocityThreshold: 0.3,
    directions: ['left', 'right'],
    enabled: true,
    preventScroll: false,
};

export function useSwipeGesture(
    handlers: SwipeHandlers,
    config: SwipeConfig = {}
): SwipeGestureReturn {
    const {
        threshold,
        velocityThreshold,
        directions,
        enabled,
        preventScroll,
    } = { ...DEFAULT_CONFIG, ...config };

    const state = useRef<SwipeState>({
        startX: 0,
        startY: 0,
        startTime: 0,
        currentX: 0,
        currentY: 0,
        isSwiping: false,
        direction: null,
    });

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        state.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            currentX: touch.clientX,
            currentY: touch.clientY,
            isSwiping: true,
            direction: null,
        };
    }, [enabled]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!enabled || !state.current.isSwiping) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        state.current.currentX = touch.clientX;
        state.current.currentY = touch.clientY;

        const diffX = state.current.currentX - state.current.startX;
        const diffY = state.current.currentY - state.current.startY;

        // Determine direction if not yet determined
        if (!state.current.direction) {
            // Only determine direction if we've moved enough
            const minMovement = 10;
            if (Math.abs(diffX) < minMovement && Math.abs(diffY) < minMovement) {
                return;
            }

            if (Math.abs(diffX) > Math.abs(diffY)) {
                state.current.direction = diffX > 0 ? 'right' : 'left';
            } else {
                state.current.direction = diffY > 0 ? 'down' : 'up';
            }

            // Notify swipe start if direction is in allowed list
            if (directions.includes(state.current.direction)) {
                handlers.onSwipeStart?.(state.current.direction);
            }
        }

        // Calculate and report progress
        if (state.current.direction && directions.includes(state.current.direction)) {
            const isHorizontal = state.current.direction === 'left' || state.current.direction === 'right';
            const distance = isHorizontal ? Math.abs(diffX) : Math.abs(diffY);
            const progress = Math.min(distance / threshold, 1);

            handlers.onSwipeProgress?.(progress, state.current.direction);

            // Prevent scroll if enabled and swiping in allowed direction
            if (preventScroll) {
                e.preventDefault();
            }
        }
    }, [enabled, threshold, directions, preventScroll, handlers]);

    const handleTouchEnd = useCallback((_e: TouchEvent) => {
        if (!enabled || !state.current.isSwiping) return;

        const diffX = state.current.currentX - state.current.startX;
        const diffY = state.current.currentY - state.current.startY;
        const elapsed = Date.now() - state.current.startTime;

        // Calculate velocity (pixels per millisecond)
        const velocityX = Math.abs(diffX) / Math.max(elapsed, 1);
        const velocityY = Math.abs(diffY) / Math.max(elapsed, 1);

        // Check if swipe meets thresholds
        const isHorizontal = state.current.direction === 'left' || state.current.direction === 'right';
        const distance = isHorizontal ? Math.abs(diffX) : Math.abs(diffY);
        const velocity = isHorizontal ? velocityX : velocityY;

        const meetsDistanceThreshold = distance >= threshold;
        const meetsVelocityThreshold = velocity >= velocityThreshold;

        // Fire swipe handler if thresholds met and direction is allowed
        if ((meetsDistanceThreshold || meetsVelocityThreshold) && state.current.direction) {
            if (directions.includes(state.current.direction)) {
                switch (state.current.direction) {
                    case 'left':
                        handlers.onSwipeLeft?.();
                        break;
                    case 'right':
                        handlers.onSwipeRight?.();
                        break;
                    case 'up':
                        handlers.onSwipeUp?.();
                        break;
                    case 'down':
                        handlers.onSwipeDown?.();
                        break;
                }
            }
        } else {
            // Swipe didn't meet thresholds
            handlers.onSwipeCancel?.();
        }

        // Reset state
        state.current.isSwiping = false;
        state.current.direction = null;
    }, [enabled, threshold, velocityThreshold, directions, handlers]);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        bind: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
    };
}

export type { SwipeDirection, SwipeConfig, SwipeHandlers, SwipeGestureReturn };
export default useSwipeGesture;

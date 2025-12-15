/**
 * useResponsiveLayout - Unified responsive layout management
 *
 * Provides device detection, breakpoint awareness, and layout state
 * for consistent responsive behavior across KripTik AI.
 */

import { useState, useEffect, useCallback } from 'react';

type DeviceType = 'mobile' | 'tablet' | 'desktop';
type LayoutMode = 'single-panel' | 'split' | 'three-panel';
type Orientation = 'portrait' | 'landscape';

interface ResponsiveBreakpoints {
    mobile: number;
    tablet: number;
    desktop: number;
}

interface SafeAreaInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface ResponsiveLayoutState {
    // Device detection
    deviceType: DeviceType;
    layoutMode: LayoutMode;
    orientation: Orientation;

    // Touch detection
    isTouchDevice: boolean;
    hasCoarsePointer: boolean;
    hasFinePointer: boolean;

    // Screen dimensions
    screenWidth: number;
    screenHeight: number;

    // Safe area insets (for notched devices)
    safeAreaInsets: SafeAreaInsets;

    // Accessibility
    prefersReducedMotion: boolean;
    prefersReducedTransparency: boolean;
    prefersDarkMode: boolean;

    // Responsive helpers
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isSmallScreen: boolean;
    isLargeScreen: boolean;
}

const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
};

function getDeviceType(width: number, breakpoints: ResponsiveBreakpoints): DeviceType {
    if (width < breakpoints.mobile) return 'mobile';
    if (width < breakpoints.tablet) return 'tablet';
    return 'desktop';
}

function getLayoutMode(deviceType: DeviceType): LayoutMode {
    switch (deviceType) {
        case 'mobile': return 'single-panel';
        case 'tablet': return 'split';
        case 'desktop': return 'three-panel';
    }
}

function getOrientation(width: number, height: number): Orientation {
    return width >= height ? 'landscape' : 'portrait';
}

function getSafeAreaInsets(): SafeAreaInsets {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const computedStyle = getComputedStyle(document.documentElement);

    // Try to get safe area insets from CSS env variables
    const parseInset = (value: string): number => {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? 0 : parsed;
    };

    return {
        top: parseInset(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInset(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInset(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInset(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0'),
    };
}

function createInitialState(breakpoints: ResponsiveBreakpoints): ResponsiveLayoutState {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    const deviceType = getDeviceType(width, breakpoints);

    return {
        deviceType,
        layoutMode: getLayoutMode(deviceType),
        orientation: getOrientation(width, height),
        isTouchDevice: false,
        hasCoarsePointer: false,
        hasFinePointer: true,
        screenWidth: width,
        screenHeight: height,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
        prefersReducedMotion: false,
        prefersReducedTransparency: false,
        prefersDarkMode: false,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isSmallScreen: width < breakpoints.tablet,
        isLargeScreen: width >= breakpoints.desktop,
    };
}

export function useResponsiveLayout(
    customBreakpoints?: Partial<ResponsiveBreakpoints>
): ResponsiveLayoutState {
    const breakpoints = { ...DEFAULT_BREAKPOINTS, ...customBreakpoints };

    const [state, setState] = useState<ResponsiveLayoutState>(() =>
        createInitialState(breakpoints)
    );

    const updateState = useCallback(() => {
        if (typeof window === 'undefined') return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const deviceType = getDeviceType(width, breakpoints);

        // Touch and pointer detection
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

        // Accessibility preferences
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const prefersReducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        setState({
            deviceType,
            layoutMode: getLayoutMode(deviceType),
            orientation: getOrientation(width, height),
            isTouchDevice,
            hasCoarsePointer,
            hasFinePointer,
            screenWidth: width,
            screenHeight: height,
            safeAreaInsets: getSafeAreaInsets(),
            prefersReducedMotion,
            prefersReducedTransparency,
            prefersDarkMode,
            isMobile: deviceType === 'mobile',
            isTablet: deviceType === 'tablet',
            isDesktop: deviceType === 'desktop',
            isSmallScreen: width < breakpoints.tablet,
            isLargeScreen: width >= breakpoints.desktop,
        });
    }, [breakpoints.desktop, breakpoints.mobile, breakpoints.tablet]);

    useEffect(() => {
        // Initial update
        updateState();

        // Debounced resize handler
        let rafId: number | null = null;
        const resizeHandler = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(updateState);
        };

        window.addEventListener('resize', resizeHandler);
        window.addEventListener('orientationchange', updateState);

        // Media query listeners for accessibility preferences
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const pointerQuery = window.matchMedia('(pointer: coarse)');

        const handleMediaChange = () => updateState();

        reducedMotionQuery.addEventListener('change', handleMediaChange);
        darkModeQuery.addEventListener('change', handleMediaChange);
        pointerQuery.addEventListener('change', handleMediaChange);

        return () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            window.removeEventListener('resize', resizeHandler);
            window.removeEventListener('orientationchange', updateState);
            reducedMotionQuery.removeEventListener('change', handleMediaChange);
            darkModeQuery.removeEventListener('change', handleMediaChange);
            pointerQuery.removeEventListener('change', handleMediaChange);
        };
    }, [updateState]);

    return state;
}

export type { DeviceType, LayoutMode, Orientation, ResponsiveLayoutState, ResponsiveBreakpoints };
export default useResponsiveLayout;

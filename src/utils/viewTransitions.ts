/**
 * viewTransitions - View Transitions API utilities
 *
 * Provides cross-browser View Transitions support with graceful fallbacks.
 * Uses the View Transitions API (Chrome 111+, Safari 18+) when available.
 */

type TransitionCallback = () => void | Promise<void>;

interface ViewTransitionOptions {
    /** Skip transition if user prefers reduced motion */
    respectReducedMotion?: boolean;
    /** Custom transition name for CSS targeting */
    transitionName?: string;
    /** Fallback behavior when API not supported */
    fallback?: 'instant' | 'fade' | 'none';
}

interface ViewTransition {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
}

/**
 * Check if View Transitions API is supported
 */
export function supportsViewTransitions(): boolean {
    return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Start a view transition with fallback support
 *
 * @param callback - Function to execute during transition (DOM updates)
 * @param options - Transition options
 * @returns Promise that resolves when transition completes
 */
export async function startViewTransition(
    callback: TransitionCallback,
    options: ViewTransitionOptions = {}
): Promise<void> {
    const {
        respectReducedMotion = true,
        fallback = 'instant',
    } = options;

    // Skip animation if user prefers reduced motion
    if (respectReducedMotion && prefersReducedMotion()) {
        await callback();
        return;
    }

    // Use View Transitions API if available
    if (supportsViewTransitions()) {
        const transition = (document as Document & {
            startViewTransition: (callback: TransitionCallback) => ViewTransition;
        }).startViewTransition(callback);

        try {
            await transition.finished;
        } catch {
            // Transition was skipped or aborted - that's ok
        }
        return;
    }

    // Fallback behavior
    switch (fallback) {
        case 'fade':
            await fadeTransition(callback);
            break;
        case 'instant':
        case 'none':
        default:
            await callback();
            break;
    }
}

/**
 * Simple fade transition fallback using CSS transitions
 */
async function fadeTransition(callback: TransitionCallback): Promise<void> {
    const root = document.documentElement;

    // Add fade-out class
    root.style.opacity = '0';
    root.style.transition = 'opacity 100ms ease-out';

    await new Promise(resolve => setTimeout(resolve, 100));

    // Execute callback
    await callback();

    // Fade back in
    root.style.opacity = '1';

    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up
    root.style.transition = '';
    root.style.opacity = '';
}

/**
 * Transition a specific panel with view-transition-name
 *
 * @param element - Element to transition
 * @param callback - DOM update callback
 * @param transitionName - CSS view-transition-name
 */
export async function transitionPanel(
    element: HTMLElement | null,
    callback: TransitionCallback,
    transitionName: string = 'panel'
): Promise<void> {
    if (!element) {
        await callback();
        return;
    }

    // Set the view-transition-name on the element
    const originalName = element.style.viewTransitionName;
    element.style.viewTransitionName = transitionName;

    await startViewTransition(callback);

    // Restore original name
    element.style.viewTransitionName = originalName;
}

/**
 * Navigate between panels with directional animation
 *
 * @param direction - 'forward' slides left, 'backward' slides right
 * @param callback - Navigation callback
 */
export async function navigatePanel(
    direction: 'forward' | 'backward',
    callback: TransitionCallback
): Promise<void> {
    // Add direction class for CSS to pick up
    const root = document.documentElement;
    root.classList.add(`vt-direction-${direction}`);

    await startViewTransition(callback);

    // Clean up direction class
    root.classList.remove(`vt-direction-${direction}`);
}

/**
 * Batch multiple DOM updates into a single view transition
 *
 * @param updates - Array of update functions
 */
export async function batchTransition(updates: TransitionCallback[]): Promise<void> {
    await startViewTransition(async () => {
        for (const update of updates) {
            await update();
        }
    });
}

/**
 * Create a reusable transition wrapper for React components
 * Returns a function that can be called to trigger transitions
 *
 * @param options - Default transition options
 */
export function createTransitionTrigger(options: ViewTransitionOptions = {}) {
    return async (callback: TransitionCallback): Promise<void> => {
        await startViewTransition(callback, options);
    };
}

/**
 * Hook-friendly transition state manager
 * Use with React's useCallback for stable references
 */
export class TransitionManager {
    private isTransitioning = false;
    private options: ViewTransitionOptions;

    constructor(options: ViewTransitionOptions = {}) {
        this.options = options;
    }

    async transition(callback: TransitionCallback): Promise<boolean> {
        if (this.isTransitioning) {
            return false;
        }

        this.isTransitioning = true;

        try {
            await startViewTransition(callback, this.options);
            return true;
        } finally {
            this.isTransitioning = false;
        }
    }

    get busy(): boolean {
        return this.isTransitioning;
    }
}

export type { ViewTransitionOptions, ViewTransition, TransitionCallback };

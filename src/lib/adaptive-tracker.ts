/**
 * Adaptive Tracker SDK
 *
 * Lightweight client-side behavior tracking for Adaptive UI.
 * Tracks clicks, scrolls, rage clicks, dead clicks, form abandonment, etc.
 */

// =============================================================================
// TYPES
// =============================================================================

interface ElementIdentifier {
    selector: string;
    componentType: string;
    text?: string;
    location: { x: number; y: number };
    dimensions?: { width: number; height: number };
    visible?: boolean;
}

interface BehaviorContext {
    pageUrl: string;
    viewportSize: { width: number; height: number };
    scrollPosition: { x: number; y: number };
    previousElement?: ElementIdentifier;
    timeOnPage: number;
    clickVelocity?: number;
    completionPercent?: number;
    abandonedField?: string;
    referrer?: string;
    deviceType: 'mobile' | 'tablet' | 'desktop';
}

type SignalType =
    | 'click'
    | 'scroll'
    | 'hover'
    | 'rage-click'
    | 'dead-click'
    | 'form-abandon'
    | 'navigation'
    | 'time-on-element'
    | 'back-button'
    | 'hesitation';

interface UserBehaviorSignal {
    id: string;
    projectId: string;
    sessionId: string;
    userId?: string;
    signalType: SignalType;
    element: ElementIdentifier;
    context: BehaviorContext;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

interface TrackerConfig {
    projectId: string;
    endpoint?: string;
    flushInterval?: number;
    maxBatchSize?: number;
    trackClicks?: boolean;
    trackScroll?: boolean;
    trackHover?: boolean;
    trackForms?: boolean;
    debug?: boolean;
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getSessionId(): string {
    let sessionId = sessionStorage.getItem('adaptive_session_id');
    if (!sessionId) {
        sessionId = generateId();
        sessionStorage.setItem('adaptive_session_id', sessionId);
    }
    return sessionId;
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

function getSelector(element: Element): string {
    if (element.id) {
        return `#${element.id}`;
    }

    // Try data attributes
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
        return `[data-testid="${dataTestId}"]`;
    }

    // Build path
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(' ')
                .filter(c => c && !c.startsWith('_') && c.length < 30)
                .slice(0, 2);
            if (classes.length) {
                selector += `.${classes.join('.')}`;
            }
        }

        path.unshift(selector);
        current = current.parentElement;

        if (path.length > 3) break;
    }

    return path.join(' > ');
}

function getComponentType(element: Element): string {
    const tag = element.tagName.toLowerCase();

    // Check for specific component types
    if (tag === 'button' || element.getAttribute('role') === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'input') return `input-${(element as HTMLInputElement).type}`;
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'form') return 'form';
    if (tag === 'nav') return 'navigation';
    if (element.getAttribute('role') === 'dialog') return 'modal';
    if (element.classList.contains('card') || element.getAttribute('role') === 'article') return 'card';

    return tag;
}

function isInteractiveElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const tabIndex = element.getAttribute('tabindex');

    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'video', 'audio'];
    const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'slider'];

    return (
        interactiveTags.includes(tag) ||
        (role && interactiveRoles.includes(role)) ||
        tabIndex !== null ||
        element.hasAttribute('onclick') ||
        (element as HTMLElement).style.cursor === 'pointer'
    );
}

function getElementIdentifier(element: Element): ElementIdentifier {
    const rect = element.getBoundingClientRect();

    return {
        selector: getSelector(element),
        componentType: getComponentType(element),
        text: (element.textContent || '').trim().substring(0, 50) || undefined,
        location: {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
        },
        dimensions: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        },
        visible: rect.width > 0 && rect.height > 0,
    };
}

function getContext(): BehaviorContext {
    return {
        pageUrl: window.location.pathname,
        viewportSize: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        scrollPosition: {
            x: window.scrollX,
            y: window.scrollY,
        },
        timeOnPage: performance.now(),
        referrer: document.referrer || undefined,
        deviceType: getDeviceType(),
    };
}

// =============================================================================
// TRACKER CLASS
// =============================================================================

export class AdaptiveTracker {
    private projectId: string;
    private sessionId: string;
    private signals: UserBehaviorSignal[] = [];
    private endpoint: string;
    private flushInterval: number;
    private maxBatchSize: number;
    private flushTimer: NodeJS.Timeout | null = null;
    private debug: boolean;

    // Click tracking state
    private lastClickTime = 0;
    private lastClickElement: Element | null = null;
    private clickCount = 0;

    // Hover tracking state
    private hoverTimer: NodeJS.Timeout | null = null;
    private hoveredElement: Element | null = null;

    // Form tracking state
    private formProgress: Map<HTMLFormElement, { fields: Set<string>; total: number }> = new Map();

    constructor(config: TrackerConfig) {
        this.projectId = config.projectId;
        this.sessionId = getSessionId();
        this.endpoint = config.endpoint || '/api/adaptive/signals';
        this.flushInterval = config.flushInterval || 5000;
        this.maxBatchSize = config.maxBatchSize || 50;
        this.debug = config.debug || false;

        // Set up automatic flushing
        this.startFlushTimer();

        // Set up event listeners
        if (config.trackClicks !== false) {
            this.setupClickTracking();
        }
        if (config.trackScroll !== false) {
            this.setupScrollTracking();
        }
        if (config.trackHover !== false) {
            this.setupHoverTracking();
        }
        if (config.trackForms !== false) {
            this.setupFormTracking();
        }

        // Track navigation
        this.setupNavigationTracking();

        // Flush on page unload
        window.addEventListener('beforeunload', () => this.flush());

        if (this.debug) {
            console.log('[AdaptiveTracker] Initialized', { projectId: this.projectId, sessionId: this.sessionId });
        }
    }

    /**
     * Add a signal to the queue
     */
    private addSignal(
        signalType: SignalType,
        element: ElementIdentifier,
        context: BehaviorContext,
        metadata?: Record<string, unknown>
    ): void {
        const signal: UserBehaviorSignal = {
            id: generateId(),
            projectId: this.projectId,
            sessionId: this.sessionId,
            signalType,
            element,
            context,
            timestamp: new Date(),
            metadata,
        };

        this.signals.push(signal);

        if (this.debug) {
            console.log('[AdaptiveTracker] Signal:', signal);
        }

        // Auto-flush if batch size reached
        if (this.signals.length >= this.maxBatchSize) {
            this.flush();
        }
    }

    /**
     * Track a click event
     */
    trackClick(element: Element): void {
        const now = Date.now();
        const elementId = getElementIdentifier(element);
        const context = getContext();

        // Detect rage clicking (3+ clicks in 2 seconds on same element)
        if (this.lastClickElement === element && now - this.lastClickTime < 2000) {
            this.clickCount++;
            if (this.clickCount >= 3) {
                this.addSignal('rage-click', elementId, {
                    ...context,
                    clickVelocity: this.clickCount / ((now - this.lastClickTime) / 1000),
                });
            }
        } else {
            this.clickCount = 1;
        }

        // Detect dead clicks (non-interactive elements)
        if (!isInteractiveElement(element)) {
            this.addSignal('dead-click', elementId, context);
        }

        // Track regular click
        this.addSignal('click', elementId, context);

        this.lastClickTime = now;
        this.lastClickElement = element;
    }

    /**
     * Track scroll depth
     */
    trackScroll(depth: number): void {
        const context = getContext();

        this.addSignal('scroll', {
            selector: 'document',
            componentType: 'page',
            location: { x: 0, y: depth },
        }, context, { depth });
    }

    /**
     * Track hover (hesitation detection)
     */
    trackHover(element: Element): void {
        const elementId = getElementIdentifier(element);
        this.hoveredElement = element;

        // Clear previous timer
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
        }

        // Start hesitation detection (5+ seconds hover)
        this.hoverTimer = setTimeout(() => {
            if (this.hoveredElement === element) {
                this.addSignal('hesitation', elementId, getContext(), {
                    duration: 5000,
                });
            }
        }, 5000);
    }

    /**
     * Track element interaction time
     */
    trackTimeOnElement(element: Element, duration: number): void {
        const elementId = getElementIdentifier(element);
        this.addSignal('time-on-element', elementId, getContext(), { duration });
    }

    /**
     * Track form abandonment
     */
    trackFormAbandonment(form: HTMLFormElement, abandonedField: string): void {
        const progress = this.formProgress.get(form);
        const completionPercent = progress
            ? Math.round((progress.fields.size / progress.total) * 100)
            : 0;

        const elementId = getElementIdentifier(form);
        const context = getContext();

        this.addSignal('form-abandon', elementId, {
            ...context,
            completionPercent,
            abandonedField,
        });
    }

    /**
     * Set up click tracking
     */
    private setupClickTracking(): void {
        document.addEventListener('click', (event) => {
            const target = event.target as Element;
            if (target) {
                this.trackClick(target);
            }
        }, { capture: true });
    }

    /**
     * Set up scroll tracking
     */
    private setupScrollTracking(): void {
        let lastScrollDepth = 0;
        let scrollTimeout: NodeJS.Timeout | null = null;

        document.addEventListener('scroll', () => {
            if (scrollTimeout) return;

            scrollTimeout = setTimeout(() => {
                const scrollDepth = Math.round(
                    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
                );

                // Track at 25% intervals
                if (scrollDepth >= lastScrollDepth + 25) {
                    this.trackScroll(scrollDepth);
                    lastScrollDepth = Math.floor(scrollDepth / 25) * 25;
                }

                scrollTimeout = null;
            }, 100);
        });
    }

    /**
     * Set up hover tracking
     */
    private setupHoverTracking(): void {
        document.addEventListener('mouseover', (event) => {
            const target = event.target as Element;
            if (target && isInteractiveElement(target)) {
                this.trackHover(target);
            }
        });

        document.addEventListener('mouseout', () => {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }
            this.hoveredElement = null;
        });
    }

    /**
     * Set up form tracking
     */
    private setupFormTracking(): void {
        // Track form field focus
        document.addEventListener('focusin', (event) => {
            const target = event.target as HTMLElement;
            const form = target.closest('form');

            if (form && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                if (!this.formProgress.has(form)) {
                    const fields = form.querySelectorAll('input, textarea, select');
                    this.formProgress.set(form, {
                        fields: new Set(),
                        total: fields.length,
                    });
                }

                const progress = this.formProgress.get(form)!;
                progress.fields.add((target as HTMLInputElement).name || target.id || getSelector(target));
            }
        });

        // Track form abandonment on page leave or form blur
        document.addEventListener('focusout', (event) => {
            const target = event.target as HTMLElement;
            const form = target.closest('form');

            if (form) {
                // Check if focus moved outside the form
                setTimeout(() => {
                    const activeElement = document.activeElement;
                    if (!form.contains(activeElement)) {
                        const progress = this.formProgress.get(form);
                        if (progress && progress.fields.size > 0 && progress.fields.size < progress.total) {
                            this.trackFormAbandonment(form, (target as HTMLInputElement).name || target.id || 'unknown');
                        }
                    }
                }, 100);
            }
        });
    }

    /**
     * Set up navigation tracking
     */
    private setupNavigationTracking(): void {
        // Track back button
        window.addEventListener('popstate', () => {
            this.addSignal('back-button', {
                selector: 'window',
                componentType: 'navigation',
                location: { x: 0, y: 0 },
            }, getContext());
        });

        // Track page navigation
        const originalPushState = history.pushState;
        history.pushState = (...args) => {
            this.addSignal('navigation', {
                selector: 'window',
                componentType: 'navigation',
                location: { x: 0, y: 0 },
            }, getContext(), { to: args[2] });
            return originalPushState.apply(history, args);
        };
    }

    /**
     * Start the flush timer
     */
    private startFlushTimer(): void {
        this.flushTimer = setInterval(() => {
            if (this.signals.length > 0) {
                this.flush();
            }
        }, this.flushInterval);
    }

    /**
     * Flush signals to server
     */
    async flush(): Promise<void> {
        if (this.signals.length === 0) return;

        const signalsToSend = [...this.signals];
        this.signals = [];

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.projectId,
                    signals: signalsToSend,
                }),
                credentials: 'include',
            });

            if (!response.ok) {
                // Put signals back on failure
                this.signals = [...signalsToSend, ...this.signals];
                if (this.debug) {
                    console.error('[AdaptiveTracker] Flush failed:', response.status);
                }
            } else if (this.debug) {
                console.log('[AdaptiveTracker] Flushed', signalsToSend.length, 'signals');
            }
        } catch (error) {
            // Put signals back on error
            this.signals = [...signalsToSend, ...this.signals];
            if (this.debug) {
                console.error('[AdaptiveTracker] Flush error:', error);
            }
        }
    }

    /**
     * Destroy the tracker
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flush();
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let trackerInstance: AdaptiveTracker | null = null;

export function initAdaptiveTracker(config: TrackerConfig): AdaptiveTracker {
    if (trackerInstance) {
        trackerInstance.destroy();
    }
    trackerInstance = new AdaptiveTracker(config);
    return trackerInstance;
}

export function getAdaptiveTracker(): AdaptiveTracker | null {
    return trackerInstance;
}


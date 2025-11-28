/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs errors, and displays a fallback UI instead of crashing.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './button';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    resetKeys?: unknown[];
    level?: 'page' | 'component' | 'critical';
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    showDetails: boolean;
}

// ============================================================================
// ERROR BOUNDARY CLASS COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Update state with error info
        this.setState({ errorInfo });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // Send to error tracking service (if configured)
        this.reportError(error, errorInfo);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps): void {
        // Reset error state if resetKeys change
        if (this.state.hasError && this.props.resetKeys) {
            const changed = prevProps.resetKeys?.some(
                (key, index) => key !== this.props.resetKeys?.[index]
            );
            if (changed) {
                this.reset();
            }
        }
    }

    private reportError(error: Error, errorInfo: ErrorInfo): void {
        // Report to backend error tracking
        try {
            const errorReport = {
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
            };

            // Send to API (fire and forget)
            fetch('/api/errors/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorReport),
            }).catch(() => {
                // Silently fail - don't crash error boundary
            });
        } catch {
            // Silently fail
        }
    }

    private reset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        });
    };

    private toggleDetails = (): void => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    private goHome = (): void => {
        window.location.href = '/';
    };

    private reload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Determine error level styling
            const level = this.props.level || 'component';
            const isPage = level === 'page';
            const isCritical = level === 'critical';

            return (
                <div
                    className={`
                        ${isPage || isCritical ? 'min-h-screen' : 'min-h-[200px]'}
                        flex items-center justify-center p-6
                        ${isCritical ? 'bg-red-950/20' : 'bg-slate-950/50'}
                    `}
                >
                    <div className="w-full max-w-lg">
                        <div className="relative backdrop-blur-xl bg-slate-900/50 border border-white/10 rounded-2xl p-8 shadow-xl">
                            {/* Ambient glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 rounded-2xl" />

                            <div className="relative space-y-6">
                                {/* Icon and Title */}
                                <div className="flex items-start gap-4">
                                    <div className={`
                                        p-3 rounded-xl 
                                        ${isCritical 
                                            ? 'bg-red-500/20 text-red-400' 
                                            : 'bg-amber-500/20 text-amber-400'
                                        }
                                    `}>
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-semibold text-white">
                                            {isCritical ? 'Critical Error' : 'Something went wrong'}
                                        </h2>
                                        <p className="text-sm text-slate-400 mt-1">
                                            {this.state.error?.message || 'An unexpected error occurred'}
                                        </p>
                                    </div>
                                </div>

                                {/* Error Details (Collapsible) */}
                                {process.env.NODE_ENV === 'development' && (
                                    <div>
                                        <button
                                            onClick={this.toggleDetails}
                                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                                        >
                                            <Bug className="w-4 h-4" />
                                            <span>Technical Details</span>
                                            {this.state.showDetails ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>

                                        {this.state.showDetails && (
                                            <div className="mt-3 p-4 bg-slate-800/50 rounded-lg border border-white/5 overflow-auto max-h-48">
                                                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
                                                    {this.state.error?.stack}
                                                </pre>
                                                {this.state.errorInfo?.componentStack && (
                                                    <>
                                                        <div className="my-3 border-t border-white/5" />
                                                        <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono">
                                                            {this.state.errorInfo.componentStack}
                                                        </pre>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={this.reset}
                                        variant="default"
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Try Again
                                    </Button>

                                    <Button
                                        onClick={this.reload}
                                        variant="outline"
                                        className="border-white/10 hover:border-white/20"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Reload Page
                                    </Button>

                                    {(isPage || isCritical) && (
                                        <Button
                                            onClick={this.goHome}
                                            variant="ghost"
                                            className="text-slate-400 hover:text-white"
                                        >
                                            <Home className="w-4 h-4 mr-2" />
                                            Go Home
                                        </Button>
                                    )}
                                </div>

                                {/* Help Text */}
                                <p className="text-xs text-slate-500">
                                    If this error persists, please try clearing your browser cache or 
                                    contact support with the error details above.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================================================

/**
 * Page-level error boundary with full-page fallback
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary level="page">
            {children}
        </ErrorBoundary>
    );
}

/**
 * Component-level error boundary with inline fallback
 */
export function ComponentErrorBoundary({ 
    children, 
    fallback 
}: { 
    children: ReactNode;
    fallback?: ReactNode;
}) {
    return (
        <ErrorBoundary level="component" fallback={fallback}>
            {children}
        </ErrorBoundary>
    );
}

/**
 * Critical error boundary for app-level errors
 */
export function CriticalErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary level="critical">
            {children}
        </ErrorBoundary>
    );
}

// ============================================================================
// HOOK FOR FUNCTIONAL COMPONENTS
// ============================================================================

/**
 * Custom hook to trigger error boundary
 */
export function useErrorHandler() {
    const [error, setError] = React.useState<Error | null>(null);

    if (error) {
        throw error;
    }

    return {
        showError: (error: Error) => setError(error),
        clearError: () => setError(null),
    };
}

// ============================================================================
// SIMPLE FALLBACK COMPONENTS
// ============================================================================

export function ErrorFallback({ 
    message = 'Something went wrong',
    onRetry 
}: { 
    message?: string;
    onRetry?: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-slate-400 mb-4">{message}</p>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                </Button>
            )}
        </div>
    );
}

export function LoadingFallback() {
    return (
        <div className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
        </div>
    );
}

// ============================================================================
// ASYNC ERROR BOUNDARY (for Suspense)
// ============================================================================

/**
 * Combined error boundary and suspense wrapper
 */
export function AsyncBoundary({ 
    children,
    loadingFallback,
    errorFallback,
}: { 
    children: ReactNode;
    loadingFallback?: ReactNode;
    errorFallback?: ReactNode;
}) {
    return (
        <ErrorBoundary fallback={errorFallback || <ErrorFallback />}>
            <React.Suspense fallback={loadingFallback || <LoadingFallback />}>
                {children}
            </React.Suspense>
        </ErrorBoundary>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ErrorBoundary;


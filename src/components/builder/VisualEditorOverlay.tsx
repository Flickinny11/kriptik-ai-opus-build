/**
 * Visual Editor Overlay - AI Element Redesign UI
 *
 * Premium liquid glass overlay for the Visual Editor feature.
 * Allows users to:
 * 1. Click elements to select them
 * 2. Enter NLP prompts for redesign
 * 3. View AI-generated image preview
 * 4. See the generated React code
 * 5. Test in sandbox, use it, or try again
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';

// =============================================================================
// TYPES
// =============================================================================

export interface SelectedElement {
    elementId: string;
    tagName: string;
    classNames: string[];
    styles: Record<string, string>;
    dimensions: { width: number; height: number };
    position: { x: number; y: number };
    textContent?: string;
    htmlContext: string;
    parent?: { tagName: string; classNames: string[] };
    children: Array<{ tagName: string; count: number }>;
    sourceFile?: string;
    sourceLine?: number;
}

export interface RedesignResult {
    sessionId: string;
    generatedImage: string;
    verification: {
        passed: boolean;
        score: number;
        feedback: string;
        issues: string[];
    };
    code: {
        component: string;
        styles?: string;
        dependencies: string[];
    };
    sandboxUrl: string;
    metrics: {
        imageGenerationMs: number;
        verificationMs: number;
        codeGenerationMs: number;
        totalMs: number;
    };
}

export type RedesignPhase =
    | 'idle'
    | 'selecting'
    | 'prompting'
    | 'generating'
    | 'reviewing'
    | 'testing';

interface VisualEditorOverlayProps {
    isActive: boolean;
    onClose: () => void;
    projectId: string;
    userId: string;
    iframeRef?: React.RefObject<HTMLIFrameElement>;
}

// =============================================================================
// ICONS
// =============================================================================

const WandIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z" />
        <path d="M19 11l.5 1.5L21 13l-1.5.5L19 15l-.5-1.5L17 13l1.5-.5L19 11z" />
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

const BeakerIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4.5 3h15M6 3v16a2 2 0 002 2h8a2 2 0 002-2V3" />
        <path d="M6 14h12" />
    </svg>
);

const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const CodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
    </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function VisualEditorOverlay({
    isActive,
    onClose,
    projectId,
    userId,
    iframeRef: _iframeRef, // Reserved for iframe element selection integration
}: VisualEditorOverlayProps) {
    const [phase, setPhase] = useState<RedesignPhase>('idle');
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [result, setResult] = useState<RedesignResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showCode, setShowCode] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Reset state when overlay is deactivated
    useEffect(() => {
        if (!isActive) {
            setPhase('idle');
            setSelectedElement(null);
            setPrompt('');
            setResult(null);
            setError(null);
            setProgress(0);
        } else {
            setPhase('selecting');
        }
    }, [isActive]);

    // Focus input when entering prompting phase
    useEffect(() => {
        if (phase === 'prompting' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [phase]);

    // Handle element selection from iframe
    // This will be called via postMessage from iframe when element is clicked
    const handleElementSelect = useCallback((element: SelectedElement) => {
        setSelectedElement(element);
        setPhase('prompting');
        setError(null);
    }, []);

    // Expose for iframe postMessage integration
    if (typeof window !== 'undefined') {
        (window as unknown as { __visualEditorSelectElement?: (element: SelectedElement) => void }).__visualEditorSelectElement = handleElementSelect;
    }

    // Handle redesign request
    const handleRedesign = async () => {
        if (!selectedElement || !prompt.trim()) return;

        setIsLoading(true);
        setPhase('generating');
        setProgress(0);
        setError(null);

        try {
            // Start SSE connection for progress updates
            const eventSource = new EventSource(
                `/api/visual-editor/progress?projectId=${projectId}`
            );

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.progress !== undefined) {
                        setProgress(data.progress);
                    }
                    if (data.message) {
                        setProgressMessage(data.message);
                    }
                } catch {
                    // Ignore parse errors
                }
            };

            // Make the redesign request
            const response = await apiClient.post<RedesignResult>('/api/visual-editor/redesign', {
                projectId,
                userId,
                element: selectedElement,
                prompt: prompt.trim(),
            });

            eventSource.close();

            if (response.data) {
                setResult(response.data);
                setPhase('reviewing');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate redesign';
            setError(message);
            setPhase('prompting');
        } finally {
            setIsLoading(false);
            setProgress(100);
        }
    };

    // Handle "Try Again"
    const handleTryAgain = () => {
        setResult(null);
        setPhase('prompting');
        setProgress(0);
    };

    // Handle "Test It" - open sandbox
    const handleTestIt = () => {
        if (result?.sandboxUrl) {
            setPhase('testing');
        }
    };

    // Handle "Use It" - apply the changes
    const handleUseIt = async () => {
        if (!result) return;

        setIsLoading(true);
        try {
            await apiClient.post('/api/visual-editor/apply', {
                projectId,
                sessionId: result.sessionId,
                code: result.code,
                element: selectedElement,
            });

            // Close the overlay on success
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to apply changes';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isActive) return null;

    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 pointer-events-none"
                >
                    {/* Selection Mode Indicator */}
                    {phase === 'selecting' && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto"
                        >
                            <div
                                className="flex items-center gap-3 px-5 py-3 rounded-2xl"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,1), 0 0 0 1px rgba(255,255,255,0.5)',
                                }}
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(245,168,108,0.3) 0%, rgba(245,168,108,0.15) 100%)',
                                    }}
                                >
                                    <WandIcon className="w-5 h-5 text-[#c25a00]" />
                                </div>
                                <div>
                                    <p className="font-semibold text-[#1a1a1a]">Visual Editor Active</p>
                                    <p className="text-sm text-[#666]">Click any element to redesign it with AI</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="ml-4 p-2 rounded-lg hover:bg-black/5 transition-colors"
                                >
                                    <XIcon className="w-5 h-5 text-[#666]" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Prompt Panel */}
                    {(phase === 'prompting' || phase === 'generating') && selectedElement && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute top-4 right-4 w-96 pointer-events-auto"
                        >
                            <div
                                className="rounded-2xl overflow-hidden"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
                                    backdropFilter: 'blur(24px)',
                                    boxShadow: '0 12px 48px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,1), 0 0 0 1px rgba(255,255,255,0.6)',
                                }}
                            >
                                {/* Header */}
                                <div
                                    className="px-5 py-4 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                                            style={{
                                                background: 'linear-gradient(145deg, rgba(245,168,108,0.25) 0%, rgba(245,168,108,0.1) 100%)',
                                            }}
                                        >
                                            <SparklesIcon className="w-5 h-5 text-[#c25a00]" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#1a1a1a]">AI Redesign</p>
                                            <p className="text-xs text-[#888]">
                                                {selectedElement.tagName.toLowerCase()}
                                                {selectedElement.classNames[0] && `.${selectedElement.classNames[0]}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedElement(null);
                                            setPhase('selecting');
                                        }}
                                        className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                                    >
                                        <XIcon className="w-4 h-4 text-[#888]" />
                                    </button>
                                </div>

                                {/* Element Preview */}
                                <div className="px-5 py-3 border-b border-black/5">
                                    <div
                                        className="p-3 rounded-xl text-xs font-mono text-[#666] overflow-hidden"
                                        style={{ background: 'rgba(0,0,0,0.03)' }}
                                    >
                                        <div className="truncate">
                                            &lt;{selectedElement.tagName.toLowerCase()}
                                            {selectedElement.classNames.length > 0 && (
                                                <span className="text-[#0066cc]">
                                                    {' '}class=&quot;{selectedElement.classNames.slice(0, 3).join(' ')}...&quot;
                                                </span>
                                            )}
                                            &gt;
                                        </div>
                                        <div className="text-[#888] mt-1">
                                            {selectedElement.dimensions.width} x {selectedElement.dimensions.height}px
                                        </div>
                                    </div>
                                </div>

                                {/* Prompt Input */}
                                <div className="p-5">
                                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                                        Describe the redesign
                                    </label>
                                    <textarea
                                        ref={inputRef}
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="e.g., Make it 3D with a glass effect and subtle shadows"
                                        disabled={isLoading}
                                        className="w-full h-24 px-4 py-3 rounded-xl border-0 resize-none text-[#1a1a1a] placeholder:text-[#aaa] focus:ring-2 focus:ring-[#F5A86C]/50 focus:outline-none"
                                        style={{
                                            background: 'rgba(0,0,0,0.04)',
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                handleRedesign();
                                            }
                                        }}
                                    />

                                    {error && (
                                        <div className="mt-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    {/* Progress */}
                                    {phase === 'generating' && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-[#666]">{progressMessage || 'Processing...'}</span>
                                                <span className="text-sm font-medium text-[#c25a00]">{progress}%</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ background: 'linear-gradient(90deg, #F5A86C 0%, #e08a4a 100%)' }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleRedesign}
                                        disabled={!prompt.trim() || isLoading}
                                        className="mt-4 w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{
                                            background: 'linear-gradient(145deg, #F5A86C 0%, #e08a4a 100%)',
                                            boxShadow: '0 4px 16px rgba(245,168,108,0.35)',
                                        }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                >
                                                    <RefreshIcon className="w-5 h-5" />
                                                </motion.div>
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="w-5 h-5" />
                                                Generate with AI
                                            </>
                                        )}
                                    </button>
                                    <p className="text-xs text-center text-[#888] mt-2">
                                        Uses FLUX.2 Pro + GPT-4o + Claude Opus 4.5
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Review Panel */}
                    {phase === 'reviewing' && result && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-4 right-4 w-[480px] max-h-[calc(100vh-2rem)] overflow-y-auto pointer-events-auto"
                        >
                            <div
                                className="rounded-2xl overflow-hidden"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
                                    backdropFilter: 'blur(24px)',
                                    boxShadow: '0 12px 48px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,1)',
                                }}
                            >
                                {/* Header */}
                                <div
                                    className="px-5 py-4 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                                            style={{
                                                background: result.verification.passed
                                                    ? 'linear-gradient(145deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                                                    : 'linear-gradient(145deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.1) 100%)',
                                            }}
                                        >
                                            {result.verification.passed ? (
                                                <CheckIcon className="w-5 h-5 text-emerald-600" />
                                            ) : (
                                                <SparklesIcon className="w-5 h-5 text-amber-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#1a1a1a]">Redesign Complete</p>
                                            <p className="text-xs text-[#888]">
                                                Score: {result.verification.score}/100 in {Math.round(result.metrics.totalMs / 1000)}s
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                                    >
                                        <XIcon className="w-4 h-4 text-[#888]" />
                                    </button>
                                </div>

                                {/* Generated Image Preview */}
                                <div className="p-5 border-b border-black/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" />
                                            Generated Design
                                        </span>
                                        <button
                                            onClick={() => setShowCode(!showCode)}
                                            className="text-xs text-[#c25a00] hover:underline flex items-center gap-1"
                                        >
                                            <CodeIcon className="w-3 h-3" />
                                            {showCode ? 'Show Preview' : 'Show Code'}
                                        </button>
                                    </div>

                                    {showCode ? (
                                        <div
                                            className="rounded-xl p-4 max-h-64 overflow-auto font-mono text-xs"
                                            style={{ background: '#1e1e2e', color: '#cdd6f4' }}
                                        >
                                            <pre className="whitespace-pre-wrap">{result.code.component}</pre>
                                        </div>
                                    ) : (
                                        <div
                                            className="rounded-xl overflow-hidden aspect-video flex items-center justify-center"
                                            style={{ background: 'rgba(0,0,0,0.03)' }}
                                        >
                                            <img
                                                src={result.generatedImage}
                                                alt="Generated design"
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        </div>
                                    )}

                                    {/* Verification Feedback */}
                                    <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                        <p className="text-[#666]">{result.verification.feedback}</p>
                                        {result.verification.issues.length > 0 && (
                                            <ul className="mt-2 text-amber-700 text-xs">
                                                {result.verification.issues.map((issue, i) => (
                                                    <li key={i}>• {issue}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="p-5 flex gap-3">
                                    <button
                                        onClick={handleTryAgain}
                                        className="flex-1 py-3 px-4 rounded-xl font-medium text-[#666] transition-all duration-300 flex items-center justify-center gap-2"
                                        style={{
                                            background: 'rgba(0,0,0,0.05)',
                                        }}
                                    >
                                        <RefreshIcon className="w-4 h-4" />
                                        Try Again
                                    </button>
                                    <button
                                        onClick={handleTestIt}
                                        className="flex-1 py-3 px-4 rounded-xl font-medium text-[#1a1a1a] transition-all duration-300 flex items-center justify-center gap-2"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,1)',
                                        }}
                                    >
                                        <BeakerIcon className="w-4 h-4" />
                                        Test It
                                    </button>
                                    <button
                                        onClick={handleUseIt}
                                        disabled={isLoading}
                                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                                        style={{
                                            background: 'linear-gradient(145deg, #10b981 0%, #059669 100%)',
                                            boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                                        }}
                                    >
                                        <CheckIcon className="w-4 h-4" />
                                        Use It
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Testing Sandbox Modal */}
                    {phase === 'testing' && result && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-4 pointer-events-auto"
                        >
                            <div
                                className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
                                    backdropFilter: 'blur(24px)',
                                    boxShadow: '0 16px 64px rgba(0,0,0,0.2)',
                                }}
                            >
                                {/* Sandbox Header */}
                                <div
                                    className="px-5 py-4 flex items-center justify-between shrink-0"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-400" />
                                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                        </div>
                                        <span className="text-sm font-medium text-[#666]">Element Sandbox Preview</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPhase('reviewing')}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-[#666] hover:bg-black/5 transition-colors"
                                        >
                                            Back to Review
                                        </button>
                                        <button
                                            onClick={handleUseIt}
                                            disabled={isLoading}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                                            style={{
                                                background: 'linear-gradient(145deg, #10b981 0%, #059669 100%)',
                                            }}
                                        >
                                            Use This Design
                                        </button>
                                    </div>
                                </div>

                                {/* Sandbox Iframe */}
                                <div className="flex-1 p-4" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                    <iframe
                                        src={result.sandboxUrl}
                                        className="w-full h-full rounded-xl border-0"
                                        style={{
                                            background: 'white',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                        }}
                                        sandbox="allow-scripts"
                                        title="Element Preview"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default VisualEditorOverlay;

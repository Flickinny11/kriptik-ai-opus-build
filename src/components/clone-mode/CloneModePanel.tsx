/**
 * Clone Mode Panel
 *
 * Main panel for the Video → Code feature.
 * Upload video recordings, preview frames, extract design DNA, and generate code.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ActivityIcon as VideoIcon,
    UploadIcon,
    Code2Icon,
    GlobeIcon as PaletteIcon,
    LayersIcon,
    LoadingIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    XIcon,
    ZapIcon,
    DownloadIcon,
    RefreshIcon,
    ClockIcon,
    CodeIcon as FileCode2Icon,
} from '../ui/icons';
import { apiClient } from '../../lib/api-client';
import { getApiBaseUrl } from '../../lib/runtime-urls';
import { FrameTimeline } from './FrameTimeline';
import { DesignDNAPreview } from './DesignDNAPreview';
import '../../styles/realistic-glass.css';

// Dark glass styling
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 30px 80px rgba(0,0,0,0.5),
        0 15px 40px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

const accentColor = '#c8ff64';
const accentGlow = 'rgba(200,255,100,0.15)';

interface VideoFrame {
    id: string;
    timestamp: number;
    keyframe: boolean;
    image: string;
    uiElements: Array<{
        id: string;
        type: string;
        bounds: { x: number; y: number; width: number; height: number };
        label?: string;
    }>;
}

interface DesignDNA {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        palette: string[];
    };
    typography: {
        headingFont?: string;
        bodyFont?: string;
        sizes: string[];
        weights: string[];
    };
    spacing: {
        unit: number;
        scale: number[];
    };
    borderRadius: string[];
    shadows: string[];
    animations: {
        duration: string;
        easing: string;
        types: string[];
    };
}

interface ComponentSuggestion {
    name: string;
    type: string;
    description: string;
    props: Array<{ name: string; type: string; required: boolean }>;
}

interface AnalysisResult {
    sessionId: string;
    frames: VideoFrame[];
    keyframeCount: number;
    designDNA: DesignDNA;
    suggestedComponents: ComponentSuggestion[];
    userJourney: Array<{
        id: string;
        frameId: string;
        action: string;
        description: string;
    }>;
    analysis: {
        screenCount: number;
        interactionCount: number;
        uniqueElementTypes: string[];
        estimatedComplexity: 'simple' | 'moderate' | 'complex';
    };
}

interface GeneratedCode {
    components: Array<{
        name: string;
        code: string;
        styles?: string;
        path: string;
        dependencies: string[];
    }>;
    entryPoint: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
    };
}

interface CloneModePanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
    onCodeGenerated?: (code: GeneratedCode) => void;
}

export function CloneModePanel({
    isOpen,
    onClose,
    projectId,
    onCodeGenerated
}: CloneModePanelProps) {
    // State
    const [stage, setStage] = useState<'upload' | 'analyzing' | 'preview' | 'generating' | 'complete'>('upload');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
    const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);

    const [framework, setFramework] = useState<'react' | 'react-native' | 'vue' | 'html'>('react');
    const [styling, setStyling] = useState<'tailwind' | 'css-modules' | 'styled-components'>('tailwind');

    const [showDesignDNA, setShowDesignDNA] = useState(false);
    const [showComponents, setShowComponents] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // Handle video file upload
    const handleFileSelect = useCallback(async (file: File) => {
        if (!file.type.startsWith('video/')) {
            setError('Please select a video file');
            return;
        }

        setError(null);
        setStage('analyzing');
        setProgress(0);
        setMessage('Reading video file...');

        try {
            // Convert to base64
            const buffer = await file.arrayBuffer();
            const base64 = btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            // Start analysis
            const response = await apiClient.post<{ success: boolean; sessionId: string; error?: string }>(
                '/api/clone/analyze-video',
                {
                    video: {
                        type: 'base64',
                        data: base64,
                        mimeType: file.type
                    },
                    projectId,
                    framework,
                    styling,
                    extractionOptions: {
                        maxFrames: 30,
                        keyframeThreshold: 0.15,
                        analyzeInteractions: true
                    }
                }
            );

            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to start analysis');
            }

            const newSessionId = response.data.sessionId;
            setSessionId(newSessionId);

            // Connect to SSE for progress updates
            connectToProgressStream(newSessionId);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload video');
            setStage('upload');
        }
    }, [projectId, framework, styling]);

    // Connect to SSE progress stream
    const connectToProgressStream = useCallback((sid: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const baseUrl = getApiBaseUrl();
        const eventSource = new EventSource(`${baseUrl}/api/clone/status/${sid}`, {
            withCredentials: true
        });

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                setProgress(data.progress || 0);
                setMessage(data.message || '');

                if (data.stage === 'complete' && data.data) {
                    setAnalysis(data.data);
                    setStage('preview');
                    eventSource.close();
                } else if (data.stage === 'error') {
                    setError(data.message);
                    setStage('upload');
                    eventSource.close();
                } else {
                    setStage('analyzing');
                }
            } catch {
                // Ignore parse errors
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            // Try to load result from API
            loadAnalysisResult(sid);
        };

        eventSourceRef.current = eventSource;
    }, []);

    // Load analysis result from API
    const loadAnalysisResult = useCallback(async (sid: string) => {
        try {
            const response = await apiClient.get<{ success: boolean; analysis: AnalysisResult }>(
                `/api/clone/analysis/${sid}`
            );

            if (response.data.success && response.data.analysis) {
                setAnalysis(response.data.analysis);
                setStage('preview');
            }
        } catch {
            // Still analyzing or error
        }
    }, []);

    // Generate code from analysis
    const handleGenerateCode = useCallback(async () => {
        if (!sessionId || !analysis) return;

        setStage('generating');
        setProgress(0);
        setMessage('Generating code from design...');

        try {
            const response = await apiClient.post<{ success: boolean; code: GeneratedCode; error?: string }>(
                '/api/clone/generate',
                {
                    sessionId,
                    framework,
                    styling
                }
            );

            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to generate code');
            }

            setGeneratedCode(response.data.code);
            setStage('complete');

            if (onCodeGenerated) {
                onCodeGenerated(response.data.code);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate code');
            setStage('preview');
        }
    }, [sessionId, analysis, framework, styling, onCodeGenerated]);

    // Reset to upload stage
    const handleReset = useCallback(() => {
        setStage('upload');
        setProgress(0);
        setMessage('');
        setError(null);
        setSessionId(null);
        setAnalysis(null);
        setGeneratedCode(null);
        setSelectedFrame(null);

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    // Handle drag and drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: accentGlow }}
                            >
                                <VideoIcon size={20} className="text-[#c8ff64]" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Clone Mode</h2>
                                <p className="text-xs text-white/40">Video → Code: Reproduce any UI from screen recordings</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {stage !== 'upload' && (
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <RefreshIcon size={16} />
                                    Start Over
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <XIcon size={20} className="text-white/40" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex">
                        {/* Main Content Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Error Display */}
                            {error && (
                                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <AlertCircleIcon size={20} className="text-red-400 flex-shrink-0" />
                                    <p className="text-sm text-red-400">{error}</p>
                                    <button
                                        onClick={() => setError(null)}
                                        className="ml-auto p-1 hover:bg-red-500/20 rounded"
                                    >
                                        <XIcon size={16} className="text-red-400" />
                                    </button>
                                </div>
                            )}

                            {/* Upload Stage */}
                            {stage === 'upload' && (
                                <div className="space-y-6">
                                    {/* Settings */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-white/50 mb-2 block">Framework</label>
                                            <select
                                                value={framework}
                                                onChange={(e) => setFramework(e.target.value as typeof framework)}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                                            >
                                                <option value="react">React</option>
                                                <option value="react-native">React Native</option>
                                                <option value="vue">Vue</option>
                                                <option value="html">HTML/CSS</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-white/50 mb-2 block">Styling</label>
                                            <select
                                                value={styling}
                                                onChange={(e) => setStyling(e.target.value as typeof styling)}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                                            >
                                                <option value="tailwind">Tailwind CSS</option>
                                                <option value="css-modules">CSS Modules</option>
                                                <option value="styled-components">Styled Components</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Drop Zone */}
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-white/10 rounded-2xl p-16 text-center cursor-pointer hover:border-white/20 hover:bg-white/[0.02] transition-all"
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="video/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileSelect(file);
                                            }}
                                            className="hidden"
                                        />
                                        <div
                                            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                                            style={{ background: accentGlow }}
                                        >
                                            <UploadIcon size={40} className="text-[#c8ff64]" />
                                        </div>
                                        <h3 className="text-lg font-medium text-white mb-2">
                                            Drop your screen recording here
                                        </h3>
                                        <p className="text-sm text-white/40 mb-4">
                                            or click to browse • MP4, WebM, MOV supported
                                        </p>
                                        <div className="flex items-center justify-center gap-6 text-xs text-white/30">
                                            <span className="flex items-center gap-1">
                                                <ClockIcon size={12} />
                                                Max 5 minutes
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <LayersIcon size={12} />
                                                Up to 30 keyframes
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tips */}
                                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                        <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                            <ZapIcon size={16} className="text-[#c8ff64]" />
                                            Tips for best results
                                        </h4>
                                        <ul className="text-xs text-white/50 space-y-2">
                                            <li>• Record at full screen resolution for pixel-perfect extraction</li>
                                            <li>• Include all UI states (hover, click, form interactions)</li>
                                            <li>• Navigate through all major screens/views</li>
                                            <li>• Pause briefly on each screen for better analysis</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Analyzing Stage */}
                            {stage === 'analyzing' && (
                                <div className="flex flex-col items-center justify-center h-full py-16">
                                    <div
                                        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6"
                                        style={{ background: accentGlow }}
                                    >
                                        <LoadingIcon size={48} className="text-[#c8ff64] animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2">Analyzing Video</h3>
                                    <p className="text-sm text-white/50 mb-6">{message}</p>

                                    {/* Progress Bar */}
                                    <div className="w-full max-w-md">
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ background: accentColor }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                        <p className="text-xs text-white/40 mt-2 text-center">{progress}%</p>
                                    </div>
                                </div>
                            )}

                            {/* Preview Stage */}
                            {stage === 'preview' && analysis && (
                                <div className="space-y-6">
                                    {/* Analysis Summary */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                            <div className="text-2xl font-bold text-white mb-1">
                                                {analysis.analysis.screenCount}
                                            </div>
                                            <div className="text-xs text-white/50">Screens Detected</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                            <div className="text-2xl font-bold text-white mb-1">
                                                {analysis.keyframeCount}
                                            </div>
                                            <div className="text-xs text-white/50">Keyframes</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                            <div className="text-2xl font-bold text-white mb-1">
                                                {analysis.suggestedComponents.length}
                                            </div>
                                            <div className="text-xs text-white/50">Components</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                            <div className="text-2xl font-bold capitalize" style={{ color: accentColor }}>
                                                {analysis.analysis.estimatedComplexity}
                                            </div>
                                            <div className="text-xs text-white/50">Complexity</div>
                                        </div>
                                    </div>

                                    {/* Frame Timeline */}
                                    <FrameTimeline
                                        frames={analysis.frames}
                                        selectedFrame={selectedFrame}
                                        onFrameSelect={setSelectedFrame}
                                        userJourney={analysis.userJourney}
                                    />

                                    {/* Selected Frame Preview */}
                                    {selectedFrame && (
                                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-medium text-white">Frame Preview</h4>
                                                <span className="text-xs text-white/40">
                                                    {(selectedFrame.timestamp / 1000).toFixed(1)}s
                                                    {selectedFrame.keyframe && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                                                            Keyframe
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="relative rounded-lg overflow-hidden bg-black/20">
                                                <img
                                                    src={`data:image/png;base64,${selectedFrame.image}`}
                                                    alt="Frame preview"
                                                    className="w-full h-auto"
                                                />
                                                {/* UI Element Overlays */}
                                                {selectedFrame.uiElements.map((el) => (
                                                    <div
                                                        key={el.id}
                                                        className="absolute border-2 border-cyan-400/50 rounded"
                                                        style={{
                                                            left: `${el.bounds.x}%`,
                                                            top: `${el.bounds.y}%`,
                                                            width: `${el.bounds.width}%`,
                                                            height: `${el.bounds.height}%`,
                                                        }}
                                                        title={el.label || el.type}
                                                    />
                                                ))}
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedFrame.uiElements.map((el) => (
                                                    <span
                                                        key={el.id}
                                                        className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/60"
                                                    >
                                                        {el.type}{el.label ? `: ${el.label}` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowDesignDNA(true)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                                        >
                                            <PaletteIcon size={16} />
                                            View Design DNA
                                        </button>
                                        <button
                                            onClick={() => setShowComponents(true)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                                        >
                                            <LayersIcon size={16} />
                                            View Components
                                        </button>
                                        <button
                                            onClick={handleGenerateCode}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                                            style={{
                                                background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                                color: '#000'
                                            }}
                                        >
                                            <ZapIcon size={16} />
                                            Generate Code
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Generating Stage */}
                            {stage === 'generating' && (
                                <div className="flex flex-col items-center justify-center h-full py-16">
                                    <div
                                        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6"
                                        style={{ background: accentGlow }}
                                    >
                                        <Code2Icon size={48} className="text-[#c8ff64] animate-pulse" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2">Generating Code</h3>
                                    <p className="text-sm text-white/50 mb-6">{message}</p>
                                    <LoadingIcon size={24} className="animate-spin text-white/30" />
                                </div>
                            )}

                            {/* Complete Stage */}
                            {stage === 'complete' && generatedCode && (
                                <div className="space-y-6">
                                    {/* Success Header */}
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <CheckCircleIcon size={32} className="text-emerald-400" />
                                        <div>
                                            <h3 className="text-lg font-medium text-white">Code Generated Successfully</h3>
                                            <p className="text-sm text-white/50">
                                                {generatedCode.components.length} components • {generatedCode.usage.outputTokens.toLocaleString()} tokens
                                            </p>
                                        </div>
                                    </div>

                                    {/* Generated Components */}
                                    <div className="space-y-4">
                                        {generatedCode.components.map((component, idx) => (
                                            <div
                                                key={idx}
                                                className="rounded-xl overflow-hidden border border-white/10"
                                            >
                                                <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03]">
                                                    <div className="flex items-center gap-2">
                                                        <FileCode2Icon size={16} className="text-[#c8ff64]" />
                                                        <span className="text-sm font-medium text-white">{component.name}</span>
                                                        <span className="text-xs text-white/40">{component.path}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(component.code)}
                                                        className="text-xs text-white/50 hover:text-white transition-colors"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                                <pre className="p-4 bg-black/30 text-xs text-white/70 overflow-x-auto max-h-64">
                                                    <code>{component.code}</code>
                                                </pre>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                const allCode = generatedCode.components.map(c =>
                                                    `// ${c.path}\n${c.code}`
                                                ).join('\n\n');
                                                navigator.clipboard.writeText(allCode);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                                        >
                                            <DownloadIcon size={16} />
                                            Copy All Code
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                                            style={{
                                                background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                                color: '#000'
                                            }}
                                        >
                                            <RefreshIcon size={16} />
                                            Clone Another
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Design DNA Modal */}
                {showDesignDNA && analysis && (
                    <DesignDNAPreview
                        designDNA={analysis.designDNA}
                        onClose={() => setShowDesignDNA(false)}
                    />
                )}

                {/* Components Modal */}
                {showComponents && analysis && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
                        onClick={() => setShowComponents(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden"
                            style={darkGlassPanel}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/5">
                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                    <LayersIcon size={20} className="text-[#c8ff64]" />
                                    Suggested Components
                                </h3>
                                <button
                                    onClick={() => setShowComponents(false)}
                                    className="p-2 hover:bg-white/5 rounded-lg"
                                >
                                    <XIcon size={16} className="text-white/40" />
                                </button>
                            </div>
                            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                                {analysis.suggestedComponents.map((comp, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-medium text-white">{comp.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                                                {comp.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/50 mb-3">{comp.description}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {comp.props.map((prop, pidx) => (
                                                <span
                                                    key={pidx}
                                                    className={`text-xs px-2 py-1 rounded ${
                                                        prop.required
                                                            ? 'bg-cyan-500/10 text-cyan-400'
                                                            : 'bg-white/5 text-white/40'
                                                    }`}
                                                >
                                                    {prop.name}: {prop.type}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}


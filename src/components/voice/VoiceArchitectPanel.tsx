/**
 * Voice Architect Panel
 *
 * Main panel combining all Voice Architect components.
 * Users can describe what they want verbally and convert it to code.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CloseIcon as X,
    MicIcon as Mic,
    WandIcon as Wand2,
    LoadingIcon as Loader2,
    ArrowRightIcon as ArrowRight,
    RefreshIcon as RefreshCw,
    VolumeIcon as Volume2,
    KeyboardIcon as Keyboard,
} from '../ui/icons';
import { VoiceRecordButton } from './VoiceRecordButton';
import { TranscriptionPanel } from './TranscriptionPanel';
import { IntentPreview } from './IntentPreview';
import { ClarificationModal } from './ClarificationModal';
import { PulsingVisualizer } from './VoiceVisualizer';

const accentColor = '#c8ff64';

interface Transcription {
    id: string;
    text: string;
    confidence: number;
    timestamp: string | Date;
    duration?: number;
}

interface ExtractedIntent {
    appType: string;
    appName?: string;
    description: string;
    features: Array<{
        name: string;
        description: string;
        priority: 'high' | 'medium' | 'low';
        complexity?: 'simple' | 'moderate' | 'complex';
    }>;
    designPreferences: Array<{
        category: 'color' | 'layout' | 'typography' | 'style' | 'animation';
        preference: string;
        specificity: 'explicit' | 'implied';
    }>;
    technicalRequirements: string[];
    ambiguities: Array<{
        id: string;
        topic: string;
        question: string;
        options?: string[];
        importance: 'blocking' | 'helpful' | 'optional';
    }>;
    confidence: number;
}

interface VoiceArchitectPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBuild: (buildPrompt: string, projectName: string) => void;
    projectId?: string;
}

type Step = 'record' | 'transcription' | 'intent' | 'building';

export function VoiceArchitectPanel({
    isOpen,
    onClose,
    onBuild,
    projectId,
}: VoiceArchitectPanelProps) {
    const [step, setStep] = useState<Step>('record');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [extractedIntent, setExtractedIntent] = useState<ExtractedIntent | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
    const [textInput, setTextInput] = useState('');

    // Clarification modal state
    const [clarificationModal, setClarificationModal] = useState<{
        isOpen: boolean;
        ambiguity: ExtractedIntent['ambiguities'][0] | null;
    }>({ isOpen: false, ambiguity: null });

    // Start a new session when panel opens
    useEffect(() => {
        if (isOpen && !sessionId) {
            startSession();
        }
    }, [isOpen]);

    // Start session
    const startSession = async () => {
        try {
            const response = await fetch('/api/voice/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId }),
            });

            const data = await response.json();
            if (data.success) {
                setSessionId(data.session.id);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start session');
        }
    };

    // Handle recording complete
    const handleRecordingComplete = useCallback(async (audioBlob: Blob, mimeType: string) => {
        if (!sessionId) return;

        setIsTranscribing(true);
        setError(null);

        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);

            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];

                const response = await fetch('/api/voice/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        sessionId,
                        audio: base64Audio,
                        mimeType,
                    }),
                });

                const data = await response.json();
                if (data.success) {
                    setTranscriptions(prev => [...prev, data.transcription]);
                    setStep('transcription');
                } else {
                    throw new Error(data.error);
                }

                setIsTranscribing(false);
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transcription failed');
            setIsTranscribing(false);
        }
    }, [sessionId]);

    // Handle text input submit
    const handleTextSubmit = async () => {
        if (!sessionId || !textInput.trim()) return;

        setIsTranscribing(true);
        setError(null);

        try {
            const response = await fetch('/api/voice/transcribe-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    sessionId,
                    text: textInput.trim(),
                }),
            });

            const data = await response.json();
            if (data.success) {
                setTranscriptions(prev => [...prev, data.transcription]);
                setTextInput('');
                setStep('transcription');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add text');
        } finally {
            setIsTranscribing(false);
        }
    };

    // Edit transcription
    const handleEditTranscription = async (id: string, newText: string) => {
        if (!sessionId) return;

        try {
            const response = await fetch(`/api/voice/transcription/${sessionId}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: newText }),
            });

            const data = await response.json();
            if (data.success) {
                setTranscriptions(prev =>
                    prev.map(t => t.id === id ? { ...t, text: newText } : t)
                );
                // Reset intent since transcription changed
                setExtractedIntent(null);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to edit');
        }
    };

    // Extract intent
    const handleExtractIntent = async () => {
        if (!sessionId || transcriptions.length === 0) return;

        setIsProcessing(true);
        setError(null);

        try {
            const response = await fetch('/api/voice/extract-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sessionId }),
            });

            const data = await response.json();
            if (data.success) {
                setExtractedIntent(data.intent);
                setStep('intent');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to extract intent');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle clarification
    const handleClarify = (ambiguity: ExtractedIntent['ambiguities'][0]) => {
        setClarificationModal({ isOpen: true, ambiguity });
    };

    // Submit clarification
    const handleSubmitClarification = async (ambiguityId: string, response: string) => {
        if (!sessionId) return;

        setIsProcessing(true);

        try {
            const apiResponse = await fetch('/api/voice/clarify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    sessionId,
                    ambiguityId,
                    response,
                }),
            });

            const data = await apiResponse.json();
            if (data.success) {
                setExtractedIntent(data.intent);
                setClarificationModal({ isOpen: false, ambiguity: null });
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Clarification failed');
        } finally {
            setIsProcessing(false);
        }
    };

    // Start build
    const handleStartBuild = async () => {
        if (!sessionId || !extractedIntent) return;

        setStep('building');
        setIsProcessing(true);

        try {
            const response = await fetch('/api/voice/to-build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sessionId }),
            });

            const data = await response.json();
            if (data.success) {
                onBuild(
                    data.buildRequest.buildPrompt,
                    data.buildRequest.suggestedProjectName
                );
                handleReset();
                onClose();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Build preparation failed');
            setStep('intent');
        } finally {
            setIsProcessing(false);
        }
    };

    // Reset session
    const handleReset = () => {
        if (sessionId) {
            fetch(`/api/voice/session/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            }).catch(() => {});
        }

        setSessionId(null);
        setTranscriptions([]);
        setExtractedIntent(null);
        setStep('record');
        setError(null);
        setTextInput('');
    };

    // Handle close
    const handleClose = () => {
        handleReset();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl z-50 flex flex-col overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.98) 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accentColor}20` }}
                                >
                                    <Mic size={20} style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Voice Architect</h2>
                                    <p className="text-xs text-white/50">Describe your app, we'll build it</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {transcriptions.length > 0 && (
                                    <button
                                        onClick={handleReset}
                                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                        title="Start over"
                                    >
                                        <RefreshCw size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Progress indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                            {['record', 'transcription', 'intent', 'building'].map((s, i) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                                            step === s
                                                ? 'scale-110'
                                                : ['record', 'transcription', 'intent', 'building'].indexOf(step) > i
                                                    ? 'opacity-50'
                                                    : 'opacity-30'
                                        }`}
                                        style={{
                                            background: step === s ? accentColor : 'rgba(255,255,255,0.1)',
                                            color: step === s ? 'black' : 'white',
                                        }}
                                    >
                                        {i + 1}
                                    </div>
                                    {i < 3 && (
                                        <div
                                            className="w-8 h-0.5"
                                            style={{
                                                background: ['record', 'transcription', 'intent', 'building'].indexOf(step) > i
                                                    ? accentColor
                                                    : 'rgba(255,255,255,0.1)',
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Error display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                                >
                                    <span className="flex-1">{error}</span>
                                    <button onClick={() => setError(null)}>
                                        <X size={16} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Main content */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <AnimatePresence mode="wait">
                                {/* Step 1: Record */}
                                {step === 'record' && (
                                    <motion.div
                                        key="record"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex-1 flex flex-col items-center justify-center p-8"
                                    >
                                        {/* Input mode toggle */}
                                        <div className="flex items-center gap-2 mb-8 p-1 rounded-lg bg-white/5">
                                            <button
                                                onClick={() => setInputMode('voice')}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                    inputMode === 'voice'
                                                        ? 'text-black'
                                                        : 'text-white/60 hover:text-white'
                                                }`}
                                                style={{
                                                    background: inputMode === 'voice' ? accentColor : 'transparent',
                                                }}
                                            >
                                                <Volume2 size={16} />
                                                Voice
                                            </button>
                                            <button
                                                onClick={() => setInputMode('text')}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                    inputMode === 'text'
                                                        ? 'text-black'
                                                        : 'text-white/60 hover:text-white'
                                                }`}
                                                style={{
                                                    background: inputMode === 'text' ? accentColor : 'transparent',
                                                }}
                                            >
                                                <Keyboard size={16} />
                                                Type
                                            </button>
                                        </div>

                                        {inputMode === 'voice' ? (
                                            <>
                                                <VoiceRecordButton
                                                    onRecordingComplete={handleRecordingComplete}
                                                    disabled={isTranscribing || !sessionId}
                                                    mode="toggle"
                                                />

                                                {isTranscribing && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="mt-8 flex flex-col items-center gap-3"
                                                    >
                                                        <PulsingVisualizer isActive={true} />
                                                        <p className="text-sm text-white/60">
                                                            Transcribing your voice...
                                                        </p>
                                                    </motion.div>
                                                )}

                                                <div className="mt-8 text-center max-w-md">
                                                    <h3 className="text-lg font-medium text-white mb-2">
                                                        Describe your app
                                                    </h3>
                                                    <p className="text-sm text-white/50">
                                                        Tell us what you want to build. Be as detailed as you like -
                                                        mention features, design preferences, or just share your vision.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full max-w-md">
                                                <textarea
                                                    value={textInput}
                                                    onChange={(e) => setTextInput(e.target.value)}
                                                    placeholder="Describe what you want to build..."
                                                    className="w-full h-48 bg-black/30 border border-white/10 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 transition-all"
                                                />
                                                <button
                                                    onClick={handleTextSubmit}
                                                    disabled={!textInput.trim() || isTranscribing}
                                                    className="w-full mt-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                                    style={{ background: accentColor, color: 'black' }}
                                                >
                                                    {isTranscribing ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <ArrowRight size={16} />
                                                    )}
                                                    Continue
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Step 2: Transcription */}
                                {step === 'transcription' && (
                                    <motion.div
                                        key="transcription"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        <TranscriptionPanel
                                            transcriptions={transcriptions}
                                            isProcessing={isTranscribing}
                                            onEditTranscription={handleEditTranscription}
                                            className="flex-1"
                                        />

                                        <div className="p-4 border-t border-white/10 space-y-3">
                                            {/* Add more input */}
                                            <div className="flex gap-2">
                                                <VoiceRecordButton
                                                    onRecordingComplete={handleRecordingComplete}
                                                    disabled={isTranscribing || isProcessing}
                                                    mode="toggle"
                                                    className="flex-shrink-0"
                                                />
                                                <div className="flex-1 text-xs text-white/40 flex items-center">
                                                    Add more details or continue to intent extraction
                                                </div>
                                            </div>

                                            {/* Extract intent button */}
                                            <button
                                                onClick={handleExtractIntent}
                                                disabled={isProcessing || transcriptions.length === 0}
                                                className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                                style={{ background: accentColor, color: 'black' }}
                                            >
                                                {isProcessing ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Wand2 size={16} />
                                                )}
                                                Extract Intent
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Intent Preview */}
                                {step === 'intent' && extractedIntent && (
                                    <motion.div
                                        key="intent"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex-1 overflow-y-auto p-4"
                                    >
                                        <IntentPreview
                                            intent={extractedIntent}
                                            onStartBuild={handleStartBuild}
                                            onClarify={handleClarify}
                                        />
                                    </motion.div>
                                )}

                                {/* Step 4: Building */}
                                {step === 'building' && (
                                    <motion.div
                                        key="building"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex-1 flex flex-col items-center justify-center p-8"
                                    >
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                            className="w-16 h-16 rounded-full border-4 border-t-transparent mb-6"
                                            style={{ borderColor: `${accentColor}40`, borderTopColor: accentColor }}
                                        />
                                        <h3 className="text-lg font-medium text-white mb-2">
                                            Preparing your build...
                                        </h3>
                                        <p className="text-sm text-white/50">
                                            Converting your voice description into a build plan
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Clarification modal */}
                        <ClarificationModal
                            isOpen={clarificationModal.isOpen}
                            ambiguity={clarificationModal.ambiguity}
                            onClose={() => setClarificationModal({ isOpen: false, ambiguity: null })}
                            onSubmit={handleSubmitClarification}
                            isSubmitting={isProcessing}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


/**
 * Transcription Panel
 *
 * Live transcription display with edit capability.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Check, X, MessageSquare, Loader2 } from 'lucide-react';

const accentColor = '#c8ff64';

interface Transcription {
    id: string;
    text: string;
    confidence: number;
    timestamp: string | Date;
    duration?: number;
}

interface TranscriptionPanelProps {
    transcriptions: Transcription[];
    isProcessing?: boolean;
    onEditTranscription?: (id: string, newText: string) => void;
    className?: string;
}

export function TranscriptionPanel({
    transcriptions,
    isProcessing = false,
    onEditTranscription,
    className = '',
}: TranscriptionPanelProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new transcriptions arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcriptions]);

    const handleStartEdit = (transcription: Transcription) => {
        setEditingId(transcription.id);
        setEditText(transcription.text);
    };

    const handleSaveEdit = () => {
        if (editingId && onEditTranscription) {
            onEditTranscription(editingId, editText);
        }
        setEditingId(null);
        setEditText('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const formatTime = (timestamp: string | Date) => {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.9) return 'text-green-400';
        if (confidence >= 0.7) return 'text-yellow-400';
        return 'text-orange-400';
    };

    if (transcriptions.length === 0 && !isProcessing) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
                >
                    <MessageSquare className="w-8 h-8" style={{ color: accentColor }} />
                </div>
                <p className="text-white/60 text-center">
                    Your voice transcription will appear here.
                    <br />
                    <span className="text-sm text-white/40">Start recording to begin.</span>
                </p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-medium text-white">Transcription</h3>
                <span className="text-xs text-white/40">
                    {transcriptions.length} segment{transcriptions.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Transcriptions */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
            >
                <AnimatePresence>
                    {transcriptions.map((transcription, index) => (
                        <motion.div
                            key={transcription.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative"
                        >
                            <div
                                className="p-3 rounded-lg border transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    borderColor: editingId === transcription.id
                                        ? accentColor
                                        : 'rgba(255,255,255,0.08)',
                                }}
                            >
                                {/* Editing mode */}
                                {editingId === transcription.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm resize-none focus:outline-none focus:ring-1"
                                            style={{ minHeight: '80px', borderColor: accentColor }}
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="p-1.5 rounded transition-colors"
                                                style={{ background: accentColor, color: 'black' }}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Text */}
                                        <p className="text-white text-sm leading-relaxed pr-8">
                                            {transcription.text}
                                        </p>

                                        {/* Meta info */}
                                        <div className="flex items-center gap-3 mt-2 text-xs">
                                            <span className="text-white/40">
                                                {formatTime(transcription.timestamp)}
                                            </span>
                                            <span className={getConfidenceColor(transcription.confidence)}>
                                                {Math.round(transcription.confidence * 100)}% confidence
                                            </span>
                                            {transcription.duration && (
                                                <span className="text-white/40">
                                                    {transcription.duration.toFixed(1)}s
                                                </span>
                                            )}
                                        </div>

                                        {/* Edit button */}
                                        {onEditTranscription && (
                                            <button
                                                onClick={() => handleStartEdit(transcription)}
                                                className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Processing indicator */}
                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 rounded-lg"
                        style={{ background: `${accentColor}10`, border: `1px dashed ${accentColor}40` }}
                    >
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                        <span className="text-sm text-white/60">Processing audio...</span>
                    </motion.div>
                )}
            </div>

            {/* Full transcription preview */}
            {transcriptions.length > 0 && (
                <div className="p-4 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-2">Combined transcription:</p>
                    <p className="text-sm text-white/80 line-clamp-3">
                        {transcriptions.map(t => t.text).join(' ')}
                    </p>
                </div>
            )}
        </div>
    );
}


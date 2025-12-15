/**
 * Clarification Modal
 *
 * Modal for answering clarification questions with option buttons.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon as X, HelpCircleIcon as HelpCircle, CheckIcon as Check, MicIcon as Mic } from '../ui/icons';
import { VoiceRecordButton } from './VoiceRecordButton';

const accentColor = '#c8ff64';

interface Ambiguity {
    id: string;
    topic: string;
    question: string;
    options?: string[];
    importance: 'blocking' | 'helpful' | 'optional';
}

interface ClarificationModalProps {
    isOpen: boolean;
    ambiguity: Ambiguity | null;
    onClose: () => void;
    onSubmit: (ambiguityId: string, response: string) => void;
    onVoiceResponse?: (ambiguityId: string, audioBlob: Blob, mimeType: string) => void;
    isSubmitting?: boolean;
}

export function ClarificationModal({
    isOpen,
    ambiguity,
    onClose,
    onSubmit,
    onVoiceResponse,
    isSubmitting = false,
}: ClarificationModalProps) {
    const [customResponse, setCustomResponse] = useState('');
    const [inputMode, setInputMode] = useState<'options' | 'text' | 'voice'>('options');

    if (!ambiguity) return null;

    const handleOptionClick = (option: string) => {
        onSubmit(ambiguity.id, option);
    };

    const handleCustomSubmit = () => {
        if (customResponse.trim()) {
            onSubmit(ambiguity.id, customResponse.trim());
            setCustomResponse('');
        }
    };

    const handleVoiceRecordComplete = (audioBlob: Blob, mimeType: string) => {
        if (onVoiceResponse) {
            onVoiceResponse(ambiguity.id, audioBlob, mimeType);
        }
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
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                    >
                        <div
                            className="w-full max-w-lg rounded-2xl border overflow-hidden"
                            style={{
                                background: 'linear-gradient(180deg, rgba(30,30,35,0.98) 0%, rgba(20,20,25,0.98) 100%)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center"
                                        style={{ background: `${accentColor}20` }}
                                    >
                                        <HelpCircle size={20} style={{ color: accentColor }} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">
                                            {ambiguity.topic}
                                        </h3>
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full"
                                            style={{
                                                background: ambiguity.importance === 'blocking'
                                                    ? 'rgba(239, 68, 68, 0.2)'
                                                    : `${accentColor}20`,
                                                color: ambiguity.importance === 'blocking'
                                                    ? '#ef4444'
                                                    : accentColor,
                                            }}
                                        >
                                            {ambiguity.importance === 'blocking' ? 'Required' : 'Optional'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Question */}
                            <div className="p-6">
                                <p className="text-white text-lg mb-6">
                                    {ambiguity.question}
                                </p>

                                {/* Input mode tabs */}
                                <div className="flex gap-2 mb-4">
                                    {ambiguity.options && ambiguity.options.length > 0 && (
                                        <button
                                            onClick={() => setInputMode('options')}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                                inputMode === 'options'
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-white/50 hover:text-white'
                                            }`}
                                        >
                                            Quick options
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setInputMode('text')}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                            inputMode === 'text'
                                                ? 'bg-white/20 text-white'
                                                : 'text-white/50 hover:text-white'
                                        }`}
                                    >
                                        Type response
                                    </button>
                                    {onVoiceResponse && (
                                        <button
                                            onClick={() => setInputMode('voice')}
                                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                                                inputMode === 'voice'
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-white/50 hover:text-white'
                                            }`}
                                        >
                                            <Mic size={14} />
                                            Voice
                                        </button>
                                    )}
                                </div>

                                {/* Options */}
                                {inputMode === 'options' && ambiguity.options && (
                                    <div className="space-y-2">
                                        {ambiguity.options.map((option, index) => (
                                            <motion.button
                                                key={index}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => handleOptionClick(option)}
                                                disabled={isSubmitting}
                                                className="w-full p-4 rounded-xl border text-left transition-all hover:scale-[1.02] group disabled:opacity-50"
                                                style={{
                                                    borderColor: 'rgba(255,255,255,0.1)',
                                                    background: 'rgba(255,255,255,0.03)',
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white">{option}</span>
                                                    <div
                                                        className="w-6 h-6 rounded-full border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        style={{ borderColor: accentColor, color: accentColor }}
                                                    >
                                                        <Check size={16} />
                                                    </div>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                )}

                                {/* Text input */}
                                {inputMode === 'text' && (
                                    <div className="space-y-3">
                                        <textarea
                                            value={customResponse}
                                            onChange={(e) => setCustomResponse(e.target.value)}
                                            placeholder="Type your response..."
                                            className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 transition-all"
                                            style={{
                                                // @ts-expect-error CSS custom property for focus ring
                                                '--tw-ring-color': accentColor,
                                            }}
                                            disabled={isSubmitting}
                                        />
                                        <button
                                            onClick={handleCustomSubmit}
                                            disabled={!customResponse.trim() || isSubmitting}
                                            className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{
                                                background: accentColor,
                                                color: 'black',
                                            }}
                                        >
                                            <Check size={16} />
                                            Submit Response
                                        </button>
                                    </div>
                                )}

                                {/* Voice input */}
                                {inputMode === 'voice' && onVoiceResponse && (
                                    <div className="flex flex-col items-center py-6">
                                        <VoiceRecordButton
                                            onRecordingComplete={handleVoiceRecordComplete}
                                            mode="toggle"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6">
                                <p className="text-xs text-white/40 text-center">
                                    Press Escape to close • Your answer helps build exactly what you want
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


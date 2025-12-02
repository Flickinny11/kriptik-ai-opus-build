/**
 * Chat Interface - Premium Liquid Glass AI Conversation Panel
 *
 * Features:
 * - Real-time streaming from multi-agent orchestrator
 * - Cost estimation before generation
 * - Agent progress visualization
 * - Liquid Glass 3D styling throughout
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, StopCircle, Pause, Play,
    User, Loader2, ArrowRight, Image, Wand2
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { orchestrator } from '../../lib/AgentOrchestrator';
import { useAgentStore } from '../../store/useAgentStore';
import AgentProgress from './AgentProgress';
import AgentTerminal from './AgentTerminal';
import { costEstimator } from '../../lib/CostEstimator';
import { useCostStore } from '../../store/useCostStore';
import CostEstimatorModal from '../cost/CostEstimatorModal';
import CostMonitor from '../cost/CostMonitor';
import CostBreakdownModal from '../cost/CostBreakdownModal';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    agentType?: string;
}

const suggestions = [
    "Build a dashboard with analytics charts",
    "Create a user authentication system",
    "Design a landing page with pricing",
    "Add a contact form with validation",
];

// Liquid Glass Button Component
function GlassButton({ 
    children, 
    onClick, 
    disabled = false,
    variant = 'default',
    size = 'md',
    className = ''
}: { 
    children: React.ReactNode; 
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);
    
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12 rounded-2xl',
    };
    
    const getStyles = () => {
        if (disabled) {
            return {
                background: 'linear-gradient(145deg, rgba(200,200,200,0.3) 0%, rgba(180,180,180,0.2) 100%)',
                boxShadow: 'none',
                cursor: 'not-allowed',
            };
        }
        
        if (variant === 'primary') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,180,150,0.85) 0%, rgba(255,160,130,0.7) 100%)'
                    : 'linear-gradient(145deg, rgba(255,200,170,0.75) 0%, rgba(255,180,150,0.6) 100%)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(255, 140, 100, 0.3), inset 0 0 20px rgba(255, 180, 140, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.6)`
                    : `0 4px 16px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.5)`,
            };
        }
        
        if (variant === 'danger') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(239,68,68,0.3) 0%, rgba(220,38,38,0.2) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: isHovered
                    ? `0 4px 16px rgba(239, 68, 68, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(239, 68, 68, 0.3)`
                    : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
            };
        }
        
        return {
            background: isHovered
                ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
            boxShadow: isHovered
                ? `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.95), 0 0 0 1px rgba(255,255,255,0.6)`
                : `0 2px 10px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
        };
    };
    
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`${sizeClasses[size]} rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${className}`}
            style={{
                ...getStyles(),
                backdropFilter: 'blur(16px)',
                transform: isHovered && !disabled ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
            }}
        >
            {children}
            
            {/* Shine effect */}
            {!disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isHovered ? '150%' : '-100%',
                        width: '60%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        transform: 'skewX(-15deg)',
                        transition: 'left 0.5s ease',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </button>
    );
}

// Liquid Glass Message Card
function MessageCard({ 
    children, 
    isUser = false,
    isSystem = false 
}: { 
    children: React.ReactNode;
    isUser?: boolean;
    isSystem?: boolean;
}) {
    return (
        <div
            className="max-w-[85%] p-4 rounded-2xl transition-all duration-300"
            style={{
                background: isUser
                    ? 'linear-gradient(145deg, rgba(255,180,150,0.6) 0%, rgba(255,160,130,0.45) 100%)'
                    : isSystem
                        ? 'linear-gradient(145deg, rgba(200,200,200,0.3) 0%, rgba(180,180,180,0.2) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
                backdropFilter: 'blur(20px)',
                boxShadow: isUser
                    ? `0 8px 24px rgba(255, 140, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : `0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`,
            }}
        >
            {children}
        </div>
    );
}

// Suggestion Card
function SuggestionCard({ 
    text, 
    onClick, 
    delay 
}: { 
    text: string; 
    onClick: () => void;
    delay: number;
}) {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="w-full text-left p-4 rounded-xl transition-all duration-300 group"
            style={{
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,220,200,0.5) 0%, rgba(255,200,170,0.35) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                backdropFilter: 'blur(16px)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(255, 140, 100, 0.12), inset 0 0 15px rgba(255, 160, 120, 0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : `0 2px 10px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            }}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{text}</span>
                <ArrowRight 
                    className="w-4 h-4 transition-all duration-300" 
                    style={{ 
                        color: isHovered ? '#c25a00' : '#999',
                        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                    }}
                />
            </div>
        </motion.button>
    );
}

export default function ChatInterface() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { globalStatus } = useAgentStore();
    const { setEstimate, resetSessionCost } = useCostStore();

    const [showCostEstimator, setShowCostEstimator] = useState(false);
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, globalStatus]);

    // Listen for completion to show breakdown
    useEffect(() => {
        if (globalStatus === 'completed') {
            setShowBreakdown(true);
        }
    }, [globalStatus]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const estimate = costEstimator.estimate(input);
        setEstimate(estimate);
        setPendingPrompt(input);
        setShowCostEstimator(true);
    };

    const confirmGeneration = async () => {
        if (!pendingPrompt) return;

        setShowCostEstimator(false);
        resetSessionCost();

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: pendingPrompt,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setPendingPrompt(null);
        setIsTyping(true);

        const systemMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            role: 'system',
            content: 'Starting multi-agent orchestration...',
            timestamp: new Date(),
            agentType: 'orchestrator',
        };
        setMessages(prev => [...prev, systemMessage]);

        await orchestrator.start(pendingPrompt);
        setIsTyping(false);
    };

    const handlePauseResume = () => {
        if (globalStatus === 'running') {
            orchestrator.pause();
        } else if (globalStatus === 'paused') {
            orchestrator.resume();
        }
    };

    const handleStop = () => {
        orchestrator.stop();
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            <CostEstimatorModal
                open={showCostEstimator}
                onOpenChange={setShowCostEstimator}
                onConfirm={confirmGeneration}
            />

            <CostBreakdownModal
                open={showBreakdown}
                onOpenChange={setShowBreakdown}
            />

            {/* Header - Liquid Glass */}
            <div 
                className="p-4 flex justify-between items-center shrink-0"
                style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                            boxShadow: `0 4px 12px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`,
                        }}
                    >
                        <Wand2 className="w-5 h-5" style={{ color: '#92400e' }} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                            Build Assistant
                        </h2>
                        <p className="text-xs" style={{ color: globalStatus === 'running' ? '#c25a00' : '#666' }}>
                            {globalStatus === 'running' ? 'Building...' :
                             globalStatus === 'paused' ? 'Paused' : 'Ready to create'}
                        </p>
                    </div>
                </div>
                
                {globalStatus !== 'idle' && (
                    <div className="flex gap-2">
                        <GlassButton
                            onClick={handlePauseResume}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                            size="sm"
                        >
                            {globalStatus === 'paused' 
                                ? <Play className="h-4 w-4" style={{ color: '#1a1a1a' }} /> 
                                : <Pause className="h-4 w-4" style={{ color: '#1a1a1a' }} />
                            }
                        </GlassButton>
                        <GlassButton
                            onClick={handleStop}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                            variant="danger"
                            size="sm"
                        >
                            <StopCircle className="h-4 w-4" style={{ color: '#dc2626' }} />
                        </GlassButton>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative min-h-0">
                {globalStatus === 'idle' ? (
                    <ScrollArea className="h-full" ref={scrollRef}>
                        <div className="p-4 space-y-4">
                            {/* Empty state with suggestions */}
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center py-8"
                                >
                                    <div 
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)',
                                            boxShadow: `0 8px 24px rgba(255, 140, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`,
                                        }}
                                    >
                                        <Wand2 className="w-8 h-8" style={{ color: '#92400e' }} />
                                    </div>
                                    <h3 
                                        className="text-lg font-semibold mb-2"
                                        style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}
                                    >
                                        What would you like to build?
                                    </h3>
                                    <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#666' }}>
                                        Describe your app and watch our AI agents build it for you.
                                    </p>

                                    {/* Suggestions */}
                                    <div className="space-y-2">
                                        {suggestions.map((suggestion, i) => (
                                            <SuggestionCard
                                                key={i}
                                                text={suggestion}
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                delay={i * 0.1}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Messages */}
                            <AnimatePresence mode="popLayout">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {msg.role !== 'user' && (
                                            <div 
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    background: msg.role === 'system'
                                                        ? 'linear-gradient(145deg, rgba(200,200,200,0.4) 0%, rgba(180,180,180,0.25) 100%)'
                                                        : 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                                                    boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9)`,
                                                }}
                                            >
                                                <Wand2 
                                                    className="w-4 h-4" 
                                                    style={{ color: msg.role === 'system' ? '#666' : '#92400e' }}
                                                />
                                            </div>
                                        )}

                                        <MessageCard isUser={msg.role === 'user'} isSystem={msg.role === 'system'}>
                                            {msg.agentType && (
                                                <div 
                                                    className="text-[10px] mb-1 font-semibold uppercase tracking-wider"
                                                    style={{ color: '#c25a00' }}
                                                >
                                                    {msg.agentType}
                                                </div>
                                            )}
                                            <p 
                                                className="text-sm whitespace-pre-wrap"
                                                style={{ color: msg.role === 'user' ? '#92400e' : '#1a1a1a' }}
                                            >
                                                {msg.content}
                                            </p>
                                            <div 
                                                className="text-[10px] mt-2"
                                                style={{ color: '#999' }}
                                            >
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </MessageCard>

                                        {msg.role === 'user' && (
                                            <div 
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                                                    boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9)`,
                                                }}
                                            >
                                                <User className="w-4 h-4" style={{ color: '#1a1a1a' }} />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Typing indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3"
                                >
                                    <div 
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                                            boxShadow: `0 2px 8px rgba(255, 140, 100, 0.15)`,
                                        }}
                                    >
                                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#92400e' }} />
                                    </div>
                                    <MessageCard>
                                        <div className="flex gap-1.5 py-1">
                                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c25a00', animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c25a00', animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c25a00', animationDelay: '300ms' }} />
                                        </div>
                                    </MessageCard>
                                </motion.div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="h-full flex flex-col">
                        <div 
                            className="p-4 shrink-0"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                        >
                            <AgentProgress />
                        </div>
                        <div 
                            className="flex-1 overflow-hidden min-h-0 m-2 rounded-xl"
                            style={{
                                background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
                                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
                            }}
                        >
                            <AgentTerminal />
                        </div>
                    </div>
                )}

                {/* Cost Monitor Overlay */}
                <AnimatePresence>
                    {globalStatus === 'running' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-4 right-4 z-10"
                        >
                            <CostMonitor />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area - Liquid Glass Pane - Sticky on mobile */}
            <div 
                className="p-3 sm:p-4 shrink-0 lg:relative"
                style={{ 
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.4) 100%)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Glass Input Container */}
                <div 
                    className="rounded-2xl p-2.5 sm:p-3 transition-all duration-300"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        boxShadow: `
                            0 8px 32px rgba(0,0,0,0.08),
                            inset 0 2px 4px rgba(255,255,255,0.95),
                            inset 0 -1px 2px rgba(0,0,0,0.02),
                            0 0 0 1px rgba(255,255,255,0.6)
                        `,
                    }}
                >
                    <div className="flex gap-1.5 sm:gap-2 items-end">
                        {/* Attach Image Button */}
                        <GlassButton size="sm">
                            <Paperclip className="h-4 w-4" style={{ color: '#1a1a1a' }} />
                        </GlassButton>
                        
                        {/* Image to Code Button - Hidden on very small screens */}
                        <div className="hidden xs:block">
                            <GlassButton size="sm">
                                <Image className="h-4 w-4" style={{ color: '#1a1a1a' }} />
                            </GlassButton>
                        </div>

                        {/* Text Input */}
                        <div className="flex-1">
                            <textarea
                                ref={inputRef}
                                placeholder="Describe what you want to build..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={globalStatus !== 'idle'}
                                rows={1}
                                className="w-full resize-none bg-transparent border-none px-2 sm:px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                                style={{ 
                                    minHeight: '40px', 
                                    maxHeight: '120px',
                                    color: '#1a1a1a',
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                }}
                            />
                        </div>

                        {/* Send Button */}
                        <GlassButton
                            onClick={handleSend}
                            disabled={globalStatus !== 'idle' || !input.trim()}
                            variant="primary"
                            size="md"
                        >
                            <Send className="h-4 w-4" style={{ color: '#92400e' }} />
                        </GlassButton>
                    </div>
                </div>

                {/* Quick hint - Hidden on mobile */}
                <div 
                    className="hidden sm:flex items-center justify-center gap-4 mt-3 text-[10px]"
                    style={{ color: '#999' }}
                >
                    <span>Press Enter to send</span>
                    <span style={{ color: '#ccc' }}>•</span>
                    <span>Shift+Enter for new line</span>
                </div>
            </div>
        </div>
    );
}

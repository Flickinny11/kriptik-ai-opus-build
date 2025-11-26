/**
 * Chat Interface - Premium AI conversation panel
 *
 * Features:
 * - Real-time streaming from multi-agent orchestrator
 * - Cost estimation before generation
 * - Agent progress visualization
 * - Premium message styling with animations
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, Mic, StopCircle, Pause, Play,
    Sparkles, Bot, User, Loader2, Zap, ArrowRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
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

        // Calculate estimate before proceeding
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

        // Add system message
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
        <div className="flex flex-col h-full bg-background/50">
            <CostEstimatorModal
                open={showCostEstimator}
                onOpenChange={setShowCostEstimator}
                onConfirm={confirmGeneration}
            />

            <CostBreakdownModal
                open={showBreakdown}
                onOpenChange={setShowBreakdown}
            />

            {/* Header */}
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/30 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm">AI Assistant</h2>
                        <p className="text-xs text-muted-foreground">
                            {globalStatus === 'running' ? 'Working...' :
                             globalStatus === 'paused' ? 'Paused' : 'Ready'}
                        </p>
                    </div>
                </div>
                {globalStatus !== 'idle' && (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handlePauseResume}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                        >
                            {globalStatus === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleStop}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                            className="text-destructive hover:text-destructive"
                        >
                            <StopCircle className="h-4 w-4" />
                        </Button>
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
                                    className="text-center py-12"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
                                        <Sparkles className="w-8 h-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">What would you like to build?</h3>
                                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                        Describe your app in natural language and our AI agents will build it for you.
                                    </p>

                                    {/* Suggestions */}
                                    <div className="space-y-2">
                                        {suggestions.map((suggestion, i) => (
                                            <motion.button
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className="w-full text-left p-3 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all duration-200 group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm">{suggestion}</span>
                                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </motion.button>
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
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                msg.role === 'system'
                                                    ? 'bg-muted'
                                                    : 'bg-gradient-to-br from-primary to-accent'
                                            }`}>
                                                <Bot className={`w-4 h-4 ${msg.role === 'system' ? 'text-muted-foreground' : 'text-white'}`} />
                                            </div>
                                        )}

                                        <Card
                                            variant={msg.role === 'user' ? 'default' : 'glass'}
                                            className={`max-w-[85%] p-3 ${
                                                msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : msg.role === 'system'
                                                    ? 'bg-muted/50 border-border/50'
                                                    : 'bg-card/80'
                                            }`}
                                        >
                                            {msg.agentType && (
                                                <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
                                                    {msg.agentType}
                                                </div>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            <div className="text-[10px] text-muted-foreground/60 mt-2">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </Card>

                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4 text-muted-foreground" />
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
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    </div>
                                    <Card variant="glass" className="p-3 bg-card/80">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </Card>
                                </motion.div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-border/50 bg-muted/20 shrink-0">
                            <AgentProgress />
                        </div>
                        <div className="flex-1 overflow-hidden bg-[#0d1117] min-h-0">
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

            {/* Input Area */}
            <div className="p-4 border-t border-border/50 bg-card/30 backdrop-blur-sm shrink-0">
                <div className="flex gap-2 items-end">
                    <Button variant="ghost" size="icon-sm" className="shrink-0">
                        <Paperclip className="h-4 w-4" />
                    </Button>

                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            placeholder="Describe your app... (Shift+Enter for new line)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={globalStatus !== 'idle'}
                            rows={1}
                            className="w-full resize-none bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 disabled:opacity-50"
                            style={{ minHeight: '44px', maxHeight: '120px' }}
                        />
                    </div>

                    <Button
                        onClick={handleSend}
                        disabled={globalStatus !== 'idle' || !input.trim()}
                        variant="gradient"
                        size="icon"
                        className="shrink-0"
                    >
                        <Send className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="icon-sm" className="shrink-0">
                        <Mic className="h-4 w-4" />
                    </Button>
                </div>

                {/* Quick hint */}
                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" /> AI-powered
                    </span>
                    <span>•</span>
                    <span>Multi-agent orchestration</span>
                    <span>•</span>
                    <span>Production-ready code</span>
                </div>
            </div>
        </div>
    );
}

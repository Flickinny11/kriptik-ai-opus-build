import { useRef, useEffect, useState, useCallback } from 'react';
import {
    RefreshIcon,
    SmartphoneIcon,
    TabletIcon,
    MonitorIcon,
    MousePointer2Icon
} from '../../components/ui/icons';
import { Button } from '../ui/button';
import { useEditorStore } from '../../store/useEditorStore';
import { cn } from '../../lib/utils';
import { AIInteractionOverlay, type AgentPhase, type AgentEvent } from './AIInteractionOverlay';

// API URL for backend requests
const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';

export default function PreviewWindow() {
    const {
        isSelectionMode,
        toggleSelectionMode,
        setSelectedElement,
        isBuilding,
        buildPhase,
        currentBuildFile,
    } = useEditorStore();

    // AI Overlay state
    const [isAIActive, setIsAIActive] = useState(false);
    const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>();
    const containerRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Sync with store build state
    useEffect(() => {
        if (isBuilding) {
            setIsAIActive(true);
            setAgentPhase(buildPhase as AgentPhase);
        } else if (buildPhase === 'complete') {
            setAgentPhase('complete');
            const timeout = setTimeout(() => {
                setIsAIActive(false);
                setAgentPhase('idle');
            }, 2000);
            return () => clearTimeout(timeout);
        } else if (buildPhase === 'error') {
            setAgentPhase('error');
            const timeout = setTimeout(() => {
                setIsAIActive(false);
                setAgentPhase('idle');
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [isBuilding, buildPhase]);

    // Handle agent events from SSE
    const handleAgentEvent = useCallback((event: AgentEvent) => {
        if (event.type === 'status_change' && event.data?.status) {
            setAgentPhase(event.data.status);
            setIsAIActive(event.data.status !== 'idle');
        } else if (event.type === 'cursor_move' && event.data) {
            if (event.data.cursorX !== undefined && event.data.cursorY !== undefined) {
                setCursorPosition({ x: event.data.cursorX, y: event.data.cursorY });
            }
        }
    }, []);

    // Connect to agent event stream
    useEffect(() => {
        try {
            const eventSource = new EventSource(`${API_URL}/api/agent/activity-stream`);
            eventSource.onmessage = (event) => {
                try {
                    const agentEvent: AgentEvent = JSON.parse(event.data);
                    handleAgentEvent(agentEvent);
                } catch {}
            };
            eventSource.onerror = () => eventSource.close();
            eventSourceRef.current = eventSource;
        } catch {}

        return () => {
            eventSourceRef.current?.close();
        };
    }, [handleAgentEvent]);

    const handleElementClick = (e: React.MouseEvent) => {
        if (!isSelectionMode) return;

        e.preventDefault();
        e.stopPropagation();

        // In a real implementation, we would use a more sophisticated method to map
        // DOM elements to source code (e.g. using data-source-loc attributes injected by babel plugin)
        // For this demo, we'll simulate finding a component

        setSelectedElement({
            file: 'src/components/Hero.tsx',
            line: 10, // Simulated line number
            componentName: 'Hero'
        });

        toggleSelectionMode(); // Turn off selection mode after picking
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm">
                            <SmartphoneIcon size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm">
                            <TabletIcon size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm bg-background shadow-sm">
                            <MonitorIcon size={12} />
                        </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">1280 x 800</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isSelectionMode ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleSelectionMode}
                        title="Select Element"
                    >
                        <MousePointer2Icon size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <RefreshIcon size={16} />
                    </Button>
                </div>
            </div>
            <div ref={containerRef} className="flex-1 bg-muted/50 p-8 flex items-center justify-center overflow-hidden relative">
                {/* AI Interaction Overlay */}
                <AIInteractionOverlay
                    isActive={isAIActive}
                    agentPhase={agentPhase}
                    currentFile={currentBuildFile || undefined}
                    cursorPosition={cursorPosition}
                    showCursor={agentPhase === 'coding' || agentPhase === 'thinking'}
                    showStatus={true}
                    showFileIndicator={!!currentBuildFile}
                />

                <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden border border-border relative">
                    {/* Simulated App Content for Selection Demo */}
                    <div
                        className={cn(
                            "w-full h-full p-8 overflow-auto",
                            isSelectionMode && "cursor-crosshair [&_*]:hover:outline [&_*]:hover:outline-2 [&_*]:hover:outline-primary [&_*]:hover:bg-primary/5"
                        )}
                        onClick={handleElementClick}
                    >
                        <div className="max-w-2xl mx-auto space-y-8">
                            <h1 className="text-4xl font-bold text-gray-900">Welcome to KripTik AI</h1>
                            <p className="text-lg text-gray-600">
                                Build production-ready apps at the speed of thought.
                                Our AI-powered editor helps you write better code, faster.
                            </p>
                            <div className="flex gap-4">
                                <button className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                                    Get Started
                                </button>
                                <button className="px-6 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors text-gray-900">
                                    Learn More
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mt-12">
                                <div className="p-6 border border-gray-100 rounded-xl bg-gray-50">
                                    <h3 className="font-semibold mb-2 text-gray-900">AI Powered</h3>
                                    <p className="text-sm text-gray-500">Smart suggestions and automated refactoring.</p>
                                </div>
                                <div className="p-6 border border-gray-100 rounded-xl bg-gray-50">
                                    <h3 className="font-semibold mb-2 text-gray-900">Production Ready</h3>
                                    <p className="text-sm text-gray-500">Built-in quality checks and deployment pipelines.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isSelectionMode && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">
                            Select an element to edit
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

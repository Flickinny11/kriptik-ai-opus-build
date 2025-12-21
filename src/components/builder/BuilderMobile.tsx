/**
 * BuilderMobile - Mobile-optimized Builder layout (<768px)
 *
 * Features:
 * - Single panel view with chat/preview toggle
 * - Swipe gesture navigation between panels
 * - Compact header with project status and deploy button
 * - FAB button for quick actions
 * - Integration with MobileQuickActionsSheet
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusIcons } from '../ui/icons';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { startViewTransition } from '../../utils/viewTransitions';
import ChatInterface from './ChatInterface';
import SandpackPreviewWindow from './SandpackPreview';
import MobileQuickActionsSheet from './MobileQuickActionsSheet';
import type { IntelligenceSettings } from './IntelligenceToggles';

interface BuilderMobileProps {
    projectId?: string;
    projectName: string;
    intelligenceSettings: IntelligenceSettings;
    onNavigateDashboard: () => void;
    onDeploy: () => void;
    onShowQualityReport: () => void;
    onShowMemory: () => void;
    onShowIntegrations: () => void;
    onShowGhostMode: () => void;
    onShowAgentPanel: () => void;
}

type MobileView = 'chat' | 'preview';

// Liquid glass panel style
const liquidGlassPanel = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 50%, rgba(248,248,250,0.5) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 20px 60px rgba(0,0,0,0.1),
        0 8px 24px rgba(0,0,0,0.08),
        inset 0 2px 4px rgba(255,255,255,0.9),
        inset 0 -1px 2px rgba(0,0,0,0.02),
        0 0 0 1px rgba(255,255,255,0.5)
    `,
};

// Mobile header style
const mobileHeaderStyle = {
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: `
        0 4px 30px rgba(0,0,0,0.3),
        0 2px 8px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255,255,255,0.1)
    `,
};

export default function BuilderMobile({
    projectId,
    projectName,
    intelligenceSettings,
    onNavigateDashboard,
    onDeploy,
    onShowQualityReport,
    onShowMemory,
    onShowIntegrations,
    onShowGhostMode,
    onShowAgentPanel,
}: BuilderMobileProps) {
    const [activeView, setActiveView] = useState<MobileView>('chat');
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [swipeProgress, setSwipeProgress] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    const { prefersReducedMotion, getTransition } = useReducedMotion();

    // Handle view change with View Transitions API
    const changeView = useCallback((newView: MobileView) => {
        if (newView === activeView) return;

        startViewTransition(() => {
            setActiveView(newView);
        });
    }, [activeView]);

    // Swipe gesture handlers
    const swipeHandlers = useSwipeGesture(
        {
            onSwipeLeft: () => changeView('preview'),
            onSwipeRight: () => changeView('chat'),
            onSwipeProgress: (progress, direction) => {
                if (direction === 'left' && activeView === 'chat') {
                    setSwipeProgress(progress);
                } else if (direction === 'right' && activeView === 'preview') {
                    setSwipeProgress(-progress);
                }
            },
            onSwipeCancel: () => setSwipeProgress(0),
        },
        {
            threshold: 50,
            velocityThreshold: 0.3,
            directions: ['left', 'right'],
            enabled: true,
        }
    );

    // Reset swipe progress after view change
    const handleViewChange = useCallback((view: MobileView) => {
        setSwipeProgress(0);
        changeView(view);
    }, [changeView]);

    // Animation variants for view transitions
    const viewVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    };

    const direction = activeView === 'preview' ? 1 : -1;

    return (
        <div
            className="h-full flex flex-col"
            style={{ background: 'linear-gradient(180deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
        >
            {/* Mobile Header */}
            <header
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={mobileHeaderStyle}
            >
                {/* Left: Back button and project info */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onNavigateDashboard}
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <StatusIcons.ChevronLeftIcon size={20} className="text-white" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm text-white font-medium truncate max-w-[120px]">
                            {projectName || projectId || 'New Project'}
                        </span>
                    </div>
                </div>

                {/* Right: Deploy button */}
                <button
                    onClick={onDeploy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                        boxShadow: '0 4px 12px rgba(255, 140, 100, 0.2)',
                    }}
                >
                    <StatusIcons.CloudIcon size={16} className="text-stone-900" />
                    <span className="text-sm font-medium text-stone-900">Deploy</span>
                </button>
            </header>

            {/* View Toggle */}
            <div className="px-4 py-2 flex gap-2">
                <button
                    onClick={() => handleViewChange('chat')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                    style={{
                        background: activeView === 'chat'
                            ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                            : 'rgba(255,255,255,0.3)',
                        boxShadow: activeView === 'chat'
                            ? 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(0,0,0,0.05)'
                            : 'none',
                    }}
                >
                    <StatusIcons.MessageSquareIcon size={18} className={activeView === 'chat' ? 'text-amber-700' : 'text-stone-500'} />
                    <span className={`text-sm font-medium ${activeView === 'chat' ? 'text-amber-700' : 'text-stone-500'}`}>
                        Chat
                    </span>
                </button>
                <button
                    onClick={() => handleViewChange('preview')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                    style={{
                        background: activeView === 'preview'
                            ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                            : 'rgba(255,255,255,0.3)',
                        boxShadow: activeView === 'preview'
                            ? 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(0,0,0,0.05)'
                            : 'none',
                    }}
                >
                    <StatusIcons.EyeIcon size={18} className={activeView === 'preview' ? 'text-amber-700' : 'text-stone-500'} />
                    <span className={`text-sm font-medium ${activeView === 'preview' ? 'text-amber-700' : 'text-stone-500'}`}>
                        Preview
                    </span>
                </button>
            </div>

            {/* Swipe indicator dots */}
            <div className="flex justify-center gap-2 py-2">
                <div
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{
                        background: activeView === 'chat' ? '#c25a00' : 'rgba(0,0,0,0.15)',
                    }}
                />
                <div
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{
                        background: activeView === 'preview' ? '#c25a00' : 'rgba(0,0,0,0.15)',
                    }}
                />
            </div>

            {/* Main Content Area with Swipe */}
            <div
                ref={contentRef}
                className="flex-1 overflow-hidden relative mx-2 mb-2 rounded-2xl"
                style={{
                    ...liquidGlassPanel,
                    transform: swipeProgress !== 0 ? `translateX(${swipeProgress * -30}px)` : undefined,
                    transition: swipeProgress === 0 ? 'transform 0.3s ease' : undefined,
                }}
                {...swipeHandlers.bind}
            >
                <AnimatePresence mode="wait" custom={direction}>
                    {activeView === 'chat' && (
                        <motion.div
                            key="chat"
                            custom={direction}
                            variants={prefersReducedMotion ? undefined : viewVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={getTransition(0.25)}
                            className="absolute inset-0"
                        >
                            <ChatInterface intelligenceSettings={intelligenceSettings} projectId={projectId} />
                        </motion.div>
                    )}
                    {activeView === 'preview' && (
                        <motion.div
                            key="preview"
                            custom={direction}
                            variants={prefersReducedMotion ? undefined : viewVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={getTransition(0.25)}
                            className="absolute inset-0"
                        >
                            <SandpackPreviewWindow />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* FAB for Quick Actions */}
            <button
                onClick={() => setShowQuickActions(true)}
                className="glass-fab"
                aria-label="Quick Actions"
            >
                <StatusIcons.PlusIcon size={24} />
            </button>

            {/* Quick Actions Bottom Sheet */}
            <MobileQuickActionsSheet
                isOpen={showQuickActions}
                onClose={() => setShowQuickActions(false)}
                onAction={(action) => {
                    setShowQuickActions(false);
                    switch (action) {
                        case 'quality':
                            onShowQualityReport();
                            break;
                        case 'memory':
                            onShowMemory();
                            break;
                        case 'integrations':
                            onShowIntegrations();
                            break;
                        case 'ghost-mode':
                            onShowGhostMode();
                            break;
                        case 'agents':
                            onShowAgentPanel();
                            break;
                        case 'deploy':
                            onDeploy();
                            break;
                    }
                }}
            />
        </div>
    );
}

/**
 * MobileQuickActionsSheet - Bottom sheet for mobile quick actions
 *
 * Features:
 * - Glass-styled bottom sheet
 * - Drag-to-dismiss with spring physics
 * - 2-column grid of quick actions
 * - 44px minimum touch targets
 * - Safe area padding for home indicator
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { StatusIcons } from '../ui/icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface MobileQuickActionsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: string) => void;
}

interface QuickAction {
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
}

const quickActions: QuickAction[] = [
    {
        id: 'quality',
        label: 'Quality Check',
        description: 'Run production scan',
        icon: StatusIcons.ShieldIcon,
        color: '#10b981',
    },
    {
        id: 'deploy',
        label: 'Deploy',
        description: 'Publish to cloud',
        icon: StatusIcons.CloudIcon,
        color: '#c25a00',
    },
    {
        id: 'agents',
        label: 'AI Agents',
        description: 'View agent status',
        icon: StatusIcons.BotIcon,
        color: '#3b82f6',
    },
    {
        id: 'memory',
        label: 'Memory',
        description: 'Project context',
        icon: StatusIcons.BrainIcon,
        color: '#8b5cf6',
    },
    {
        id: 'integrations',
        label: 'Integrations',
        description: 'Connect services',
        icon: StatusIcons.PlugIcon,
        color: '#f59e0b',
    },
    {
        id: 'ghost-mode',
        label: 'Ghost Mode',
        description: 'Autonomous building',
        icon: StatusIcons.GhostIcon,
        color: '#6366f1',
    },
];

export default function MobileQuickActionsSheet({
    isOpen,
    onClose,
    onAction,
}: MobileQuickActionsSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [dragY, setDragY] = useState(0);
    const { prefersReducedMotion } = useReducedMotion();

    // Handle drag gestures
    const handleDrag = useCallback((_event: any, info: PanInfo) => {
        if (info.offset.y > 0) {
            setDragY(info.offset.y);
        }
    }, []);

    const handleDragEnd = useCallback((_event: any, info: PanInfo) => {
        setDragY(0);
        // Close if dragged more than 100px or with high velocity
        if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
        }
    }, [onClose]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const springTransition = {
        type: 'spring' as const,
        damping: 30,
        stiffness: 400,
    };

    const instantTransition = {
        duration: 0,
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
                        transition={prefersReducedMotion ? instantTransition : { duration: 0.2 }}
                        className="fixed inset-0 z-[199] bg-black/30"
                        style={{
                            backdropFilter: 'blur(4px)',
                            WebkitBackdropFilter: 'blur(4px)',
                        }}
                        onClick={handleBackdropClick}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        ref={sheetRef}
                        initial={{ y: '100%' }}
                        animate={{ y: dragY }}
                        exit={{ y: '100%' }}
                        transition={prefersReducedMotion ? instantTransition : springTransition}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        className="fixed left-0 right-0 bottom-0 z-[200] rounded-t-3xl"
                        style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 50%, rgba(248,248,250,0.8) 100%)',
                            backdropFilter: 'blur(40px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                            boxShadow: `
                                0 -20px 60px rgba(0,0,0,0.15),
                                0 -8px 24px rgba(0,0,0,0.08),
                                inset 0 1px 1px rgba(255,255,255,0.95)
                            `,
                            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                        }}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div
                                className="w-10 h-1 rounded-full"
                                style={{ background: 'rgba(0,0,0,0.15)' }}
                            />
                        </div>

                        {/* Header */}
                        <div className="px-5 pb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-stone-900">
                                Quick Actions
                            </h2>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.05)' }}
                            >
                                <StatusIcons.CloseIcon size={20} className="text-stone-500" />
                            </button>
                        </div>

                        {/* Actions Grid */}
                        <div className="px-4 pb-6 grid grid-cols-2 gap-3">
                            {quickActions.map((action) => (
                                <QuickActionButton
                                    key={action.id}
                                    action={action}
                                    onClick={() => onAction(action.id)}
                                />
                            ))}
                        </div>

                        {/* Swipe hint */}
                        <div className="px-5 pb-4 text-center">
                            <p className="text-xs text-stone-400">
                                Swipe down to dismiss
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Quick Action Button Component
function QuickActionButton({
    action,
    onClick,
}: {
    action: QuickAction;
    onClick: () => void;
}) {
    const [isPressed, setIsPressed] = useState(false);
    const Icon = action.icon;

    return (
        <button
            onClick={onClick}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            className="flex flex-col items-start p-4 rounded-2xl min-h-[88px] transition-transform active:scale-95"
            style={{
                background: isPressed
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                boxShadow: isPressed
                    ? 'inset 0 2px 4px rgba(0,0,0,0.05)'
                    : `0 4px 12px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.4)`,
            }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{
                    background: `${action.color}15`,
                    color: action.color,
                }}
            >
                <Icon size={20} className="text-current" />
            </div>
            <span className="text-sm font-medium text-stone-900 text-left">
                {action.label}
            </span>
            <span className="text-xs text-stone-500 text-left">
                {action.description}
            </span>
        </button>
    );
}

export type { MobileQuickActionsSheetProps };

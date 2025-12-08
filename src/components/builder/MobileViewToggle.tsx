/**
 * MobileViewToggle - Liquid Glass View Switcher for Mobile/Tablet
 *
 * Premium frosted glass toggle for switching between Chat and Preview modes
 * on smaller screens (< 1024px width).
 *
 * Features:
 * - Liquid Glass 3D styling matching existing components
 * - Smooth 250ms transitions between states with scale effect (0.98 -> 1)
 * - Fixed position at top of viewport
 * - Active state with warm internal glow effect
 * - Only visible on mobile/tablet screens
 * - Horizontal swipe gesture support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Eye, LucideIcon } from 'lucide-react';

export type MobileView = 'chat' | 'preview';

interface MobileViewToggleProps {
    activeView: MobileView;
    onViewChange: (view: MobileView) => void;
}

// Hook for handling swipe gestures
export function useSwipeGesture(
    onSwipeLeft: () => void,
    onSwipeRight: () => void,
    options: { threshold?: number; enabled?: boolean } = {}
) {
    const { threshold = 50, enabled = true } = options;
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const isSwiping = useRef<boolean>(false);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled) return;
        touchStartX.current = e.changedTouches[0].screenX;
        isSwiping.current = true;
    }, [enabled]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!enabled || !isSwiping.current) return;
        touchEndX.current = e.changedTouches[0].screenX;
    }, [enabled]);

    const handleTouchEnd = useCallback(() => {
        if (!enabled || !isSwiping.current) return;
        isSwiping.current = false;

        const diff = touchStartX.current - touchEndX.current;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swiped left
                onSwipeLeft();
            } else {
                // Swiped right
                onSwipeRight();
            }
        }

        touchStartX.current = 0;
        touchEndX.current = 0;
    }, [enabled, threshold, onSwipeLeft, onSwipeRight]);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
    };
}

export default function MobileViewToggle({ activeView, onViewChange }: MobileViewToggleProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Check screen width and update visibility
    useEffect(() => {
        const checkWidth = () => {
            setIsVisible(window.innerWidth < 1024);
        };

        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    if (!isVisible) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 lg:hidden"
        >
            <div
                className="flex items-center gap-1 p-1.5 rounded-2xl"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.4) 50%, rgba(248,248,250,0.45) 100%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    boxShadow: `
                        0 8px 32px rgba(0,0,0,0.12),
                        0 4px 16px rgba(0,0,0,0.08),
                        inset 0 1px 2px rgba(255,255,255,0.95),
                        inset 0 -1px 1px rgba(0,0,0,0.02),
                        0 0 0 1px rgba(255,255,255,0.5)
                    `,
                }}
            >
                <ToggleButton
                    isActive={activeView === 'chat'}
                    onClick={() => onViewChange('chat')}
                    icon={MessageSquare}
                    label="Chat"
                />
                <ToggleButton
                    isActive={activeView === 'preview'}
                    onClick={() => onViewChange('preview')}
                    icon={Eye}
                    label="Preview"
                />
            </div>

            {/* Swipe hint indicator - subtle cue for users */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.5 }}
                className="text-center mt-2 text-[10px] font-medium"
                style={{ color: 'rgba(0,0,0,0.35)' }}
            >
                Swipe to switch
            </motion.div>
        </motion.div>
    );
}

interface ToggleButtonProps {
    isActive: boolean;
    onClick: () => void;
    icon: LucideIcon;
    label: string;
}

function ToggleButton({ isActive, onClick, icon: Icon, label }: ToggleButtonProps) {
    const [isPressed, setIsPressed] = useState(false);

    return (
        <motion.button
            onClick={onClick}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            // 44px minimum touch target for mobile accessibility
            className="relative flex items-center justify-center gap-2 px-5 rounded-xl overflow-hidden"
            style={{
                minHeight: '44px',
                minWidth: '44px',
            }}
            animate={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.65) 0%, rgba(255,180,150,0.5) 100%)'
                    : 'transparent',
                scale: isPressed ? 0.97 : 1,
            }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            whileTap={{ scale: 0.95 }}
        >
            {/* Background layer with warm internal glow */}
            <motion.div
                className="absolute inset-0 rounded-xl"
                animate={{
                    opacity: isActive ? 1 : 0,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                    background: 'linear-gradient(145deg, rgba(255,200,170,0.65) 0%, rgba(255,180,150,0.5) 100%)',
                    boxShadow: `
                        inset 0 0 20px rgba(255, 160, 120, 0.25),
                        0 4px 12px rgba(255, 140, 100, 0.2),
                        0 2px 6px rgba(255, 130, 80, 0.15),
                        0 0 0 1px rgba(255, 200, 170, 0.5)
                    `,
                }}
            />

            <Icon
                className="w-4 h-4 relative z-10 transition-colors duration-250"
                style={{ color: isActive ? '#b45309' : '#666' }}
            />
            <span
                className="text-sm font-medium relative z-10 transition-colors duration-250"
                style={{
                    color: isActive ? '#92400e' : '#666',
                    fontFamily: 'var(--font-body, Outfit, system-ui, sans-serif)',
                }}
            >
                {label}
            </span>

            {/* Active indicator dot with glow */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full z-10"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Shine effect on press */}
            <motion.div
                animate={{
                    left: isPressed ? '150%' : '-100%',
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                    position: 'absolute',
                    top: 0,
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    pointerEvents: 'none',
                }}
            />
        </motion.button>
    );
}

// Hook to manage mobile view state with swipe gesture support
export function useMobileView(defaultView: MobileView = 'chat') {
    const [activeView, setActiveView] = useState<MobileView>(defaultView);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkWidth = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    // Swipe gesture handlers
    const swipeToPreview = useCallback(() => {
        if (isMobile && activeView === 'chat') {
            setActiveView('preview');
        }
    }, [isMobile, activeView]);

    const swipeToChat = useCallback(() => {
        if (isMobile && activeView === 'preview') {
            setActiveView('chat');
        }
    }, [isMobile, activeView]);

    const swipeHandlers = useSwipeGesture(
        swipeToPreview,
        swipeToChat,
        { threshold: 60, enabled: isMobile }
    );

    return {
        activeView,
        setActiveView,
        isMobile,
        swipeHandlers,
    };
}

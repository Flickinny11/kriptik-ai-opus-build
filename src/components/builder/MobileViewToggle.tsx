/**
 * MobileViewToggle - Liquid Glass View Switcher for Mobile/Tablet
 *
 * Premium frosted glass toggle for switching between Chat and Preview modes
 * on smaller screens (< 1024px width).
 *
 * Features:
 * - Liquid Glass 3D styling matching existing components
 * - Smooth 300ms transitions between states
 * - Fixed position at top of viewport
 * - Active state with warm glow effect
 * - Only visible on mobile/tablet screens
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Eye } from 'lucide-react';

export type MobileView = 'chat' | 'preview';

interface MobileViewToggleProps {
    activeView: MobileView;
    onViewChange: (view: MobileView) => void;
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 lg:hidden"
        >
            <div
                className="flex items-center gap-1 p-1 rounded-2xl"
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
        </motion.div>
    );
}

interface ToggleButtonProps {
    isActive: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
}

function ToggleButton({ isActive, onClick, icon: Icon, label }: ToggleButtonProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 overflow-hidden"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.65) 0%, rgba(255,180,150,0.5) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.35) 100%)'
                        : 'transparent',
                boxShadow: isActive
                    ? `
                        inset 0 0 20px rgba(255, 160, 120, 0.25),
                        0 4px 12px rgba(255, 140, 100, 0.2),
                        0 2px 6px rgba(255, 130, 80, 0.15),
                        0 0 0 1px rgba(255, 200, 170, 0.5)
                    `
                    : isHovered
                        ? `0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.4)`
                        : 'none',
                transform: isHovered && !isActive ? 'translateY(-1px)' : 'translateY(0)',
            }}
        >
            <Icon
                className="w-4 h-4 transition-colors duration-300"
                style={{ color: isActive ? '#b45309' : '#666' }}
            />
            <span
                className="text-sm font-medium transition-colors duration-300"
                style={{
                    color: isActive ? '#92400e' : '#666',
                    fontFamily: 'var(--font-body, Outfit, system-ui, sans-serif)',
                }}
            >
                {label}
            </span>

            {/* Active indicator dot */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Shine effect on hover */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered && !isActive ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.5s ease',
                    pointerEvents: 'none',
                }}
            />
        </button>
    );
}

// Hook to manage mobile view state
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

    return {
        activeView,
        setActiveView,
        isMobile,
    };
}

/**
 * Hover Sidebar Component
 *
 * A futuristic, semi-translucent sidebar that appears on hover.
 * Features 3D edges, glitch microanimations, and cyberpunk styling.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Folder, LayoutTemplate, Palette, KeyRound,
    Settings, Plug, User, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    path: string;
    description: string;
}

const NAV_ITEMS: NavItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Folder,
        path: '/dashboard',
        description: 'Your projects & builds',
    },
    {
        id: 'templates',
        label: 'Templates',
        icon: LayoutTemplate,
        path: '/templates',
        description: 'Ready-to-use starters',
    },
    {
        id: 'design-room',
        label: 'Design Room',
        icon: Palette,
        path: '/design-room',
        description: 'UI/UX workspace',
    },
    {
        id: 'vault',
        label: 'Credential Vault',
        icon: KeyRound,
        path: '/vault',
        description: 'Secure key storage',
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: '/settings',
        description: 'App preferences',
    },
    {
        id: 'integrations',
        label: 'Integrations',
        icon: Plug,
        path: '/integrations',
        description: 'Connected services',
    },
    {
        id: 'account',
        label: 'My Account',
        icon: User,
        path: '/account',
        description: 'Profile & billing',
    },
];

export function HoverSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Detect mouse near left edge
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (e.clientX <= 20) {
                setIsOpen(true);
            } else if (e.clientX > 280) {
                setIsOpen(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <>
            {/* Visible trigger zone with subtle glow indicator */}
            <div
                className="fixed left-0 top-0 w-2 h-full z-40 group cursor-pointer"
                onMouseEnter={() => setIsOpen(true)}
            >
                {/* Subtle glow line that hints at the sidebar */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-16 bg-gradient-to-b from-transparent via-amber-500/40 to-transparent rounded-full" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop blur */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Sidebar */}
                        <motion.aside
                            initial={{ x: -280, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -280, opacity: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 300,
                                damping: 30,
                            }}
                            onMouseLeave={() => setIsOpen(false)}
                            className={cn(
                                "fixed left-0 top-0 h-full w-64 z-50",
                                "flex flex-col"
                            )}
                            style={{
                                background: 'linear-gradient(135deg, rgba(250, 250, 250, 0.08) 0%, rgba(200, 200, 200, 0.04) 100%)',
                                backdropFilter: 'blur(20px)',
                                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: `
                                    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
                                    4px 0 24px rgba(0, 0, 0, 0.4),
                                    8px 0 48px rgba(0, 0, 0, 0.2)
                                `,
                            }}
                        >
                            {/* 3D Edge effect */}
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.1) 100%)',
                                }}
                            />

                            {/* Header */}
                            <div className="p-6 border-b border-white/5">
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500"
                                >
                                    Navigation
                                </motion.div>
                            </div>

                            {/* Navigation Items */}
                            <nav className="flex-1 py-4 overflow-y-auto">
                                {NAV_ITEMS.map((item, index) => {
                                    const isActive = location.pathname === item.path;
                                    const isHovered = hoveredItem === item.id;

                                    return (
                                        <motion.button
                                            key={item.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.05 * index }}
                                            onClick={() => {
                                                navigate(item.path);
                                                setIsOpen(false);
                                            }}
                                            onMouseEnter={() => setHoveredItem(item.id)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-6 py-3",
                                                "transition-all duration-200 relative",
                                                "group cursor-pointer",
                                                isActive && "bg-white/5"
                                            )}
                                        >
                                            {/* Hover/Active indicator */}
                                            <motion.div
                                                className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500"
                                                initial={{ scaleY: 0 }}
                                                animate={{ scaleY: isActive || isHovered ? 1 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            />

                                            {/* Icon with glitch effect on hover */}
                                            <div className={cn(
                                                "relative w-8 h-8 flex items-center justify-center",
                                                "rounded-lg transition-all duration-200",
                                                isHovered && "nav-icon-glitch"
                                            )}>
                                                <item.icon className={cn(
                                                    "w-4 h-4 transition-colors duration-200",
                                                    isActive ? "text-amber-400" : "text-zinc-400",
                                                    isHovered && "text-white"
                                                )} />
                                            </div>

                                            {/* Label */}
                                            <div className="flex-1 text-left">
                                                <div className={cn(
                                                    "text-sm font-medium transition-colors duration-200",
                                                    "font-mono tracking-wide",
                                                    isActive ? "text-white" : "text-zinc-300",
                                                    isHovered && "text-white nav-text-glitch"
                                                )}>
                                                    {item.label}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] text-zinc-500 mt-0.5",
                                                    "transition-opacity duration-200",
                                                    isHovered ? "opacity-100" : "opacity-0"
                                                )}>
                                                    {item.description}
                                                </div>
                                            </div>

                                            {/* Arrow indicator */}
                                            <ChevronRight className={cn(
                                                "w-4 h-4 text-zinc-600 transition-all duration-200",
                                                isHovered && "text-amber-400 translate-x-1"
                                            )} />
                                        </motion.button>
                                    );
                                })}
                            </nav>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/5">
                                <div className="text-[10px] font-mono text-zinc-600 text-center">
                                    <span className="text-zinc-500">SYS://</span>
                                    <span className="text-amber-500/50">KRIPTIK.AI</span>
                                    <span className="text-zinc-600">/v2.0</span>
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* CSS for nav item glitch effects */}
            <style>{`
                @keyframes nav-glitch {
                    0%, 100% { transform: translate(0); }
                    20% { transform: translate(-1px, 1px); }
                    40% { transform: translate(1px, -1px); }
                    60% { transform: translate(-1px, 0); }
                    80% { transform: translate(1px, 1px); }
                }

                @keyframes nav-text-shift {
                    0%, 100% { text-shadow: 0 0 0 transparent; }
                    25% { text-shadow: 1px 0 0 rgba(255, 107, 53, 0.5), -1px 0 0 rgba(0, 217, 255, 0.5); }
                    50% { text-shadow: -1px 0 0 rgba(255, 107, 53, 0.5), 1px 0 0 rgba(0, 217, 255, 0.5); }
                    75% { text-shadow: 0 1px 0 rgba(255, 107, 53, 0.3); }
                }

                .nav-icon-glitch {
                    animation: nav-glitch 0.3s ease infinite;
                }

                .nav-text-glitch {
                    animation: nav-text-shift 0.5s ease infinite;
                }
            `}</style>
        </>
    );
}

export default HoverSidebar;


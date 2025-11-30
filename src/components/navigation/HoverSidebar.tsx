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
            {/* Visible trigger zone with subtle indicator */}
            <div
                className="fixed left-0 top-0 w-2 h-full z-40 group cursor-pointer"
                onMouseEnter={() => setIsOpen(true)}
            >
                {/* Subtle line that hints at the sidebar */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-16 bg-gradient-to-b from-transparent via-black/20 to-transparent rounded-full" />
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

                        {/* Sidebar - Realistic Glass */}
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
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.35) 50%, rgba(248, 248, 250, 0.4) 100%)',
                                backdropFilter: 'blur(30px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                                boxShadow: `
                                    inset -1px 0 0 rgba(255, 255, 255, 0.8),
                                    4px 0 24px rgba(0, 0, 0, 0.06),
                                    1px 0 0 rgba(0, 0, 0, 0.03),
                                    inset 0 1px 1px rgba(255, 255, 255, 0.9)
                                `,
                            }}
                        >
                            {/* 3D Edge effect - right side glass thickness */}
                            <div
                                className="absolute right-0 top-0 bottom-0 w-2"
                                style={{
                                    background: 'linear-gradient(90deg, rgba(200,200,205,0.4) 0%, rgba(180,180,185,0.3) 100%)',
                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.03)',
                                }}
                            />

                            {/* Header */}
                            <div className="p-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-xs uppercase tracking-[0.2em]"
                                    style={{ color: '#404040', fontFamily: '-apple-system, sans-serif' }}
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
                                                "transition-all duration-300 relative",
                                                "group cursor-pointer rounded-xl mx-2",
                                                isActive && "bg-white/40"
                                            )}
                                            style={{
                                                background: isActive ? 'rgba(255,255,255,0.4)' : 'transparent',
                                                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)' : 'none',
                                            }}
                                        >
                                            {/* Hover/Active indicator */}
                                            <motion.div
                                                className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                                                style={{ background: 'rgba(0,0,0,0.3)' }}
                                                initial={{ scaleY: 0 }}
                                                animate={{ scaleY: isActive || isHovered ? 1 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            />

                                            {/* Icon */}
                                            <div 
                                                className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
                                                style={{ background: 'rgba(0,0,0,0.06)' }}
                                            >
                                                <item.icon className="w-4 h-4 text-neutral-800" />
                                            </div>

                                            {/* Label */}
                                            <div className="flex-1 text-left">
                                                <div 
                                                    className="text-sm font-medium transition-colors duration-200"
                                                    style={{ 
                                                        color: '#1a1a1a',
                                                        fontFamily: '-apple-system, sans-serif' 
                                                    }}
                                                >
                                                    {item.label}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] mt-0.5",
                                                    "transition-opacity duration-200",
                                                    isHovered ? "opacity-100" : "opacity-0"
                                                )}
                                                style={{ color: '#666' }}>
                                                    {item.description}
                                                </div>
                                            </div>

                                            {/* Arrow indicator */}
                                            <ChevronRight 
                                                className={cn(
                                                    "w-4 h-4 transition-all duration-200",
                                                    isHovered ? "translate-x-1 text-neutral-800" : "text-neutral-400"
                                                )}
                                            />
                                        </motion.button>
                                    );
                                })}
                            </nav>

                            {/* Footer */}
                            <div className="p-6" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <div className="text-[10px] text-center" style={{ color: '#666' }}>
                                    <span>KripTik AI</span>
                                    <span style={{ color: '#999' }}> • v2.0</span>
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


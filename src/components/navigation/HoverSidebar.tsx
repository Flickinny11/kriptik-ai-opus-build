/**
 * Hover Sidebar Component
 *
 * Realistic frosted glass sidebar with 3D glass button items.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Blocks, Paintbrush, ShieldCheck,
    SlidersHorizontal, Cable, CircleUser
} from 'lucide-react';
import { cn } from '@/lib/utils';
import '../../styles/realistic-glass.css';

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
        icon: LayoutDashboard,
        path: '/dashboard',
        description: 'Your projects & builds',
    },
    {
        id: 'templates',
        label: 'Templates',
        icon: Blocks,
        path: '/templates',
        description: 'Ready-to-use starters',
    },
    {
        id: 'design-room',
        label: 'Design Room',
        icon: Paintbrush,
        path: '/design-room',
        description: 'UI/UX workspace',
    },
    {
        id: 'vault',
        label: 'Credential Vault',
        icon: ShieldCheck,
        path: '/vault',
        description: 'Secure key storage',
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: SlidersHorizontal,
        path: '/settings',
        description: 'App preferences',
    },
    {
        id: 'integrations',
        label: 'Integrations',
        icon: Cable,
        path: '/integrations',
        description: 'Connected services',
    },
    {
        id: 'account',
        label: 'My Account',
        icon: CircleUser,
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
                className="fixed left-0 top-0 w-2 h-full z-[100] group cursor-pointer"
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
                            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[100]"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Sidebar - Realistic 3D Glass */}
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
                                "fixed left-0 top-0 h-full w-72 z-[110]",
                                "flex flex-col"
                            )}
                            style={{
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(248, 248, 250, 0.45) 100%)',
                                backdropFilter: 'blur(30px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                                boxShadow: `
                                    0 20px 60px rgba(0, 0, 0, 0.1),
                                    0 8px 24px rgba(0, 0, 0, 0.06),
                                    inset 0 1px 1px rgba(255, 255, 255, 0.95),
                                    inset 0 -1px 1px rgba(0, 0, 0, 0.02),
                                    0 0 0 1px rgba(255, 255, 255, 0.5)
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

                            {/* Navigation Items - Photorealistic 3D Glass Buttons */}
                            <nav className="flex-1 py-4 px-4 overflow-y-auto space-y-3">
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
                                            className="w-full flex items-center gap-3 cursor-pointer relative overflow-hidden"
                                            style={{
                                                padding: '14px 18px',
                                                borderRadius: '50px',
                                                background: isActive 
                                                    ? 'linear-gradient(145deg, rgba(255, 210, 180, 0.7) 0%, rgba(255, 190, 160, 0.55) 40%, rgba(255, 170, 140, 0.45) 100%)'
                                                    : isHovered
                                                        ? 'linear-gradient(145deg, rgba(255, 240, 230, 0.7) 0%, rgba(255, 230, 215, 0.55) 40%, rgba(255, 220, 200, 0.5) 100%)'
                                                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 40%, rgba(248, 248, 250, 0.45) 100%)',
                                                backdropFilter: 'blur(24px) saturate(200%)',
                                                WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                                                boxShadow: isActive
                                                    ? `
                                                        0 4px 0 rgba(220, 160, 120, 0.5),
                                                        0 12px 40px rgba(255, 150, 100, 0.3),
                                                        0 6px 20px rgba(255, 130, 80, 0.2),
                                                        0 0 30px rgba(255, 160, 120, 0.25),
                                                        inset 0 2px 2px rgba(255, 255, 255, 0.95),
                                                        inset 0 -2px 2px rgba(0, 0, 0, 0.02),
                                                        0 0 0 1px rgba(255, 200, 170, 0.6)
                                                    `
                                                    : isHovered
                                                        ? `
                                                            0 6px 0 rgba(200, 180, 160, 0.5),
                                                            0 16px 50px rgba(255, 150, 100, 0.2),
                                                            0 8px 25px rgba(255, 130, 80, 0.15),
                                                            0 0 20px rgba(255, 180, 140, 0.3),
                                                            inset 0 2px 2px rgba(255, 255, 255, 1),
                                                            inset 0 -2px 2px rgba(0, 0, 0, 0.02),
                                                            0 0 0 1px rgba(255, 220, 200, 0.7)
                                                        `
                                                        : `
                                                            0 4px 0 rgba(200, 195, 190, 0.5),
                                                            0 12px 40px rgba(0, 0, 0, 0.08),
                                                            0 4px 12px rgba(0, 0, 0, 0.05),
                                                            inset 0 2px 2px rgba(255, 255, 255, 0.95),
                                                            inset 0 -2px 2px rgba(0, 0, 0, 0.03),
                                                            0 0 0 1px rgba(255, 255, 255, 0.6)
                                                        `,
                                                transform: isHovered 
                                                    ? 'translateY(-4px) translateZ(10px)' 
                                                    : 'translateY(0) translateZ(0)',
                                                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                            }}
                                        >
                                            {/* Shine effect overlay */}
                                            <div
                                                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                                style={{
                                                    background: isHovered
                                                        ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)'
                                                        : 'none',
                                                    transform: isHovered ? 'translateX(100%) skewX(-15deg)' : 'translateX(-100%) skewX(-15deg)',
                                                    transition: 'transform 0.6s ease',
                                                }}
                                            />

                                            {/* Right edge - visible 3D glass thickness */}
                                            <div
                                                className="absolute top-1 right-0 w-[3px] rounded-r-full pointer-events-none"
                                                style={{
                                                    height: 'calc(100% - 8px)',
                                                    background: 'linear-gradient(90deg, rgba(220, 215, 210, 0.6) 0%, rgba(200, 195, 190, 0.4) 100%)',
                                                    opacity: 0.8,
                                                }}
                                            />

                                            {/* Icon in glass container */}
                                            <div 
                                                className="relative w-10 h-10 flex items-center justify-center rounded-xl"
                                                style={{ 
                                                    background: isActive
                                                        ? 'rgba(255, 160, 120, 0.2)'
                                                        : 'rgba(0, 0, 0, 0.05)',
                                                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5)',
                                                }}
                                            >
                                                <span
                                                    style={{ 
                                                        color: isActive ? '#c45020' : '#1a1a1a',
                                                        filter: isActive ? 'drop-shadow(0 0 4px rgba(255,140,80,0.5))' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <item.icon className="w-5 h-5" />
                                                </span>
                                            </div>

                                            {/* Label */}
                                            <div className="flex-1 text-left">
                                                <div 
                                                    className="text-sm font-medium"
                                                    style={{ 
                                                        color: isActive ? '#a03810' : '#1a1a1a',
                                                        fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif',
                                                        fontWeight: isActive ? 600 : 500,
                                                        textShadow: isActive ? '0 1px 2px rgba(255,140,80,0.2)' : 'none',
                                                    }}
                                                >
                                                    {item.label}
                                                </div>
                                            </div>

                                            {/* Arrow indicator */}
                                            <div 
                                                className="w-5 h-5 flex items-center justify-center rounded-full"
                                                style={{
                                                    background: isActive ? 'rgba(255,160,120,0.3)' : 'rgba(0,0,0,0.06)',
                                                    opacity: isHovered || isActive ? 1 : 0.5,
                                                    transition: 'all 0.3s ease',
                                                }}
                                            >
                                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                                    <path 
                                                        d="M2 1L5 4L2 7" 
                                                        stroke={isActive ? '#c45020' : '#1a1a1a'}
                                                        strokeWidth="1.5" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </div>
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


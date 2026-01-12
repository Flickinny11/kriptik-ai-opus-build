/**
 * Neural Icons - Custom SVG icons for the Neural Canvas design system
 *
 * Icons designed for the code visualization and AI orchestration UI.
 * Uses the warm glass theme with amber/gold accents.
 *
 * ZERO external icon libraries - ALL inline SVGs
 * Premium, sophisticated design with 3D depth and neural/tech aesthetics
 */

import React from 'react';

/**
 * All available icon names as a const array for type safety and iteration
 */
export const iconNames = [
    // File Operations
    'file-code',
    'file-diff',
    'file-search',
    'file-plus',
    'file-edit',
    // Thinking/Reasoning
    'brain',
    'synapse',
    'sparkle',
    'circuit',
    // Status/Progress
    'check',
    'check-circle',
    'alert-circle',
    'clock',
    'activity',
    'progress',
    'pending',
    'active',
    'error',
    // Code/Development
    'code',
    'code-brackets',
    'terminal',
    'git-branch',
    'copy',
    // Navigation/UI
    'chevron-down',
    'chevron-right',
    'expand',
    'collapse',
    'close',
    // Agents/Orchestration
    'agent',
    'grid',
    'layers',
    'workflow',
    'folder',
    // Agent Types
    'ui-agent',
    'api-agent',
    'test-agent',
    'database-agent',
    'code-agent',
    'security-agent',
    'design-agent',
    'integration-agent',
    // Phase Timeline
    'intent-lock',
    'initialize',
    'build',
    'integration',
    'test',
    'verify',
    'demo',
    // Analysis
    'analyze',
    // Language Icons
    'typescript',
    'javascript',
    'react',
    'python',
    'rust',
    'go',
    'css',
    'html',
    'json',
] as const;

/**
 * Type union of all available icon names
 */
export type NeuralIconName = typeof iconNames[number];

export interface NeuralIconProps {
    name: NeuralIconName;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
    gradient?: boolean;
}

// Counter for unique gradient IDs to avoid conflicts
let gradientIdCounter = 0;

/**
 * Gradient definitions component for reusable gradients
 */
const GradientDefs: React.FC<{ id: string }> = ({ id }) => (
    <defs>
        <linearGradient id={`neural-cyan-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`neural-amber-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`neural-success-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={`neural-error-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id={`neural-slate-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
    </defs>
);

/**
 * Neural Icon component - renders custom SVG icons by name
 *
 * @param name - The icon name to render
 * @param size - Icon size in pixels (default: 24)
 * @param className - Optional CSS class name
 * @param style - Optional inline styles
 * @param gradient - Whether to use gradient fills (default: false)
 */
export const NeuralIcon: React.FC<NeuralIconProps> = ({
    name,
    size = 24,
    className = '',
    style,
    gradient = false
}) => {
    const gradientId = React.useMemo(() => `${++gradientIdCounter}`, []);
    const strokeColor = gradient ? `url(#neural-cyan-${gradientId})` : 'currentColor';
    const fillColor = gradient ? `url(#neural-amber-${gradientId})` : 'currentColor';

    const iconMap: Record<NeuralIconName, React.ReactNode> = {
        // File Operations
        'file-code': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M14 2v6h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 13l-2 2 2 2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 13l2 2-2 2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'file-diff': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M14 2v6h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 15h6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 11h6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
        'file-search': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M14 2v6h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="17" cy="17" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M20 20l2 2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
        'file-plus': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M14 2v6h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 11v6M9 14h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
        'file-edit': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M12 20H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v4"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M14 2v6h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path
                    d="M18.5 15.5l-4.5 4.5L12 21l1-2 4.5-4.5a1.41 1.41 0 0 1 2 0c.56.56.56 1.44 0 2z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
        ),

        // Thinking/Reasoning
        'brain': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M12 2C9.24 2 7 4.24 7 7c0 1.02.31 1.96.82 2.75C6.72 10.49 6 11.92 6 13.5c0 2.21 1.57 4.05 3.65 4.47.06.34.1.69.1 1.03v2a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-2c0-.34.04-.69.1-1.03 2.08-.42 3.65-2.26 3.65-4.47 0-1.58-.72-3.01-1.82-3.75.51-.79.82-1.73.82-2.75 0-2.76-2.24-5-5-5z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M9 10c1.5.5 3 .5 4.5 0M9.5 14c1 .5 2.5.5 3.5 0" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" />
                <circle cx="9.5" cy="7.5" r="1" fill={fillColor} />
                <circle cx="14.5" cy="7.5" r="1" fill={fillColor} />
            </svg>
        ),
        'synapse': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="6" cy="12" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="18" cy="12" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M9 12h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
                <circle cx="6" cy="12" r="1" fill={fillColor} />
                <circle cx="18" cy="12" r="1" fill={fillColor} />
                <circle cx="12" cy="12" r="1.5" fill={fillColor} opacity="0.6" />
                <path d="M12 9V7M12 17v-2" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
            </svg>
        ),
        'sparkle': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path
                    d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path d="M18 18l1.5 1.5M6 6l1.5 1.5M6 18l1.5-1.5M18 6l1.5-1.5" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
            </svg>
        ),
        'circuit': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="2" y="2" width="20" height="20" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="6" cy="6" r="1.5" fill={fillColor} />
                <circle cx="18" cy="6" r="1.5" fill={fillColor} />
                <circle cx="6" cy="18" r="1.5" fill={fillColor} />
                <circle cx="18" cy="18" r="1.5" fill={fillColor} />
                <circle cx="12" cy="12" r="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.5" />
                <path d="M10 12h4M12 10v4" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" />
            </svg>
        ),

        // Status/Progress
        'check': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M20 6L9 17l-5-5" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'check-circle': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={gradient ? `url(#neural-success-${gradientId})` : strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M9 12l2 2 4-4" stroke={gradient ? `url(#neural-success-${gradientId})` : strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'alert-circle': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={gradient ? `url(#neural-error-${gradientId})` : strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M12 8v4M12 16h.01" stroke={gradient ? `url(#neural-error-${gradientId})` : strokeColor} strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
        'clock': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <polyline points="12,6 12,12 16,14" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'activity': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'progress': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.3" />
                <path
                    d="M12 2a10 10 0 0 1 8.66 15"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                />
                <circle cx="12" cy="12" r="3" fill={fillColor} opacity="0.5" />
            </svg>
        ),
        'pending': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="3" fill={fillColor} opacity="0.5" />
            </svg>
        ),
        'active': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M12 6v6l4 2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'error': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={gradient ? `url(#neural-error-${gradientId})` : strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M12 8v4M12 16h.01" stroke={gradient ? `url(#neural-error-${gradientId})` : strokeColor} strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),

        // Code/Development
        'code': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'code-brackets': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'terminal': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M4 17l6-6-6-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 19h8" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'git-branch': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <line x1="6" y1="3" x2="6" y2="15" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="18" cy="6" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="6" cy="18" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M18 9a9 9 0 0 1-9 9" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
        ),
        'copy': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="9" y="9" width="13" height="13" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
        ),

        // Navigation/UI
        'chevron-down': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M6 9l6 6 6-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'chevron-right': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M9 18l6-6-6-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'expand': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M15 3h6v6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 21H3v-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 3l-7 7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 21l7-7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'collapse': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M4 14h6v6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 10h-6V4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 10l7-7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 21l7-7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'close': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M18 6L6 18M6 6l12 12" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),

        // Agents/Orchestration
        'agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="8" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="8" r="1.5" fill={fillColor} />
            </svg>
        ),
        'grid': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="3" y="3" width="7" height="7" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            </svg>
        ),
        'layers': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <polygon points="12,2 2,7 12,12 22,7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <polyline points="2,17 12,22 22,17" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <polyline points="2,12 12,17 22,12" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
        ),
        'workflow': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="3" y="3" width="6" height="6" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <rect x="15" y="3" width="6" height="6" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <rect x="9" y="15" width="6" height="6" rx="1" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M9 6h6M6 9v4l3 3M18 9v4l-3 3" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'folder': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
        ),

        // Agent Types
        'ui-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="3" y="3" width="18" height="18" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M3 9h18" stroke={strokeColor} strokeWidth="1.5" />
                <rect x="6" y="12" width="5" height="3" rx="0.5" stroke={strokeColor} strokeWidth="1" fill="none" />
                <rect x="13" y="12" width="5" height="6" rx="0.5" stroke={strokeColor} strokeWidth="1" fill="none" />
                <circle cx="6" cy="6" r="1" fill={fillColor} />
                <circle cx="9" cy="6" r="1" fill={fillColor} />
            </svg>
        ),
        'api-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M4 4h6v6H4z" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M14 4h6v6h-6z" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M4 14h6v6H4z" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="17" cy="17" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M10 7h4M7 10v4M17 10v4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
        'test-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M9 2v4.5L5 11l4 4.5V22h6v-6.5l4-4.5-4-4.5V2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 6h6" stroke={strokeColor} strokeWidth="1.5" />
                <circle cx="12" cy="14" r="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            </svg>
        ),
        'database-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <ellipse cx="12" cy="6" rx="8" ry="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke={strokeColor} strokeWidth="1.5" />
                <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke={strokeColor} strokeWidth="1.5" />
            </svg>
        ),
        'code-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="4" y="2" width="16" height="20" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M8 10l-2 2 2 2M16 10l2 2-2 2M13 8l-2 8" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'security-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M12 2l8 4v6c0 5.52-3.58 10.18-8 11-4.42-.82-8-5.48-8-11V6l8-4z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 12l2 2 4-4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'design-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="1" fill={fillColor} />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
        'integration-agent': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="6" cy="6" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="18" cy="6" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="6" cy="18" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="18" cy="18" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M9 6h6M6 9v6M18 9v6M9 18h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="2" fill={fillColor} />
            </svg>
        ),

        // Phase Timeline
        'intent-lock': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="3" y="11" width="18" height="11" rx="2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="16" r="1.5" fill={fillColor} />
            </svg>
        ),
        'initialize': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="12" cy="12" r="10" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M12 6v6l4 2" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'build': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
        ),
        'integration': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M17 6.1H3" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M21 12.1H3" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M15.1 18H3" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="19" cy="6" r="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <circle cx="17" cy="18" r="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            </svg>
        ),
        'test': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <polyline points="14,2 14,8 20,8" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 15l2 2 4-4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'verify': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 12l2 2 4-4" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        'demo': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <rect x="2" y="3" width="20" height="14" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <line x1="8" y1="21" x2="16" y2="21" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <polygon points="10,8 16,11 10,14" fill={fillColor} />
            </svg>
        ),

        // Analysis
        'analyze': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                {gradient && <GradientDefs id={gradientId} />}
                <circle cx="11" cy="11" r="8" stroke={strokeColor} strokeWidth="1.5" fill="none" />
                <path d="M21 21l-4.35-4.35" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M11 8v6M8 11h6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),

        // Language Icons
        'typescript': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#3178c6" />
                <text x="12" y="17" fontSize="10" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TS</text>
            </svg>
        ),
        'javascript': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#f7df1e" />
                <text x="12" y="17" fontSize="10" fill="#1a1a1a" fontFamily="monospace" textAnchor="middle" fontWeight="bold">JS</text>
            </svg>
        ),
        'react': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <circle cx="12" cy="12" r="2" fill="#61dafb" />
                <ellipse cx="12" cy="12" rx="9" ry="4" stroke="#61dafb" strokeWidth="1" fill="none" />
                <ellipse cx="12" cy="12" rx="9" ry="4" stroke="#61dafb" strokeWidth="1" fill="none" transform="rotate(60 12 12)" />
                <ellipse cx="12" cy="12" rx="9" ry="4" stroke="#61dafb" strokeWidth="1" fill="none" transform="rotate(120 12 12)" />
            </svg>
        ),
        'python': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#3776ab" />
                <text x="12" y="17" fontSize="9" fill="#ffd43b" fontFamily="monospace" textAnchor="middle" fontWeight="bold">PY</text>
            </svg>
        ),
        'rust': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#dea584" />
                <text x="12" y="17" fontSize="9" fill="#1a1a1a" fontFamily="monospace" textAnchor="middle" fontWeight="bold">RS</text>
            </svg>
        ),
        'go': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#00add8" />
                <text x="12" y="17" fontSize="9" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">GO</text>
            </svg>
        ),
        'css': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#264de4" />
                <text x="12" y="17" fontSize="8" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">CSS</text>
            </svg>
        ),
        'html': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#e34c26" />
                <text x="12" y="14" fontSize="4" fill="#fff" fontFamily="monospace" textAnchor="middle">{'</>'}</text>
                <text x="12" y="19" fontSize="5" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">HTML</text>
            </svg>
        ),
        'json': (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#292929" />
                <text x="12" y="11" fontSize="4" fill="#fff" fontFamily="monospace" textAnchor="middle">{'{ }'}</text>
                <text x="12" y="18" fontSize="6" fill="#f59e0b" fontFamily="monospace" textAnchor="middle" fontWeight="bold">JSON</text>
            </svg>
        ),
    };

    return <>{iconMap[name] || null}</>;
};

/**
 * Get the appropriate file icon based on language
 */
export const getLanguageIcon = (language: string, size = 24): React.ReactNode => {
    const langMap: Record<string, NeuralIconName> = {
        typescript: 'typescript',
        ts: 'typescript',
        javascript: 'javascript',
        js: 'javascript',
        jsx: 'react',
        tsx: 'react',
        python: 'python',
        py: 'python',
        rust: 'rust',
        rs: 'rust',
        go: 'go',
        css: 'css',
        scss: 'css',
        html: 'html',
        htm: 'html',
        json: 'json',
    };

    const iconName = langMap[language.toLowerCase()] || 'file-code';
    return <NeuralIcon name={iconName} size={size} />;
};

/**
 * Get an icon by name string with type safety
 * Returns the NeuralIcon component or null if name is invalid
 */
export const getIconByName = (name: string, size = 24, gradient = false): React.ReactNode => {
    if (iconNames.includes(name as NeuralIconName)) {
        return <NeuralIcon name={name as NeuralIconName} size={size} gradient={gradient} />;
    }
    return null;
};

export default NeuralIcon;

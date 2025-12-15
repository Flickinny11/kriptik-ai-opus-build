/**
 * Status Icons - Gradient icons for status indicators and actions
 * Matches KripTik AI warm glass theme with depth effects
 */

import React from 'react';

export interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

// Color constants for consistency
const COLORS = {
    primary: '#1a1a1a',
    secondary: '#666',
    muted: '#999',
    accent: '#c25a00',
    accentLight: 'rgba(255,180,140,0.9)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
};

// Check/Success Icon with gradient
export const CheckIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.success} />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#checkGrad)" />
        <path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Loading/Spinner Icon
export const LoadingIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="loadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accent} />
                <stop offset="100%" stopColor={COLORS.accentLight} />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="2" fill="none" />
        <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="url(#loadGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
        />
    </svg>
);

// Error/Alert Icon
export const ErrorIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="errorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.error} />
                <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#errorGrad)" />
        <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Warning Icon
export const WarningIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="warnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.warning} />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        <path d="M12 2L2 20h20L12 2z" fill="url(#warnGrad)" />
        <path d="M12 9v4M12 17h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Info Icon
export const InfoIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="infoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.info} />
                <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#infoGrad)" />
        <path d="M12 16v-4M12 8h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Settings/Gear Icon with depth
export const SettingsIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="settingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e8e4df" />
                <stop offset="100%" stopColor="#ccc8c3" />
            </linearGradient>
        </defs>
        <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
            fill="url(#settingsGrad)"
            stroke={COLORS.primary}
            strokeWidth="1.5"
        />
        <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke={COLORS.primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);

// Search Icon with glass effect
export const SearchIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="searchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
            </linearGradient>
        </defs>
        <circle cx="11" cy="11" r="7" fill="url(#searchGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M21 21l-4.35-4.35" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Clock/Time Icon
export const ClockIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="clockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#clockGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M12 6v6l4 2" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Brain/AI Icon
export const BrainIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path
            d="M12 4.5a2.5 2.5 0 0 0-2.5 2.5c0 .28.05.55.13.8A3 3 0 0 0 7 10.5c0 .76.28 1.46.75 2A3 3 0 0 0 7 14.5a3 3 0 0 0 2.5 2.96V19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-1.54A3 3 0 0 0 17 14.5a3 3 0 0 0-.75-2 3 3 0 0 0 .75-2 3 3 0 0 0-2.63-2.7c.08-.25.13-.52.13-.8a2.5 2.5 0 0 0-2.5-2.5z"
            fill="url(#brainGrad)"
            stroke={COLORS.primary}
            strokeWidth="1.5"
        />
        <path d="M9 10.5h6M9 13.5h6" stroke={COLORS.primary} strokeWidth="1" opacity="0.5" />
    </svg>
);

// Code Icon with brackets
export const CodeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M8 6l-6 6 6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 6l6 6-6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 4l-4 16" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Plus/Add Icon
export const PlusIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="plusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#plusGrad)" />
        <path d="M12 8v8M8 12h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Close/X Icon
export const CloseIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.05)" stroke={COLORS.secondary} strokeWidth="1.5" />
        <path d="M15 9l-6 6M9 9l6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Eye/View Icon
export const EyeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
            stroke={COLORS.primary}
            strokeWidth="1.5"
            fill="none"
        />
        <circle cx="12" cy="12" r="3" fill={COLORS.accent} stroke={COLORS.primary} strokeWidth="1.5" />
    </svg>
);

// Eye Off/Hidden Icon
export const EyeOffIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
            stroke={COLORS.secondary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
        <path d="M1 1l22 22" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Trash/Delete Icon
export const TrashIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={COLORS.error} strokeWidth="1.5" strokeLinecap="round" />
        <path
            d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
            stroke={COLORS.primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
        <path d="M10 11v6M14 11v6" stroke={COLORS.secondary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Copy Icon
export const CopyIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="9" y="9" width="13" height="13" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path
            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            stroke={COLORS.secondary}
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

// Refresh Icon
export const RefreshIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M23 4v6h-6M1 20v-6h6"
            stroke={COLORS.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
            stroke={COLORS.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);

// Download Icon
export const DownloadIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 10l5 5 5-5M12 15V3" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Upload Icon
export const UploadIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 8l-5-5-5 5M12 3v12" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Lock/Security Icon
export const LockIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="3" y="11" width="18" height="11" rx="2" fill="url(#lockGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1.5" fill={COLORS.accent} />
    </svg>
);

// Shield/Protected Icon
export const ShieldIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.success} stopOpacity="0.2" />
                <stop offset="100%" stopColor={COLORS.success} stopOpacity="0.1" />
            </linearGradient>
        </defs>
        <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            fill="url(#shieldGrad)"
            stroke={COLORS.success}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Key Icon
export const KeyIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="8" cy="15" r="5" fill="none" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M11.5 11.5l9 9M17 14l3 3M14 17l3 3" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Plug/Connect Icon
export const PlugIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 22v-4" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 18h10" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 14v4h10v-4" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M9 14V8a3 3 0 0 1 6 0v6" stroke={COLORS.secondary} strokeWidth="1.5" fill="none" />
        <path d="M9 2v4M15 2v4" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Zap/Lightning Icon
export const ZapIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="zapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.warning} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            fill="url(#zapGrad)"
            stroke={COLORS.primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// Arrow Icons
export const ArrowLeftIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M19 12H5M12 19l-7-7 7-7" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ArrowRightIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M5 12h14M12 5l7 7-7 7" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ChevronDownIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M6 9l6 6 6-6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ChevronRightIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M9 6l6 6-6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ChevronLeftIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M15 18l-6-6 6-6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// MoreHorizontal (3 dots)
export const MoreHorizontalIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="1.5" fill={COLORS.primary} />
        <circle cx="6" cy="12" r="1.5" fill={COLORS.primary} />
        <circle cx="18" cy="12" r="1.5" fill={COLORS.primary} />
    </svg>
);

// CreditCard Icon
export const CreditCardIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="1" y="4" width="22" height="16" rx="2" fill="url(#cardGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M1 10h22" stroke={COLORS.primary} strokeWidth="1.5" />
        <rect x="5" y="14" width="6" height="2" rx="0.5" fill={COLORS.accent} />
    </svg>
);

// LogOut Icon
export const LogOutIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 17l5-5-5-5M21 12H9" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// User Icon
export const UserIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="userGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <circle cx="12" cy="8" r="4" fill="url(#userGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Wallet Icon
export const WalletIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="2" y="6" width="20" height="14" rx="2" fill="url(#walletGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M2 10h20" stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="17" cy="14" r="1.5" fill={COLORS.accent} />
        <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" stroke={COLORS.secondary} strokeWidth="1.5" />
    </svg>
);

// Globe Icon
export const GlobeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <ellipse cx="12" cy="12" rx="4" ry="10" stroke={COLORS.secondary} strokeWidth="1" fill="none" />
        <path d="M2 12h20" stroke={COLORS.secondary} strokeWidth="1" />
        <path d="M12 2a15 15 0 0 1 0 20" stroke={COLORS.accent} strokeWidth="1.5" fill="none" />
    </svg>
);

// Activity Icon
export const ActivityIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Bell/Notification Icon
export const BellIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="url(#bellGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Moon Icon
export const MoonIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#334155" />
            </linearGradient>
        </defs>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moonGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Sun Icon
export const SunIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.warning} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="5" fill="url(#sunGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={COLORS.warning} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Cloud Icon
export const CloudIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
            </linearGradient>
        </defs>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="url(#cloudGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Database Icon
export const DatabaseIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <ellipse cx="12" cy="5" rx="9" ry="3" fill="url(#dbGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M21 5v7c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M21 12v7c0 1.66-4.03 3-9 3s-9-1.34-9-3v-7" stroke={COLORS.primary} strokeWidth="1.5" />
    </svg>
);

// Server Icon
export const ServerIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="serverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="8" rx="2" fill="url(#serverGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <rect x="2" y="14" width="20" height="8" rx="2" fill="url(#serverGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="6" cy="6" r="1" fill={COLORS.success} />
        <circle cx="6" cy="18" r="1" fill={COLORS.success} />
    </svg>
);

// Workflow Icon
export const WorkflowIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="6" height="6" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <rect x="15" y="3" width="6" height="6" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <rect x="9" y="15" width="6" height="6" rx="1" stroke={COLORS.accent} strokeWidth="1.5" fill="none" />
        <path d="M6 9v2a2 2 0 0 0 2 2h2M18 9v2a2 2 0 0 1-2 2h-2" stroke={COLORS.secondary} strokeWidth="1.5" />
    </svg>
);

// Layers Icon
export const LayersIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255,180,140,0.3)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke={COLORS.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// LayoutDashboard Icon
export const LayoutDashboardIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="7" height="9" rx="1" fill="rgba(255,180,140,0.3)" stroke={COLORS.primary} strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <rect x="14" y="12" width="7" height="9" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <rect x="3" y="16" width="7" height="5" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
    </svg>
);

// Eye2/Preview Icon
export const Code2Icon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M16 18l6-6-6-6" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 6l-6 6 6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// X/Close Icon (alternative)
export const XIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18 6L6 18M6 6l12 12" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// AlertCircle Icon
export const AlertCircleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke={COLORS.warning} strokeWidth="1.5" fill="none" />
        <path d="M12 8v4M12 16h.01" stroke={COLORS.warning} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// CheckCircle Icon
export const CheckCircleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke={COLORS.success} strokeWidth="1.5" fill="none" />
        <path d="M9 12l2 2 4-4" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Circle Icon (simple filled circle for radio buttons)
export const CircleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
);

// MessageSquare Icon (for comments)
export const MessageSquareIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="messageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" fill="url(#messageGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// UserPlus Icon (for adding collaborators)
export const UserPlusIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="9" cy="7" r="4" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M19 8v6M22 11h-6" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Sparkles Icon
export const SparklesIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="sparklesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" fill="url(#sparklesGrad)" stroke={COLORS.primary} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 3l.5 2L8 5.5l-2.5.5L5 8l-.5-2L2 5.5l2.5-.5L5 3z" fill={COLORS.accent} />
        <path d="M19 16l.5 2 2.5.5-2.5.5-.5 2-.5-2-2.5-.5 2.5-.5.5-2z" fill={COLORS.accentLight} />
    </svg>
);

// LayoutTemplate Icon
export const LayoutTemplateIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="layoutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#layoutGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M3 9h18M9 9v12" stroke={COLORS.primary} strokeWidth="1.5" />
        <rect x="12" y="12" width="6" height="6" rx="0.5" fill={COLORS.accent} opacity="0.3" />
    </svg>
);

// Rocket Icon
export const RocketIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill="url(#rocketGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" fill="url(#rocketGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="16" cy="8" r="1.5" fill="#fff" />
    </svg>
);

// Keyboard Icon
export const KeyboardIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="keyboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="2" y="6" width="20" height="12" rx="2" fill="url(#keyboardGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="6" y="13" width="12" height="2" rx="0.5" fill={COLORS.accent} opacity="0.3" />
    </svg>
);

// Play Icon
export const PlayIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#playGrad)" />
        <path d="M10 8l6 4-6 4V8z" fill="#fff" />
    </svg>
);

// Pause Icon
export const PauseIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.1)" stroke={COLORS.secondary} strokeWidth="1.5" />
        <rect x="9" y="8" width="2" height="8" rx="0.5" fill={COLORS.primary} />
        <rect x="13" y="8" width="2" height="8" rx="0.5" fill={COLORS.primary} />
    </svg>
);

// Stop/Square Icon
export const StopIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.1)" stroke={COLORS.error} strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="0.5" fill={COLORS.error} />
    </svg>
);

// DollarSign Icon
export const DollarSignIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Gift Icon
export const GiftIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="giftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.success} />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>
        <rect x="3" y="8" width="18" height="4" rx="1" fill="url(#giftGrad)" />
        <rect x="3" y="12" width="18" height="10" rx="1" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M12 8V22M3 12h18" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-3-3c-1.66 0-3 .66-3 3s1.34 3 3 3z" stroke={COLORS.success} strokeWidth="1.5" fill="none" />
    </svg>
);

// XCircle Icon (error with X mark)
export const XCircleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" fill={COLORS.error} />
        <path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Users Icon
export const UsersIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="usersGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <circle cx="9" cy="7" r="4" fill="url(#usersGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="17" cy="7" r="3" fill="rgba(255,180,140,0.5)" stroke={COLORS.secondary} strokeWidth="1.5" />
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={COLORS.secondary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Lightbulb Icon
export const LightbulbIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="lightbulbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" stroke="url(#lightbulbGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 18h6M10 22h4" stroke={COLORS.warning} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// TrendingUp Icon
export const TrendingUpIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="trendingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>
        <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="url(#trendingGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 6h6v6" stroke="url(#trendingGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Coins Icon
export const CoinsIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="coinsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        <circle cx="8" cy="8" r="6" fill="url(#coinsGrad)" opacity="0.9" />
        <circle cx="8" cy="8" r="6" stroke={COLORS.warning} strokeWidth="1.5" fill="none" />
        <circle cx="16" cy="16" r="6" fill="url(#coinsGrad)" opacity="0.7" />
        <circle cx="16" cy="16" r="6" stroke={COLORS.warning} strokeWidth="1.5" fill="none" />
    </svg>
);

// AlertTriangle Icon
export const AlertTriangleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="alertTriangleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="url(#alertTriangleGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M12 9v4M12 17h.01" stroke={COLORS.warning} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// CheckCircle2 Icon (alias for CheckCircleIcon with slightly different styling)
export const CheckCircle2Icon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="checkCircle2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" stroke="url(#checkCircle2Grad)" strokeWidth="1.5" fill="none" />
        <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Bot Icon
export const BotIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="botGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <rect x="3" y="8" width="18" height="12" rx="2" fill="url(#botGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M12 2v4" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="2" r="1" fill={COLORS.accent} />
        <circle cx="8" cy="13" r="1.5" fill="#fff" />
        <circle cx="16" cy="13" r="1.5" fill="#fff" />
        <path d="M9 17h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Ghost Icon
export const GhostIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
            </linearGradient>
        </defs>
        <path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2 2 3-3 3 3 2-2 3 3V10a8 8 0 0 0-8-8z" fill="url(#ghostGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Square Icon
export const SquareIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="4" y="4" width="16" height="16" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
    </svg>
);

// BarChart3 Icon
export const BarChart3Icon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 3v18h18" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7" y="10" width="3" height="8" rx="0.5" fill={COLORS.accent} />
        <rect x="12" y="6" width="3" height="12" rx="0.5" fill={COLORS.accentLight} />
        <rect x="17" y="3" width="3" height="15" rx="0.5" fill={COLORS.success} />
    </svg>
);

// ImagePlus Icon (for image uploads)
export const ImagePlusIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="imagePlusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#imagePlusGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" fill={COLORS.accent} />
        <path d="M21 15l-5-5-11 11" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 5h6M19 2v6" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Paperclip Icon
export const PaperclipIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

// Send Icon
export const SendIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="sendGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="url(#sendGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Mic Icon
export const MicIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="9" y="2" width="6" height="11" rx="3" fill={COLORS.accent} stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M5 10a7 7 0 0 0 14 0" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 17v4M8 21h8" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// ArrowUp Icon
export const ArrowUpIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 19V5M5 12l7-7 7 7" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ArrowDown Icon
export const ArrowDownIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 5v14M19 12l-7 7-7-7" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Menu Icon
export const MenuIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 12h18M3 6h18M3 18h18" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Terminal Icon
export const TerminalIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M6 9l4 3-4 3" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 15h6" stroke={COLORS.secondary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// ExternalLink Icon
export const ExternalLinkIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 3h6v6M10 14L21 3" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Link Icon
export const LinkIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Filter Icon
export const FilterIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

// Maximize Icon
export const MaximizeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Minimize Icon
export const MinimizeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Star Icon
export const StarIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.warning} />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#starGrad)" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Heart Icon
export const HeartIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={COLORS.error} stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Target Icon
export const TargetIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="12" r="6" stroke={COLORS.secondary} strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="12" r="2" fill={COLORS.accent} />
    </svg>
);

// Edit/Pencil Icon
export const EditIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill={COLORS.accent} stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Save Icon
export const SaveIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M17 21v-8H7v8" stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M7 3v5h8" stroke={COLORS.primary} strokeWidth="1.5" />
        <rect x="9" y="14" width="6" height="5" rx="0.5" fill={COLORS.accent} opacity="0.3" />
    </svg>
);

// Share Icon
export const ShareIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="18" cy="5" r="3" fill={COLORS.accent} stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="6" cy="12" r="3" fill={COLORS.accentLight} stroke={COLORS.primary} strokeWidth="1.5" />
        <circle cx="18" cy="19" r="3" fill={COLORS.accent} stroke={COLORS.primary} strokeWidth="1.5" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={COLORS.primary} strokeWidth="1.5" />
    </svg>
);

// Wand/Magic Wand Icon
export const WandIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="wandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accent} />
                <stop offset="100%" stopColor={COLORS.accentLight} />
            </linearGradient>
        </defs>
        <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" stroke="url(#wandGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Volume/Speaker Icon
export const VolumeIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="volumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accent} />
                <stop offset="100%" stopColor={COLORS.accentLight} />
            </linearGradient>
        </defs>
        <path d="M11 5L6 9H2v6h4l5 4V5z" fill="url(#volumeGrad)" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Help Circle Icon
export const HelpCircleIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="helpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.info} />
                <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#helpGrad)" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Palette Icon
export const PaletteIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="paletteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accent} />
                <stop offset="100%" stopColor={COLORS.accentLight} />
            </linearGradient>
        </defs>
        <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c.9 0 2-.4 2-1.5 0-.47-.17-.92-.5-1.24a1.45 1.45 0 0 1-.4-1.06c0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z" fill="url(#paletteGrad)" />
        <circle cx="6.5" cy="11.5" r="1.5" fill="#fff" />
        <circle cx="9.5" cy="7.5" r="1.5" fill="#fff" />
        <circle cx="14.5" cy="7.5" r="1.5" fill="#fff" />
        <circle cx="17.5" cy="11.5" r="1.5" fill="#fff" />
    </svg>
);

// Smartphone Icon
export const SmartphoneIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="5" y="2" width="14" height="20" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M12 18h.01" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Tablet Icon
export const TabletIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="4" y="2" width="16" height="20" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M12 18h.01" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Monitor Icon
export const MonitorIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="3" width="20" height="14" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M8 21h8M12 17v4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// FolderGit Icon
export const FolderGitIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="13" r="2" fill={COLORS.accent} />
        <path d="M14 13h3M7 13h3" stroke={COLORS.secondary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// GitBranch Icon
export const GitBranchIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="6" cy="6" r="3" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <circle cx="18" cy="6" r="3" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <circle cx="6" cy="18" r="3" stroke={COLORS.accent} strokeWidth="1.5" fill="none" />
        <path d="M6 9v6M18 9a9 9 0 0 1-9 9" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// RefreshCw Icon
export const RefreshCwIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M21 2v6h-6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 22v-6h6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// TestTube Icon
export const TestTubeIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M9 2v13l-3 4c-.6.8-.1 2 1 2h10c1.1 0 1.6-1.2 1-2l-3-4V2" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9 2h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 15h10" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Accessibility Icon
export const AccessibilityIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <circle cx="12" cy="4" r="2" fill={COLORS.accent} />
        <path d="M5 8h14M12 8v5M8 21l4-8 4 8" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

// FileJson Icon (JSON file)
export const FileJsonIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M14 2v6h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 12H9a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1m6-4h1a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
);

// FileCode Icon
export const FileCodeIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M14 2v6h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 13l-2 2 2 2M14 13l2 2-2 2" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// MousePointer2 Icon
export const MousePointer2Icon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M4 4l7.07 17 2.51-7.39L21 11.07 4 4z" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M13.5 13.5L19 19" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Trophy Icon
export const TrophyIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <defs>
            <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accent} />
                <stop offset="100%" stopColor={COLORS.accentLight} />
            </linearGradient>
        </defs>
        <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <path d="M8 21h8M12 17v4" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 3h12v8a6 6 0 1 1-12 0V3z" fill="url(#trophyGrad)" stroke={COLORS.primary} strokeWidth="1.5" />
    </svg>
);

// Gavel Icon
export const GavelIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M14.5 3L21 9.5M7 10l7-7 4 4-7 7" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M3 21l6-6" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 15l-6 6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="2" y="20" width="6" height="2" rx="1" fill={COLORS.secondary} />
    </svg>
);

// Unlink Icon
export const UnlinkIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 2v3M2 8h3M16 22v-3M22 16h-3" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Link2 Icon
export const Link2Icon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 12h8" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Loader2 Icon (alias for LoadingIcon)
export const Loader2Icon = LoadingIcon;

// ChevronUp Icon
export const ChevronUpIcon = ({ size = 24, className = '', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M18 15l-6-6-6 6" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Export all status icons (with both naming styles for compatibility)
export const StatusIcons = {
    // Short names
    Check: CheckIcon,
    Loading: LoadingIcon,
    Error: ErrorIcon,
    Warning: WarningIcon,
    Info: InfoIcon,
    Settings: SettingsIcon,
    Search: SearchIcon,
    Clock: ClockIcon,
    Brain: BrainIcon,
    Code: CodeIcon,
    Plus: PlusIcon,
    Close: CloseIcon,
    Eye: EyeIcon,
    EyeOff: EyeOffIcon,
    Trash: TrashIcon,
    Copy: CopyIcon,
    Refresh: RefreshIcon,
    Download: DownloadIcon,
    Upload: UploadIcon,
    Lock: LockIcon,
    Shield: ShieldIcon,
    Key: KeyIcon,
    Plug: PlugIcon,
    Zap: ZapIcon,
    ArrowLeft: ArrowLeftIcon,
    ArrowRight: ArrowRightIcon,
    ArrowUp: ArrowUpIcon,
    ArrowDown: ArrowDownIcon,
    ChevronDown: ChevronDownIcon,
    ChevronRight: ChevronRightIcon,
    ChevronLeft: ChevronLeftIcon,
    MessageSquare: MessageSquareIcon,
    UserPlus: UserPlusIcon,
    Circle: CircleIcon,
    Sparkles: SparklesIcon,
    LayoutTemplate: LayoutTemplateIcon,
    Rocket: RocketIcon,
    Keyboard: KeyboardIcon,
    Users: UsersIcon,
    Play: PlayIcon,
    Pause: PauseIcon,
    Stop: StopIcon,
    Square: SquareIcon,
    DollarSign: DollarSignIcon,
    Gift: GiftIcon,
    XCircle: XCircleIcon,
    Lightbulb: LightbulbIcon,
    TrendingUp: TrendingUpIcon,
    Coins: CoinsIcon,
    AlertTriangle: AlertTriangleIcon,
    CheckCircle2: CheckCircle2Icon,
    Bot: BotIcon,
    Ghost: GhostIcon,
    BarChart3: BarChart3Icon,
    ImagePlus: ImagePlusIcon,
    Paperclip: PaperclipIcon,
    Send: SendIcon,
    Mic: MicIcon,
    Menu: MenuIcon,
    Terminal: TerminalIcon,
    ExternalLink: ExternalLinkIcon,
    Link: LinkIcon,
    Filter: FilterIcon,
    Maximize: MaximizeIcon,
    Minimize: MinimizeIcon,
    Star: StarIcon,
    Heart: HeartIcon,
    Target: TargetIcon,
    Edit: EditIcon,
    Save: SaveIcon,
    Share: ShareIcon,
    Wand: WandIcon,
    Volume: VolumeIcon,
    HelpCircle: HelpCircleIcon,
    Palette: PaletteIcon,

    // Full names with Icon suffix (for compatibility)
    CheckIcon,
    LoadingIcon,
    ErrorIcon,
    WarningIcon,
    InfoIcon,
    SettingsIcon,
    SearchIcon,
    ClockIcon,
    BrainIcon,
    CodeIcon,
    PlusIcon,
    CloseIcon,
    EyeIcon,
    EyeOffIcon,
    TrashIcon,
    CopyIcon,
    RefreshIcon,
    DownloadIcon,
    UploadIcon,
    LockIcon,
    ShieldIcon,
    KeyIcon,
    PlugIcon,
    ZapIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    MessageSquareIcon,
    UserPlusIcon,
    CircleIcon,
    SparklesIcon,
    LayoutTemplateIcon,
    RocketIcon,
    KeyboardIcon,
    UsersIcon,
    PlayIcon,
    PauseIcon,
    StopIcon,
    SquareIcon,
    DollarSignIcon,
    GiftIcon,
    XCircleIcon,
    LightbulbIcon,
    TrendingUpIcon,
    CoinsIcon,
    AlertTriangleIcon,
    CheckCircle2Icon,
    BotIcon,
    GhostIcon,
    BarChart3Icon,
    ImagePlusIcon,
    PaperclipIcon,
    SendIcon,
    MicIcon,
    MenuIcon,
    TerminalIcon,
    ExternalLinkIcon,
    LinkIcon,
    FilterIcon,
    MaximizeIcon,
    MinimizeIcon,
    StarIcon,
    HeartIcon,
    TargetIcon,
    EditIcon,
    SaveIcon,
    ShareIcon,
    WandIcon,
    VolumeIcon,
    HelpCircleIcon,
    PaletteIcon,
    SmartphoneIcon,
    TabletIcon,
    MonitorIcon,
    FolderGitIcon,
    GitBranchIcon,
    RefreshCwIcon,

    // Additional icon aliases
    ActivityIcon,
    CloudIcon,
    DatabaseIcon,
    ServerIcon,
    WorkflowIcon,
    LayersIcon,
    LayoutDashboardIcon,
    Code2Icon,
    XIcon,
    AlertCircleIcon,
    CheckCircleIcon,
    MoreHorizontalIcon,
    CreditCardIcon,
    LogOutIcon,
    UserIcon,
    WalletIcon,
    GlobeIcon,
    BellIcon,
    MoonIcon,
    SunIcon,
};

export default StatusIcons;

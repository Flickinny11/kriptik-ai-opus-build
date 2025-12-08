/**
 * Chat Interface Icons - Premium KripTik-style icons
 *
 * Black, white, charcoal with red accents
 * Matching AbstractIcons.tsx aesthetic
 * NO generic AI-slop - unique, hand-crafted designs
 */

// Color palette (matches AbstractIcons)
const COLORS = {
    black: '#0a0a0a',
    charcoal: '#2d2d2d',
    gray: '#4a4a4a',
    lightGray: '#6a6a6a',
    white: '#ffffff',
    offWhite: '#e8e8e8',
    red: '#dc2626',
    redLight: '#ef4444',
    redDark: '#991b1b',
};

interface IconProps {
    size?: number;
    className?: string;
}

/**
 * Orchestrator Icon - Multi-agent network visualization
 * Three interconnected nodes representing agent coordination
 */
export const OrchestratorIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Connection lines - forming triangle network */}
        <path
            d="M12 4L4 18M12 4L20 18M4 18H20"
            stroke={COLORS.charcoal}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* 3D depth on connections */}
        <path
            d="M12 4.5L4.5 18M12 4.5L19.5 18"
            stroke={COLORS.lightGray}
            strokeWidth="0.75"
            opacity="0.4"
        />
        {/* Center pulse line with red */}
        <path
            d="M12 8L12 14"
            stroke={COLORS.red}
            strokeWidth="2"
            strokeLinecap="round"
        />
        {/* Agent nodes */}
        {/* Top node (primary) */}
        <circle cx="12" cy="4" r="3" fill={COLORS.white} stroke={COLORS.black} strokeWidth="1.5" />
        <circle cx="12" cy="4" r="1.5" fill={COLORS.red} />
        {/* Bottom left node */}
        <circle cx="4" cy="18" r="2.5" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="1.5" />
        <circle cx="4" cy="18" r="1" fill={COLORS.gray} />
        {/* Bottom right node */}
        <circle cx="20" cy="18" r="2.5" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="1.5" />
        <circle cx="20" cy="18" r="1" fill={COLORS.gray} />
        {/* Node 3D shadows */}
        <ellipse cx="12.5" cy="4.5" rx="2.5" ry="0.5" fill={COLORS.black} opacity="0.2" />
    </svg>
);

/**
 * Intelligence Icon - Brain/neural network style
 * For Krip-Toe-Nite intelligent routing
 */
export const IntelligenceIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Neural path background */}
        <path
            d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C7.58 20 4 16.42 4 12Z"
            fill={COLORS.offWhite}
            stroke={COLORS.black}
            strokeWidth="1.5"
        />
        {/* 3D shadow */}
        <ellipse cx="12" cy="20" rx="6" ry="1.5" fill={COLORS.charcoal} opacity="0.3" />
        {/* Neural connections */}
        <path
            d="M8 9L12 12L8 15M16 9L12 12L16 15"
            stroke={COLORS.charcoal}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Center node with red */}
        <circle cx="12" cy="12" r="2.5" fill={COLORS.white} stroke={COLORS.red} strokeWidth="1.5" />
        <circle cx="12" cy="12" r="1" fill={COLORS.red} />
        {/* Outer nodes */}
        <circle cx="8" cy="9" r="1.5" fill={COLORS.charcoal} />
        <circle cx="8" cy="15" r="1.5" fill={COLORS.charcoal} />
        <circle cx="16" cy="9" r="1.5" fill={COLORS.charcoal} />
        <circle cx="16" cy="15" r="1.5" fill={COLORS.charcoal} />
        {/* Pulse indicators */}
        <circle cx="12" cy="6" r="1" fill={COLORS.red} opacity="0.7" />
        <circle cx="12" cy="18" r="1" fill={COLORS.red} opacity="0.7" />
    </svg>
);

/**
 * Speed Bolt Icon - Lightning for fast models
 * Stylized bolt with 3D effect
 */
export const SpeedBoltIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* 3D shadow */}
        <path
            d="M14 3L5 13H12L10 21L19 11H12L14 3Z"
            fill={COLORS.charcoal}
            transform="translate(0.5, 0.5)"
            opacity="0.3"
        />
        {/* Main bolt */}
        <path
            d="M14 3L5 13H12L10 21L19 11H12L14 3Z"
            fill={COLORS.offWhite}
            stroke={COLORS.black}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Red accent core */}
        <path
            d="M13 6L8 12H11L10 17L15 11H12L13 6Z"
            fill={COLORS.red}
            opacity="0.8"
        />
        {/* Highlight */}
        <path
            d="M12 5L10 9"
            stroke={COLORS.white}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
        />
    </svg>
);

/**
 * User Avatar Icon - Human silhouette
 * Clean, premium avatar for user messages
 */
export const UserAvatarIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Body/shoulders with 3D depth */}
        <path
            d="M4 20C4 17.5 6 15 12 15C18 15 20 17.5 20 20"
            fill={COLORS.offWhite}
            stroke={COLORS.black}
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* 3D shadow on body */}
        <path
            d="M5 20C5 18 7 16 12 16C17 16 19 18 19 20"
            fill={COLORS.charcoal}
            opacity="0.2"
        />
        {/* Head */}
        <circle cx="12" cy="8" r="4" fill={COLORS.white} stroke={COLORS.black} strokeWidth="1.5" />
        {/* Face detail - subtle */}
        <path
            d="M10 7.5C10 7.5 10.5 8.5 12 8.5C13.5 8.5 14 7.5 14 7.5"
            stroke={COLORS.lightGray}
            strokeWidth="0.75"
            strokeLinecap="round"
            opacity="0.5"
        />
        {/* Red accent dot (status) */}
        <circle cx="16" cy="5" r="1.5" fill={COLORS.red} />
        {/* Head 3D shadow */}
        <ellipse cx="12" cy="12" rx="3" ry="0.5" fill={COLORS.black} opacity="0.15" />
    </svg>
);

/**
 * AI Assistant Icon - Robot/AI face
 * Modern AI assistant representation
 */
export const AIAssistantIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Main head shape */}
        <rect
            x="4" y="4" width="16" height="14" rx="3"
            fill={COLORS.white}
            stroke={COLORS.black}
            strokeWidth="1.5"
        />
        {/* 3D shadow */}
        <path
            d="M6 18H18A3 3 0 0020 15V9"
            stroke={COLORS.charcoal}
            strokeWidth="0.75"
            opacity="0.4"
        />
        {/* Eyes */}
        <circle cx="9" cy="10" r="2" fill={COLORS.charcoal} />
        <circle cx="15" cy="10" r="2" fill={COLORS.charcoal} />
        {/* Eye highlights */}
        <circle cx="8.5" cy="9.5" r="0.5" fill={COLORS.white} />
        <circle cx="14.5" cy="9.5" r="0.5" fill={COLORS.white} />
        {/* Antenna base */}
        <rect x="11" y="1" width="2" height="4" rx="1" fill={COLORS.charcoal} />
        {/* Antenna top with red */}
        <circle cx="12" cy="1" r="1.5" fill={COLORS.red} />
        {/* Mouth - subtle smile */}
        <path
            d="M9 14C9 14 10.5 15 12 15C13.5 15 15 14 15 14"
            stroke={COLORS.charcoal}
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Cheek accents */}
        <rect x="6" y="12" width="2" height="1" rx="0.5" fill={COLORS.red} opacity="0.4" />
        <rect x="16" y="12" width="2" height="1" rx="0.5" fill={COLORS.red} opacity="0.4" />
        {/* Bottom stand */}
        <rect x="10" y="18" width="4" height="2" rx="1" fill={COLORS.charcoal} />
        <rect x="8" y="20" width="8" height="2" rx="1" fill={COLORS.gray} />
    </svg>
);

/**
 * Send Message Icon - Paper plane
 * Premium send button icon
 */
export const SendMessageIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* 3D shadow */}
        <path
            d="M3 12L21 3L14 21L11 14L3 12Z"
            fill={COLORS.charcoal}
            transform="translate(0.5, 0.5)"
            opacity="0.3"
        />
        {/* Main plane */}
        <path
            d="M2 12L20 3L13 21L10 14L2 12Z"
            fill={COLORS.offWhite}
            stroke={COLORS.black}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Inner fold */}
        <path
            d="M20 3L10 14"
            stroke={COLORS.charcoal}
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Red accent tip */}
        <path
            d="M18 4L20 3L19 5"
            fill={COLORS.red}
        />
        {/* Highlight */}
        <path
            d="M4 12L8 11"
            stroke={COLORS.white}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.5"
        />
    </svg>
);

/**
 * Stop Circle Icon - For stopping generation
 */
export const StopIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Outer circle with 3D */}
        <circle cx="12" cy="12" r="9" fill={COLORS.offWhite} stroke={COLORS.black} strokeWidth="1.5" />
        <ellipse cx="12" cy="21" rx="6" ry="1" fill={COLORS.black} opacity="0.15" />
        {/* Inner stop square */}
        <rect x="8" y="8" width="8" height="8" rx="1" fill={COLORS.red} />
        {/* 3D effect on square */}
        <path
            d="M9 16H15A1 1 0 0016 15V9"
            stroke={COLORS.redDark}
            strokeWidth="0.75"
        />
        {/* Highlight */}
        <rect x="9" y="9" width="2" height="2" rx="0.5" fill={COLORS.white} opacity="0.4" />
    </svg>
);

/**
 * Pause Icon - For pausing generation
 */
export const PauseIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Outer circle */}
        <circle cx="12" cy="12" r="9" fill={COLORS.offWhite} stroke={COLORS.black} strokeWidth="1.5" />
        {/* Pause bars */}
        <rect x="8" y="7" width="3" height="10" rx="1" fill={COLORS.charcoal} />
        <rect x="13" y="7" width="3" height="10" rx="1" fill={COLORS.charcoal} />
        {/* Red accent on bars */}
        <rect x="8.5" y="7.5" width="2" height="2" rx="0.5" fill={COLORS.red} opacity="0.6" />
        <rect x="13.5" y="7.5" width="2" height="2" rx="0.5" fill={COLORS.red} opacity="0.6" />
    </svg>
);

/**
 * Play Icon - For resuming
 */
export const PlayIcon = ({ size = 24, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Outer circle */}
        <circle cx="12" cy="12" r="9" fill={COLORS.offWhite} stroke={COLORS.black} strokeWidth="1.5" />
        {/* Play triangle */}
        <path
            d="M10 7L18 12L10 17V7Z"
            fill={COLORS.charcoal}
            stroke={COLORS.black}
            strokeWidth="1"
            strokeLinejoin="round"
        />
        {/* Red accent */}
        <path
            d="M11 9L15 12L11 15"
            fill={COLORS.red}
            opacity="0.6"
        />
    </svg>
);

export default {
    OrchestratorIcon,
    IntelligenceIcon,
    SpeedBoltIcon,
    UserAvatarIcon,
    AIAssistantIcon,
    SendMessageIcon,
    StopIcon,
    PauseIcon,
    PlayIcon,
};


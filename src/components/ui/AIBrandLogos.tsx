/**
 * AI Brand Logos - Real brand SVG logos from Simple Icons + Custom Icons
 *
 * Premium, authentic logos for AI model providers
 * NO generic Lucide icons - real brand identity
 */

import { motion } from 'framer-motion';

interface BrandLogoProps {
    size?: number;
    className?: string;
    animated?: boolean;
}

// Color palette for custom icons
const COLORS = {
    black: '#0a0a0a',
    charcoal: '#2d2d2d',
    gray: '#4a4a4a',
    white: '#ffffff',
    offWhite: '#e8e8e8',
    red: '#dc2626',
    cyan: '#06b6d4',
    amber: '#f59e0b',
};

/**
 * KripTik AI Logo (Custom - matches KriptikLogo.tsx style)
 * 3D sphere with orbital ring - for Krip-Toe-Nite
 */
export const KripTikNiteLogo = ({ size = 24, className, animated }: BrandLogoProps) => {
    const logo = (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <defs>
                <radialGradient id="ktnSphere" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#4a4a4a" />
                    <stop offset="50%" stopColor="#1a1a1a" />
                    <stop offset="100%" stopColor="#0a0a0a" />
                </radialGradient>
                <linearGradient id="ktnRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={COLORS.amber} />
                    <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
            </defs>
            {/* Sphere */}
            <circle cx="12" cy="12" r="6" fill="url(#ktnSphere)" />
            <circle cx="12" cy="12" r="5.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            {/* Orbital ring */}
            <g transform="rotate(-20, 12, 12)">
                <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="url(#ktnRing)" strokeWidth="1.5" strokeLinecap="round" />
                {/* Ring detail */}
                <ellipse cx="12" cy="12" rx="8" ry="2.5" fill="none" stroke={COLORS.amber} strokeWidth="0.75" opacity="0.5" />
            </g>
            {/* Highlight */}
            <circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.3)" />
        </svg>
    );

    if (animated) {
        return (
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
                {logo}
            </motion.div>
        );
    }
    return logo;
};

/**
 * Anthropic Logo (Claude) - From Simple Icons
 * Orange/tan stylized 'A' shape
 */
export const AnthropicLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
            d="M17.304 3.541h-3.677l6.372 16.918h3.677L17.304 3.541zm-10.608 0L.324 20.459h3.677l1.254-3.48h6.012l1.254 3.48h3.677L9.826 3.541H6.696zm.484 10.578L9.311 8.27l2.13 5.849H7.18z"
            fill="#D4A27F"
        />
    </svg>
);

/**
 * OpenAI Logo (GPT) - From Simple Icons
 * Classic hexagonal infinity symbol
 */
export const OpenAILogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
            d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0012 .008a6.038 6.038 0 00-5.744 4.225 5.985 5.985 0 00-3.998 2.903 6.075 6.075 0 00.752 7.118 5.985 5.985 0 00.516 4.91 6.046 6.046 0 006.51 2.9A6.065 6.065 0 0012 24a6.038 6.038 0 005.744-4.225 5.985 5.985 0 003.998-2.903 6.075 6.075 0 00-.752-7.118zM12 22.14a4.2 4.2 0 01-2.707-.992l.133-.075 4.502-2.6a.732.732 0 00.368-.64v-6.349l1.903 1.099a.067.067 0 01.037.052v5.254A4.232 4.232 0 0112 22.14zM4.13 18.05a4.188 4.188 0 01-.502-2.828l.133.079 4.502 2.6a.73.73 0 00.736 0l5.5-3.177v2.197a.067.067 0 01-.027.058l-4.554 2.63A4.232 4.232 0 014.13 18.05zM2.77 7.995a4.21 4.21 0 012.2-1.85v5.361a.73.73 0 00.368.64l5.5 3.176-1.903 1.099a.067.067 0 01-.064.006l-4.554-2.63A4.232 4.232 0 012.77 7.995zm16.233 3.795l-5.5-3.176 1.903-1.099a.067.067 0 01.064-.006l4.554 2.63a4.224 4.224 0 01-.654 7.645v-5.355a.73.73 0 00-.367-.639zm1.894-2.847l-.133-.079-4.502-2.6a.73.73 0 00-.736 0l-5.5 3.177V7.244a.067.067 0 01.027-.058l4.554-2.63a4.224 4.224 0 016.29 4.387zM9.42 12.743l-1.903-1.099a.067.067 0 01-.037-.052V6.338a4.224 4.224 0 016.934-3.246l-.133.075-4.502 2.6a.732.732 0 00-.368.64zm1.034-2.232l2.45-1.414 2.45 1.414v2.828l-2.45 1.414-2.45-1.414v-2.828z"
            fill="#10A37F"
        />
    </svg>
);

/**
 * Google Logo (Gemini) - From Simple Icons
 * Google's 'G' with their brand colors
 */
export const GoogleLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

/**
 * Mistral Logo - From Simple Icons
 * Orange stylized 'M' blocks
 */
export const MistralLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M3.428 0v4.5h4.5V0h-4.5Zm6.107 0v4.5h4.5V0h-4.5Zm6.107 0v4.5h4.5V0h-4.5ZM21.857 0v4.5h-4.5V0h4.5Z" fill="#0a0a0a"/>
        <path d="M3.428 6.429v4.5h4.5v-4.5h-4.5ZM21.857 6.429v4.5h-4.5v-4.5h4.5Z" fill="#F7D046"/>
        <path d="M15.642 6.429v4.5h-4.5v-4.5h4.5Zm-6.107 0v4.5h-4.5v-4.5h4.5Z" fill="#F7D046"/>
        <path d="M3.428 12.857v4.5h4.5v-4.5h-4.5Zm6.107 0v4.5h4.5v-4.5h-4.5ZM21.857 12.857v4.5h-4.5v-4.5h4.5Z" fill="#F2A73B"/>
        <path d="M3.428 19.286v4.5h4.5v-4.5h-4.5Zm6.107 0v4.5h4.5v-4.5h-4.5Zm6.107 0v4.5h4.5v-4.5h-4.5ZM21.857 19.286v4.5h-4.5v-4.5h4.5Z" fill="#EE792F"/>
    </svg>
);

/**
 * DeepSeek Logo (Custom - Chinese AI)
 * Deep blue with tech aesthetic
 */
export const DeepSeekLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="dsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
        </defs>
        {/* Main 'D' shape with tech lines */}
        <path
            d="M4 4h8c4.4 0 8 3.6 8 8s-3.6 8-8 8H4V4z"
            fill="none"
            stroke="url(#dsGrad)"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path
            d="M7 8h5c2.2 0 4 1.8 4 4s-1.8 4-4 4H7V8z"
            fill="url(#dsGrad)"
            opacity="0.3"
        />
        {/* Tech accent lines */}
        <line x1="7" y1="12" x2="14" y2="12" stroke={COLORS.red} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="12" r="1" fill={COLORS.red} />
    </svg>
);

/**
 * X/Grok Logo - From Simple Icons (X logo)
 */
export const XGrokLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
            d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
            fill="#000000"
        />
    </svg>
);

/**
 * Alibaba/Qwen Logo (Custom - Qwen style)
 * Orange/red gradient with cloud motif
 */
export const QwenLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="qwenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF6A00" />
                <stop offset="100%" stopColor="#FF4500" />
            </linearGradient>
        </defs>
        {/* Q shape */}
        <circle cx="12" cy="11" r="7" fill="none" stroke="url(#qwenGrad)" strokeWidth="2.5" />
        <path d="M14 14l4 5" stroke="url(#qwenGrad)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Inner accent */}
        <circle cx="12" cy="11" r="3" fill="url(#qwenGrad)" opacity="0.4" />
        <circle cx="11" cy="10" r="1" fill="white" opacity="0.6" />
    </svg>
);

/**
 * Codestral Logo (Custom - Mistral coding variant)
 * Code brackets with Mistral colors
 */
export const CodestralLogo = ({ size = 24, className }: BrandLogoProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="codeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F7D046" />
                <stop offset="50%" stopColor="#F2A73B" />
                <stop offset="100%" stopColor="#EE792F" />
            </linearGradient>
        </defs>
        {/* Opening bracket */}
        <path
            d="M8 4L3 12L8 20"
            fill="none"
            stroke="url(#codeGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Closing bracket */}
        <path
            d="M16 4L21 12L16 20"
            fill="none"
            stroke="url(#codeGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Center dot */}
        <circle cx="12" cy="12" r="2" fill={COLORS.red} />
    </svg>
);

/**
 * Get the correct logo component for a model ID
 */
export const getModelLogo = (modelId: string): React.FC<BrandLogoProps> => {
    const logoMap: Record<string, React.FC<BrandLogoProps>> = {
        'krip-toe-nite': KripTikNiteLogo,
        'claude-opus-4.5': AnthropicLogo,
        'claude-sonnet-4.5': AnthropicLogo,
        'gpt-5.1-codex-max': OpenAILogo,
        'gemini-3-pro': GoogleLogo,
        'gemini-2.5-flash': GoogleLogo,
        'mistral-large-3': MistralLogo,
        'grok-4-fast': XGrokLogo,
        'deepseek-v3': DeepSeekLogo,
        'deepseek-r1': DeepSeekLogo,
        'qwen3-coder': QwenLogo,
        'codestral-2508': CodestralLogo,
    };

    return logoMap[modelId] || KripTikNiteLogo;
};

export default {
    KripTikNiteLogo,
    AnthropicLogo,
    OpenAILogo,
    GoogleLogo,
    MistralLogo,
    DeepSeekLogo,
    XGrokLogo,
    QwenLogo,
    CodestralLogo,
    getModelLogo,
};


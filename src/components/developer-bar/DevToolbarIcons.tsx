/**
 * Developer Toolbar Icons - Premium 3D Geometric Icons
 *
 * Design Scheme:
 * - Black and white base with RED ACCENTS
 * - 3D interlocking geometric shapes
 * - No emojis, no Lucide icons
 * - Layered shadows and depth
 * - Animated hover/active states
 */

import { motion } from 'framer-motion';

export type ToolbarIconName =
  | 'featureAgents'
  | 'openSourceStudio'
  | 'console'
  | 'network'
  | 'settings'
  | 'health'
  | 'database'
  | 'memory'
  | 'dna'
  | 'aiLab'
  | 'quality'
  | 'voice'
  | 'selfHeal'
  | 'rules'
  | 'cloneMode'
  | 'security'
  | 'permissions';

interface IconProps {
  name: ToolbarIconName;
  size?: number;
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
}

// Gradient definitions - Black, White, Red scheme
const GradientDefs = () => (
  <defs>
    {/* Red accent gradient */}
    <linearGradient id="redAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FF3B3B" />
      <stop offset="50%" stopColor="#DC2626" />
      <stop offset="100%" stopColor="#991B1B" />
    </linearGradient>

    {/* Red glow gradient */}
    <linearGradient id="redGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FCA5A5" />
      <stop offset="100%" stopColor="#EF4444" />
    </linearGradient>

    {/* Dark metallic gradient */}
    <linearGradient id="darkMetal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#3A3A4A" />
      <stop offset="30%" stopColor="#2A2A3A" />
      <stop offset="70%" stopColor="#1A1A2A" />
      <stop offset="100%" stopColor="#0F0F1A" />
    </linearGradient>

    {/* Light metallic gradient */}
    <linearGradient id="lightMetal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#F8F8FC" />
      <stop offset="30%" stopColor="#E8E8F0" />
      <stop offset="70%" stopColor="#D0D0DC" />
      <stop offset="100%" stopColor="#B8B8C8" />
    </linearGradient>

    {/* Chrome gradient */}
    <linearGradient id="chrome" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#E8E8EC" />
      <stop offset="25%" stopColor="#B0B0BC" />
      <stop offset="50%" stopColor="#E8E8EC" />
      <stop offset="75%" stopColor="#A0A0B0" />
      <stop offset="100%" stopColor="#D0D0DC" />
    </linearGradient>

    {/* Deep black gradient */}
    <linearGradient id="deepBlack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#1C1C28" />
      <stop offset="100%" stopColor="#0A0A12" />
    </linearGradient>

    {/* 3D depth filter */}
    <filter id="depth3D" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="1" floodColor="#000" floodOpacity="0.5" />
      <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.3" />
    </filter>

    {/* Red glow filter */}
    <filter id="redGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood floodColor="#EF4444" floodOpacity="0.6" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    {/* Inner shadow */}
    <filter id="innerShadow">
      <feOffset dx="0" dy="1"/>
      <feGaussianBlur stdDeviation="1" result="offset-blur"/>
      <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
      <feFlood floodColor="black" floodOpacity="0.3" result="color"/>
      <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
      <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
    </filter>
  </defs>
);

// Individual icon components - 3D geometric designs with black/white/red
const icons: Record<ToolbarIconName, (props: { isActive: boolean; isHovered: boolean }) => JSX.Element> = {

  // Console - Terminal window with cursor
  console: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Terminal window */}
      <motion.rect
        x="3" y="4" width="18" height="16" rx="2"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="0.8"
        animate={{ scale: isHovered ? 1.02 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Title bar */}
      <rect x="3" y="4" width="18" height="3" rx="2" ry="0" fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'} />
      {/* Window buttons */}
      <circle cx="6" cy="5.5" r="0.8" fill={isActive ? '#1A1A2A' : '#EF4444'} />
      <circle cx="8.5" cy="5.5" r="0.8" fill={isActive ? '#1A1A2A' : '#F59E0B'} />
      <circle cx="11" cy="5.5" r="0.8" fill={isActive ? '#1A1A2A' : '#22C55E'} />
      {/* Console text lines */}
      <rect x="5" y="9" width="8" height="1" rx="0.5" fill={isActive ? '#22C55E' : '#4A4A5A'} />
      <rect x="5" y="11.5" width="12" height="1" rx="0.5" fill={isActive ? '#FFF' : '#5A5A6A'} />
      <rect x="5" y="14" width="6" height="1" rx="0.5" fill={isActive ? '#FFF' : '#5A5A6A'} />
      {/* Blinking cursor */}
      <motion.rect
        x="12" y="14" width="1.5" height="1"
        fill={isActive ? '#EF4444' : '#DC2626'}
        animate={{ opacity: isHovered ? [1, 0, 1] : 0.7 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      {/* Prompt symbol */}
      <path d="M5 17L7 17.5L5 18" stroke={isActive ? '#22C55E' : '#5A5A6A'} strokeWidth="0.8" fill="none" />
    </g>
  ),

  // Network - Connected nodes with data flow
  network: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Central hub */}
      <motion.circle
        cx="12" cy="12" r="4"
        fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'}
        stroke={isActive ? '#FCA5A5' : '#4A4A5A'}
        strokeWidth="0.8"
        animate={{ scale: isHovered ? 1.1 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Outer nodes */}
      <circle cx="5" cy="5" r="2.5" fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'} stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      <circle cx="19" cy="5" r="2.5" fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'} stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      <circle cx="5" cy="19" r="2.5" fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'} stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      <circle cx="19" cy="19" r="2.5" fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'} stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      {/* Connection lines */}
      <path d="M7 7L10 10" stroke={isActive ? '#EF4444' : '#4A4A5A'} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 7L14 10" stroke={isActive ? '#EF4444' : '#4A4A5A'} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 17L10 14" stroke={isActive ? '#EF4444' : '#4A4A5A'} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 17L14 14" stroke={isActive ? '#EF4444' : '#4A4A5A'} strokeWidth="1.2" strokeLinecap="round" />
      {/* Animated data packets */}
      <motion.circle
        cx="8" cy="8" r="1"
        fill={isActive ? '#FFF' : '#5A5A6A'}
        animate={isHovered ? { cx: [8, 10], cy: [8, 10], opacity: [1, 0] } : {}}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
      <motion.circle
        cx="16" cy="16" r="1"
        fill={isActive ? '#FFF' : '#5A5A6A'}
        animate={isHovered ? { cx: [16, 14], cy: [16, 14], opacity: [1, 0] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill={isActive ? '#FFF' : 'url(#chrome)'} />
    </g>
  ),

  // Settings - Gear with precision marks
  settings: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Main gear */}
      <motion.path
        d="M12 2L13.5 4.5L16.5 4L17.5 7L20.5 8L20 11L22 13L20 15L20.5 18L17.5 19L16.5 22L13.5 21.5L12 24L10.5 21.5L7.5 22L6.5 19L3.5 18L4 15L2 13L4 11L3.5 8L6.5 7L7.5 4L10.5 4.5L12 2Z"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="0.8"
        animate={{ rotate: isHovered ? 360 : 0 }}
        transition={{ duration: 3, repeat: isHovered ? Infinity : 0, ease: 'linear' }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Inner circle */}
      <circle cx="12" cy="13" r="5" fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'} stroke={isActive ? '#FCA5A5' : '#3A3A4A'} strokeWidth="0.5" />
      {/* Center hole */}
      <circle cx="12" cy="13" r="2.5" fill={isActive ? 'url(#deepBlack)' : 'url(#chrome)'} />
      {/* Precision marks */}
      <circle cx="12" cy="13" r="1" fill={isActive ? '#FFF' : '#EF4444'} />
      <path d="M12 8V9M12 17V18M7 13H8M16 13H17" stroke={isActive ? '#FFF' : '#5A5A6A'} strokeWidth="1" strokeLinecap="round" />
    </g>
  ),

  // Feature Agents - Hexagonal node network
  featureAgents: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Central hexagon */}
      <motion.path
        d="M12 3L18 7V13L12 17L6 13V7L12 3Z"
        fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'}
        stroke={isActive ? '#FCA5A5' : '#4A4A5A'}
        strokeWidth="0.8"
        animate={{ rotate: isHovered ? 15 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Inner hexagon */}
      <path
        d="M12 6L15 8V12L12 14L9 12V8L12 6Z"
        fill={isActive ? '#1A1A2A' : 'url(#chrome)'}
        opacity="0.9"
      />
      {/* Center node */}
      <circle cx="12" cy="10" r="1.5" fill={isActive ? '#FFF' : '#EF4444'} />
      {/* Orbiting ring */}
      <motion.circle
        cx="12" cy="10" r="3"
        fill="none"
        stroke={isActive ? '#FCA5A5' : '#DC2626'}
        strokeWidth="0.6"
        strokeDasharray="2 2"
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Satellite nodes */}
      <circle cx="12" cy="19" r="1.5" fill={isActive ? '#EF4444' : '#3A3A4A'} />
      <path d="M12 17V17.5" stroke={isActive ? '#FCA5A5' : '#5A5A6A'} strokeWidth="0.8" />
    </g>
  ),

  // Open Source Studio - HuggingFace-inspired face with model layers
  openSourceStudio: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Outer circle - model hub */}
      <motion.circle
        cx="12" cy="12" r="9"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#EF4444' : '#4A4A5A'}
        strokeWidth="0.8"
        animate={{ scale: isHovered ? 1.02 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Inner ring - processing */}
      <circle
        cx="12" cy="12" r="6"
        fill="none"
        stroke={isActive ? '#FCA5A5' : '#3A3A4A'}
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      {/* Left eye */}
      <ellipse cx="9" cy="10" rx="1.5" ry="2" fill={isActive ? '#1A1A2A' : 'url(#darkMetal)'} />
      <circle cx="9" cy="9.5" r="0.6" fill={isActive ? '#FFF' : '#EF4444'} />
      {/* Right eye */}
      <ellipse cx="15" cy="10" rx="1.5" ry="2" fill={isActive ? '#1A1A2A' : 'url(#darkMetal)'} />
      <circle cx="15" cy="9.5" r="0.6" fill={isActive ? '#FFF' : '#EF4444'} />
      {/* Smile */}
      <path
        d="M8 14C8 14 10 17 12 17C14 17 16 14 16 14"
        fill={isActive ? '#1A1A2A' : 'url(#darkMetal)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* Model layers indicator */}
      <motion.g
        animate={{ rotate: isHovered ? 360 : 0 }}
        transition={{ duration: 4, repeat: isHovered ? Infinity : 0, ease: 'linear' }}
        style={{ transformOrigin: 'center' }}
      >
        <circle cx="12" cy="3" r="1.5" fill={isActive ? '#EF4444' : '#5A5A6A'} />
        <circle cx="19" cy="8" r="1.2" fill={isActive ? '#DC2626' : '#4A4A5A'} />
        <circle cx="19" cy="16" r="1.2" fill={isActive ? '#DC2626' : '#4A4A5A'} />
        <circle cx="12" cy="21" r="1.5" fill={isActive ? '#EF4444' : '#5A5A6A'} />
        <circle cx="5" cy="16" r="1.2" fill={isActive ? '#DC2626' : '#4A4A5A'} />
        <circle cx="5" cy="8" r="1.2" fill={isActive ? '#DC2626' : '#4A4A5A'} />
      </motion.g>
    </g>
  ),

  // Health - Heart with pulse line
  health: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Heart shape */}
      <motion.path
        d="M12 20L4 12C1.5 9.5 2 5 5.5 4.5C8 4 10 5.5 12 7.5C14 5.5 16 4 18.5 4.5C22 5 22.5 9.5 20 12L12 20Z"
        fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'}
        stroke={isActive ? '#FCA5A5' : '#4A4A5A'}
        strokeWidth="0.5"
        animate={{ scale: isHovered ? [1, 1.05, 1] : 1 }}
        style={{ transformOrigin: 'center' }}
        transition={{ duration: 0.8, repeat: isHovered ? Infinity : 0 }}
      />
      {/* ECG pulse line */}
      <motion.path
        d="M5 12H8L9 9L11 15L13 11L14 12H19"
        fill="none"
        stroke={isActive ? '#FFF' : 'url(#chrome)'}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{
          pathLength: isHovered ? [0, 1, 0] : [0.5, 1, 0.5],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </g>
  ),

  // Database - Cylindrical storage
  database: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Top ellipse */}
      <ellipse cx="12" cy="6" rx="7" ry="2.5" fill={isActive ? 'url(#lightMetal)' : 'url(#darkMetal)'} />
      {/* Cylinder body */}
      <path d="M5 6V17C5 18.5 8 20 12 20C16 20 19 18.5 19 17V6"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#EF4444' : '#3A3A4A'}
        strokeWidth="0.5"
      />
      {/* Data layer lines */}
      <ellipse cx="12" cy="10" rx="6.5" ry="1.8" fill="none" stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      <ellipse cx="12" cy="14" rx="6.5" ry="1.8" fill="none" stroke={isActive ? '#DC2626' : '#3A3A4A'} strokeWidth="0.5" />
      {/* Data indicators */}
      <motion.g animate={{ opacity: isHovered ? [0.5, 1, 0.5] : 0.7 }} transition={{ duration: 1.2, repeat: Infinity }}>
        <circle cx="9" cy="11.5" r="0.8" fill={isActive ? '#EF4444' : '#5A5A6A'} />
        <circle cx="12" cy="11.5" r="0.8" fill={isActive ? '#EF4444' : '#5A5A6A'} />
        <circle cx="15" cy="11.5" r="0.8" fill={isActive ? '#EF4444' : '#5A5A6A'} />
      </motion.g>
    </g>
  ),

  // Memory - Layered crystalline structure
  memory: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Stacked memory layers */}
      <motion.rect
        x="5" y="15" width="14" height="4" rx="1"
        fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        stroke={isActive ? '#DC2626' : '#3A3A4A'}
        strokeWidth="0.5"
        animate={{ y: isHovered ? 14 : 15 }}
      />
      <motion.rect
        x="6" y="10" width="12" height="4" rx="1"
        fill={isActive ? 'url(#lightMetal)' : 'url(#deepBlack)'}
        stroke={isActive ? '#EF4444' : '#4A4A5A'}
        strokeWidth="0.5"
        animate={{ y: isHovered ? 9 : 10 }}
      />
      <motion.rect
        x="7" y="5" width="10" height="4" rx="1"
        fill={isActive ? '#FFF' : 'url(#darkMetal)'}
        stroke={isActive ? '#FCA5A5' : '#5A5A6A'}
        strokeWidth="0.5"
        animate={{ y: isHovered ? 4 : 5 }}
      />
      {/* Circuit traces */}
      <path d="M9 7H15M8 12H16M7 17H17" stroke={isActive ? '#EF4444' : '#4A4A5A'} strokeWidth="0.4" />
      {/* Status indicators */}
      <circle cx="13" cy="7" r="0.6" fill={isActive ? '#DC2626' : '#5A5A6A'} />
      <circle cx="14" cy="12" r="0.6" fill={isActive ? '#EF4444' : '#5A5A6A'} />
    </g>
  ),

  // DNA - Double helix with red accents
  dna: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Left helix strand */}
      <motion.path
        d="M7 3C7 3 17 8 17 12C17 16 7 21 7 21"
        fill="none"
        stroke={isActive ? 'url(#redAccent)' : 'url(#chrome)'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? 8 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Right helix strand */}
      <motion.path
        d="M17 3C17 3 7 8 7 12C7 16 17 21 17 21"
        fill="none"
        stroke={isActive ? 'url(#lightMetal)' : 'url(#darkMetal)'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? -8 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Cross bridges */}
      <path d="M8 6H16" stroke={isActive ? '#FFF' : '#5A5A6A'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 12H16.5" stroke={isActive ? '#FFF' : '#5A5A6A'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 18H16" stroke={isActive ? '#FFF' : '#5A5A6A'} strokeWidth="1.5" strokeLinecap="round" />
      {/* Base pair nodes */}
      <circle cx="12" cy="6" r="1" fill={isActive ? '#DC2626' : '#4A4A5A'} />
      <circle cx="12" cy="12" r="1" fill={isActive ? '#EF4444' : '#4A4A5A'} />
      <circle cx="12" cy="18" r="1" fill={isActive ? '#DC2626' : '#4A4A5A'} />
    </g>
  ),

  // AI Lab - Flask with bubbles
  aiLab: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Flask body */}
      <motion.path
        d="M9 3V8L5 18C4.5 19.5 5.5 21 7 21H17C18.5 21 19.5 19.5 19 18L15 8V3"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ scale: isHovered ? 1.03 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Flask neck cap */}
      <rect x="8" y="2" width="8" height="2" rx="0.5" fill={isActive ? '#EF4444' : '#4A4A5A'} />
      {/* Liquid inside */}
      <motion.path
        d="M6.5 15L7.5 12H16.5L17.5 15C17.8 16.5 17 17.5 16 17.5H8C7 17.5 6.2 16.5 6.5 15Z"
        fill={isActive ? 'url(#redGlow)' : 'url(#darkMetal)'}
        animate={{ y: isHovered ? [0, -1, 0] : 0 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {/* Bubbles */}
      <motion.circle
        cx="9" cy="14" r="0.8"
        fill={isActive ? '#FFF' : '#6A6A7A'}
        animate={{ y: isHovered ? [-2, -5, -2] : 0, opacity: isHovered ? [1, 0, 1] : 1 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.circle
        cx="12" cy="15" r="1"
        fill={isActive ? '#FFF' : '#6A6A7A'}
        animate={{ y: isHovered ? [-1, -4, -1] : 0, opacity: isHovered ? [1, 0, 1] : 1 }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
      />
      <motion.circle
        cx="15" cy="14" r="0.6"
        fill={isActive ? '#FFF' : '#6A6A7A'}
        animate={{ y: isHovered ? [-3, -6, -3] : 0, opacity: isHovered ? [1, 0, 1] : 1 }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
      />
    </g>
  ),

  // Quality - Interlocking rings with checkmark
  quality: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Outer ring */}
      <circle cx="12" cy="12" r="9" fill="none"
        stroke={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        strokeWidth="2.5"
      />
      {/* Inner ring */}
      <motion.circle
        cx="12" cy="12" r="5.5"
        fill="none"
        stroke={isActive ? 'url(#redAccent)' : '#4A4A5A'}
        strokeWidth="2"
        animate={{ scale: isHovered ? 1.08 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Center filled */}
      <circle cx="12" cy="12" r="3" fill={isActive ? 'url(#redGlow)' : 'url(#deepBlack)'} />
      {/* Check mark */}
      <motion.path
        d="M9 12L11 14L15 10"
        fill="none"
        stroke={isActive ? '#FFF' : 'url(#chrome)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: isHovered ? 1 : 0.85 }}
      />
    </g>
  ),

  // Voice - Microphone with sound waves
  voice: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Microphone body */}
      <rect x="9" y="3" width="6" height="10" rx="3"
        fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="0.5"
      />
      {/* Microphone grille lines */}
      <path d="M10 5H14M10 7H14M10 9H14" stroke={isActive ? '#DC2626' : '#5A5A6A'} strokeWidth="0.5" />
      {/* Stand arc */}
      <path d="M7 11C7 15 9 17 12 17C15 17 17 15 17 11"
        fill="none"
        stroke={isActive ? 'url(#lightMetal)' : '#4A4A5A'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Stand base */}
      <path d="M12 17V20M9 20H15" stroke={isActive ? 'url(#chrome)' : '#5A5A6A'} strokeWidth="1.5" strokeLinecap="round" />
      {/* Sound waves */}
      <motion.path
        d="M5 8C5 8 4 10 4 12C4 14 5 16 5 16"
        fill="none"
        stroke={isActive ? '#EF4444' : '#4A4A5A'}
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? [0.3, 1, 0.3] : 0.5 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <motion.path
        d="M19 8C19 8 20 10 20 12C20 14 19 16 19 16"
        fill="none"
        stroke={isActive ? '#EF4444' : '#4A4A5A'}
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? [0.3, 1, 0.3] : 0.5 }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.15 }}
      />
    </g>
  ),

  // Self Heal - Regenerating broken element
  selfHeal: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Broken element healing */}
      <motion.path
        d="M5 12L9 8L12 12L15 8L19 12"
        fill="none"
        stroke={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{
          d: isHovered
            ? "M5 12L9 10.5L12 12L15 10.5L19 12"
            : "M5 12L9 8L12 12L15 8L19 12"
        }}
        transition={{ duration: 0.8 }}
      />
      {/* Healing particles */}
      <motion.circle
        cx="12" cy="10"
        r="1.5"
        fill={isActive ? '#EF4444' : '#5A5A6A'}
        animate={{
          y: isHovered ? [0, -4, 0] : 0,
          opacity: isHovered ? [0, 1, 0] : 0.6
        }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      <motion.circle
        cx="9" cy="9"
        r="1"
        fill={isActive ? '#DC2626' : '#4A4A5A'}
        animate={{
          y: isHovered ? [0, -3, 0] : 0,
          opacity: isHovered ? [0, 1, 0] : 0.4
        }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
      />
      <motion.circle
        cx="15" cy="9"
        r="1"
        fill={isActive ? '#FCA5A5' : '#4A4A5A'}
        animate={{
          y: isHovered ? [0, -3, 0] : 0,
          opacity: isHovered ? [0, 1, 0] : 0.4
        }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
      />
      {/* Base wrap */}
      <path d="M7 16C7 18 9 20 12 20C15 20 17 18 17 16"
        fill="none"
        stroke={isActive ? '#EF4444' : '#5A5A6A'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  ),

  // Rules - Scales of balance
  rules: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Balance beam */}
      <motion.line
        x1="3" y1="9" x2="21" y2="9"
        stroke={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? [-2, 2, -2] : 0 }}
        style={{ transformOrigin: '12px 9px' }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Center pillar */}
      <rect x="10.5" y="9" width="3" height="10" rx="0.5" fill={isActive ? 'url(#lightMetal)' : 'url(#deepBlack)'} />
      {/* Pillar top ornament */}
      <circle cx="12" cy="7" r="2" fill={isActive ? '#EF4444' : '#4A4A5A'} />
      {/* Left pan */}
      <path d="M3 9L2 13H8L7 9" fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'} stroke={isActive ? '#DC2626' : '#4A4A5A'} strokeWidth="0.5" />
      {/* Right pan */}
      <path d="M17 9L16 13H22L21 9" fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'} stroke={isActive ? '#DC2626' : '#4A4A5A'} strokeWidth="0.5" />
      {/* Base */}
      <rect x="7" y="19" width="10" height="2" rx="1" fill={isActive ? 'url(#redAccent)' : '#3A3A4A'} />
    </g>
  ),

  // Clone Mode - Duplicate layers
  cloneMode: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Back layer */}
      <motion.rect
        x="9" y="9" width="10" height="12" rx="1.5"
        fill={isActive ? 'url(#darkMetal)' : 'url(#deepBlack)'}
        stroke={isActive ? '#DC2626' : '#3A3A4A'}
        strokeWidth="0.8"
        opacity="0.8"
        animate={{ x: isHovered ? 10 : 9, y: isHovered ? 10 : 9 }}
      />
      {/* Front layer */}
      <rect x="5" y="5" width="10" height="12" rx="1.5"
        fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'}
        stroke={isActive ? '#EF4444' : '#4A4A5A'}
        strokeWidth="0.8"
      />
      {/* Plus icon */}
      <path d="M10 9V13M8 11H12" stroke={isActive ? '#DC2626' : 'url(#chrome)'} strokeWidth="2" strokeLinecap="round" />
      {/* Clone arrow */}
      <motion.path
        d="M16 16L19 19M19 16V19H16"
        fill="none"
        stroke={isActive ? '#EF4444' : '#5A5A6A'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? [0.5, 1, 0.5] : 0.7 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </g>
  ),

  // Security - Shield with lock
  security: ({ isActive, isHovered }) => (
    <g filter={isActive ? "url(#redGlowFilter)" : "url(#depth3D)"}>
      <GradientDefs />
      {/* Shield */}
      <motion.path
        d="M12 2L4 6V11C4 16 12 22 12 22C12 22 20 16 20 11V6L12 2Z"
        fill={isActive ? 'url(#chrome)' : 'url(#deepBlack)'}
        stroke={isActive ? '#DC2626' : '#4A4A5A'}
        strokeWidth="1"
        animate={{ scale: isHovered ? 1.03 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Lock body */}
      <rect x="9" y="11" width="6" height="5" rx="1" fill={isActive ? 'url(#redAccent)' : 'url(#darkMetal)'} />
      {/* Lock shackle */}
      <motion.path
        d="M10 11V9C10 7.5 10.8 7 12 7C13.2 7 14 7.5 14 9V11"
        fill="none"
        stroke={isActive ? '#FFF' : 'url(#chrome)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ y: isHovered ? -1 : 0 }}
      />
      {/* Keyhole */}
      <circle cx="12" cy="13.5" r="0.8" fill={isActive ? '#1A1A2A' : '#EF4444'} />
    </g>
  ),

  // Permissions - Key with access levels
  permissions: ({ isActive, isHovered }) => (
    <g filter="url(#depth3D)">
      <GradientDefs />
      {/* Key head */}
      <circle cx="8" cy="8" r="5" fill={isActive ? 'url(#chrome)' : 'url(#darkMetal)'} stroke={isActive ? '#DC2626' : '#4A4A5A'} strokeWidth="0.8" />
      <circle cx="8" cy="8" r="2.5" fill={isActive ? 'url(#redAccent)' : 'url(#deepBlack)'} />
      {/* Key shaft */}
      <rect x="11" y="7" width="9" height="2" rx="0.5" fill={isActive ? 'url(#lightMetal)' : 'url(#darkMetal)'} />
      {/* Key teeth */}
      <motion.path
        d="M16 9V12M18 9V14M20 9V11"
        stroke={isActive ? 'url(#chrome)' : '#5A5A6A'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ y: isHovered ? [0, 1, 0] : 0 }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      {/* Access level indicators */}
      <circle cx="6" cy="16" r="1.5" fill={isActive ? '#22C55E' : '#4A4A5A'} />
      <circle cx="10" cy="18" r="1.5" fill={isActive ? '#EAB308' : '#4A4A5A'} />
      <circle cx="14" cy="16" r="1.5" fill={isActive ? '#EF4444' : '#4A4A5A'} />
      <path d="M6 17.5L10 19.5L14 17.5" fill="none" stroke={isActive ? '#FFF' : '#3A3A4A'} strokeWidth="0.5" />
    </g>
  ),
};

export function DevToolbarIcon({ name, size = 24, isActive = false, isHovered = false, className = '' }: IconProps) {
  const IconComponent = icons[name];

  if (!IconComponent) {
    console.warn(`DevToolbar Icon "${name}" not found`);
    return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`dev-toolbar-icon ${className}`}
      style={{ overflow: 'visible' }}
    >
      <IconComponent isActive={isActive} isHovered={isHovered} />
    </svg>
  );
}

export default DevToolbarIcon;

/**
 * Developer Bar Icons - Custom 3D Geometric Icons
 *
 * Design Philosophy:
 * - 3D intertwining geometric shapes
 * - No lightning bolts, robot heads, or rockets
 * - Gradients and depth for photorealistic feel
 * - Animated on hover/active states
 */

import { motion } from 'framer-motion';

export type IconName =
  | 'agents' | 'memory' | 'qualityCheck' | 'integrations' | 'server'
  | 'ghostMode' | 'marketFit' | 'predictiveEngine' | 'aiSlopCatch' | 'userTwin'
  | 'workflows' | 'database' | 'developerSettings' | 'voiceFirst' | 'dna'
  | 'liveDebug' | 'liveHealth' | 'testGen' | 'timeMachine' | 'selfHeal'
  | 'rules' | 'agentBuilder' | 'livingDocs' | 'apiAutopilot'
  | 'deployment' | 'cloudDeploy' | 'migrationWizard' | 'repoAware'
  | 'cloneMode' | 'zeroTrustSec'
  | 'multiplayer' | 'publish' | 'share' | 'multiTask'
  | 'openSourceStudio';

interface IconProps {
  name: IconName;
  size?: number;
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
}

// Gradient definitions used across icons
const GradientDefs = () => (
  <defs>
    {/* Primary warm gradient */}
    <linearGradient id="warmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFB87A" />
      <stop offset="50%" stopColor="#FF8E4A" />
      <stop offset="100%" stopColor="#E85D2A" />
    </linearGradient>

    {/* Active glow gradient */}
    <linearGradient id="activeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFD4A8" />
      <stop offset="100%" stopColor="#FFA050" />
    </linearGradient>

    {/* Metallic silver gradient */}
    <linearGradient id="metallicSilver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#E8E8EC" />
      <stop offset="30%" stopColor="#C8C8D0" />
      <stop offset="70%" stopColor="#A8A8B4" />
      <stop offset="100%" stopColor="#88889C" />
    </linearGradient>

    {/* Dark metallic gradient */}
    <linearGradient id="darkMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#4A4A5C" />
      <stop offset="50%" stopColor="#2A2A3C" />
      <stop offset="100%" stopColor="#1A1A28" />
    </linearGradient>

    {/* Cyan tech gradient */}
    <linearGradient id="cyanTech" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#7AEAFF" />
      <stop offset="100%" stopColor="#40B8E0" />
    </linearGradient>

    {/* Green success gradient */}
    <linearGradient id="greenSuccess" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#7AE8A0" />
      <stop offset="100%" stopColor="#40C870" />
    </linearGradient>

    {/* Purple insight gradient */}
    <linearGradient id="purpleInsight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#B892FF" />
      <stop offset="100%" stopColor="#8060E0" />
    </linearGradient>

    {/* 3D lighting effect */}
    <filter id="innerGlow">
      <feGaussianBlur stdDeviation="1" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    {/* Drop shadow for depth */}
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.3" />
    </filter>
  </defs>
);

// Individual icon components - 3D geometric designs
const icons: Record<IconName, (props: { isActive: boolean; isHovered: boolean }) => JSX.Element> = {

  // Agents - Interlocking hexagonal nodes
  agents: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Central hexagon */}
      <motion.path
        d="M12 4L18 8V16L12 20L6 16V8L12 4Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        stroke={isActive ? '#FFD4A8' : '#888'}
        strokeWidth="0.5"
        animate={{ rotate: isHovered ? 15 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Inner geometric pattern */}
      <path
        d="M12 7L15 9V15L12 17L9 15V9L12 7Z"
        fill={isActive ? 'url(#activeGlow)' : 'url(#darkMetallic)'}
        opacity="0.8"
      />
      {/* Node connections */}
      <circle cx="12" cy="12" r="2" fill={isActive ? '#FFF' : '#CCC'} />
      <motion.circle
        cx="12" cy="12" r="3.5"
        fill="none"
        stroke={isActive ? '#FFB87A' : '#888'}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: 'center' }}
      />
    </g>
  ),

  // Memory - Layered crystalline structure
  memory: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Stacked layers */}
      <motion.rect
        x="5" y="14" width="14" height="3" rx="0.5"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ y: isHovered ? 13 : 14 }}
      />
      <motion.rect
        x="6" y="10" width="12" height="3" rx="0.5"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ y: isHovered ? 9 : 10 }}
      />
      <motion.rect
        x="7" y="6" width="10" height="3" rx="0.5"
        fill={isActive ? '#FFD4A8' : '#D8D8E0'}
        animate={{ y: isHovered ? 5 : 6 }}
      />
      {/* Crystal facet lines */}
      <path d="M8 7.5L16 7.5M7 11.5L17 11.5M6 15.5L18 15.5" stroke={isActive ? '#FFF' : '#666'} strokeWidth="0.3" opacity="0.6" />
    </g>
  ),

  // Quality Check - Interlocking rings with checkmark
  qualityCheck: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Outer ring */}
      <circle cx="12" cy="12" r="8" fill="none" stroke={isActive ? 'url(#greenSuccess)' : 'url(#metallicSilver)'} strokeWidth="2" />
      {/* Inner ring */}
      <motion.circle
        cx="12" cy="12" r="5"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : '#A8A8B4'}
        strokeWidth="1.5"
        animate={{ scale: isHovered ? 1.1 : 1 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Check mark */}
      <motion.path
        d="M8.5 12L11 14.5L15.5 10"
        fill="none"
        stroke={isActive ? '#FFF' : '#666'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: isHovered ? 1 : 0.8 }}
      />
    </g>
  ),

  // Integrations - Puzzle pieces interlocking
  integrations: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Left piece */}
      <motion.path
        d="M4 8H8V6C8 5 9.5 5 9.5 6V8H10V14H9.5V16C9.5 17 8 17 8 16V14H4V8Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ x: isHovered ? -1 : 0 }}
      />
      {/* Right piece */}
      <motion.path
        d="M20 8H16V6C16 5 14.5 5 14.5 6V8H14V14H14.5V16C14.5 17 16 17 16 16V14H20V8Z"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ x: isHovered ? 1 : 0 }}
      />
      {/* Connection indicator */}
      <circle cx="12" cy="11" r="1.5" fill={isActive ? '#FFF' : '#888'} />
    </g>
  ),

  // Server - Production Stack (stacked server modules with database symbol)
  server: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Top server module */}
      <motion.rect
        x="5" y="4" width="14" height="4" rx="1"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ y: isHovered ? 3.5 : 4 }}
      />
      <circle cx="16" cy="6" r="0.8" fill={isActive ? '#c8ff64' : '#666'} />
      {/* Middle server module */}
      <motion.rect
        x="5" y="10" width="14" height="4" rx="1"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ y: isHovered ? 9.5 : 10 }}
      />
      <circle cx="16" cy="12" r="0.8" fill={isActive ? '#c8ff64' : '#666'} />
      {/* Bottom server module */}
      <motion.rect
        x="5" y="16" width="14" height="4" rx="1"
        fill={isActive ? 'url(#cyanTech)' : '#A8A8B4'}
        animate={{ y: isHovered ? 15.5 : 16 }}
      />
      <circle cx="16" cy="18" r="0.8" fill={isActive ? '#c8ff64' : '#666'} />
      {/* Connection lines */}
      <motion.path
        d="M8 8V10M8 14V16"
        stroke={isActive ? '#FFF' : '#666'}
        strokeWidth="1"
        animate={{ opacity: isHovered ? 1 : 0.6 }}
      />
    </g>
  ),

  // Ghost Mode - Ethereal flowing form
  ghostMode: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      <motion.path
        d="M12 3C8 3 5 6 5 10V18C5 19 6 19 6.5 18.5L8 17L9.5 18.5C10 19 11 19 11.5 18.5L12 18L12.5 18.5C13 19 14 19 14.5 18.5L16 17L17.5 18.5C18 19 19 19 19 18V10C19 6 16 3 12 3Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        opacity={isActive ? 0.9 : 0.7}
        animate={{
          y: isHovered ? [-1, 1, -1] : 0,
          opacity: isActive ? [0.7, 0.9, 0.7] : 0.7
        }}
        transition={{
          y: { duration: 2, repeat: Infinity },
          opacity: { duration: 3, repeat: Infinity }
        }}
      />
      {/* Eyes */}
      <circle cx="9" cy="10" r="1.5" fill={isActive ? '#FFF' : '#444'} />
      <circle cx="15" cy="10" r="1.5" fill={isActive ? '#FFF' : '#444'} />
    </g>
  ),

  // Market Fit - Rising trend with target
  marketFit: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Target circles */}
      <circle cx="12" cy="12" r="8" fill="none" stroke={isActive ? 'url(#warmGradient)' : '#888'} strokeWidth="1" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={isActive ? 'url(#activeGlow)' : '#AAA'} strokeWidth="1" />
      <circle cx="12" cy="12" r="2" fill={isActive ? 'url(#warmGradient)' : '#888'} />
      {/* Trend arrow */}
      <motion.path
        d="M6 16L10 12L14 14L18 8"
        fill="none"
        stroke={isActive ? 'url(#greenSuccess)' : '#666'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ pathLength: isHovered ? [0, 1] : 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d="M16 8H18V10"
        fill="none"
        stroke={isActive ? 'url(#greenSuccess)' : '#666'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? 1 : 0.8 }}
      />
    </g>
  ),

  // Predictive Engine - Crystal ball with data streams
  predictiveEngine: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Orb */}
      <circle cx="12" cy="11" r="7" fill={isActive ? 'url(#purpleInsight)' : 'url(#darkMetallic)'} opacity="0.9" />
      <ellipse cx="12" cy="11" rx="7" ry="3" fill={isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'} />
      {/* Data streams */}
      <motion.path
        d="M8 11C8 11 10 9 12 11C14 13 16 11 16 11"
        fill="none"
        stroke={isActive ? '#FFF' : '#888'}
        strokeWidth="1"
        animate={{
          d: isHovered
            ? "M8 11C8 11 10 13 12 11C14 9 16 11 16 11"
            : "M8 11C8 11 10 9 12 11C14 13 16 11 16 11"
        }}
        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
      />
      {/* Base */}
      <path d="M8 17H16L14 19H10L8 17Z" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
    </g>
  ),

  // AI-Slop Catch - Filter with rejected particles
  aiSlopCatch: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Funnel */}
      <path d="M5 5H19L15 11V17L9 19V11L5 5Z" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Filter lines */}
      <path d="M7 7H17M8 9H16" stroke={isActive ? '#FFF' : '#666'} strokeWidth="0.5" />
      {/* Rejected particles */}
      <motion.circle
        cx="18" cy="8" r="1"
        fill="#E85D2A"
        animate={{ opacity: isHovered ? [0, 1, 0] : 0 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <motion.circle
        cx="6" cy="9" r="0.8"
        fill="#E85D2A"
        animate={{ opacity: isHovered ? [0, 1, 0] : 0 }}
        transition={{ duration: 1, delay: 0.3, repeat: Infinity }}
      />
    </g>
  ),

  // User Twin - Mirrored figure
  userTwin: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Original figure */}
      <circle cx="8" cy="8" r="3" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <path d="M4 18C4 14 5.5 12 8 12C10.5 12 12 14 12 18" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Twin figure (mirrored) */}
      <motion.g
        opacity={0.6}
        animate={{ opacity: isHovered ? 0.9 : 0.6 }}
      >
        <circle cx="16" cy="8" r="3" fill={isActive ? 'url(#activeGlow)' : '#A8A8B4'} />
        <path d="M12 18C12 14 13.5 12 16 12C18.5 12 20 14 20 18" fill={isActive ? 'url(#activeGlow)' : '#A8A8B4'} />
      </motion.g>
      {/* Connection line */}
      <path d="M11 12H13" stroke={isActive ? '#FFF' : '#888'} strokeWidth="1" strokeDasharray="2 1" />
    </g>
  ),

  // Workflows - Flowing connected nodes
  workflows: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Nodes */}
      <rect x="4" y="4" width="5" height="5" rx="1" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <rect x="15" y="4" width="5" height="5" rx="1" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <rect x="4" y="15" width="5" height="5" rx="1" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <rect x="15" y="15" width="5" height="5" rx="1" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Flow lines */}
      <motion.path
        d="M9 6.5H15M9 17.5H15M6.5 9V15M17.5 9V15"
        stroke={isActive ? '#FFF' : '#666'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ pathLength: isHovered ? [0, 1] : 1 }}
        transition={{ duration: 0.8 }}
      />
    </g>
  ),

  // Database - Cylindrical storage with layers
  database: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Cylinder */}
      <ellipse cx="12" cy="6" rx="7" ry="2.5" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <path d="M5 6V18C5 19.5 8 21 12 21C16 21 19 19.5 19 18V6" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Layer lines */}
      <ellipse cx="12" cy="11" rx="7" ry="2" fill="none" stroke={isActive ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.2)'} strokeWidth="0.5" />
      <ellipse cx="12" cy="16" rx="7" ry="2" fill="none" stroke={isActive ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.2)'} strokeWidth="0.5" />
      {/* Data dots */}
      <motion.g animate={{ opacity: isHovered ? [0.5, 1, 0.5] : 0.7 }} transition={{ duration: 1.5, repeat: Infinity }}>
        <circle cx="9" cy="13" r="0.8" fill={isActive ? '#FFF' : '#666'} />
        <circle cx="12" cy="13" r="0.8" fill={isActive ? '#FFF' : '#666'} />
        <circle cx="15" cy="13" r="0.8" fill={isActive ? '#FFF' : '#666'} />
      </motion.g>
    </g>
  ),

  // Developer Settings - Gear with code brackets
  developerSettings: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Gear */}
      <motion.path
        d="M12 8L13 7L14 8L15 7.5L15 9L16 9.5L16 11L17 11.5L16 12.5L17 13.5L16 14L16 15.5L15 15.5L15 17L14 16.5L13 17.5L12 16.5L11 17.5L10 16.5L9 17L9 15.5L8 15.5L8 14L7 13.5L8 12.5L7 11.5L8 11L8 9.5L9 9L9 7.5L10 8L11 7L12 8Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ rotate: isHovered ? 45 : 0 }}
        style={{ transformOrigin: 'center' }}
        transition={{ duration: 0.5 }}
      />
      {/* Code brackets */}
      <path d="M10 11L8.5 12.5L10 14" fill="none" stroke={isActive ? '#FFF' : '#444'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 11L15.5 12.5L14 14" fill="none" stroke={isActive ? '#FFF' : '#444'} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),

  // Voice First - Sound waves with input
  voiceFirst: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Microphone body */}
      <rect x="10" y="4" width="4" height="8" rx="2" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Stand */}
      <path d="M12 14V17M9 17H15" stroke={isActive ? 'url(#warmGradient)' : '#888'} strokeWidth="1.5" strokeLinecap="round" />
      {/* Sound waves */}
      <motion.path
        d="M7 8C7 8 6 10 6 12C6 14 7 16 7 16"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? [0.3, 1, 0.3] : 0.6 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <motion.path
        d="M17 8C17 8 18 10 18 12C18 14 17 16 17 16"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ opacity: isHovered ? [0.3, 1, 0.3] : 0.6 }}
        transition={{ duration: 1, delay: 0.2, repeat: Infinity }}
      />
    </g>
  ),

  // DNA - Double helix structure
  dna: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      <motion.path
        d="M8 4C8 4 16 8 16 12C16 16 8 20 8 20"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? 10 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      <motion.path
        d="M16 4C16 4 8 8 8 12C8 16 16 20 16 20"
        fill="none"
        stroke={isActive ? 'url(#activeGlow)' : '#A8A8B4'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? -10 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Cross bridges */}
      <path d="M9 7H15M9 12H15M9 17H15" stroke={isActive ? '#FFF' : '#666'} strokeWidth="1" />
    </g>
  ),

  // Live Debug - Bug with magnifier
  liveDebug: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Bug body */}
      <ellipse cx="10" cy="13" rx="4" ry="5" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Bug head */}
      <circle cx="10" cy="7" r="2.5" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Legs */}
      <path d="M6 10L4 8M6 13L3 13M6 16L4 18M14 10L16 8M14 13L17 13M14 16L16 18" stroke={isActive ? '#FFF' : '#666'} strokeWidth="1" strokeLinecap="round" />
      {/* Magnifier */}
      <motion.g animate={{ scale: isHovered ? 1.1 : 1 }} style={{ transformOrigin: '18px 6px' }}>
        <circle cx="18" cy="6" r="3" fill="none" stroke={isActive ? 'url(#cyanTech)' : '#888'} strokeWidth="1.5" />
        <line x1="20" y1="8" x2="22" y2="10" stroke={isActive ? 'url(#cyanTech)' : '#888'} strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
    </g>
  ),

  // Live Health - Heart with pulse
  liveHealth: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Heart */}
      <path
        d="M12 20L4 12C2 10 2 6 5 5C8 4 10 6 12 8C14 6 16 4 19 5C22 6 22 10 20 12L12 20Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
      />
      {/* Pulse line */}
      <motion.path
        d="M6 12H9L10 9L12 15L14 11L15 12H18"
        fill="none"
        stroke={isActive ? '#FFF' : '#444'}
        strokeWidth="1.5"
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

  // Test Gen - Beaker with checkmarks
  testGen: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Beaker */}
      <path d="M9 4H15V8L18 18C18 20 16 21 12 21C8 21 6 20 6 18L9 8V4Z" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Liquid */}
      <path d="M7 16C7 16 9 15 12 15C15 15 17 16 17 16L18 18C18 20 16 21 12 21C8 21 6 20 6 18L7 16Z" fill={isActive ? 'url(#greenSuccess)' : '#A8A8B4'} opacity="0.8" />
      {/* Checkmarks */}
      <motion.path
        d="M9 13L10.5 14.5L13 12"
        fill="none"
        stroke={isActive ? '#FFF' : '#666'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ pathLength: isHovered ? [0, 1] : 1 }}
      />
    </g>
  ),

  // Time Machine - Clock with spiral
  timeMachine: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Clock face */}
      <circle cx="12" cy="12" r="8" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <circle cx="12" cy="12" r="6" fill={isActive ? 'url(#darkMetallic)' : '#2A2A3C'} />
      {/* Clock hands */}
      <motion.line
        x1="12" y1="12" x2="12" y2="8"
        stroke={isActive ? '#FFF' : '#888'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? 360 : 0 }}
        style={{ transformOrigin: '12px 12px' }}
        transition={{ duration: 2, ease: "linear" }}
      />
      <line x1="12" y1="12" x2="15" y2="14" stroke={isActive ? '#FFF' : '#888'} strokeWidth="1" strokeLinecap="round" />
      {/* Spiral */}
      <motion.path
        d="M12 12C12 10 14 10 14 12C14 14 10 14 10 12C10 8 16 8 16 12C16 16 8 16 8 12"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#666'}
        strokeWidth="0.5"
        opacity="0.7"
        animate={{ rotate: isHovered ? -360 : 0 }}
        style={{ transformOrigin: '12px 12px' }}
        transition={{ duration: 4, ease: "linear", repeat: Infinity }}
      />
    </g>
  ),

  // Self Heal - Regenerating structure
  selfHeal: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Broken/healing element */}
      <motion.path
        d="M6 12L10 8L12 12L14 8L18 12"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{
          d: isHovered
            ? "M6 12L10 10L12 12L14 10L18 12"
            : "M6 12L10 8L12 12L14 8L18 12"
        }}
      />
      {/* Healing particles */}
      <motion.circle
        cx="12" cy="10"
        r="1"
        fill={isActive ? 'url(#greenSuccess)' : '#888'}
        animate={{
          y: isHovered ? [0, -3, 0] : 0,
          opacity: isHovered ? [0, 1, 0] : 0.5
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {/* Wrap around */}
      <path d="M8 16C8 18 10 20 12 20C14 20 16 18 16 16" fill="none" stroke={isActive ? 'url(#greenSuccess)' : '#888'} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),

  // Rules - Scales of balance
  rules: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Balance beam */}
      <motion.line
        x1="4" y1="10" x2="20" y2="10"
        stroke={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ rotate: isHovered ? [-3, 3, -3] : 0 }}
        style={{ transformOrigin: '12px 10px' }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Center pillar */}
      <rect x="11" y="10" width="2" height="10" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Left pan */}
      <path d="M4 10L3 14H9L8 10" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Right pan */}
      <path d="M16 10L15 14H21L20 10" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Base */}
      <rect x="8" y="19" width="8" height="2" rx="1" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
    </g>
  ),

  // Agent Builder - Assembling blocks
  agentBuilder: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Main block */}
      <rect x="7" y="10" width="10" height="10" rx="1" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Top connector */}
      <motion.rect
        x="10" y="4" width="4" height="5" rx="0.5"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ y: isHovered ? 5 : 4 }}
        transition={{ duration: 0.3 }}
      />
      {/* Side connectors */}
      <rect x="4" y="13" width="3" height="4" rx="0.5" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <rect x="17" y="13" width="3" height="4" rx="0.5" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Face */}
      <circle cx="10" cy="14" r="1" fill={isActive ? '#FFF' : '#444'} />
      <circle cx="14" cy="14" r="1" fill={isActive ? '#FFF' : '#444'} />
    </g>
  ),

  // Living Docs - Book with pulse
  livingDocs: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Book cover */}
      <path d="M4 4H12V20H4C3 20 3 19 3 18V6C3 5 3 4 4 4Z" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <path d="M12 4H20C21 4 21 5 21 6V18C21 19 21 20 20 20H12V4Z" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Spine */}
      <line x1="12" y1="4" x2="12" y2="20" stroke={isActive ? '#FFF' : '#666'} strokeWidth="1" />
      {/* Text lines */}
      <path d="M6 8H10M6 11H9M14 8H18M14 11H17" stroke={isActive ? 'rgba(255,255,255,0.5)' : '#666'} strokeWidth="0.5" />
      {/* Pulse indicator */}
      <motion.circle
        cx="16" cy="16"
        r="2"
        fill={isActive ? 'url(#greenSuccess)' : '#888'}
        animate={{ scale: isHovered ? [1, 1.3, 1] : 1, opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </g>
  ),

  // API Autopilot - Plane with connection nodes
  apiAutopilot: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Simplified plane shape - more abstract geometric */}
      <motion.path
        d="M4 12L8 10L12 4L16 10L20 12L16 14L12 20L8 14L4 12Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ rotate: isHovered ? 5 : 0 }}
        style={{ transformOrigin: 'center' }}
      />
      {/* Center core */}
      <circle cx="12" cy="12" r="2" fill={isActive ? '#FFF' : '#444'} />
      {/* Connection dots */}
      <circle cx="8" cy="12" r="1" fill={isActive ? 'url(#cyanTech)' : '#888'} />
      <circle cx="16" cy="12" r="1" fill={isActive ? 'url(#cyanTech)' : '#888'} />
      <circle cx="12" cy="8" r="1" fill={isActive ? 'url(#cyanTech)' : '#888'} />
      <circle cx="12" cy="16" r="1" fill={isActive ? 'url(#cyanTech)' : '#888'} />
    </g>
  ),

  // Deployment - Abstract launch container
  deployment: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Container */}
      <path d="M6 8L12 4L18 8V16L12 20L6 16V8Z" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <path d="M6 8L12 12L18 8" fill="none" stroke={isActive ? 'rgba(255,255,255,0.5)' : '#666'} strokeWidth="0.5" />
      <line x1="12" y1="12" x2="12" y2="20" stroke={isActive ? 'rgba(255,255,255,0.5)' : '#666'} strokeWidth="0.5" />
      {/* Upload indicator */}
      <motion.path
        d="M12 16L12 10M9 12L12 9L15 12"
        fill="none"
        stroke={isActive ? '#FFF' : '#444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ y: isHovered ? -2 : 0 }}
      />
    </g>
  ),

  // Cloud Deploy - Cloud with upload
  cloudDeploy: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Cloud shape */}
      <path
        d="M6 15C4 15 3 13.5 3 12C3 10.5 4.5 9 6 9C6 6 8.5 4 11.5 4C14.5 4 17 6 17 9C18.5 9 20 10 20 12C20 14 18.5 15 17 15H6Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
      />
      {/* Upload arrow */}
      <motion.path
        d="M12 18V12M9 14L12 11L15 14"
        fill="none"
        stroke={isActive ? '#FFF' : '#444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ y: isHovered ? -2 : 0 }}
      />
    </g>
  ),

  // Migration Wizard - Portal with data flow
  migrationWizard: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Left portal */}
      <ellipse cx="6" cy="12" rx="3" ry="6" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Right portal */}
      <ellipse cx="18" cy="12" rx="3" ry="6" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Data flow */}
      <motion.path
        d="M9 10H15M9 12H15M9 14H15"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 2"
        animate={{
          strokeDashoffset: isHovered ? [0, -20] : 0
        }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      {/* Arrow indicators */}
      <path d="M13 8L15 10L13 12" fill="none" stroke={isActive ? '#FFF' : '#666'} strokeWidth="0.5" />
      <path d="M13 12L15 14L13 16" fill="none" stroke={isActive ? '#FFF' : '#666'} strokeWidth="0.5" />
    </g>
  ),

  // Repo Aware - Tree structure
  repoAware: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Root node */}
      <circle cx="12" cy="6" r="3" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Branches */}
      <path d="M12 9V12M12 12L7 16M12 12L17 16" stroke={isActive ? 'url(#warmGradient)' : '#888'} strokeWidth="1.5" />
      {/* Leaf nodes */}
      <circle cx="7" cy="18" r="2" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <circle cx="12" cy="16" r="2" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <circle cx="17" cy="18" r="2" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Awareness indicator */}
      <motion.circle
        cx="12" cy="6"
        r="5"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="0.5"
        opacity="0.5"
        animate={{ scale: isHovered ? [1, 1.3, 1] : 1, opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </g>
  ),

  // Clone Mode - Duplicate layers
  cloneMode: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Back layer */}
      <motion.rect
        x="8" y="8" width="10" height="12" rx="1"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        opacity="0.7"
        animate={{ x: isHovered ? 10 : 8, y: isHovered ? 10 : 8 }}
      />
      {/* Front layer */}
      <rect x="6" y="6" width="10" height="12" rx="1" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Plus icon */}
      <path d="M11 10V14M9 12H13" stroke={isActive ? '#FFF' : '#444'} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),

  // Zero Trust Security - Shield with lock
  zeroTrustSec: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Shield */}
      <path
        d="M12 3L4 6V12C4 17 12 21 12 21C12 21 20 17 20 12V6L12 3Z"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
      />
      {/* Lock body */}
      <rect x="9" y="11" width="6" height="5" rx="1" fill={isActive ? '#FFF' : '#444'} />
      {/* Lock shackle */}
      <motion.path
        d="M10 11V9C10 7.5 11 7 12 7C13 7 14 7.5 14 9V11"
        fill="none"
        stroke={isActive ? '#FFF' : '#444'}
        strokeWidth="1.5"
        animate={{ y: isHovered ? -1 : 0 }}
      />
    </g>
  ),

  // Multiplayer - Connected users
  multiplayer: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* User 1 */}
      <circle cx="7" cy="8" r="2.5" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      <path d="M4 16C4 13 5 12 7 12C9 12 10 13 10 16" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* User 2 */}
      <circle cx="17" cy="8" r="2.5" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <path d="M14 16C14 13 15 12 17 12C19 12 20 13 20 16" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Connection */}
      <motion.path
        d="M10 10L14 10M10 14L14 14"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="1"
        strokeDasharray="2 2"
        animate={{ strokeDashoffset: isHovered ? [0, -8] : 0 }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </g>
  ),

  // Publish - Send/broadcast icon
  publish: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Broadcast waves */}
      <motion.path
        d="M5 12C5 8 8 5 12 5"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : '#888'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.5}
        animate={{ opacity: isHovered ? [0.3, 0.8, 0.3] : 0.5 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.path
        d="M3 12C3 7 7 3 12 3"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : '#888'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.3}
        animate={{ opacity: isHovered ? [0.2, 0.6, 0.2] : 0.3 }}
        transition={{ duration: 1.5, delay: 0.2, repeat: Infinity }}
      />
      {/* Send arrow */}
      <path
        d="M12 21V10M8 14L12 10L16 14"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),

  // Share - Connected nodes
  share: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Main node */}
      <circle cx="6" cy="12" r="3" fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'} />
      {/* Connected nodes */}
      <circle cx="18" cy="6" r="3" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      <circle cx="18" cy="18" r="3" fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'} />
      {/* Connections */}
      <motion.path
        d="M9 10L15 7M9 14L15 17"
        fill="none"
        stroke={isActive ? 'url(#cyanTech)' : '#888'}
        strokeWidth="1.5"
        animate={{ strokeDashoffset: isHovered ? [0, -10] : 0 }}
        strokeDasharray={isHovered ? "4 2" : "0"}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </g>
  ),

  // MultiTask - Grid/split view
  multiTask: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Grid squares */}
      <motion.rect
        x="4" y="4" width="7" height="7" rx="1"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ scale: isHovered ? 0.95 : 1 }}
        style={{ transformOrigin: '7.5px 7.5px' }}
      />
      <motion.rect
        x="13" y="4" width="7" height="7" rx="1"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ scale: isHovered ? 0.95 : 1 }}
        style={{ transformOrigin: '16.5px 7.5px' }}
      />
      <motion.rect
        x="4" y="13" width="7" height="7" rx="1"
        fill={isActive ? 'url(#activeGlow)' : '#B8B8C4'}
        animate={{ scale: isHovered ? 0.95 : 1 }}
        style={{ transformOrigin: '7.5px 16.5px' }}
      />
      <motion.rect
        x="13" y="13" width="7" height="7" rx="1"
        fill={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        animate={{ scale: isHovered ? 0.95 : 1 }}
        style={{ transformOrigin: '16.5px 16.5px' }}
      />
    </g>
  ),

  // Open Source Studio - HuggingFace model browser icon (stylized 🤗 face)
  openSourceStudio: ({ isActive, isHovered }) => (
    <g filter="url(#dropShadow)">
      <GradientDefs />
      {/* Outer ring - representing open source community */}
      <motion.circle
        cx="12" cy="12" r="9"
        fill="none"
        stroke={isActive ? 'url(#warmGradient)' : 'url(#metallicSilver)'}
        strokeWidth="1.5"
        animate={{
          strokeDasharray: isHovered ? '3 2' : '56.5 0',
          rotate: isHovered ? 360 : 0,
        }}
        style={{ transformOrigin: '12px 12px' }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      {/* Inner hub - model repository */}
      <motion.circle
        cx="12" cy="12" r="5"
        fill={isActive ? 'url(#activeGlow)' : 'url(#darkMetallic)'}
        animate={{ scale: isHovered ? 1.1 : 1 }}
        style={{ transformOrigin: '12px 12px' }}
      />
      {/* Eyes - friendly face like HuggingFace mascot */}
      <motion.circle
        cx="10" cy="11" r="1"
        fill={isActive ? '#1A1A28' : '#E8E8EC'}
        animate={{ y: isHovered ? -0.5 : 0 }}
      />
      <motion.circle
        cx="14" cy="11" r="1"
        fill={isActive ? '#1A1A28' : '#E8E8EC'}
        animate={{ y: isHovered ? -0.5 : 0 }}
      />
      {/* Smile - representing positive community */}
      <motion.path
        d="M10 13.5 Q12 15.5 14 13.5"
        fill="none"
        stroke={isActive ? '#1A1A28' : '#E8E8EC'}
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ scale: isHovered ? 1.1 : 1 }}
        style={{ transformOrigin: '12px 14px' }}
      />
      {/* Orbiting dots - representing models/datasets */}
      <motion.circle
        cx="18" cy="7" r="1.5"
        fill={isActive ? '#FFD21E' : '#B8B8C4'}
        animate={{
          cx: isHovered ? [18, 5, 18] : 18,
          cy: isHovered ? [7, 12, 7] : 7,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="5" cy="16" r="1.5"
        fill={isActive ? '#FF8E4A' : '#A8A8B4'}
        animate={{
          cx: isHovered ? [5, 19, 5] : 5,
          cy: isHovered ? [16, 12, 16] : 16,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </g>
  ),
};

export function DeveloperBarIcon({ name, size = 24, isActive = false, isHovered = false, className = '' }: IconProps) {
  const IconComponent = icons[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`developer-bar-icon ${className}`}
    >
      <IconComponent isActive={isActive} isHovered={isHovered} />
    </svg>
  );
}

export default DeveloperBarIcon;


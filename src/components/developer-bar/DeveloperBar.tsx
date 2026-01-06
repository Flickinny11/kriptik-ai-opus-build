/**
 * Developer Bar - Frosted Glass Toolbar
 *
 * Inspired by Spline glass design:
 * - Real frosted glass pill-shaped buttons
 * - Warm amber glow when active
 * - Physics-based 3D flip animations
 * - Resizable toolbar (drag to expand)
 * - Buttons that look like actual glass objects
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
import { DeveloperBarPanel } from './DeveloperBarPanel';
import './developer-bar.css';

// SVG Filter for realistic glass refraction
const GlassRefractionFilter = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      {/* Glass refraction effect */}
      <filter id="glass-refraction" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.01"
          numOctaves="2"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="3"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      {/* Glass edge glow */}
      <filter id="glass-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
        <feOffset in="blur" dx="0" dy="1" result="offsetBlur"/>
        <feFlood floodColor="white" floodOpacity="0.3" result="color"/>
        <feComposite in="color" in2="offsetBlur" operator="in" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      {/* Warm glow for active state */}
      <filter id="warm-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
        <feFlood floodColor="#F5A86C" floodOpacity="0.6" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  </svg>
);

export interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
  category: 'core' | 'ai' | 'deploy' | 'tools' | 'collab';
}

const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'feature-agent', name: 'Feature Agent', icon: 'agents', category: 'core' },
  { id: 'open-source-studio', name: 'Open Source', icon: 'openSourceStudio', category: 'ai' },
  { id: 'ai-lab', name: 'AI Lab', icon: 'aiLab', category: 'ai' },
  { id: 'memory', name: 'Memory', icon: 'memory', category: 'core' },
  { id: 'quality-check', name: 'Quality', icon: 'qualityCheck', category: 'core' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations', category: 'core' },
  { id: 'production-stack', name: 'Prod Stack', icon: 'server', category: 'core' },
  { id: 'market-fit', name: 'Market Fit', icon: 'marketFit', category: 'ai' },
  { id: 'predictive-engine', name: 'Predictive', icon: 'predictiveEngine', category: 'ai' },
  { id: 'ai-slop-catch', name: 'AI-Slop', icon: 'aiSlopCatch', category: 'ai' },
  { id: 'user-twin', name: 'User Twin', icon: 'userTwin', category: 'ai' },
  { id: 'workflows', name: 'Workflows', icon: 'workflows', category: 'tools' },
  { id: 'database', name: 'Database', icon: 'database', category: 'tools' },
  { id: 'developer-settings', name: 'Dev Settings', icon: 'developerSettings', category: 'tools' },
  { id: 'voice-first', name: 'Voice', icon: 'voiceFirst', category: 'tools' },
  { id: 'dna', name: 'DNA', icon: 'dna', category: 'tools' },
  { id: 'live-debug', name: 'Debug', icon: 'liveDebug', category: 'tools' },
  { id: 'live-health', name: 'Health', icon: 'liveHealth', category: 'tools' },
  { id: 'test-gen', name: 'Test Gen', icon: 'testGen', category: 'tools' },
  { id: 'time-machine', name: 'Time Machine', icon: 'timeMachine', category: 'tools' },
  { id: 'self-heal', name: 'Self Heal', icon: 'selfHeal', category: 'tools' },
  { id: 'rules', name: 'Rules', icon: 'rules', category: 'tools' },
  { id: 'agent-builder', name: 'Agent Builder', icon: 'agentBuilder', category: 'tools' },
  { id: 'living-docs', name: 'Living Docs', icon: 'livingDocs', category: 'tools' },
  { id: 'api-autopilot', name: 'API Pilot', icon: 'apiAutopilot', category: 'tools' },
  { id: 'deployment', name: 'Deploy', icon: 'deployment', category: 'deploy' },
  { id: 'cloud-deploy', name: 'Cloud', icon: 'cloudDeploy', category: 'deploy' },
  { id: 'migration-wizard', name: 'Migration', icon: 'migrationWizard', category: 'deploy' },
  { id: 'repo-aware', name: 'Repo', icon: 'repoAware', category: 'deploy' },
  { id: 'clone-mode', name: 'Clone', icon: 'cloneMode', category: 'deploy' },
  { id: 'zero-trust-sec', name: 'Security', icon: 'zeroTrustSec', category: 'deploy' },
  { id: 'multiplayer', name: 'MultiPlayer', icon: 'multiplayer', category: 'collab' },
  { id: 'publish', name: 'Publish', icon: 'publish', category: 'collab' },
  { id: 'share', name: 'Share', icon: 'share', category: 'collab' },
  { id: 'browser-permissions', name: 'Permissions', icon: 'zeroTrustSec', category: 'deploy' },
];

type Orientation = 'vertical' | 'horizontal';

const BUTTON_SIZE = 72; // Height of each pill button
const MIN_TOOLBAR_LENGTH = 300;
const MAX_TOOLBAR_LENGTH = 800;
const BUTTON_GAP = 8;
const TOOLBAR_PADDING = 16;

interface DeveloperBarProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function DeveloperBar({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: DeveloperBarProps) {
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [toolbarLength, setToolbarLength] = useState(400);
  const [buttonPage, setButtonPage] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);

  const clampToViewport = useCallback((pos: { x: number; y: number }) => {
    if (typeof window === 'undefined') return pos;

    const TOOLBAR_THICKNESS = 84; // matches CSS cross-axis size
    const width = orientation === 'vertical' ? TOOLBAR_THICKNESS : toolbarLength;
    const height = orientation === 'vertical' ? toolbarLength : TOOLBAR_THICKNESS;
    const padding = 8;

    const maxX = Math.max(padding, window.innerWidth - width - padding);
    const maxY = Math.max(padding, window.innerHeight - height - padding);

    return {
      x: Math.min(Math.max(pos.x, padding), maxX),
      y: Math.min(Math.max(pos.y, padding), maxY),
    };
  }, [orientation, toolbarLength]);

  // Ensure the toolbar never starts/ends half off-screen
  useEffect(() => {
    const clamped = clampToViewport(position);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
      x.set(clamped.x);
      y.set(clamped.y);
    }
  }, [clampToViewport, position, x, y]);

  // Calculate how many buttons fit based on toolbar length
  const visibleButtonCount = Math.floor((toolbarLength - TOOLBAR_PADDING * 2) / (BUTTON_SIZE + BUTTON_GAP));
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / Math.max(1, visibleButtonCount));
  const startIndex = buttonPage * visibleButtonCount;
  const visibleButtons = FEATURE_BUTTONS.slice(startIndex, startIndex + visibleButtonCount);

  const getSlideDirection = useCallback(() => {
    if (typeof window === 'undefined') return 'right';
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (orientation === 'vertical') {
      return position.x < screenWidth / 2 ? 'right' : 'left';
    } else {
      return position.y < screenHeight / 2 ? 'down' : 'up';
    }
  }, [orientation, position]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isResizing) {
      const next = { x: position.x + info.offset.x, y: position.y + info.offset.y };
      const clamped = clampToViewport(next);
      setPosition(clamped);
      x.set(clamped.x);
      y.set(clamped.y);
    }
  }, [position, isResizing, clampToViewport, x, y]);

  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId);
      } else {
        return [...prev, featureId];
      }
    });
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
    setButtonPage(0);
  }, []);

  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      } else {
        return prev <= 0 ? totalPages - 1 : prev - 1;
      }
    });
  }, [totalPages]);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsResizing(true);

    const startPos = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startLength = toolbarLength;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentPos = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const delta = orientation === 'vertical' ? currentPos - startPos : currentPos - startPos;
      const newLength = Math.max(MIN_TOOLBAR_LENGTH, Math.min(MAX_TOOLBAR_LENGTH, startLength + delta));
      setToolbarLength(newLength);
    };

    const onEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }, [toolbarLength, orientation]);

  // Reset page when visible count changes
  useEffect(() => {
    if (buttonPage >= totalPages) {
      setButtonPage(Math.max(0, totalPages - 1));
    }
  }, [buttonPage, totalPages]);

  const slideDirection = getSlideDirection();
  const isVertical = orientation === 'vertical';

  return (
    <>
      {/* SVG Filters for Glass Effects */}
      <GlassRefractionFilter />

      {/* Frosted Glass Toolbar */}
      <motion.div
        ref={barRef}
        className={`glass-toolbar glass-toolbar--${orientation} ${isResizing ? 'glass-toolbar--resizing' : ''} ${className}`}
        style={{
          x,
          y,
          [isVertical ? 'height' : 'width']: toolbarLength,
        }}
        drag={!isResizing}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* 3D Frosted glass base */}
        <div className="glass-toolbar__base">
          {/* Multi-layer shadow for floating effect */}
          <div className="glass-toolbar__shadow" />

          {/* Main glass surface with refraction */}
          <div className="glass-toolbar__frost" />

          {/* Inner frost for depth */}
          <div className="glass-toolbar__frost-inner" />

          {/* Specular highlight - top reflection */}
          <div className="glass-toolbar__specular" />

          {/* Content container */}
          <div className="glass-toolbar__content">
            {/* Grip/Orientation toggle */}
            <button
              className="glass-toolbar__grip"
              onClick={toggleOrientation}
              title={`Switch to ${isVertical ? 'horizontal' : 'vertical'}`}
            >
              <span className="glass-toolbar__grip-dot" />
              <span className="glass-toolbar__grip-dot" />
              <span className="glass-toolbar__grip-dot" />
            </button>

            {/* Page navigation - Previous */}
            {totalPages > 1 && (
              <button
                className="glass-toolbar__nav glass-toolbar__nav--prev"
                onClick={() => cycleButtons('prev')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d={isVertical ? "M12 8H4M4 8L7 5M4 8L7 11" : "M8 12V4M8 4L5 7M8 4L11 7"}
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Glass pill buttons */}
            <div className="glass-toolbar__buttons">
              <AnimatePresence mode="popLayout">
                {visibleButtons.map((feature, index) => (
                  <GlassPillButton
                    key={feature.id}
                    feature={feature}
                    isActive={activeFeatures.includes(feature.id)}
                    isOpen={openPanels.includes(feature.id)}
                    onClick={() => handleFeatureClick(feature.id)}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Page navigation - Next */}
            {totalPages > 1 && (
              <button
                className="glass-toolbar__nav glass-toolbar__nav--next"
                onClick={() => cycleButtons('next')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d={isVertical ? "M4 8H12M12 8L9 5M12 8L9 11" : "M8 4V12M8 12L11 9M8 12L5 9"}
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Page indicator */}
            {totalPages > 1 && (
              <div className="glass-toolbar__pages">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <span
                    key={i}
                    className={`glass-toolbar__page-dot ${i === buttonPage ? 'glass-toolbar__page-dot--active' : ''}`}
                  />
                ))}
              </div>
            )}

            {/* Resize handle */}
            <div
              className="glass-toolbar__resize"
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            >
              <span className="glass-toolbar__resize-line" />
              <span className="glass-toolbar__resize-line" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Glass Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => (
          <DeveloperBarPanel
            key={panelId}
            featureId={panelId}
            slideDirection={slideDirection}
            barPosition={position}
            barOrientation={orientation}
            onClose={() => handlePanelClose(panelId)}
            isActive={activeFeatures.includes(panelId)}
            stackIndex={index}
            totalPanels={openPanels.length}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

// Photorealistic 3D Glass Pill Button - With visible thickness and edges
function GlassPillButton({
  feature,
  isActive,
  isOpen,
  onClick,
  index
}: {
  feature: FeatureButton;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    // Trigger flip animation
    setIsFlipped(true);
    setTimeout(() => setIsFlipped(false), 700);
    onClick();
  };

  const showGlow = isActive || isOpen;

  return (
    <motion.button
      title={feature.name}
      aria-label={feature.name}
      className={`glass-pill ${showGlow ? 'glass-pill--active' : ''} ${isFlipped ? 'glass-pill--flipped' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{
        duration: 0.4,
        delay: index * 0.04,
        ease: [0.23, 1, 0.32, 1]
      }}
      layout
    >
      {/* 3D Glass pill body */}
      <div className="glass-pill__body">
        {/* Warm glow layer - photorealistic breathing light */}
        <motion.div
          className="glass-pill__glow"
          initial={{ opacity: 0 }}
          animate={{
            opacity: showGlow ? [0.7, 1, 0.7] : 0,
            scale: showGlow ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Drop shadow for 3D depth */}
        <div className="glass-pill__drop-shadow" />

        {/* 3D Edge - Top (visible thickness) */}
        <div className="glass-pill__edge-top" />

        {/* 3D Edge - Left (visible thickness) */}
        <div className="glass-pill__edge-left" />

        {/* 3D Edge - Bottom shadow */}
        <div className="glass-pill__edge-shadow" />

        {/* Frosted glass surface */}
        <div className="glass-pill__frost" />

        {/* Inner frost reflection */}
        <div className="glass-pill__frost-inner" />

        {/* Specular highlight - top reflection */}
        <div className="glass-pill__highlight" />

        {/* Content */}
        <div className="glass-pill__content">
          <div className="glass-pill__icon">
            <DeveloperBarIcon
              name={feature.icon}
              size={24}
              isActive={showGlow}
              isHovered={isHovered}
            />
          </div>

          {/* Status dots - visible activity indicator */}
          <div className="glass-pill__dots">
            <span className={`glass-pill__dot ${showGlow ? 'glass-pill__dot--active' : ''}`} />
            <span className={`glass-pill__dot ${showGlow ? 'glass-pill__dot--active' : ''}`} />
            <span className={`glass-pill__dot ${showGlow ? 'glass-pill__dot--active' : ''}`} />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default DeveloperBar;

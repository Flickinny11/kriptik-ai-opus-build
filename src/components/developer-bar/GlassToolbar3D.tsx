/**
 * GlassToolbar3D - Photorealistic Glass Toolbar (CSS Implementation)
 * 
 * Recreates the Spline glass design using advanced CSS:
 * - Real frosted glass appearance with backdrop-filter
 * - Pill-shaped buttons with depth and refraction effects
 * - Physics-based flip animation on click (CSS 3D transforms)
 * - Warm amber glow for active state
 * - Resizable and draggable toolbar
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeveloperBarPanel } from './DeveloperBarPanel';
import type { IconName } from './DeveloperBarIcons';
import { DeveloperBarIcon } from './DeveloperBarIcons';
import './glass-toolbar.css';

export interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
  category: 'core' | 'ai' | 'deploy' | 'tools' | 'collab';
}

const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'agents', name: 'Agents', icon: 'agents', category: 'core' },
  { id: 'memory', name: 'Memory', icon: 'memory', category: 'core' },
  { id: 'quality-check', name: 'Quality', icon: 'qualityCheck', category: 'core' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations', category: 'core' },
  { id: 'ghost-mode', name: 'Ghost Mode', icon: 'ghostMode', category: 'ai' },
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
];

// Glass Pill Button Component
function GlassPillButton({
  feature,
  isActive,
  isOpen,
  onClick,
}: {
  feature: FeatureButton;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleClick = () => {
    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 600);
    onClick();
  };

  const active = isActive || isOpen;

  return (
    <motion.button
      className={`spline-pill ${active ? 'spline-pill--active' : ''} ${isFlipping ? 'spline-pill--flipping' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Warm glow behind active button */}
      {active && (
        <motion.div 
          className="spline-pill__glow"
          animate={{ 
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            duration: 2.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        />
      )}
      
      {/* Glass body */}
      <div className="spline-pill__body">
        {/* Frosted glass layers */}
        <div className="spline-pill__frost" />
        <div className="spline-pill__frost-inner" />
        
        {/* Top highlight reflection */}
        <div className="spline-pill__highlight" />
        
        {/* Content */}
        <div className="spline-pill__content">
          <div className="spline-pill__icon">
            <DeveloperBarIcon 
              name={feature.icon} 
              size={20} 
              isActive={active}
              isHovered={isHovered}
            />
          </div>
          <span className="spline-pill__label">{feature.name}</span>
          
          {/* Three dots indicator (like Spline reference) */}
          <div className="spline-pill__dots">
            <span className={`spline-pill__dot ${active ? 'spline-pill__dot--active' : ''}`} />
            <span className={`spline-pill__dot ${active ? 'spline-pill__dot--active' : ''}`} />
            <span className={`spline-pill__dot ${active ? 'spline-pill__dot--active' : ''}`} />
          </div>
        </div>
        
        {/* Inner shadow for depth */}
        <div className="spline-pill__inner-shadow" />
      </div>
    </motion.button>
  );
}

// Main Export Component
interface GlassToolbar3DProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function GlassToolbar3D({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: GlassToolbar3DProps) {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [toolbarSize, setToolbarSize] = useState({ width: 110, height: 480 });
  const [buttonPage, setButtonPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVertical = orientation === 'vertical';
  
  // Calculate how many buttons fit
  const buttonHeight = 72;
  const padding = 80; // For controls
  const maxButtonsVisible = Math.max(1, Math.floor((
    isVertical ? toolbarSize.height - padding : toolbarSize.width - padding
  ) / buttonHeight));
  
  const visibleButtons = FEATURE_BUTTONS.slice(
    buttonPage * maxButtonsVisible,
    (buttonPage + 1) * maxButtonsVisible
  );
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / Math.max(1, maxButtonsVisible));

  // Reset page when visible count changes
  useEffect(() => {
    if (buttonPage >= totalPages) {
      setButtonPage(Math.max(0, totalPages - 1));
    }
  }, [buttonPage, totalPages]);

  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId);
      }
      return [...prev, featureId];
    });
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
    setToolbarSize(prev => ({ width: prev.height, height: prev.width }));
    setButtonPage(0);
  }, []);

  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      }
      return prev <= 0 ? totalPages - 1 : prev - 1;
    });
  }, [totalPages]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isResizing) return;
    e.preventDefault();
    setIsDragging(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startPos = { ...position };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      setPosition({
        x: Math.max(0, startPos.x + (currentX - startX)),
        y: Math.max(0, startPos.y + (currentY - startY))
      });
    };

    const onEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startSize = { ...toolbarSize };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const newWidth = Math.max(100, Math.min(500, startSize.width + (currentX - startX)));
      const newHeight = Math.max(200, Math.min(700, startSize.height + (currentY - startY)));
      
      setToolbarSize({ width: newWidth, height: newHeight });
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
  };

  const getSlideDirection = useCallback(() => {
    if (typeof window === 'undefined') return 'right';
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (isVertical) {
      return position.x < screenWidth / 2 ? 'right' : 'left';
    } else {
      return position.y < screenHeight / 2 ? 'down' : 'up';
    }
  }, [isVertical, position]);

  return (
    <>
      {/* Spline-style Glass Toolbar */}
      <motion.div
        ref={containerRef}
        className={`spline-toolbar ${isVertical ? 'spline-toolbar--vertical' : 'spline-toolbar--horizontal'} ${isDragging ? 'spline-toolbar--dragging' : ''} ${className}`}
        style={{
          left: position.x,
          top: position.y,
          width: toolbarSize.width,
          height: toolbarSize.height,
        }}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Glass platform base */}
        <div className="spline-toolbar__platform">
          {/* Frosted glass layers */}
          <div className="spline-toolbar__frost" />
          <div className="spline-toolbar__frost-inner" />
          
          {/* Top edge highlight */}
          <div className="spline-toolbar__edge-highlight" />
          
          {/* Shadow for depth */}
          <div className="spline-toolbar__shadow" />
        </div>

        {/* Drag handle */}
        <div 
          className="spline-toolbar__grip"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <span className="spline-toolbar__grip-dot" />
          <span className="spline-toolbar__grip-dot" />
          <span className="spline-toolbar__grip-dot" />
        </div>

        {/* Navigation - Previous */}
        {totalPages > 1 && (
          <button
            className="spline-toolbar__nav spline-toolbar__nav--prev"
            onClick={() => cycleButtons('prev')}
          >
            {isVertical ? '↑' : '←'}
          </button>
        )}

        {/* Buttons container */}
        <div className="spline-toolbar__buttons">
          <AnimatePresence mode="popLayout">
            {visibleButtons.map((feature) => (
              <GlassPillButton
                key={feature.id}
                feature={feature}
                isActive={activeFeatures.includes(feature.id)}
                isOpen={openPanels.includes(feature.id)}
                onClick={() => handleFeatureClick(feature.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Navigation - Next */}
        {totalPages > 1 && (
          <button
            className="spline-toolbar__nav spline-toolbar__nav--next"
            onClick={() => cycleButtons('next')}
          >
            {isVertical ? '↓' : '→'}
          </button>
        )}

        {/* Page indicator */}
        {totalPages > 1 && (
          <div className="spline-toolbar__pages">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span 
                key={i} 
                className={`spline-toolbar__page-dot ${i === buttonPage ? 'spline-toolbar__page-dot--active' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Orientation toggle */}
        <button
          className="spline-toolbar__orientation"
          onClick={toggleOrientation}
          title={`Switch to ${isVertical ? 'horizontal' : 'vertical'}`}
        >
          ⟳
        </button>

        {/* Resize handle */}
        <div 
          className="spline-toolbar__resize"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </motion.div>

      {/* Feature Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => (
          <DeveloperBarPanel
            key={panelId}
            featureId={panelId}
            slideDirection={getSlideDirection()}
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

export default GlassToolbar3D;

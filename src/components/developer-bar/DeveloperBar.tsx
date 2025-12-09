/**
 * Developer Bar - 3D Liquid Glass Command Center
 * 
 * A floating, photorealistic translucent glass toolbar with:
 * - True glass morphism with refraction effects
 * - Warm photorealistic glow on active buttons
 * - Click to open, click again to close (multi-panel support)
 * - Button pagination with smooth slide animation
 * - Custom 3D geometric icons
 * - Buttery smooth 60fps animations
 * 
 * Design: Inspired by Spline glass aesthetics
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
import { DeveloperBarPanel } from './DeveloperBarPanel';
import './developer-bar.css';

// Feature button configuration
export interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
  category: 'core' | 'ai' | 'deploy' | 'tools' | 'collab';
}

const FEATURE_BUTTONS: FeatureButton[] = [
  // Core Features
  { id: 'agents', name: 'Agents', icon: 'agents', category: 'core' },
  { id: 'memory', name: 'Memory', icon: 'memory', category: 'core' },
  { id: 'quality-check', name: 'Quality Check', icon: 'qualityCheck', category: 'core' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations', category: 'core' },
  
  // AI & Intelligence
  { id: 'ghost-mode', name: 'Ghost Mode', icon: 'ghostMode', category: 'ai' },
  { id: 'market-fit', name: 'Market Fit', icon: 'marketFit', category: 'ai' },
  { id: 'predictive-engine', name: 'Predictive Engine', icon: 'predictiveEngine', category: 'ai' },
  { id: 'ai-slop-catch', name: 'AI-Slop Catch', icon: 'aiSlopCatch', category: 'ai' },
  { id: 'user-twin', name: 'User Twin', icon: 'userTwin', category: 'ai' },
  
  // Development Tools
  { id: 'workflows', name: 'Workflows', icon: 'workflows', category: 'tools' },
  { id: 'database', name: 'Database', icon: 'database', category: 'tools' },
  { id: 'developer-settings', name: 'Dev Settings', icon: 'developerSettings', category: 'tools' },
  { id: 'voice-first', name: 'Voice-First', icon: 'voiceFirst', category: 'tools' },
  { id: 'dna', name: 'DNA', icon: 'dna', category: 'tools' },
  { id: 'live-debug', name: 'Live Debug', icon: 'liveDebug', category: 'tools' },
  { id: 'live-health', name: 'Live Health', icon: 'liveHealth', category: 'tools' },
  { id: 'test-gen', name: 'Test Gen', icon: 'testGen', category: 'tools' },
  { id: 'time-machine', name: 'Time Machine', icon: 'timeMachine', category: 'tools' },
  { id: 'self-heal', name: 'Self Heal', icon: 'selfHeal', category: 'tools' },
  { id: 'rules', name: 'Rules', icon: 'rules', category: 'tools' },
  { id: 'agent-builder', name: 'Agent Builder', icon: 'agentBuilder', category: 'tools' },
  { id: 'living-docs', name: 'Living Docs', icon: 'livingDocs', category: 'tools' },
  { id: 'api-autopilot', name: 'API AutoPilot', icon: 'apiAutopilot', category: 'tools' },
  
  // Deployment
  { id: 'deployment', name: 'Deployment', icon: 'deployment', category: 'deploy' },
  { id: 'cloud-deploy', name: 'Cloud Deploy', icon: 'cloudDeploy', category: 'deploy' },
  { id: 'migration-wizard', name: 'Migration Wizard', icon: 'migrationWizard', category: 'deploy' },
  { id: 'repo-aware', name: 'Repo Aware', icon: 'repoAware', category: 'deploy' },
  { id: 'clone-mode', name: 'Clone Mode', icon: 'cloneMode', category: 'deploy' },
  { id: 'zero-trust-sec', name: '0 Trust Sec', icon: 'zeroTrustSec', category: 'deploy' },
  
  // Collaboration
  { id: 'multiplayer', name: 'MultiPlayer', icon: 'multiplayer', category: 'collab' },
  { id: 'publish', name: 'Publish', icon: 'publish', category: 'collab' },
  { id: 'share', name: 'Share', icon: 'share', category: 'collab' },
];

type Orientation = 'vertical' | 'horizontal';

// Number of buttons visible at once
const VISIBLE_BUTTONS_VERTICAL = 10;
const VISIBLE_BUTTONS_HORIZONTAL = 14;

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
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [buttonPage, setButtonPage] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);

  // Calculate visible buttons based on orientation
  const visibleCount = orientation === 'vertical' ? VISIBLE_BUTTONS_VERTICAL : VISIBLE_BUTTONS_HORIZONTAL;
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / visibleCount);
  const startIndex = buttonPage * visibleCount;
  const visibleButtons = FEATURE_BUTTONS.slice(startIndex, startIndex + visibleCount);
  
  // Calculate slide direction based on position and screen space
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
    setPosition({
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    });
  }, [position]);

  // Simple toggle: click opens, click again closes
  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(featureId)) {
        // Close this panel
        return prev.filter(id => id !== featureId);
      } else {
        // Open this panel
        return [...prev, featureId];
      }
    });
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  // Close a specific panel
  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
    setButtonPage(0); // Reset to first page on orientation change
  }, []);

  // Cycle to next page of buttons
  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      } else {
        return prev <= 0 ? totalPages - 1 : prev - 1;
      }
    });
  }, [totalPages]);

  const slideDirection = getSlideDirection();
  const isVertical = orientation === 'vertical';

  return (
    <>
      {/* Main Developer Bar */}
      <motion.div
        ref={barRef}
        className={`developer-bar developer-bar--${orientation} ${className}`}
        style={{ x, y }}
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Glass Container with Refraction */}
        <div className="developer-bar__glass">
          {/* Refraction layer */}
          <div className="developer-bar__refraction" />
          
          {/* Inner glow */}
          <div className="developer-bar__inner-glow" />
          
          {/* Glass surface */}
          <div className="developer-bar__surface">
            {/* Orientation toggle grip */}
            <button 
              className="developer-bar__grip"
              onClick={toggleOrientation}
              title={`Switch to ${isVertical ? 'horizontal' : 'vertical'}`}
            >
              <div className="developer-bar__grip-lines">
                <span /><span /><span />
              </div>
            </button>

            {/* Previous page button */}
            {totalPages > 1 && (
              <motion.button
                className="developer-bar__cycle-btn"
                onClick={() => cycleButtons('prev')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path 
                    d={isVertical ? "M9 6L3 6M3 6L6 3M3 6L6 9" : "M6 9L6 3M6 3L3 6M6 3L9 6"}
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            )}

            {/* Feature buttons */}
            <div className={`developer-bar__buttons ${isVertical ? 'developer-bar__buttons--vertical' : 'developer-bar__buttons--horizontal'}`}>
              <AnimatePresence mode="popLayout">
                {visibleButtons.map((feature, index) => (
                  <GlassButton
                    key={feature.id}
                    feature={feature}
                    isActive={activeFeatures.includes(feature.id)}
                    isOpen={openPanels.includes(feature.id)}
                    onClick={() => handleFeatureClick(feature.id)}
                    orientation={orientation}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Next page button */}
            {totalPages > 1 && (
              <motion.button
                className="developer-bar__cycle-btn"
                onClick={() => cycleButtons('next')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path 
                    d={isVertical ? "M3 6L9 6M9 6L6 9M9 6L6 3" : "M6 3L6 9M6 9L9 6M6 9L3 6"}
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            )}

            {/* Page indicator */}
            {totalPages > 1 && (
              <div className="developer-bar__page-indicator">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <span 
                    key={i} 
                    className={`developer-bar__page-dot ${i === buttonPage ? 'developer-bar__page-dot--active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Edge highlights for 3D depth */}
          <div className="developer-bar__edge developer-bar__edge--top" />
          <div className="developer-bar__edge developer-bar__edge--right" />
          <div className="developer-bar__edge developer-bar__edge--bottom" />
          <div className="developer-bar__edge developer-bar__edge--left" />
        </div>
        
        {/* Outer shadow layers */}
        <div className="developer-bar__shadow developer-bar__shadow--1" />
        <div className="developer-bar__shadow developer-bar__shadow--2" />
      </motion.div>

      {/* Open Panels - Each is floating and independently draggable */}
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

// Individual Glass Button Component
function GlassButton({
  feature,
  isActive,
  isOpen,
  onClick,
  orientation,
  index
}: {
  feature: FeatureButton;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
  orientation: Orientation;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className={`
        developer-bar__btn
        ${isActive ? 'developer-bar__btn--active' : ''}
        ${isOpen ? 'developer-bar__btn--open' : ''}
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.02,
        ease: [0.23, 1, 0.32, 1]
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      title={feature.name}
      layout
    >
      {/* Glass button body */}
      <div className="developer-bar__btn-glass">
        {/* Active/Open warm glow */}
        {(isActive || isOpen) && (
          <motion.div
            className="developer-bar__btn-glow"
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
        
        {/* Glass refraction */}
        <div className="developer-bar__btn-refraction" />
        
        {/* Icon */}
        <div className="developer-bar__btn-icon">
          <DeveloperBarIcon 
            name={feature.icon} 
            size={20} 
            isActive={isActive || isOpen}
            isHovered={isHovered}
          />
        </div>

        {/* Glass highlight */}
        <div className="developer-bar__btn-highlight" />
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`developer-bar__tooltip developer-bar__tooltip--${orientation}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {feature.name}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default DeveloperBar;

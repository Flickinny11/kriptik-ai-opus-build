/**
 * Developer Bar - Revolutionary 3D Command Center Toolbar
 * 
 * A floating, photorealistic 3D toolbar with:
 * - Slide-out panel system for feature visualization
 * - Pulsing glow effects for active features
 * - Custom 3D geometric icons
 * - Vertical/horizontal orientation support
 * - Multi-task capability for side-by-side views
 * 
 * Design Philosophy: "Holy shit this is amazing" within 2 seconds
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
  isActive?: boolean;
  hasNotification?: boolean;
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
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [multiTaskMode, setMultiTaskMode] = useState(false);
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [_isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  
  // Calculate slide direction based on position and screen space
  const getSlideDirection = useCallback(() => {
    if (typeof window === 'undefined') return 'right';
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (orientation === 'vertical') {
      // Slide to the side with more space
      return position.x < screenWidth / 2 ? 'right' : 'left';
    } else {
      // Slide up or down based on position
      return position.y < screenHeight / 2 ? 'down' : 'up';
    }
  }, [orientation, position]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    setPosition({
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    });
    setIsDragging(false);
  }, [position]);

  const handleFeatureClick = useCallback((featureId: string) => {
    if (multiTaskMode) {
      setOpenPanels(prev => 
        prev.includes(featureId) 
          ? prev.filter(id => id !== featureId)
          : [...prev, featureId]
      );
    } else {
      setExpandedPanel(prev => prev === featureId ? null : featureId);
    }
    onFeatureToggle?.(featureId);
  }, [multiTaskMode, onFeatureToggle]);

  const toggleMultiTask = useCallback(() => {
    if (!multiTaskMode) {
      // Show tooltip/notification
      setMultiTaskMode(true);
      if (expandedPanel) {
        setOpenPanels([expandedPanel]);
        setExpandedPanel(null);
      }
    } else {
      setMultiTaskMode(false);
      if (openPanels.length > 0) {
        setExpandedPanel(openPanels[0]);
      }
      setOpenPanels([]);
    }
  }, [multiTaskMode, expandedPanel, openPanels]);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
  }, []);

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
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* 3D Toolbar Container */}
        <div className="developer-bar__container">
          {/* Ambient glow layer */}
          <div className="developer-bar__ambient-glow" />
          
          {/* Main body with metallic texture */}
          <div className="developer-bar__body">
            {/* Top edge highlight */}
            <div className="developer-bar__edge developer-bar__edge--top" />
            
            {/* Orientation toggle */}
            <button 
              className="developer-bar__orientation-toggle"
              onClick={toggleOrientation}
              title={`Switch to ${isVertical ? 'horizontal' : 'vertical'}`}
            >
              <div className="developer-bar__grip">
                <span /><span /><span />
              </div>
            </button>

            {/* Feature buttons */}
            <div className={`developer-bar__buttons ${isVertical ? 'developer-bar__buttons--vertical' : 'developer-bar__buttons--horizontal'}`}>
              {FEATURE_BUTTONS.map((feature) => (
                <FeatureButton
                  key={feature.id}
                  feature={feature}
                  isActive={activeFeatures.includes(feature.id)}
                  isExpanded={expandedPanel === feature.id || openPanels.includes(feature.id)}
                  onClick={() => handleFeatureClick(feature.id)}
                  orientation={orientation}
                />
              ))}
            </div>

            {/* MultiTask button */}
            <button
              className={`developer-bar__multitask ${multiTaskMode ? 'developer-bar__multitask--active' : ''}`}
              onClick={toggleMultiTask}
              title="MultiTask Mode"
            >
              <DeveloperBarIcon name="multiTask" size={20} isActive={multiTaskMode} />
              <span className="developer-bar__multitask-label">Multi</span>
            </button>

            {/* Bottom edge shadow */}
            <div className="developer-bar__edge developer-bar__edge--bottom" />
          </div>
          
          {/* Outer shadow layers for depth */}
          <div className="developer-bar__shadow developer-bar__shadow--1" />
          <div className="developer-bar__shadow developer-bar__shadow--2" />
          <div className="developer-bar__shadow developer-bar__shadow--3" />
        </div>
      </motion.div>

      {/* Slide-out Panels */}
      <AnimatePresence>
        {expandedPanel && !multiTaskMode && (
          <DeveloperBarPanel
            featureId={expandedPanel}
            slideDirection={slideDirection}
            barPosition={position}
            barOrientation={orientation}
            onClose={() => setExpandedPanel(null)}
            isActive={activeFeatures.includes(expandedPanel)}
          />
        )}
      </AnimatePresence>

      {/* MultiTask Panels */}
      <AnimatePresence>
        {multiTaskMode && openPanels.map((panelId, index) => (
          <DeveloperBarPanel
            key={panelId}
            featureId={panelId}
            slideDirection={slideDirection}
            barPosition={position}
            barOrientation={orientation}
            onClose={() => setOpenPanels(prev => prev.filter(id => id !== panelId))}
            isActive={activeFeatures.includes(panelId)}
            stackIndex={index}
            totalPanels={openPanels.length}
          />
        ))}
      </AnimatePresence>

      {/* MultiTask Mode Tooltip */}
      <AnimatePresence>
        {multiTaskMode && openPanels.length === 0 && (
          <motion.div
            className="developer-bar__tooltip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              left: position.x + (isVertical ? 80 : 0),
              top: position.y + (isVertical ? 0 : 80),
            }}
          >
            <div className="developer-bar__tooltip-content">
              <span className="developer-bar__tooltip-title">MultiTask Mode Active</span>
              <p>Click on toolbar items to open multiple views side-by-side. Compare data and multi-task efficiently.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Individual Feature Button Component
function FeatureButton({
  feature,
  isActive,
  isExpanded,
  onClick,
  orientation
}: {
  feature: FeatureButton;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
  orientation: Orientation;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className={`
        developer-bar__button
        ${isActive ? 'developer-bar__button--active' : ''}
        ${isExpanded ? 'developer-bar__button--expanded' : ''}
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      title={feature.name}
    >
      {/* Button 3D layers */}
      <div className="developer-bar__button-body">
        {/* Active pulse glow */}
        {isActive && (
          <motion.div
            className="developer-bar__button-glow"
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
        
        {/* Icon */}
        <div className="developer-bar__button-icon">
          <DeveloperBarIcon 
            name={feature.icon} 
            size={22} 
            isActive={isActive}
            isHovered={isHovered}
          />
        </div>

        {/* Button surface highlight */}
        <div className="developer-bar__button-highlight" />
        
        {/* Button edge */}
        <div className="developer-bar__button-edge" />
      </div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`developer-bar__button-tooltip developer-bar__button-tooltip--${orientation}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {feature.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification dot */}
      {feature.hasNotification && (
        <div className="developer-bar__button-notification" />
      )}
    </motion.button>
  );
}

export default DeveloperBar;


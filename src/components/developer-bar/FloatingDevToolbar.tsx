/**
 * Floating Developer Toolbar - Premium Edition
 *
 * Features:
 * - Only specified buttons: Feature Agents, Health, Database, Memory, DNA, 
 *   AI Lab, Quality, Voice, Self Heal, Rules, Clone Mode, Security, Multiplayer, Permissions
 * - Custom 3D geometric icons (black/white with red accents)
 * - Tooltips on hover
 * - Premium glass styling matching Feature Agents popout
 * - Resizable, draggable panels
 * - Smooth animations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { DevToolbarIcon, type ToolbarIconName } from './DevToolbarIcons';
import { DevToolbarPanel } from './DevToolbarPanel';
import './floating-dev-toolbar.css';

// Button configuration - ONLY these buttons
export interface ToolbarButton {
  id: string;
  name: string;
  icon: ToolbarIconName;
  tooltip: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: 'feature-agents', name: 'Feature Agents', icon: 'featureAgents', tooltip: 'Manage parallel AI agents' },
  { id: 'health', name: 'Health', icon: 'health', tooltip: 'Real-time system health' },
  { id: 'database', name: 'Database', icon: 'database', tooltip: 'Database explorer & queries' },
  { id: 'memory', name: 'Memory', icon: 'memory', tooltip: 'AI memory & context' },
  { id: 'dna', name: 'DNA', icon: 'dna', tooltip: 'App DNA & architecture' },
  { id: 'ai-lab', name: 'AI Lab', icon: 'aiLab', tooltip: 'AI experimentation lab' },
  { id: 'quality', name: 'Quality', icon: 'quality', tooltip: 'Code quality metrics' },
  { id: 'voice', name: 'Voice', icon: 'voice', tooltip: 'Voice commands' },
  { id: 'self-heal', name: 'Self Heal', icon: 'selfHeal', tooltip: 'Auto-fix & recovery' },
  { id: 'rules', name: 'Rules', icon: 'rules', tooltip: 'Business rules engine' },
  { id: 'clone-mode', name: 'Clone Mode', icon: 'cloneMode', tooltip: 'Duplicate & branch' },
  { id: 'security', name: 'Security', icon: 'security', tooltip: 'Security analysis' },
  { id: 'multiplayer', name: 'Multiplayer', icon: 'multiplayer', tooltip: 'Real-time collaboration' },
  { id: 'permissions', name: 'Permissions', icon: 'permissions', tooltip: 'Access control' },
];

interface FloatingDevToolbarProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function FloatingDevToolbar({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: FloatingDevToolbarProps) {
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isVertical, setIsVertical] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);

  // Clamp to viewport
  const clampToViewport = useCallback((pos: { x: number; y: number }) => {
    if (typeof window === 'undefined') return pos;
    const padding = 10;
    const barWidth = isVertical ? 72 : 600;
    const barHeight = isVertical ? 600 : 72;

    return {
      x: Math.min(Math.max(pos.x, padding), window.innerWidth - barWidth - padding),
      y: Math.min(Math.max(pos.y, padding), window.innerHeight - barHeight - padding),
    };
  }, [isVertical]);

  useEffect(() => {
    const clamped = clampToViewport(position);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
      x.set(clamped.x);
      y.set(clamped.y);
    }
  }, [clampToViewport, position, x, y]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number } }) => {
    const newPos = clampToViewport({
      x: position.x + info.offset.x,
      y: position.y + info.offset.y,
    });
    setPosition(newPos);
    x.set(newPos.x);
    y.set(newPos.y);
  };

  const togglePanel = useCallback((buttonId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(buttonId)) {
        return prev.filter(id => id !== buttonId);
      } else {
        return [...prev, buttonId];
      }
    });
    onFeatureToggle?.(buttonId);
  }, [onFeatureToggle]);

  const closePanel = useCallback((buttonId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== buttonId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setIsVertical(prev => !prev);
  }, []);

  return (
    <>
      {/* Main Toolbar */}
      <motion.div
        ref={barRef}
        className={`floating-dev-toolbar ${isVertical ? 'floating-dev-toolbar--vertical' : 'floating-dev-toolbar--horizontal'} ${className}`}
        style={{ x, y }}
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Glass base */}
        <div className="floating-dev-toolbar__glass">
          {/* Shadow layers */}
          <div className="floating-dev-toolbar__shadow" />
          <div className="floating-dev-toolbar__shadow-inner" />

          {/* Frost layers */}
          <div className="floating-dev-toolbar__frost" />
          <div className="floating-dev-toolbar__frost-highlight" />

          {/* Edge highlights */}
          <div className="floating-dev-toolbar__edge-top" />
          <div className="floating-dev-toolbar__edge-left" />

          {/* Buttons container */}
          <div className="floating-dev-toolbar__buttons">
            {TOOLBAR_BUTTONS.map((button) => {
              const isActive = activeFeatures.includes(button.id) || openPanels.includes(button.id);
              const isHovered = hoveredButton === button.id;

              return (
                <motion.button
                  key={button.id}
                  className={`floating-dev-toolbar__button ${isActive ? 'floating-dev-toolbar__button--active' : ''}`}
                  onClick={() => togglePanel(button.id)}
                  onMouseEnter={() => setHoveredButton(button.id)}
                  onMouseLeave={() => setHoveredButton(null)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Button glow */}
                  {isActive && <div className="floating-dev-toolbar__button-glow" />}

                  {/* Icon */}
                  <DevToolbarIcon
                    name={button.icon}
                    size={26}
                    isActive={isActive}
                    isHovered={isHovered}
                  />

                  {/* Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        className="floating-dev-toolbar__tooltip"
                        initial={{ opacity: 0, x: isVertical ? 10 : 0, y: isVertical ? 0 : 10 }}
                        animate={{ opacity: 1, x: isVertical ? 0 : 0, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="floating-dev-toolbar__tooltip-name">{button.name}</span>
                        <span className="floating-dev-toolbar__tooltip-desc">{button.tooltip}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Orientation toggle */}
          <button 
            className="floating-dev-toolbar__orientation-toggle"
            onClick={toggleOrientation}
            title={isVertical ? 'Switch to horizontal' : 'Switch to vertical'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path 
                d={isVertical 
                  ? "M4 8H20M4 16H20" 
                  : "M8 4V20M16 4V20"
                } 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Open Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => {
          const button = TOOLBAR_BUTTONS.find(b => b.id === panelId);
          if (!button) return null;

          return (
            <DevToolbarPanel
              key={panelId}
              featureId={panelId}
              title={button.name}
              icon={button.icon}
              barPosition={position}
              barOrientation={isVertical ? 'vertical' : 'horizontal'}
              onClose={() => closePanel(panelId)}
              isActive={activeFeatures.includes(panelId)}
              stackIndex={index}
            />
          );
        })}
      </AnimatePresence>
    </>
  );
}

export default FloatingDevToolbar;

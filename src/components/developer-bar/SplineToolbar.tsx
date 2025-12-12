/**
 * Spline Toolbar - Uses actual Spline runtime for photorealistic glass
 *
 * This uses the Spline scene directly for the authentic glass look
 */

import { Suspense, lazy, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
import { DeveloperBarPanel } from './DeveloperBarPanel';

// Lazy load Spline to avoid blocking
const Spline = lazy(() => import('@splinetool/react-spline'));

interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
}

const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'feature-agent', name: 'Feature Agent', icon: 'agents' },
  { id: 'memory', name: 'Memory', icon: 'memory' },
  { id: 'quality-check', name: 'Quality', icon: 'qualityCheck' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations' },
  { id: 'time-machine', name: 'Time', icon: 'timeMachine' },
  { id: 'deployment', name: 'Deploy', icon: 'deployment' },
  { id: 'database', name: 'Database', icon: 'database' },
];

interface SplineToolbarProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function SplineToolbar({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: SplineToolbarProps) {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [buttonPage, setButtonPage] = useState(0);
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [splineError, setSplineError] = useState(false);

  const buttonsPerPage = 4;
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / buttonsPerPage);
  const visibleButtons = FEATURE_BUTTONS.slice(
    buttonPage * buttonsPerPage,
    (buttonPage + 1) * buttonsPerPage
  );

  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      }
      return prev <= 0 ? totalPages - 1 : prev - 1;
    });
  }, [totalPages]);

  const isVertical = orientation === 'vertical';
  const toolbarWidth = isVertical ? 110 : visibleButtons.length * 90 + 60;
  const toolbarHeight = isVertical ? visibleButtons.length * 80 + 80 : 100;

  return (
    <>
      {/* Main Toolbar Container */}
      <motion.div
        className={`spline-toolbar ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: toolbarWidth,
          height: toolbarHeight,
          zIndex: 9999,
          cursor: 'grab',
          borderRadius: 28,
          overflow: 'hidden',
        }}
        drag
        dragMomentum={false}
        onDragEnd={(_, info) => {
          setPosition(prev => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y
          }));
        }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Spline Glass Background */}
        <div style={{
          position: 'absolute',
          inset: -100,
          pointerEvents: 'none',
          opacity: splineLoaded && !splineError ? 0.9 : 0,
          transition: 'opacity 0.5s ease',
          transform: 'scale(0.3)',
          transformOrigin: 'center center',
        }}>
          <Suspense fallback={null}>
            <Spline
              scene="https://prod.spline.design/1nVE6otDuZKQ8S7l/scene.splinecode"
              onLoad={() => setSplineLoaded(true)}
              onError={() => setSplineError(true)}
            />
          </Suspense>
        </div>

        {/* Glass effect overlay (fallback + enhancement) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 28,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.12) 100%)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.15),
            0 16px 48px rgba(0,0,0,0.1),
            inset 0 1px 1px rgba(255,255,255,0.4),
            inset 0 -1px 1px rgba(0,0,0,0.05)
          `,
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          padding: 12,
          gap: 8,
          height: '100%',
          zIndex: 1,
        }}>
          {/* Grip handle */}
          <button
            onClick={() => setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            style={{
              display: 'flex',
              gap: 3,
              padding: '8px 12px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: 8,
              cursor: 'pointer',
              flexDirection: isVertical ? 'row' : 'column',
            }}
          >
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.3)' }} />
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.3)' }} />
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.3)' }} />
          </button>

          {/* Navigation - Prev */}
          {totalPages > 1 && (
            <button
              onClick={() => cycleButtons('prev')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0,0,0,0.5)',
                fontSize: 14,
              }}
            >
              {isVertical ? '↑' : '←'}
            </button>
          )}

          {/* Buttons */}
          <div style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            gap: 6,
            flex: 1,
          }}>
            <AnimatePresence mode="popLayout">
              {visibleButtons.map((feature, index) => {
                const isActive = activeFeatures.includes(feature.id) || openPanels.includes(feature.id);

                return (
                  <motion.button
                    key={feature.id}
                    onClick={() => handleFeatureClick(feature.id)}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      width: isVertical ? 80 : 70,
                      height: isVertical ? 64 : 70,
                      padding: 8,
                      outline: 'none',
                      borderRadius: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      // Translucent glass - NOT white
                      background: isActive
                        ? 'linear-gradient(145deg, rgba(245,168,108,0.85) 0%, rgba(232,139,77,0.9) 100%)'
                        : 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(15px) saturate(1.5)',
                      WebkitBackdropFilter: 'blur(15px) saturate(1.5)',
                      border: isActive
                        ? '1px solid rgba(245,168,108,0.6)'
                        : '1px solid rgba(255,255,255,0.3)',
                      boxShadow: isActive
                        ? '0 4px 20px rgba(245,168,108,0.4), 0 8px 32px rgba(245,168,108,0.2), inset 0 1px 1px rgba(255,255,255,0.3)'
                        : '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.5)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ width: 24, height: 24 }}>
                      <DeveloperBarIcon
                        name={feature.icon}
                        size={24}
                        isActive={isActive}
                        isHovered={false}
                      />
                    </div>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: isActive ? '#fff' : 'rgba(0,0,0,0.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                    }}>
                      {feature.name}
                    </span>

                    {/* Status dots */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: '50%',
                            background: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.15)',
                          }}
                        />
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Navigation - Next */}
          {totalPages > 1 && (
            <button
              onClick={() => cycleButtons('next')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0,0,0,0.5)',
                fontSize: 14,
              }}
            >
              {isVertical ? '↓' : '→'}
            </button>
          )}

          {/* Page dots */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4, padding: 4 }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: i === buttonPage ? '#F5A86C' : 'rgba(0,0,0,0.15)',
                    boxShadow: i === buttonPage ? '0 0 8px rgba(245,168,108,0.6)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => (
          <DeveloperBarPanel
            key={panelId}
            featureId={panelId}
            slideDirection={isVertical ? 'right' : 'down'}
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

export default SplineToolbar;


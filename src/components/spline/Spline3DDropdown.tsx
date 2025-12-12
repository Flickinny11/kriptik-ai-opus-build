'use client';

import { Suspense, lazy, useState, useCallback, Component, type ReactNode, type ReactEventHandler } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './spline-dropdown.css';

// Lazy load Spline to avoid SSR issues - use regular import, not /next
const Spline = lazy(() => import('@splinetool/react-spline'));

// Error Boundary for Spline
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SplineErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Spline Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="spline-dropdown-error">
          <div className="spline-dropdown-error-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3L22 20H2L12 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M12 9V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 17.2h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <span>3D Scene unavailable</span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="spline-dropdown-retry"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Spline3DDropdownProps {
  isVisible?: boolean;
  onClose?: () => void;
  position?: { x: number; y: number };
  sceneUrl?: string;
}

export function Spline3DDropdown({
  isVisible = true,
  onClose,
  position = { x: 50, y: 50 },
  sceneUrl = 'https://prod.spline.design/KUdlbGgiKyu9tTlF/scene.splinecode'
}: Spline3DDropdownProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
    console.log('Spline 3D Dropdown loaded successfully');
  }, []);

  const handleError = useCallback<ReactEventHandler<HTMLDivElement>>((e) => {
    console.error('Spline load error:', e);
    setHasError(true);
    setIsLoaded(true);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="spline-dropdown-overlay"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25
          }}
          drag
          dragMomentum={false}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Close button */}
          <button
            className="spline-dropdown-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1L11 11M1 11L11 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Loading indicator */}
          {!isLoaded && !hasError && (
            <div className="spline-dropdown-loading">
              <div className="spline-dropdown-spinner" />
              <span>Loading 3D Scene...</span>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div className="spline-dropdown-error">
              <div className="spline-dropdown-error-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L22 20H2L12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M12 9V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M12 17.2h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
              <span>Failed to load 3D scene</span>
              <button
                onClick={() => {
                  setHasError(false);
                  setIsLoaded(false);
                }}
                className="spline-dropdown-retry"
              >
                Retry
              </button>
            </div>
          )}

          {/* Spline scene container */}
          {!hasError && (
            <div className={`spline-dropdown-scene ${isLoaded ? 'loaded' : ''}`}>
              <SplineErrorBoundary>
                <Suspense fallback={null}>
                  <Spline
                    scene={sceneUrl}
                    onLoad={handleLoad}
                    onError={handleError}
                  />
                </Suspense>
              </SplineErrorBoundary>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toggleable version with button
export function Spline3DDropdownToggle() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.button
        className="spline-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="spline-toggle-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        3D Panel
      </motion.button>

      <Spline3DDropdown
        isVisible={isOpen}
        onClose={() => setIsOpen(false)}
        position={{ x: 50, y: 40 }}
      />
    </>
  );
}

export default Spline3DDropdown;

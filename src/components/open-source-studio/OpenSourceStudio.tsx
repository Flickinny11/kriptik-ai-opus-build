/**
 * Open Source Studio - Main Container
 * 
 * Full-screen modal for browsing HuggingFace models with drag-and-drop
 * Model Dock for collecting models to train/deploy.
 * 
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenSourceStudioStore } from '@/store/useOpenSourceStudioStore';
import { useHuggingFace } from '@/hooks/useHuggingFace';
import { HuggingFaceConnect } from './HuggingFaceConnect';
import { HuggingFaceStatus } from './HuggingFaceStatus';
import { ModelBrowser } from './ModelBrowser';
import { ModelDock } from './ModelDock';
import { ModelDetails } from './ModelDetails';
import './OpenSourceStudio.css';

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HuggingFaceIcon = () => (
  <svg viewBox="0 0 95 95" width="28" height="28" aria-hidden="true">
    <path
      d="M47.5 95C73.7335 95 95 73.7335 95 47.5C95 21.2665 73.7335 0 47.5 0C21.2665 0 0 21.2665 0 47.5C0 73.7335 21.2665 95 47.5 95Z"
      fill="#FFD21E"
    />
    <path
      d="M25.8599 57.95C25.8599 51.62 31.0299 46.45 37.3599 46.45C43.6899 46.45 48.8599 51.62 48.8599 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <path
      d="M46.1399 57.95C46.1399 51.62 51.3099 46.45 57.6399 46.45C63.9699 46.45 69.1399 51.62 69.1399 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <ellipse cx="32.3599" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <ellipse cx="62.6399" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <path
      d="M47.5 75.05C55.12 75.05 61.3 68.87 61.3 61.25H33.7C33.7 68.87 39.88 75.05 47.5 75.05Z"
      fill="#000"
    />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

interface OpenSourceStudioProps {
  onClose?: () => void;
}

export function OpenSourceStudio({ onClose }: OpenSourceStudioProps) {
  const {
    isOpen,
    setOpen,
    selectedModel,
    dock,
    setHfConnection,
  } = useOpenSourceStudioStore();

  const {
    status: hfStatus,
    isLoading: hfLoading,
    disconnect: hfDisconnect,
    isConnected: hfConnected,
  } = useHuggingFace();

  // Sync HF connection status with store
  useEffect(() => {
    setHfConnection(
      hfStatus.connected,
      hfStatus.username,
      hfStatus.avatarUrl
    );
  }, [hfStatus, setHfConnection]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [setOpen, onClose]);

  // Keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  // If not connected to HuggingFace, show connection modal
  const showConnectModal = !hfConnected && !hfLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="oss-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="oss-container"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Header */}
            <header className="oss-header">
              <div className="oss-header-brand">
                <HuggingFaceIcon />
                <div className="oss-header-text">
                  <h1 className="oss-title">Open Source Studio</h1>
                  <p className="oss-subtitle">Browse, collect, and train HuggingFace models</p>
                </div>
              </div>

              <div className="oss-header-actions">
                {/* HuggingFace Status */}
                {hfConnected && hfStatus.username && (
                  <HuggingFaceStatus
                    user={{
                      username: hfStatus.username,
                      fullName: hfStatus.fullName,
                      avatarUrl: hfStatus.avatarUrl,
                      canWrite: hfStatus.canWrite ?? false,
                      isPro: hfStatus.isPro ?? false,
                    }}
                    onDisconnect={hfDisconnect}
                    compact
                  />
                )}

                {/* Close Button */}
                <button
                  className="oss-close-btn"
                  onClick={handleClose}
                  aria-label="Close Open Source Studio"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* Main Content */}
            <div className="oss-content">
              {/* Left Panel: Model Browser */}
              <div className="oss-panel oss-panel--browser">
                <ModelBrowser />
              </div>

              {/* Right Panel: Model Dock */}
              <div className="oss-panel oss-panel--dock">
                <ModelDock />
              </div>
            </div>

            {/* Bottom Panel: Model Details */}
            <AnimatePresence>
              {selectedModel && (
                <motion.div
                  className="oss-panel oss-panel--details"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ModelDetails model={selectedModel} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dock Count Indicator */}
            <div className="oss-dock-indicator">
              <span className="oss-dock-count">{dock.length}/5 models in dock</span>
              {dock.length === 5 && (
                <span className="oss-dock-full">Dock full - remove a model to add more</span>
              )}
            </div>

            {/* HuggingFace Connection Modal */}
            <AnimatePresence>
              {showConnectModal && (
                <div className="oss-connect-overlay">
                  <HuggingFaceConnect
                    onConnect={async (user) => {
                      setHfConnection(true, user.username, user.avatarUrl);
                    }}
                    required={true}
                    mode="modal"
                  />
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OpenSourceStudio;

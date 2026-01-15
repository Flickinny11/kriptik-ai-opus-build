/**
 * AI Lab Hub - Comprehensive AI & ML Interface
 *
 * The main hub for all AI/ML features in KripTik:
 * - Open Source Studio: Browse & collect HuggingFace models
 * - Training: Fine-tune models with custom datasets
 * - Endpoints: Deploy & manage inference endpoints
 * - Research: Multi-agent research orchestration
 *
 * This consolidates all AI Lab functionality into a single tabbed interface.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OpenSourceStudio } from '../open-source-studio/OpenSourceStudio';
import { TrainingWizard } from '../training/TrainingWizard';
import { AILab as ResearchLab } from './AILab';
import { useOpenSourceStudioStore } from '@/store/useOpenSourceStudioStore';
import { useAILabStore } from '@/store/useAILabStore';
import './AILabHub.css';

// =============================================================================
// ICONS (inline SVG)
// =============================================================================

const HuggingFaceIcon = () => (
  <svg viewBox="0 0 95 95" width="20" height="20">
    <path d="M47.5 95C73.7335 95 95 73.7335 95 47.5C95 21.2665 73.7335 0 47.5 0C21.2665 0 0 21.2665 0 47.5C0 73.7335 21.2665 95 47.5 95Z" fill="#FFD21E"/>
    <path d="M25.8599 57.95C25.8599 51.62 31.0299 46.45 37.3599 46.45C43.6899 46.45 48.8599 51.62 48.8599 57.95" stroke="#000" strokeWidth="3" strokeMiterlimit="10" fill="none"/>
    <path d="M46.1399 57.95C46.1399 51.62 51.3099 46.45 57.6399 46.45C63.9699 46.45 69.1399 51.62 69.1399 57.95" stroke="#000" strokeWidth="3" strokeMiterlimit="10" fill="none"/>
    <ellipse cx="32.3599" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <ellipse cx="62.6399" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <path d="M47.5 75.05C55.12 75.05 61.3 68.87 61.3 61.25H33.7C33.7 68.87 39.88 75.05 47.5 75.05Z" fill="#000"/>
  </svg>
);

const TrainingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4"/>
    <path d="m6.343 6.343-.707-.707"/>
    <path d="M2 12h4"/>
    <path d="m6.343 17.657-.707.707"/>
    <path d="M12 18v4"/>
    <path d="m17.657 17.657.707.707"/>
    <path d="M18 12h4"/>
    <path d="m17.657 6.343.707-.707"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
);

const EndpointsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <path d="M6 8h.01"/>
    <path d="M10 8h.01"/>
  </svg>
);

const ResearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

type TabId = 'studio' | 'training' | 'endpoints' | 'research';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface AILabHubProps {
  onClose?: () => void;
  initialTab?: TabId;
}

export function AILabHub({ onClose, initialTab = 'studio' }: AILabHubProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { setOpen: setStudioOpen } = useOpenSourceStudioStore();
  const { setOpen: setResearchOpen } = useAILabStore();

  const tabs: Tab[] = [
    {
      id: 'studio',
      label: 'Open Source Studio',
      icon: <HuggingFaceIcon />,
      description: 'Browse & collect HuggingFace models',
    },
    {
      id: 'training',
      label: 'Training',
      icon: <TrainingIcon />,
      description: 'Fine-tune models with your data',
    },
    {
      id: 'endpoints',
      label: 'Endpoints',
      icon: <EndpointsIcon />,
      description: 'Deploy & manage inference APIs',
    },
    {
      id: 'research',
      label: 'Research Lab',
      icon: <ResearchIcon />,
      description: 'Multi-agent AI research',
    },
  ];

  const handleClose = useCallback(() => {
    setStudioOpen(false);
    setResearchOpen(false);
    onClose?.();
  }, [setStudioOpen, setResearchOpen, onClose]);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    // Open the appropriate store when switching tabs
    if (tabId === 'studio') {
      setStudioOpen(true);
      setResearchOpen(false);
    } else if (tabId === 'research') {
      setResearchOpen(true);
      setStudioOpen(false);
    } else {
      setStudioOpen(false);
      setResearchOpen(false);
    }
  }, [setStudioOpen, setResearchOpen]);

  // Navigate to endpoints page
  const handleEndpointsClick = useCallback(() => {
    window.location.href = '/endpoints';
  }, []);

  return (
    <motion.div
      className="ai-lab-hub-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="ai-lab-hub-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Header */}
        <header className="ai-lab-hub-header">
          <div className="ai-lab-hub-title-area">
            <h1 className="ai-lab-hub-title">AI Lab</h1>
            <p className="ai-lab-hub-subtitle">Train, deploy, and orchestrate AI models</p>
          </div>

          {/* Tab Navigation */}
          <nav className="ai-lab-hub-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`ai-lab-hub-tab ${activeTab === tab.id ? 'ai-lab-hub-tab--active' : ''}`}
                onClick={() => tab.id === 'endpoints' ? handleEndpointsClick() : handleTabChange(tab.id)}
              >
                <span className="ai-lab-hub-tab-icon">{tab.icon}</span>
                <span className="ai-lab-hub-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Close Button */}
          <button className="ai-lab-hub-close" onClick={handleClose}>
            <CloseIcon />
          </button>
        </header>

        {/* Tab Content */}
        <div className="ai-lab-hub-content">
          <AnimatePresence mode="wait">
            {activeTab === 'studio' && (
              <motion.div
                key="studio"
                className="ai-lab-hub-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <OpenSourceStudio onClose={handleClose} />
              </motion.div>
            )}

            {activeTab === 'training' && (
              <motion.div
                key="training"
                className="ai-lab-hub-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="ai-lab-hub-training-wrapper">
                  <TrainingWizard
                    isOpen={true}
                    onClose={handleClose}
                    onComplete={(jobId) => {
                      console.log('[AILabHub] Training complete, job:', jobId);
                      // Switch to endpoints tab to see the deployed model
                      handleEndpointsClick();
                    }}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'research' && (
              <motion.div
                key="research"
                className="ai-lab-hub-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ResearchLab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AILabHub;

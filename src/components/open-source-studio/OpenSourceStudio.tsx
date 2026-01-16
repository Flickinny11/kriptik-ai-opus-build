/**
 * Open Source Studio - Comprehensive 4-Tab Hub
 *
 * Full integration with the massive backend:
 * - Open Source: HuggingFace models, drag-and-drop dock, NLP integration prompt
 * - AI Lab: Multi-agent research orchestration with budget management
 * - Training: Full multi-modal training wizard (LLM, Image, Video, Audio)
 * - Deploy: Serverless endpoint deployment and management
 *
 * All tabs integrate with BuildLoopOrchestrator for unique intent lock per tab.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import { useAILabStore } from '@/store/useAILabStore';
import { useHuggingFace } from '@/hooks/useHuggingFace';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

// Core UI components
import { HuggingFaceConnect } from './HuggingFaceConnect';
import { HuggingFaceStatus } from './HuggingFaceStatus';
import { ModelBrowser } from './ModelBrowser';
import { ModelDock } from './ModelDock';
import { ModelDetails } from './ModelDetails';
import { ModelLibrary } from './ModelLibrary';

// Tab panels
import { AILab } from '../ai-lab/AILab';
import { TrainingPanel } from './TrainingPanel';
import { DeployPanel } from './DeployPanel';

import './OpenSourceStudio.css';
import './ModelLibrary.css';

// =============================================================================
// TYPES
// =============================================================================

type StudioTab = 'open-source' | 'ai-lab' | 'training' | 'deploy';

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HuggingFaceIcon = () => (
  <svg viewBox="0 0 95 95" width="28" height="28" aria-hidden="true">
    <path d="M47.5 95C73.7335 95 95 73.7335 95 47.5C95 21.2665 73.7335 0 47.5 0C21.2665 0 0 21.2665 0 47.5C0 73.7335 21.2665 95 47.5 95Z" fill="#FFD21E"/>
    <path d="M25.8599 57.95C25.8599 51.62 31.0299 46.45 37.3599 46.45C43.6899 46.45 48.8599 51.62 48.8599 57.95" stroke="#000" strokeWidth="3" strokeMiterlimit="10" fill="none"/>
    <path d="M46.1399 57.95C46.1399 51.62 51.3099 46.45 57.6399 46.45C63.9699 46.45 69.1399 51.62 69.1399 57.95" stroke="#000" strokeWidth="3" strokeMiterlimit="10" fill="none"/>
    <ellipse cx="32.3599" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <ellipse cx="62.6399" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <path d="M47.5 75.05C55.12 75.05 61.3 68.87 61.3 61.25H33.7C33.7 68.87 39.88 75.05 47.5 75.05Z" fill="#000"/>
  </svg>
);

const TabIcons: Record<StudioTab, JSX.Element> = {
  'open-source': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <ellipse cx="9" cy="10" rx="1.5" ry="2" fill="currentColor"/>
      <ellipse cx="15" cy="10" rx="1.5" ry="2" fill="currentColor"/>
      <path d="M8 15c0 0 2 3 4 3s4-3 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'ai-lab': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  'training': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="6" width="4" height="15" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="17" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  'deploy': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// NOTE: TrainingPanel and DeployPanel now handle their own logic internally

// =============================================================================
// SUB COMPONENTS
// =============================================================================

// Liquid Glass Tab Button
function TabButton({
  tab,
  label,
  isActive,
  onClick,
  badge
}: {
  tab: StudioTab;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="oss-tab-btn"
      style={{
        background: isActive
          ? 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(250,250,252,0.85) 100%)'
          : isHovered
            ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(250,250,252,0.4) 100%)'
            : 'transparent',
        boxShadow: isActive
          ? `
            0 6px 20px rgba(0,0,0,0.1),
            0 3px 10px rgba(0,0,0,0.06),
            inset 0 2px 4px rgba(255,255,255,1),
            0 0 0 1px rgba(255,255,255,0.8),
            0 0 16px rgba(251,191,36,0.15)
          `
          : isHovered
            ? '0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.7)'
            : 'none',
        color: isActive ? '#92400e' : isHovered ? '#44403c' : '#78716c',
        transform: `perspective(400px) ${isActive ? 'translateZ(2px) rotateX(-1deg)' : 'translateZ(0)'}`,
      }}
    >
      {TabIcons[tab]}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="oss-tab-badge">{badge}</span>
      )}
    </button>
  );
}

// NLP Integration Prompt Bar for Open Source Tab
function IntegrationPromptBar({
  models,
  onSubmit,
  isProcessing
}: {
  models: ModelWithRequirements[];
  onSubmit: (prompt: string) => void;
  isProcessing: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (prompt.trim() && !isProcessing && models.length > 0) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="oss-prompt-bar"
      style={{
        padding: '6px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flexShrink: 0,
        background: 'rgba(25, 25, 35, 0.95)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        className="oss-prompt-context"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflow: 'hidden',
          flexWrap: 'wrap',
        }}
      >
        {models.length > 0 ? (
          <div className="oss-prompt-models" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', overflow: 'hidden' }}>
            <span className="oss-prompt-label" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>Models in dock:</span>
            {models.slice(0, 2).map(m => (
              <span key={m.id} className="oss-prompt-model-tag" style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,210,30,0.15)', borderRadius: '4px', color: '#FFD21E', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.modelId.split('/').pop()}</span>
            ))}
            {models.length > 2 && <span className="oss-prompt-more" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>+{models.length - 2}</span>}
          </div>
        ) : (
          <span className="oss-prompt-hint" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Drag models to dock, then describe your integration</span>
        )}
      </div>

      <div className="oss-prompt-input-container" style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe integration... e.g., 'Image generation with upscaling'"
          className="oss-prompt-input"
          rows={1}
          style={{
            flex: 1,
            minHeight: '28px',
            maxHeight: '50px',
            padding: '5px 8px',
            fontSize: '0.7rem',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.9)',
            resize: 'none',
            outline: 'none',
          }}
        />

        <button
          className="oss-prompt-submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing || models.length === 0}
          style={{
            width: '28px',
            height: '28px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: prompt.trim() && models.length > 0
              ? 'linear-gradient(145deg, #f59e0b 0%, #d97706 100%)'
              : 'rgba(255,255,255,0.1)',
            boxShadow: prompt.trim() && models.length > 0
              ? '0 2px 8px rgba(245,158,11,0.3)'
              : 'none',
          }}
        >
          {isProcessing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="oss-prompt-spinner"
            />
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
    </div>
  );
}

// NOTE: Old TrainingTabContent and DeployTabContent removed - now using TrainingPanel and DeployPanel components

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface OpenSourceStudioProps {
  onClose?: () => void;
  /** When true, renders inline without overlay (for embedding in panels) */
  embedded?: boolean;
}

export function OpenSourceStudio({ onClose, embedded = false }: OpenSourceStudioProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('open-source');
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);
  const [implementationPlan, setImplementationPlan] = useState<any>(null);

  const {
    isOpen,
    setOpen,
    selectedModel,
    selectModel,
    dock,
    setHfConnection,
  } = useOpenSourceStudioStore();

  const { setOpen: setAILabOpen } = useAILabStore();

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
      if (e.key === 'Escape') handleClose();
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

  // Handle NLP prompt submission - integrates with BuildLoopOrchestrator
  const handlePromptSubmit = async (prompt: string) => {
    setIsProcessingPrompt(true);
    try {
      const dockModels = dock.map(d => d.model);

      // Send to backend for intent lock and plan generation
      const response = await authenticatedFetch(`${API_URL}/api/open-source-studio/integrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          models: dockModels.map(m => ({
            modelId: m.modelId,
            task: m.pipeline_tag,
            estimatedVRAM: m.estimatedVRAM,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store full response including projectId for execution
        setImplementationPlan(data);
      } else {
        const error = await response.json();
        console.error('[OpenSourceStudio] Integration failed:', error);
        alert(`Failed to generate plan: ${error.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[OpenSourceStudio] Integration error:', err);
      alert('Failed to connect to server');
    } finally {
      setIsProcessingPrompt(false);
    }
  };

  // If not connected to HuggingFace, show connection modal
  const showConnectModal = !hfConnected && !hfLoading;
  const dockModels = dock.map(d => d.model);

  // Shared content renderer for both embedded and overlay modes
  const renderStudioContent = () => (
    <>
      {/* Tab Navigation */}
      <nav className="oss-tabs" style={embedded ? { padding: '8px 12px' } : undefined}>
              <TabButton
                tab="open-source"
                label="Open Source"
                isActive={activeTab === 'open-source'}
                onClick={() => setActiveTab('open-source')}
                badge={dock.length}
              />
              <TabButton
                tab="ai-lab"
                label="AI Lab"
                isActive={activeTab === 'ai-lab'}
                onClick={() => {
                  setActiveTab('ai-lab');
                  setAILabOpen(true);
                }}
              />
              <TabButton
                tab="training"
                label="Training"
                isActive={activeTab === 'training'}
                onClick={() => setActiveTab('training')}
              />
              <TabButton
                tab="deploy"
                label="Deploy"
                isActive={activeTab === 'deploy'}
                onClick={() => setActiveTab('deploy')}
              />
      </nav>

      {/* Tab Content */}
      <div className="oss-content">
        <AnimatePresence mode="wait">
          {/* Open Source Tab */}
          {activeTab === 'open-source' && (
            <motion.div
              key="open-source"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="oss-tab-content"
            >
              <div
                className="oss-main-layout"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 220px',
                  gap: '8px',
                  flex: 1,
                  minHeight: 0,
                  padding: '8px',
                }}
              >
                <div className="oss-panel oss-panel--library" style={{ overflow: 'hidden', minHeight: 0 }}>
                  <ModelLibrary
                    onSelectModel={(modelId, _modelName, author) => {
                      selectModel({
                        modelId,
                        id: modelId,
                        author,
                        downloads: 0,
                        likes: 0,
                        lastModified: new Date().toISOString(),
                        tags: [],
                        sha: '',
                        private: false,
                        gated: false,
                        disabled: false,
                        pipeline_tag: 'text-generation',
                      } as ModelWithRequirements);
                    }}
                  />
                </div>
                <div className="oss-panel oss-panel--browser" style={{ overflow: 'hidden', minHeight: 0 }}>
                  <ModelBrowser />
                </div>
                <div className="oss-panel oss-panel--dock" style={{ overflow: 'hidden', minHeight: 0 }}>
                  <ModelDock />
                </div>
              </div>

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

              {/* Integration Prompt Bar */}
              <IntegrationPromptBar
                models={dockModels}
                onSubmit={handlePromptSubmit}
                isProcessing={isProcessingPrompt}
              />
            </motion.div>
          )}

          {/* AI Lab Tab */}
          {activeTab === 'ai-lab' && (
            <motion.div
              key="ai-lab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="oss-tab-content oss-tab-content--full"
            >
              <AILab />
            </motion.div>
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="oss-tab-content oss-tab-content--full"
            >
              <TrainingPanel />
            </motion.div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <motion.div
              key="deploy"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="oss-tab-content oss-tab-content--full"
            >
              <DeployPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Implementation Plan Modal */}
      <AnimatePresence>
        {implementationPlan && (
          <motion.div
            className="oss-plan-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="oss-plan-modal"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <h3>Implementation Plan</h3>
              <div className="oss-plan-summary">
                <p><strong>Summary:</strong> {implementationPlan.plan?.summary || 'No summary'}</p>
                {implementationPlan.plan?.requirements && (
                  <div className="oss-plan-requirements">
                    <span>GPU: {implementationPlan.plan.requirements.gpuType || 'TBD'}</span>
                    <span>VRAM: {implementationPlan.plan.requirements.estimatedVRAM || '?'} GB</span>
                    <span>Est. Cost: {implementationPlan.plan.requirements.estimatedMonthlyCost || 'TBD'}/mo</span>
                  </div>
                )}
              </div>
              <div className="oss-plan-content">
                <pre>{JSON.stringify(implementationPlan.plan, null, 2)}</pre>
              </div>
              <div className="oss-plan-actions">
                <button onClick={() => setImplementationPlan(null)}>Cancel</button>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      setIsProcessingPrompt(true);
                      const response = await authenticatedFetch(`${API_URL}/api/open-source-studio/integrate/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          plan: implementationPlan.plan,
                          projectId: implementationPlan.projectId,
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        console.log('[OpenSourceStudio] Execution result:', result);
                        alert(`Deployed ${result.summary?.deployed || 0}/${result.summary?.total || 0} models successfully!`);
                      } else {
                        const error = await response.json();
                        alert(`Execution failed: ${error.message || 'Unknown error'}`);
                      }
                    } catch (err) {
                      console.error('[OpenSourceStudio] Execute error:', err);
                      alert('Failed to execute plan');
                    } finally {
                      setIsProcessingPrompt(false);
                      setImplementationPlan(null);
                    }
                  }}
                  disabled={isProcessingPrompt}
                >
                  {isProcessingPrompt ? 'Deploying...' : 'Approve & Execute'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HuggingFace Connection - inline mode for embedded, modal for standalone */}
      <AnimatePresence>
        {showConnectModal && (
          <div className={`oss-connect-overlay ${embedded ? 'oss-connect-overlay--embedded' : ''}`}>
            <HuggingFaceConnect
              onConnect={async (user) => {
                setHfConnection(true, user.username, user.avatarUrl);
              }}
              required={true}
              mode={embedded ? 'inline' : 'modal'}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );

  // EMBEDDED MODE: Render directly without overlay (for toolbar panels)
  if (embedded) {
    return (
      <div
        className="oss-container oss-container--4tab oss-container--embedded"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          borderRadius: 0,
          background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.98), rgba(20, 20, 30, 1))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Compact Header for embedded mode */}
        <header className="oss-header" style={{ padding: '10px 14px' }}>
          <div className="oss-header-brand">
            <HuggingFaceIcon />
            <div className="oss-header-text">
              <h1 className="oss-title" style={{ fontSize: '1rem' }}>Open Source Studio</h1>
              <p className="oss-subtitle" style={{ fontSize: '0.7rem' }}>HuggingFace models, training &amp; deployment</p>
            </div>
          </div>
          <div className="oss-header-actions">
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
          </div>
        </header>
        {renderStudioContent()}
      </div>
    );
  }

  // NORMAL MODE: Render with overlay, controlled by isOpen
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
            className="oss-container oss-container--4tab"
            style={{
              width: '92vw',
              height: '88vh',
              maxWidth: '1100px',
              maxHeight: '650px',
              minWidth: '700px',
              minHeight: '480px',
            }}
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
                  <p className="oss-subtitle">Browse, train, and deploy open source AI models</p>
                </div>
              </div>
              <div className="oss-header-actions">
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
                <button
                  className="oss-close-btn"
                  onClick={handleClose}
                  aria-label="Close Open Source Studio"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>
            {renderStudioContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OpenSourceStudio;

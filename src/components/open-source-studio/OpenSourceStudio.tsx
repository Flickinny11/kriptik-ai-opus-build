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
import { authenticatedFetch } from '@/lib/api-config';

// Existing comprehensive components
import { HuggingFaceConnect } from './HuggingFaceConnect';
import { HuggingFaceStatus } from './HuggingFaceStatus';
import { ModelBrowser } from './ModelBrowser';
import { ModelDock } from './ModelDock';
import { ModelDetails } from './ModelDetails';
import { TrainingModule } from './TrainingModule';
import { TrainingConfig, type TrainingParams } from './TrainingConfig';
import { DatasetSelector, type HuggingFaceDataset } from './DatasetSelector';
import { TrainingProgress } from './TrainingProgress';
import { TrainingCostEstimator } from './TrainingCostEstimator';
import { DeploymentConfig, type DeploymentOptions } from './DeploymentConfig';
import { EndpointManagement, type DeployedEndpoint } from './EndpointManagement';
import { EndpointTest } from './EndpointTest';
import { AILab } from '../ai-lab/AILab';
import { TrainingWizard } from '../training/TrainingWizard';

import './OpenSourceStudio.css';

// =============================================================================
// TYPES
// =============================================================================

type StudioTab = 'open-source' | 'ai-lab' | 'training' | 'deploy';

type TrainingSubView = 'overview' | 'wizard' | 'configure' | 'dataset' | 'progress' | 'cost';
type DeploySubView = 'overview' | 'configure' | 'endpoints' | 'test';

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

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

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
    <div className="oss-prompt-bar">
      <div className="oss-prompt-context">
        {models.length > 0 ? (
          <div className="oss-prompt-models">
            <span className="oss-prompt-label">Models in dock:</span>
            {models.slice(0, 3).map(m => (
              <span key={m.id} className="oss-prompt-model-tag">{m.modelId.split('/').pop()}</span>
            ))}
            {models.length > 3 && <span className="oss-prompt-more">+{models.length - 3} more</span>}
          </div>
        ) : (
          <span className="oss-prompt-hint">Drag models to dock, then describe your integration workflow</span>
        )}
      </div>

      <div className="oss-prompt-input-container">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe how to integrate these models... e.g., 'Create an image generation pipeline with upscaling and face restoration'"
          className="oss-prompt-input"
          rows={2}
        />

        <button
          className="oss-prompt-submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing || models.length === 0}
          style={{
            background: prompt.trim() && models.length > 0
              ? 'linear-gradient(145deg, #f59e0b 0%, #d97706 100%)'
              : 'rgba(0,0,0,0.1)',
            boxShadow: prompt.trim() && models.length > 0
              ? '0 4px 12px rgba(245,158,11,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
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

// Training Tab Overview with sub-navigation
function TrainingTabContent({
  models,
  onStartTraining
}: {
  models: ModelWithRequirements[];
  onStartTraining: (modelId: string, params: TrainingParams) => void;
}) {
  const [subView, setSubView] = useState<TrainingSubView>('overview');
  const [selectedModel, setSelectedModel] = useState<ModelWithRequirements | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<HuggingFaceDataset | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleModelSelect = (model: ModelWithRequirements) => {
    setSelectedModel(model);
    setSubView('dataset');
  };

  const handleDatasetSelect = (dataset: HuggingFaceDataset) => {
    setSelectedDataset(dataset);
    setSubView('configure');
  };

  const handleStartTraining = (params: TrainingParams) => {
    if (selectedModel) {
      onStartTraining(selectedModel.modelId, params);
      setSubView('progress');
    }
  };

  // Overview with action cards
  if (subView === 'overview') {
    return (
      <div className="oss-training-overview">
        <div className="oss-training-header">
          <h3>Training &amp; Fine-Tuning</h3>
          <p>Train LLM, Image, Video, and Audio models with full parameter control</p>
        </div>

        <div className="oss-training-actions">
          {/* New Training Job */}
          <button className="oss-training-action-card" onClick={() => setShowWizard(true)}>
            <div className="oss-action-icon">
              <PlusIcon />
            </div>
            <div className="oss-action-content">
              <h4>New Training Job</h4>
              <p>Start a new multi-modal training with the wizard</p>
            </div>
          </button>

          {/* Quick Train from Dock */}
          {models.length > 0 && (
            <div className="oss-training-dock-models">
              <h4>Train from Dock ({models.length} models)</h4>
              <div className="oss-training-model-grid">
                {models.map(model => (
                  <button
                    key={model.id}
                    className="oss-training-model-card"
                    onClick={() => handleModelSelect(model)}
                  >
                    <span className="oss-training-model-name">{model.modelId.split('/').pop()}</span>
                    <span className="oss-training-model-task">{model.pipeline_tag || 'Unknown'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Training Wizard Modal */}
        <TrainingWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={(jobId) => {
            setActiveJobId(jobId);
            setSubView('progress');
            setShowWizard(false);
          }}
        />
      </div>
    );
  }

  // Dataset Selection
  if (subView === 'dataset' && selectedModel) {
    return (
      <div className="oss-training-subview">
        <button className="oss-back-btn" onClick={() => setSubView('overview')}>
          <BackIcon /> Back
        </button>
        <DatasetSelector
          modelTask={selectedModel.pipeline_tag || 'text-generation'}
          onSelect={handleDatasetSelect}
          selectedDataset={selectedDataset}
        />
      </div>
    );
  }

  // Training Configuration
  if (subView === 'configure' && selectedModel) {
    return (
      <div className="oss-training-subview">
        <button className="oss-back-btn" onClick={() => setSubView('dataset')}>
          <BackIcon /> Back to Dataset
        </button>
        <div className="oss-training-config-layout">
          <div className="oss-training-config-main">
            <TrainingConfig
              model={selectedModel}
              onStartTraining={handleStartTraining}
              isLoading={false}
            />
          </div>
          <div className="oss-training-config-sidebar">
            <TrainingCostEstimator
              modelId={selectedModel.modelId}
              estimatedVRAM={selectedModel.estimatedVRAM || 8}
              trainingType="qlora"
              epochs={3}
            />
          </div>
        </div>
      </div>
    );
  }

  // Training Progress
  if (subView === 'progress' && activeJobId) {
    return (
      <div className="oss-training-subview">
        <button className="oss-back-btn" onClick={() => setSubView('overview')}>
          <BackIcon /> Back to Overview
        </button>
        <TrainingProgress
          jobId={activeJobId}
          onComplete={() => {
            setSubView('overview');
            setActiveJobId(null);
          }}
        />
      </div>
    );
  }

  return null;
}

// Deploy Tab Content with sub-navigation
function DeployTabContent({
  models
}: {
  models: ModelWithRequirements[];
}) {
  const [subView, setSubView] = useState<DeploySubView>('overview');
  const [selectedModel, setSelectedModel] = useState<ModelWithRequirements | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<DeployedEndpoint | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async (options: DeploymentOptions) => {
    if (!selectedModel) return;
    setIsDeploying(true);

    try {
      const response = await authenticatedFetch('/api/open-source-studio/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.modelId,
          modelName: selectedModel.modelId.split('/').pop(),
          customConfig: options,
        }),
      });

      if (response.ok) {
        setSubView('endpoints');
      }
    } catch (err) {
      console.error('[Deploy] Error:', err);
    } finally {
      setIsDeploying(false);
    }
  };

  // Overview
  if (subView === 'overview') {
    return (
      <div className="oss-deploy-overview">
        <div className="oss-deploy-header">
          <h3>Deploy to Serverless Endpoints</h3>
          <p>Deploy models as private inference endpoints on RunPod or Modal</p>
        </div>

        <div className="oss-deploy-actions">
          <button
            className="oss-deploy-action-card"
            onClick={() => setSubView('endpoints')}
          >
            <div className="oss-action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="2" y="13" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="6" cy="7" r="1" fill="currentColor"/>
                <circle cx="6" cy="17" r="1" fill="currentColor"/>
              </svg>
            </div>
            <div className="oss-action-content">
              <h4>Manage Endpoints</h4>
              <p>View and manage deployed inference endpoints</p>
            </div>
          </button>

          {models.length > 0 && (
            <div className="oss-deploy-dock-models">
              <h4>Deploy from Dock ({models.length} models)</h4>
              <div className="oss-deploy-model-grid">
                {models.map(model => (
                  <button
                    key={model.id}
                    className="oss-deploy-model-card"
                    onClick={() => {
                      setSelectedModel(model);
                      setSubView('configure');
                    }}
                  >
                    <span className="oss-deploy-model-name">{model.modelId.split('/').pop()}</span>
                    <span className="oss-deploy-model-vram">{model.estimatedVRAM || '?'} GB VRAM</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Deployment Configuration
  if (subView === 'configure' && selectedModel) {
    return (
      <DeploymentConfig
        modelId={selectedModel.modelId}
        modelName={selectedModel.modelId.split('/').pop() || 'model'}
        estimatedVRAM={selectedModel.estimatedVRAM || 8}
        onDeploy={handleDeploy}
        onCancel={() => setSubView('overview')}
        isDeploying={isDeploying}
      />
    );
  }

  // Endpoint Management
  if (subView === 'endpoints') {
    return (
      <div className="oss-deploy-subview">
        <button className="oss-back-btn" onClick={() => setSubView('overview')}>
          <BackIcon /> Back
        </button>
        <EndpointManagement
          onDeploy={() => setSubView('overview')}
          onSelectEndpoint={(endpoint) => {
            setSelectedEndpoint(endpoint);
            setSubView('test');
          }}
        />
      </div>
    );
  }

  // Endpoint Testing
  if (subView === 'test' && selectedEndpoint) {
    return (
      <div className="oss-deploy-subview">
        <button className="oss-back-btn" onClick={() => setSubView('endpoints')}>
          <BackIcon /> Back to Endpoints
        </button>
        <EndpointTest
          endpoint={selectedEndpoint}
          onClose={() => setSubView('endpoints')}
        />
      </div>
    );
  }

  return null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface OpenSourceStudioProps {
  onClose?: () => void;
}

export function OpenSourceStudio({ onClose }: OpenSourceStudioProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('open-source');
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);
  const [implementationPlan, setImplementationPlan] = useState<any>(null);

  const {
    isOpen,
    setOpen,
    selectedModel,
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
      const response = await authenticatedFetch('/api/open-source-studio/integrate', {
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

  // Handle training start
  const handleStartTraining = async (modelId: string, params: TrainingParams) => {
    try {
      const response = await authenticatedFetch('/api/training/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          trainingType: params.type,
          epochs: params.epochs,
          learningRate: params.learningRate,
          batchSize: params.batchSize,
          loraRank: params.loraRank,
          loraAlpha: params.loraAlpha,
          loraDropout: params.loraDropout,
          targetModules: params.targetModules,
          datasetId: params.datasetId,
          budgetLimit: params.budgetLimit,
          autoSaveToHub: params.autoSaveToHub,
          outputRepoName: params.modelName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[OpenSourceStudio] Training job created:', data.job.id);
      }
    } catch (err) {
      console.error('[OpenSourceStudio] Training error:', err);
    }
  };

  // If not connected to HuggingFace, show connection modal
  const showConnectModal = !hfConnected && !hfLoading;
  const dockModels = dock.map(d => d.model);

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

            {/* Tab Navigation */}
            <nav className="oss-tabs">
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
                    <div className="oss-main-layout">
                      <div className="oss-panel oss-panel--browser">
                        <ModelBrowser />
                      </div>
                      <div className="oss-panel oss-panel--dock">
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
                    className="oss-tab-content"
                  >
                    <TrainingTabContent
                      models={dockModels}
                      onStartTraining={handleStartTraining}
                    />
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
                    className="oss-tab-content"
                  >
                    <DeployTabContent models={dockModels} />
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
                          // Execute the approved plan
                          try {
                            setIsProcessingPrompt(true);
                            const response = await authenticatedFetch('/api/open-source-studio/integrate/execute', {
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
                              // Show success notification or update UI
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

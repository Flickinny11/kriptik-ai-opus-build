/**
 * Training Page - NLP-First Flagship Training Interface
 *
 * Main training page implementing the NLP-first flow:
 * 1. Landing State - NLP input with capability showcase
 * 2. Plan Generation State - Loading with step indicator
 * 3. Plan Review State - Implementation plan display
 * 4. Environment Setup State - Setup progress
 * 5. Training In Progress State - Live metrics
 * 6. Frozen State - Budget freeze overlay
 * 7. Complete State - Results with testing
 *
 * Phase 7 of FLAGSHIP-TRAINING-IMPLEMENTATION-PLAN.md
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrainingStore } from '@/store/useTrainingStore';
import { HoverSidebar } from '@/components/navigation/HoverSidebar';
import {
  TrainingIntentInput,
  TrainingImplementationPlan,
  TrainingProgressEnhanced,
  BudgetFreezeOverlay,
  UniversalModelTester,
  QuickTestPanel,
  TrainingNotificationBell,
} from '@/components/training';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import './TrainingPage.css';

// =============================================================================
// TYPES
// =============================================================================

type TrainingFlowState =
  | 'landing'
  | 'generating'
  | 'plan_review'
  | 'setup'
  | 'training'
  | 'frozen'
  | 'complete';

interface RecentJob {
  id: string;
  name: string;
  status: string;
  modality: string;
  createdAt: string;
  finalLoss?: number;
  totalCost?: number;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

const BrainIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path d="M12 2a4 4 0 00-4 4c0 1.1.45 2.1 1.17 2.83L8 10a4 4 0 00-4 4c0 1.66 1 3.08 2.44 3.69L6 19a2 2 0 002 2h8a2 2 0 002-2l-.44-1.31A4 4 0 0020 14a4 4 0 00-4-4l-1.17-1.17A4 4 0 0016 6a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <path d="M12 12v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MusicIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const VideoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="10,8 16,12 10,16" fill="currentColor" />
  </svg>
);

const ImageIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VoiceIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TextIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M4 7V4h16v3M9 20h6M12 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
    <path d="M12 2a10 10 0 019 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// EXAMPLE PROMPTS
// =============================================================================

const EXAMPLE_PROMPTS = [
  {
    category: 'Music',
    prompt: 'Train a model to generate Suno-quality music with expressive vocals',
    icon: MusicIcon,
    color: '#f59e0b',
  },
  {
    category: 'Video',
    prompt: 'Fine-tune a video model to generate cinematic 4K footage',
    icon: VideoIcon,
    color: '#ec4899',
  },
  {
    category: 'Voice',
    prompt: 'Clone my voice from 5 minutes of audio samples',
    icon: VoiceIcon,
    color: '#8b5cf6',
  },
  {
    category: 'Code',
    prompt: 'Train a coding model specialized in React and TypeScript',
    icon: CodeIcon,
    color: '#22c55e',
  },
  {
    category: 'Image',
    prompt: 'Train a model in my art style using 50 reference images',
    icon: ImageIcon,
    color: '#3b82f6',
  },
];

const CAPABILITY_CARDS = [
  { type: 'music', label: 'Music Generation', icon: MusicIcon, color: '#f59e0b', desc: 'Suno-level quality' },
  { type: 'video', label: 'Video Generation', icon: VideoIcon, color: '#ec4899', desc: 'Cinematic 4K' },
  { type: 'image', label: 'Image Generation', icon: ImageIcon, color: '#3b82f6', desc: 'Custom styles' },
  { type: 'voice', label: 'Voice Cloning', icon: VoiceIcon, color: '#8b5cf6', desc: 'From 5 min audio' },
  { type: 'text', label: 'Text & Chat', icon: TextIcon, color: '#06b6d4', desc: 'GPT-4 level' },
  { type: 'code', label: 'Code Generation', icon: CodeIcon, color: '#22c55e', desc: 'Multi-language' },
];

// =============================================================================
// GENERATION STEPS
// =============================================================================

const GENERATION_STEPS = [
  'Parsing intent',
  'Selecting models',
  'Choosing methods',
  'Estimating costs',
  'Generating plan',
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CapabilityShowcase() {
  return (
    <div className="tp-capability-showcase">
      <h3 className="tp-capability-title">What can you train?</h3>
      <div className="tp-capability-grid">
        {CAPABILITY_CARDS.map((cap) => (
          <motion.div
            key={cap.type}
            className="tp-capability-card"
            style={{ '--accent': cap.color } as React.CSSProperties}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="tp-capability-icon">
              <cap.icon />
            </div>
            <div className="tp-capability-label">{cap.label}</div>
            <div className="tp-capability-desc">{cap.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ExamplePrompts({ onClick }: { onClick: (prompt: string) => void }) {
  return (
    <div className="tp-examples">
      <p className="tp-examples-label">Try an example</p>
      <div className="tp-examples-list">
        {EXAMPLE_PROMPTS.map((ex, idx) => (
          <motion.button
            key={idx}
            className="tp-example-btn"
            style={{ '--accent': ex.color } as React.CSSProperties}
            onClick={() => onClick(ex.prompt)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="tp-example-category">{ex.category}</span>
            <span className="tp-example-text">{ex.prompt}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function RecentJobs({ jobs, onSelect }: { jobs: RecentJob[]; onSelect: (id: string) => void }) {
  if (jobs.length === 0) return null;

  return (
    <div className="tp-recent-jobs">
      <h3 className="tp-recent-title">Recent Training Jobs</h3>
      <div className="tp-recent-list">
        {jobs.map((job) => (
          <button
            key={job.id}
            className="tp-recent-job"
            onClick={() => onSelect(job.id)}
          >
            <div className="tp-recent-job-info">
              <span className="tp-recent-job-name">{job.name}</span>
              <span className={`tp-recent-job-status tp-status--${job.status}`}>{job.status}</span>
            </div>
            <div className="tp-recent-job-meta">
              <span className="tp-recent-job-modality">{job.modality}</span>
              <span className="tp-recent-job-date">
                <ClockIcon />
                {new Date(job.createdAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GenerationProgress({ currentStep }: { currentStep: number }) {
  return (
    <motion.div
      className="tp-generation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="tp-generation-animation">
        <motion.div
          className="tp-generation-spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <BrainIcon />
        </motion.div>
        <motion.div
          className="tp-generation-ring"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <h2 className="tp-generation-title">Analyzing your training requirements</h2>
      <p className="tp-generation-subtitle">KripTik AI is creating your implementation plan</p>

      <div className="tp-generation-steps">
        {GENERATION_STEPS.map((step, idx) => (
          <div
            key={step}
            className={`tp-generation-step ${
              idx < currentStep ? 'tp-step--complete' :
              idx === currentStep ? 'tp-step--active' : ''
            }`}
          >
            <div className="tp-step-indicator">
              {idx < currentStep ? (
                <CheckCircleIcon />
              ) : idx === currentStep ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <SpinnerIcon />
                </motion.div>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span className="tp-step-label">{step}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SetupProgress({ stages, currentStage, logs }: {
  stages: string[];
  currentStage: number;
  logs: string[];
}) {
  return (
    <motion.div
      className="tp-setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="tp-setup-title">Setting up training environment</h2>

      <div className="tp-setup-stages">
        {stages.map((stage, idx) => (
          <div
            key={stage}
            className={`tp-setup-stage ${
              idx < currentStage ? 'tp-stage--complete' :
              idx === currentStage ? 'tp-stage--active' : ''
            }`}
          >
            <div className="tp-stage-indicator">
              {idx < currentStage ? <CheckCircleIcon /> : idx === currentStage ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <SpinnerIcon />
                </motion.div>
              ) : (
                <span className="tp-stage-dot" />
              )}
            </div>
            <span className="tp-stage-label">{stage}</span>
          </div>
        ))}
      </div>

      <div className="tp-setup-logs">
        <div className="tp-logs-header">Setup Logs</div>
        <div className="tp-logs-content">
          {logs.map((log, idx) => (
            <div key={idx} className="tp-log-line">
              <span className="tp-log-time">[{new Date().toLocaleTimeString()}]</span>
              <span className="tp-log-text">{log}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CompletionSummary({ result }: { result: {
  finalLoss?: number;
  totalCost: number;
  trainingTime: number;
  totalEpochs: number;
  modelPath?: string;
  huggingfaceUrl?: string;
} }) {
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="tp-completion-summary">
      <div className="tp-completion-icon">
        <CheckCircleIcon />
      </div>
      <h2 className="tp-completion-title">Training Complete</h2>

      <div className="tp-completion-stats">
        <div className="tp-stat">
          <span className="tp-stat-value">{result.finalLoss?.toFixed(4) || 'N/A'}</span>
          <span className="tp-stat-label">Final Loss</span>
        </div>
        <div className="tp-stat">
          <span className="tp-stat-value">${result.totalCost.toFixed(2)}</span>
          <span className="tp-stat-label">Total Cost</span>
        </div>
        <div className="tp-stat">
          <span className="tp-stat-value">{formatTime(result.trainingTime)}</span>
          <span className="tp-stat-label">Training Time</span>
        </div>
        <div className="tp-stat">
          <span className="tp-stat-value">{result.totalEpochs}</span>
          <span className="tp-stat-label">Epochs</span>
        </div>
      </div>

      {result.huggingfaceUrl && (
        <a
          href={result.huggingfaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tp-completion-link"
        >
          View on HuggingFace
        </a>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TrainingPage() {
  const {
    nlpPrompt,
    setNlpPrompt,
    currentPlan,
    currentContract,
    parseTrainingIntent,
    resetPlan,
    jobs,
    activeJobId,
    setActiveJob,
    subscribeToProgress,
    unsubscribeFromProgress,
  } = useTrainingStore();

  const [flowState, setFlowState] = useState<TrainingFlowState>('landing');
  const [generationStep, setGenerationStep] = useState(0);
  const [setupStages] = useState(['Provisioning GPU', 'Loading model', 'Preparing dataset', 'Starting training']);
  const [setupStage, setSetupStage] = useState(0);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [trainingResult, setTrainingResult] = useState<{
    finalLoss?: number;
    totalCost: number;
    trainingTime: number;
    totalEpochs: number;
    modelPath?: string;
    huggingfaceUrl?: string;
  } | null>(null);
  const [freezeState, setFreezeState] = useState<{
    jobId: string;
    checkpoint: { id: string; epoch: number; loss: number };
    frozenAt: string;
    currentSpend: number;
    percentUsed: number;
    canResume: boolean;
    resumeUrl: string;
  } | null>(null);

  // Fetch recent jobs
  useEffect(() => {
    const fetchRecentJobs = async () => {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/jobs?limit=5`);
        if (response.ok) {
          const data = await response.json();
          setRecentJobs((data.jobs || data || []).slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch recent jobs:', err);
      }
    };
    fetchRecentJobs();
  }, []);

  // Simulate generation steps
  useEffect(() => {
    if (flowState === 'generating') {
      const interval = setInterval(() => {
        setGenerationStep(prev => {
          if (prev < GENERATION_STEPS.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 800);

      return () => clearInterval(interval);
    }
  }, [flowState]);

  // Watch for plan ready
  useEffect(() => {
    if (currentPlan && flowState === 'generating') {
      setFlowState('plan_review');
      setGenerationStep(0);
    }
  }, [currentPlan, flowState]);

  // Simulate setup progress
  useEffect(() => {
    if (flowState === 'setup') {
      const interval = setInterval(() => {
        setSetupStage(prev => {
          if (prev < setupStages.length) {
            setSetupLogs(logs => [...logs, `${setupStages[prev]} completed`]);
            return prev + 1;
          }
          return prev;
        });
      }, 2000);

      // Transition to training after setup
      const timeout = setTimeout(() => {
        setFlowState('training');
        if (activeJobId) {
          subscribeToProgress(activeJobId);
        }
      }, setupStages.length * 2000 + 500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [flowState, setupStages, activeJobId, subscribeToProgress]);

  // Handle example prompt click
  const handleExampleClick = useCallback((prompt: string) => {
    setNlpPrompt(prompt);
  }, [setNlpPrompt]);

  // Handle intent submit
  const handleIntentSubmit = useCallback(async () => {
    if (!nlpPrompt.trim()) return;
    setFlowState('generating');
    await parseTrainingIntent();
  }, [nlpPrompt, parseTrainingIntent]);

  // Handle plan approval
  const handlePlanApproved = useCallback(async (jobId: string) => {
    setFlowState('setup');
    setSetupStage(0);
    setSetupLogs(['Starting environment setup...']);
    setActiveJob(jobId);
  }, [setActiveJob]);

  // Handle job select from recent
  const handleJobSelect = useCallback((jobId: string) => {
    setActiveJob(jobId);
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      if (job.progress?.status === 'completed') {
        setFlowState('complete');
        if (job.result) {
          setTrainingResult({
            finalLoss: job.result.finalLoss,
            totalCost: job.result.totalCost,
            trainingTime: job.result.trainingTime,
            totalEpochs: job.result.totalEpochs,
            modelPath: job.result.modelPath,
            huggingfaceUrl: job.result.huggingfaceUrl,
          });
        }
      } else if (job.progress?.status === 'running') {
        setFlowState('training');
        subscribeToProgress(jobId);
      }
    }
  }, [jobs, setActiveJob, subscribeToProgress]);

  // Handle budget adjustment
  const handleAdjustBudget = useCallback(async (newBudget: number) => {
    if (!freezeState) return;
    try {
      await authenticatedFetch(`${API_URL}/api/training/jobs/${freezeState.jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newBudget }),
      });
      setFreezeState(null);
      setFlowState('training');
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  }, [freezeState]);

  // Handle start new training
  const handleStartNew = useCallback(() => {
    resetPlan();
    setFlowState('landing');
    unsubscribeFromProgress();
    setTrainingResult(null);
    setFreezeState(null);
  }, [resetPlan, unsubscribeFromProgress]);

  // Get active job
  const activeJob = jobs.find(j => j.id === activeJobId);

  // Render content based on flow state
  const renderContent = () => {
    switch (flowState) {
      case 'landing':
        return (
          <motion.div
            className="tp-landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="tp-hero">
              <h1 className="tp-hero-title">Train Flagship-Level AI Models</h1>
              <p className="tp-hero-subtitle">Describe what you want to train in plain English</p>
            </div>

            <div className="tp-input-section">
              <TrainingIntentInput onParseComplete={handleIntentSubmit} />
              <ExamplePrompts onClick={handleExampleClick} />
            </div>

            <CapabilityShowcase />
            <RecentJobs jobs={recentJobs} onSelect={handleJobSelect} />
          </motion.div>
        );

      case 'generating':
        return <GenerationProgress currentStep={generationStep} />;

      case 'plan_review':
        return (
          <motion.div
            className="tp-plan-review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="tp-plan-header">
              <button className="tp-back-btn" onClick={handleStartNew}>
                Back
              </button>
              <h2>Review Your Implementation Plan</h2>
            </div>
            <TrainingImplementationPlan onApproved={handlePlanApproved} />
          </motion.div>
        );

      case 'setup':
        return <SetupProgress stages={setupStages} currentStage={setupStage} logs={setupLogs} />;

      case 'training':
        return (
          <motion.div
            className="tp-training-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="tp-training-header">
              <button className="tp-back-btn" onClick={handleStartNew}>
                New Training
              </button>
              <h2>{activeJob?.name || 'Training in Progress'}</h2>
            </div>

            <div className="tp-training-content">
              {activeJob?.progress && (
                <TrainingProgressEnhanced
                  jobId={activeJobId || ''}
                  progress={{
                    jobId: activeJobId || '',
                    status: activeJob.progress.status,
                    currentEpoch: activeJob.progress.currentEpoch,
                    totalEpochs: activeJob.progress.totalEpochs,
                    currentStep: activeJob.progress.currentStep,
                    totalSteps: activeJob.progress.totalSteps,
                    loss: activeJob.progress.loss,
                    learningRate: activeJob.progress.learningRate,
                    eta: activeJob.progress.eta,
                    gpuUtilization: activeJob.progress.gpuUtilization,
                    gpuMemoryUsed: activeJob.progress.gpuMemoryUsed,
                    gpuMemoryTotal: activeJob.progress.gpuMemoryTotal,
                    logs: activeJob.progress.logs || [],
                    metrics: activeJob.progress.metrics || { loss: [], learningRate: [] },
                    cost: activeJob.progress.cost || { gpuCost: 0, platformFee: 0, totalCost: 0, creditsUsed: 0, estimatedRemaining: 0 },
                  }}
                  onPause={() => {/* pause */}}
                  onResume={() => {/* resume */}}
                  onStop={() => {/* stop */}}
                />
              )}

              {activeJobId && activeJob && currentContract && (
                <QuickTestPanel
                  baseModelId={currentContract.recommendedBaseModels[0]?.modelId || activeJob.baseModel}
                  modality={(activeJob.modality as 'llm' | 'image' | 'video' | 'audio' | 'code') || 'llm'}
                />
              )}
            </div>
          </motion.div>
        );

      case 'frozen':
        return freezeState ? (
          <BudgetFreezeOverlay
            jobId={freezeState.jobId}
            freezeState={{
              jobId: freezeState.jobId,
              checkpoint: {
                id: freezeState.checkpoint.id,
                step: 0,
                epoch: freezeState.checkpoint.epoch,
                loss: freezeState.checkpoint.loss,
                path: '',
                sizeBytes: 0,
                createdAt: new Date().toISOString(),
              },
              currentSpend: freezeState.currentSpend,
              percentUsed: freezeState.percentUsed,
              canResume: freezeState.canResume,
              resumeUrl: freezeState.resumeUrl,
              frozenAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }}
            budgetState={{
              jobId: freezeState.jobId,
              userId: '',
              currentSpend: freezeState.currentSpend,
              maxBudget: freezeState.currentSpend / (freezeState.percentUsed / 100),
              alertThreshold: 80,
              freezeThreshold: 100,
              estimatedTotalSpend: freezeState.currentSpend * 1.2,
              spendRate: 0,
              status: 'frozen',
              notificationChannels: ['in_app'],
              updatedAt: new Date().toISOString(),
            }}
            onResume={() => handleAdjustBudget(freezeState.currentSpend * 1.5)}
            onTest={() => {
              // Open testing modal
            }}
          />
        ) : null;

      case 'complete':
        return trainingResult ? (
          <motion.div
            className="tp-complete-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CompletionSummary result={trainingResult} />

            {activeJob && currentContract && (
              <div className="tp-complete-testing">
                <h3>Test Your Model</h3>
                <UniversalModelTester
                  pretrainedModelId={currentContract.recommendedBaseModels[0]?.modelId || ''}
                  finetunedModelId={trainingResult.modelPath || ''}
                  modality={(activeJob.modality as 'llm' | 'image' | 'video' | 'audio') || 'llm'}
                />
              </div>
            )}

            <div className="tp-complete-actions">
              <button className="tp-action-btn tp-action-btn--primary" onClick={handleStartNew}>
                Train Another Model
              </button>
              <a
                href={`/dashboard/training/${activeJobId}`}
                className="tp-action-btn tp-action-btn--secondary"
              >
                View Full Report
              </a>
            </div>
          </motion.div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="training-page">
      <HoverSidebar />

      <header className="tp-page-header">
        <div className="tp-page-title">
          <BrainIcon />
          <span>Flagship Training</span>
        </div>
        <div className="tp-page-actions">
          <TrainingNotificationBell />
        </div>
      </header>

      <main className="tp-main">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}

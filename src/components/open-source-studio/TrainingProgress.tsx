/**
 * Training Progress - Real-time Training Display
 * 
 * Shows live training progress, metrics, and logs.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TrainingProgress.css';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingMetrics {
  epoch: number;
  totalEpochs: number;
  step: number;
  totalSteps: number;
  loss: number;
  learningRate: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  costSoFar: number;
  gpuUtilization: number;
  memoryUsed: number;
  memoryTotal: number;
}

export type TrainingStatus = 'queued' | 'provisioning' | 'training' | 'saving' | 'completed' | 'failed' | 'stopped';

interface TrainingProgressProps {
  jobId: string;
  status: TrainingStatus;
  metrics: TrainingMetrics | null;
  logs: string[];
  onStop: () => void;
  onViewOnHub?: () => void;
  hubUrl?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// =============================================================================
// ICONS
// =============================================================================

const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingProgress({
  jobId,
  status,
  metrics,
  logs,
  onStop,
  onViewOnHub,
  hubUrl,
}: TrainingProgressProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const overallProgress = metrics
    ? ((metrics.epoch - 1 + metrics.step / metrics.totalSteps) / metrics.totalEpochs) * 100
    : 0;

  const isActive = ['queued', 'provisioning', 'training', 'saving'].includes(status);

  return (
    <div className={`training-progress training-progress--${status}`}>
      {/* Status Header */}
      <div className="training-progress-header">
        <div className="training-progress-status">
          {status === 'completed' && <CheckIcon />}
          {status === 'failed' && <ErrorIcon />}
          {isActive && <span className="training-progress-pulse" />}
          <span className="training-progress-status-text">
            {status === 'queued' && 'Queued'}
            {status === 'provisioning' && 'Provisioning GPU...'}
            {status === 'training' && 'Training in progress'}
            {status === 'saving' && 'Saving to HuggingFace...'}
            {status === 'completed' && 'Training Complete'}
            {status === 'failed' && 'Training Failed'}
            {status === 'stopped' && 'Training Stopped'}
          </span>
        </div>
        <span className="training-progress-job-id">Job: {jobId.slice(0, 8)}</span>
      </div>

      {/* Progress Bar */}
      {metrics && (
        <div className="training-progress-bar-container">
          <div className="training-progress-bar">
            <motion.div
              className="training-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="training-progress-percent">{Math.round(overallProgress)}%</span>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="training-progress-metrics">
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">Epoch</span>
            <span className="training-progress-metric-value">
              {metrics.epoch}/{metrics.totalEpochs}
            </span>
          </div>
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">Step</span>
            <span className="training-progress-metric-value">
              {metrics.step}/{metrics.totalSteps}
            </span>
          </div>
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">Loss</span>
            <motion.span
              className="training-progress-metric-value"
              key={metrics.loss}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
            >
              {metrics.loss.toFixed(4)}
            </motion.span>
          </div>
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">Learning Rate</span>
            <span className="training-progress-metric-value">
              {metrics.learningRate.toExponential(2)}
            </span>
          </div>
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">GPU Memory</span>
            <span className="training-progress-metric-value">
              {metrics.memoryUsed.toFixed(1)}/{metrics.memoryTotal}GB
            </span>
          </div>
          <div className="training-progress-metric">
            <span className="training-progress-metric-label">GPU Util</span>
            <span className="training-progress-metric-value">{metrics.gpuUtilization}%</span>
          </div>
        </div>
      )}

      {/* Time & Cost */}
      {metrics && (
        <div className="training-progress-time-cost">
          <div className="training-progress-time">
            <span>Elapsed: {formatTime(metrics.elapsedTime)}</span>
            <span>ETA: {formatTime(metrics.estimatedTimeRemaining)}</span>
          </div>
          <div className="training-progress-cost">
            <span>Cost: ${metrics.costSoFar.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Logs Toggle */}
      <button
        className="training-progress-logs-toggle"
        onClick={() => setShowLogs(!showLogs)}
      >
        {showLogs ? 'Hide Logs' : 'Show Logs'} ({logs.length})
      </button>

      {/* Logs */}
      <AnimatePresence>
        {showLogs && (
          <motion.div
            className="training-progress-logs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="training-progress-logs-content">
              {logs.map((log, i) => (
                <div key={i} className="training-progress-log-line">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="training-progress-actions">
        {isActive && (
          <motion.button
            className="training-progress-btn stop"
            onClick={onStop}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <StopIcon />
            <span>Stop Training</span>
          </motion.button>
        )}

        {status === 'completed' && hubUrl && (
          <motion.button
            className="training-progress-btn view"
            onClick={onViewOnHub}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ExternalLinkIcon />
            <span>View on HuggingFace</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}

export default TrainingProgress;

/**
 * Deployment Configuration - Inference Endpoint Settings
 * 
 * Configure and deploy trained models as serverless endpoints on RunPod.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DeploymentConfig.css';

// =============================================================================
// TYPES
// =============================================================================

export interface DeploymentOptions {
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  customEnvVars: Record<string, string>;
  volumePersistence: boolean;
  volumeSizeGB: number;
}

interface DeploymentConfigProps {
  modelId: string;
  modelName: string;
  estimatedVRAM: number;
  onDeploy: (options: DeploymentOptions) => Promise<void>;
  onCancel: () => void;
  isDeploying: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GPU_OPTIONS = [
  { id: 'nvidia-rtx-3090', name: 'RTX 3090', vram: 24, costPerHour: 0.44 },
  { id: 'nvidia-rtx-4090', name: 'RTX 4090', vram: 24, costPerHour: 0.69 },
  { id: 'nvidia-a40', name: 'A40', vram: 48, costPerHour: 0.79 },
  { id: 'nvidia-l40', name: 'L40', vram: 48, costPerHour: 0.99 },
  { id: 'nvidia-a100-40gb', name: 'A100 40GB', vram: 40, costPerHour: 1.89 },
  { id: 'nvidia-a100-80gb', name: 'A100 80GB', vram: 80, costPerHour: 2.49 },
  { id: 'nvidia-h100', name: 'H100', vram: 80, costPerHour: 3.99 },
];

const IDLE_TIMEOUT_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RocketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91-.78-.8-2.07-.81-2.91-.09zM12 15l-3-3 9-9a3 3 0 113 3l-9 9zM22 22l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GpuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 6V4M12 6V4M17 6V4M7 18v2M12 18v2M17 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 3h6M9 21h6M20 9v6M4 9v6M21 12h-6M3 12h6M15.88 11.34l4.24-4.24M3.88 16.9l4.24-4.24M8.12 11.34l-4.24-4.24M20.12 16.9l-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TimerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="14" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M12 10v4l2 2M9 2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ServerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="2" y="13" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="7" r="1" fill="currentColor" />
    <circle cx="6" cy="17" r="1" fill="currentColor" />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="deployment-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function DeploymentConfig({
  modelId: _modelId,
  modelName,
  estimatedVRAM,
  onDeploy,
  onCancel,
  isDeploying,
}: DeploymentConfigProps) {
  // modelId is passed for future use in deployment metadata
  void _modelId;
  // Recommend GPU based on VRAM requirement
  const recommendedGpu = useMemo(() => {
    return GPU_OPTIONS.find(gpu => gpu.vram >= estimatedVRAM) || GPU_OPTIONS[GPU_OPTIONS.length - 1];
  }, [estimatedVRAM]);

  const [options, setOptions] = useState<DeploymentOptions>({
    gpuType: recommendedGpu.id,
    minWorkers: 0,
    maxWorkers: 3,
    idleTimeout: 300,
    customEnvVars: {},
    volumePersistence: true,
    volumeSizeGB: 20,
  });

  const [showEnvVars, setShowEnvVars] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const selectedGpu = useMemo(() => {
    return GPU_OPTIONS.find(gpu => gpu.id === options.gpuType) || recommendedGpu;
  }, [options.gpuType, recommendedGpu]);

  // Estimate monthly cost
  const estimatedMonthlyCost = useMemo(() => {
    // Assume 20% utilization for cost estimate
    const hoursPerMonth = 730 * 0.2;
    return selectedGpu.costPerHour * hoursPerMonth * (options.minWorkers || 1);
  }, [selectedGpu, options.minWorkers]);

  const handleDeploy = useCallback(() => {
    onDeploy(options);
  }, [options, onDeploy]);

  const addEnvVar = useCallback(() => {
    if (newEnvKey && newEnvValue) {
      setOptions(prev => ({
        ...prev,
        customEnvVars: {
          ...prev.customEnvVars,
          [newEnvKey]: newEnvValue,
        },
      }));
      setNewEnvKey('');
      setNewEnvValue('');
    }
  }, [newEnvKey, newEnvValue]);

  const removeEnvVar = useCallback((key: string) => {
    setOptions(prev => {
      const { [key]: _, ...rest } = prev.customEnvVars;
      return { ...prev, customEnvVars: rest };
    });
  }, []);

  return (
    <div className="deployment-config">
      {/* Header */}
      <div className="deployment-config-header">
        <div className="deployment-config-title-group">
          <RocketIcon />
          <div>
            <h2 className="deployment-config-title">Deploy Inference Endpoint</h2>
            <p className="deployment-config-subtitle">{modelName}</p>
          </div>
        </div>
        <button className="deployment-config-close" onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      {/* Notice */}
      <div className="deployment-config-notice">
        <InfoIcon />
        <div>
          <strong>Your RunPod Account</strong>
          <p>This endpoint will be created on your RunPod account. You own it completely and pay RunPod directly.</p>
        </div>
      </div>

      {/* GPU Selection */}
      <div className="deployment-config-section">
        <h3 className="deployment-config-section-title">
          <GpuIcon />
          <span>GPU Selection</span>
        </h3>
        <div className="deployment-config-gpu-grid">
          {GPU_OPTIONS.map(gpu => (
            <button
              key={gpu.id}
              className={`deployment-config-gpu-option ${options.gpuType === gpu.id ? 'selected' : ''} ${gpu.vram < estimatedVRAM ? 'insufficient' : ''}`}
              onClick={() => setOptions(prev => ({ ...prev, gpuType: gpu.id }))}
              disabled={gpu.vram < estimatedVRAM}
            >
              <span className="deployment-config-gpu-name">{gpu.name}</span>
              <span className="deployment-config-gpu-vram">{gpu.vram}GB VRAM</span>
              <span className="deployment-config-gpu-cost">${gpu.costPerHour}/hr</span>
              {gpu.id === recommendedGpu.id && (
                <span className="deployment-config-gpu-badge">Recommended</span>
              )}
              {gpu.vram < estimatedVRAM && (
                <span className="deployment-config-gpu-warning">Insufficient VRAM</span>
              )}
              {options.gpuType === gpu.id && <CheckIcon />}
            </button>
          ))}
        </div>
      </div>

      {/* Scaling Configuration */}
      <div className="deployment-config-section">
        <h3 className="deployment-config-section-title">
          <ScaleIcon />
          <span>Auto-Scaling</span>
        </h3>
        <div className="deployment-config-scaling-grid">
          <div className="deployment-config-field">
            <label className="deployment-config-label">
              Min Workers
              <span className="deployment-config-hint" title="Minimum number of GPU workers always running (costs money even when idle)">
                <InfoIcon />
              </span>
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={options.minWorkers}
              onChange={(e) => setOptions(prev => ({ ...prev, minWorkers: parseInt(e.target.value) || 0 }))}
              className="deployment-config-input"
            />
          </div>
          <div className="deployment-config-field">
            <label className="deployment-config-label">
              Max Workers
              <span className="deployment-config-hint" title="Maximum number of workers that can be spun up under load">
                <InfoIcon />
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={options.maxWorkers}
              onChange={(e) => setOptions(prev => ({ ...prev, maxWorkers: parseInt(e.target.value) || 1 }))}
              className="deployment-config-input"
            />
          </div>
        </div>
        <p className="deployment-config-scaling-note">
          {options.minWorkers === 0 
            ? "Scale to zero when idle (no cost, but cold start delay)"
            : `${options.minWorkers} worker(s) always running (~$${(selectedGpu.costPerHour * 730 * options.minWorkers).toFixed(0)}/month)`
          }
        </p>
      </div>

      {/* Idle Timeout */}
      <div className="deployment-config-section">
        <h3 className="deployment-config-section-title">
          <TimerIcon />
          <span>Idle Timeout</span>
        </h3>
        <select
          value={options.idleTimeout}
          onChange={(e) => setOptions(prev => ({ ...prev, idleTimeout: parseInt(e.target.value) }))}
          className="deployment-config-select"
        >
          {IDLE_TIMEOUT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="deployment-config-note">
          Worker shuts down after this period of inactivity
        </p>
      </div>

      {/* Volume Persistence */}
      <div className="deployment-config-section">
        <h3 className="deployment-config-section-title">
          <ServerIcon />
          <span>Storage</span>
        </h3>
        <label className="deployment-config-checkbox">
          <input
            type="checkbox"
            checked={options.volumePersistence}
            onChange={(e) => setOptions(prev => ({ ...prev, volumePersistence: e.target.checked }))}
          />
          <span>Enable persistent volume (for model weights)</span>
        </label>
        {options.volumePersistence && (
          <div className="deployment-config-field" style={{ marginTop: '12px' }}>
            <label className="deployment-config-label">Volume Size (GB)</label>
            <input
              type="number"
              min="10"
              max="500"
              value={options.volumeSizeGB}
              onChange={(e) => setOptions(prev => ({ ...prev, volumeSizeGB: parseInt(e.target.value) || 20 }))}
              className="deployment-config-input"
            />
          </div>
        )}
      </div>

      {/* Environment Variables */}
      <div className="deployment-config-section">
        <button
          className="deployment-config-env-toggle"
          onClick={() => setShowEnvVars(!showEnvVars)}
        >
          <span>Custom Environment Variables ({Object.keys(options.customEnvVars).length})</span>
          <span>{showEnvVars ? '−' : '+'}</span>
        </button>
        
        <AnimatePresence>
          {showEnvVars && (
            <motion.div
              className="deployment-config-env-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {Object.entries(options.customEnvVars).map(([key, value]) => (
                <div key={key} className="deployment-config-env-item">
                  <span className="deployment-config-env-key">{key}</span>
                  <span className="deployment-config-env-value">{value}</span>
                  <button onClick={() => removeEnvVar(key)} className="deployment-config-env-remove">×</button>
                </div>
              ))}
              <div className="deployment-config-env-add">
                <input
                  type="text"
                  placeholder="KEY"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  className="deployment-config-env-input"
                />
                <input
                  type="text"
                  placeholder="value"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  className="deployment-config-env-input"
                />
                <button
                  onClick={addEnvVar}
                  disabled={!newEnvKey || !newEnvValue}
                  className="deployment-config-env-add-btn"
                >
                  <PlusIcon />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cost Summary */}
      <div className="deployment-config-cost-summary">
        <div className="deployment-config-cost-row">
          <span>GPU Cost</span>
          <span>${selectedGpu.costPerHour}/hr</span>
        </div>
        <div className="deployment-config-cost-row">
          <span>Est. Monthly (20% util)</span>
          <span className="deployment-config-cost-total">${estimatedMonthlyCost.toFixed(0)}/mo</span>
        </div>
        <p className="deployment-config-cost-note">
          Actual costs depend on usage. Scale to zero = pay only when used.
        </p>
      </div>

      {/* Test Window Notice */}
      <div className="deployment-config-test-notice">
        <CheckIcon />
        <span>Includes 30-minute test window</span>
      </div>

      {/* Deploy Button */}
      <motion.button
        className="deployment-config-deploy-btn"
        onClick={handleDeploy}
        disabled={isDeploying}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isDeploying ? (
          <>
            <LoadingSpinner />
            <span>Deploying...</span>
          </>
        ) : (
          <>
            <RocketIcon />
            <span>Deploy Endpoint</span>
          </>
        )}
      </motion.button>
    </div>
  );
}

export default DeploymentConfig;

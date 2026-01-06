/**
 * Training Cost Estimator - Budget & Cost Calculator
 * 
 * Real-time cost estimates for training on RunPod GPUs.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TrainingType } from './TrainingConfig';
import './TrainingCostEstimator.css';

// =============================================================================
// TYPES
// =============================================================================

interface TrainingCostEstimatorProps {
  vramRequired: number;
  epochs: number;
  trainingType: TrainingType;
  budgetLimit?: number;
}

interface GPUOption {
  name: string;
  vram: number;
  costPerHour: number;
  available: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GPU_OPTIONS: GPUOption[] = [
  { name: 'RTX 3090', vram: 24, costPerHour: 0.44, available: true },
  { name: 'RTX 4090', vram: 24, costPerHour: 0.69, available: true },
  { name: 'A40', vram: 48, costPerHour: 0.79, available: true },
  { name: 'L40', vram: 48, costPerHour: 0.99, available: true },
  { name: 'A100 40GB', vram: 40, costPerHour: 1.89, available: true },
  { name: 'A100 80GB', vram: 80, costPerHour: 2.49, available: true },
  { name: 'H100', vram: 80, costPerHour: 3.99, available: true },
];

// =============================================================================
// ICONS
// =============================================================================

const GpuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 6V4M12 6V4M17 6V4M7 18v2M12 18v2M17 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v12M8 14.5c0 1.38 1.79 2.5 4 2.5s4-1.12 4-2.5S14.21 12 12 12 8 10.88 8 9.5 9.79 7 12 7s4 1.12 4 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 9v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingCostEstimator({
  vramRequired,
  epochs,
  trainingType,
  budgetLimit = 10,
}: TrainingCostEstimatorProps) {
  // Find suitable GPU
  const recommendedGPU = useMemo(() => {
    const suitable = GPU_OPTIONS.filter(gpu => gpu.vram >= vramRequired && gpu.available);
    return suitable.length > 0 ? suitable[0] : GPU_OPTIONS[GPU_OPTIONS.length - 1];
  }, [vramRequired]);

  // Estimate training time based on model size and epochs
  const estimatedHours = useMemo(() => {
    // Rough estimate: 1-2 hours per epoch for medium models, adjusted by training type
    const baseHoursPerEpoch = vramRequired < 24 ? 0.5 : vramRequired < 48 ? 1 : 2;
    const typeMultiplier = trainingType === 'qlora' ? 0.8 : trainingType === 'lora' ? 1 : 1.5;
    return Math.ceil(epochs * baseHoursPerEpoch * typeMultiplier * 10) / 10;
  }, [epochs, vramRequired, trainingType]);

  // Calculate costs
  const estimatedCost = useMemo(() => {
    return Math.ceil(estimatedHours * recommendedGPU.costPerHour * 100) / 100;
  }, [estimatedHours, recommendedGPU.costPerHour]);

  const isWithinBudget = estimatedCost <= budgetLimit;
  const maxEpochsForBudget = useMemo(() => {
    const hoursPerEpoch = estimatedHours / epochs;
    const maxHours = budgetLimit / recommendedGPU.costPerHour;
    return Math.floor(maxHours / hoursPerEpoch);
  }, [epochs, estimatedHours, budgetLimit, recommendedGPU.costPerHour]);

  return (
    <div className="cost-estimator">
      <h3 className="cost-estimator-title">
        <DollarIcon />
        <span>Cost Estimate</span>
      </h3>

      {/* GPU Recommendation */}
      <div className="cost-estimator-gpu">
        <div className="cost-estimator-gpu-icon">
          <GpuIcon />
        </div>
        <div className="cost-estimator-gpu-info">
          <span className="cost-estimator-gpu-name">{recommendedGPU.name}</span>
          <span className="cost-estimator-gpu-spec">
            {recommendedGPU.vram}GB VRAM • ${recommendedGPU.costPerHour}/hr
          </span>
        </div>
        <div className="cost-estimator-gpu-fit">
          {vramRequired <= recommendedGPU.vram ? (
            <span className="cost-estimator-badge success">
              <CheckIcon /> Fits
            </span>
          ) : (
            <span className="cost-estimator-badge warning">
              <WarningIcon /> Tight
            </span>
          )}
        </div>
      </div>

      {/* Estimates Grid */}
      <div className="cost-estimator-grid">
        <div className="cost-estimator-item">
          <span className="cost-estimator-label">
            <ClockIcon /> Est. Time
          </span>
          <span className="cost-estimator-value">{estimatedHours} hours</span>
        </div>
        <div className="cost-estimator-item">
          <span className="cost-estimator-label">
            <DollarIcon /> Est. Cost
          </span>
          <motion.span
            className={`cost-estimator-value ${isWithinBudget ? 'within' : 'over'}`}
            key={estimatedCost}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
          >
            ${estimatedCost.toFixed(2)}
          </motion.span>
        </div>
      </div>

      {/* Budget Bar */}
      <div className="cost-estimator-budget">
        <div className="cost-estimator-budget-header">
          <span>Budget: ${budgetLimit}</span>
          <span className={isWithinBudget ? 'within' : 'over'}>
            {isWithinBudget ? `${Math.round((1 - estimatedCost / budgetLimit) * 100)}% remaining` : 'Over budget!'}
          </span>
        </div>
        <div className="cost-estimator-budget-bar">
          <motion.div
            className={`cost-estimator-budget-fill ${isWithinBudget ? 'within' : 'over'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (estimatedCost / budgetLimit) * 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Budget Warning */}
      {!isWithinBudget && (
        <motion.div
          className="cost-estimator-warning"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <WarningIcon />
          <span>
            Training will stop at budget limit. Max {maxEpochsForBudget} epochs with current budget.
          </span>
        </motion.div>
      )}

      {/* Notes */}
      <div className="cost-estimator-notes">
        <p>Estimates based on RunPod pricing. Actual costs may vary based on availability and GPU load.</p>
      </div>
    </div>
  );
}

export default TrainingCostEstimator;

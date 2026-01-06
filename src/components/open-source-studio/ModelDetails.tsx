/**
 * Model Details - Selected Model Information Panel
 * 
 * Shows detailed info, requirements, and estimated costs for selected model.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { motion } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import './ModelDetails.css';

// =============================================================================
// HELPERS
// =============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function formatSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function estimateCost(vramGB: number, hoursPerEpoch: number = 1): { perHour: number; perEpoch: number } {
  // Rough RunPod pricing estimates
  const costPerGBHour = vramGB <= 24 ? 0.03 : vramGB <= 48 ? 0.02 : 0.025;
  const perHour = vramGB * costPerGBHour;
  return {
    perHour: Math.round(perHour * 100) / 100,
    perEpoch: Math.round(perHour * hoursPerEpoch * 100) / 100,
  };
}

function getGPURecommendation(vramGB: number): string {
  if (vramGB <= 16) return 'RTX 3090/4090 (24GB)';
  if (vramGB <= 24) return 'RTX 3090/4090 (24GB)';
  if (vramGB <= 48) return 'A40/L40 (48GB)';
  if (vramGB <= 80) return 'A100-80GB';
  return 'Multi-GPU Setup Required';
}

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GpuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 6V4M12 6V4M17 6V4M7 18v2M12 18v2M17 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DollarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v12M8 14.5c0 1.38 1.79 2.5 4 2.5s4-1.12 4-2.5S14.21 12 12 12 8 10.88 8 9.5 9.79 7 12 7s4 1.12 4 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FineTuneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

interface ModelDetailsProps {
  model: ModelWithRequirements;
  onFineTune?: (model: ModelWithRequirements) => void;
}

export function ModelDetails({ model, onFineTune }: ModelDetailsProps) {
  const { selectModel, addToDock, dock, hfConnected } = useOpenSourceStudioStore();

  const isInDock = dock.some(item => item.model.modelId === model.modelId);

  // Calculate estimated size from siblings
  const estimatedSize = model.siblings
    ?.filter(f =>
      f.rfilename.endsWith('.bin') ||
      f.rfilename.endsWith('.safetensors') ||
      f.rfilename.endsWith('.pt')
    )
    .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

  const estimatedVRAM = Math.ceil((estimatedSize / (1024 * 1024 * 1024)) * 2.5);
  const costEstimate = estimateCost(estimatedVRAM);
  const gpuRecommendation = getGPURecommendation(estimatedVRAM);

  return (
    <motion.div
      className="model-details"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {/* Close Button */}
      <button
        className="model-details-close"
        onClick={() => selectModel(null)}
        aria-label="Close details"
      >
        <CloseIcon />
      </button>

      {/* Header */}
      <div className="model-details-header">
        <div className="model-details-title-group">
          <h2 className="model-details-title">{model.modelId}</h2>
          <a
            href={`https://huggingface.co/${model.modelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="model-details-link"
          >
            View on HuggingFace <ExternalLinkIcon />
          </a>
        </div>

        <div className="model-details-badges">
          {model.pipeline_tag && (
            <span className="model-details-badge task">
              {model.pipeline_tag.replace(/-/g, ' ')}
            </span>
          )}
          {model.library_name && (
            <span className="model-details-badge library">
              {model.library_name}
            </span>
          )}
          {model.cardData?.license && (
            <span className="model-details-badge license">
              {model.cardData.license}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="model-details-stats">
        <div className="model-details-stat">
          <span className="model-details-stat-value">{formatNumber(model.downloads)}</span>
          <span className="model-details-stat-label">Downloads</span>
        </div>
        <div className="model-details-stat">
          <span className="model-details-stat-value">{formatNumber(model.likes)}</span>
          <span className="model-details-stat-label">Likes</span>
        </div>
        <div className="model-details-stat">
          <span className="model-details-stat-value">{formatSize(estimatedSize)}</span>
          <span className="model-details-stat-label">Size</span>
        </div>
        <div className="model-details-stat">
          <span className="model-details-stat-value">{estimatedVRAM || '?'} GB</span>
          <span className="model-details-stat-label">Est. VRAM</span>
        </div>
      </div>

      {/* Requirements */}
      <div className="model-details-section">
        <h3 className="model-details-section-title">
          <GpuIcon />
          <span>GPU Requirements</span>
        </h3>
        <div className="model-details-requirements">
          <div className="model-details-requirement">
            <span className="model-details-requirement-label">Recommended GPU</span>
            <span className="model-details-requirement-value">{gpuRecommendation}</span>
          </div>
          <div className="model-details-requirement">
            <span className="model-details-requirement-label">Min VRAM</span>
            <span className="model-details-requirement-value">{estimatedVRAM} GB</span>
          </div>
          {model.config?.architectures && (
            <div className="model-details-requirement">
              <span className="model-details-requirement-label">Architecture</span>
              <span className="model-details-requirement-value">
                {model.config.architectures.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cost Estimates */}
      <div className="model-details-section">
        <h3 className="model-details-section-title">
          <DollarIcon />
          <span>Cost Estimates (RunPod)</span>
        </h3>
        <div className="model-details-costs">
          <div className="model-details-cost">
            <span className="model-details-cost-value">${costEstimate.perHour}/hr</span>
            <span className="model-details-cost-label">Inference</span>
          </div>
          <div className="model-details-cost">
            <span className="model-details-cost-value">${(costEstimate.perHour * 2).toFixed(2)}/hr</span>
            <span className="model-details-cost-label">Fine-tuning</span>
          </div>
          <div className="model-details-cost">
            <span className="model-details-cost-value">~${costEstimate.perEpoch * 5}</span>
            <span className="model-details-cost-label">5 Epochs (est)</span>
          </div>
        </div>
        <p className="model-details-cost-note">
          Costs are estimates based on RunPod pricing. Actual costs may vary.
        </p>
      </div>

      {/* Tags */}
      {model.tags && model.tags.length > 0 && (
        <div className="model-details-section">
          <h3 className="model-details-section-title">
            <TagIcon />
            <span>Tags</span>
          </h3>
          <div className="model-details-tags">
            {model.tags.slice(0, 10).map((tag) => (
              <span key={tag} className="model-details-tag">
                {tag}
              </span>
            ))}
            {model.tags.length > 10 && (
              <span className="model-details-tag-more">
                +{model.tags.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="model-details-actions">
        {/* Fine-Tune Button - Primary Action */}
        {hfConnected && onFineTune && (
          <motion.button
            className="model-details-btn fine-tune"
            onClick={() => onFineTune(model)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FineTuneIcon />
            Fine-Tune Model
          </motion.button>
        )}
        
        {!isInDock ? (
          <motion.button
            className="model-details-btn primary"
            onClick={() => addToDock(model)}
            disabled={dock.length >= 5}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Add to Dock
          </motion.button>
        ) : (
          <button className="model-details-btn disabled" disabled>
            Already in Dock
          </button>
        )}
        <a
          href={`https://huggingface.co/${model.modelId}/tree/main`}
          target="_blank"
          rel="noopener noreferrer"
          className="model-details-btn secondary"
        >
          View Files
        </a>
      </div>
    </motion.div>
  );
}

export default ModelDetails;

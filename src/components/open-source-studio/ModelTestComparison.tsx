/**
 * Model Test Comparison - Before vs After Testing UI
 *
 * Features:
 * - Side-by-side comparison of base vs fine-tuned model
 * - Support for text, image, video, and audio outputs
 * - Real-time generation with loading states
 * - Quality metrics and improvement indicators
 *
 * NO Lucide React icons - custom SVG icons only
 * 3D Photorealistic Liquid Glass Design System
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import './ModelTestComparison.css';

// =============================================================================
// TYPES
// =============================================================================

type OutputType = 'text' | 'image' | 'video' | 'audio';

interface TestResult {
  output: string | null;
  latencyMs: number;
  tokensUsed?: number;
  error?: string;
}

interface ComparisonMetrics {
  qualityImprovement: number;
  latencyChange: number;
  observations: string[];
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <polygon points="5,3 19,12 5,21" fill="currentColor" />
  </svg>
);

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Output Display for different types
function OutputDisplay({
  type,
  output,
  latency,
  tokens,
  error,
  label,
  isLoading,
}: {
  type: OutputType;
  output: string | null;
  latency?: number;
  tokens?: number;
  error?: string;
  label: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mtc-output mtc-output--loading">
        <div className="mtc-output-header">
          <h4>{label}</h4>
        </div>
        <div className="mtc-output-content">
          <motion.div
            className="mtc-loading-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p>Generating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mtc-output mtc-output--error">
        <div className="mtc-output-header">
          <h4>{label}</h4>
        </div>
        <div className="mtc-output-content">
          <p className="mtc-error-msg">{error}</p>
        </div>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="mtc-output mtc-output--empty">
        <div className="mtc-output-header">
          <h4>{label}</h4>
        </div>
        <div className="mtc-output-content">
          <p>Run a test to see output</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mtc-output">
      <div className="mtc-output-header">
        <h4>{label}</h4>
        <div className="mtc-output-meta">
          {latency !== undefined && (
            <span className="mtc-meta-item">
              <span className="mtc-meta-label">Time:</span>
              <span className="mtc-meta-value">{(latency / 1000).toFixed(2)}s</span>
            </span>
          )}
          {tokens !== undefined && (
            <span className="mtc-meta-item">
              <span className="mtc-meta-label">Tokens:</span>
              <span className="mtc-meta-value">{tokens}</span>
            </span>
          )}
        </div>
      </div>
      <div className="mtc-output-content">
        {type === 'text' && (
          <div className="mtc-text-output">
            {output}
          </div>
        )}
        {type === 'image' && (
          <img src={output} alt={label} className="mtc-image-output" />
        )}
        {type === 'video' && (
          <video src={output} controls className="mtc-video-output" />
        )}
        {type === 'audio' && (
          <audio src={output} controls className="mtc-audio-output" />
        )}
      </div>
    </div>
  );
}

// Metrics Display
function MetricsDisplay({ metrics }: { metrics: ComparisonMetrics | null }) {
  if (!metrics) return null;

  const qualityColor = metrics.qualityImprovement > 0 ? 'var(--mtc-green)' : 'var(--mtc-red)';
  const latencyColor = metrics.latencyChange <= 0 ? 'var(--mtc-green)' : 'var(--mtc-amber)';

  return (
    <div className="mtc-metrics">
      <h4>Improvement Analysis</h4>
      <div className="mtc-metrics-grid">
        <div className="mtc-metric">
          <div className="mtc-metric-icon" style={{ background: `${qualityColor}20`, color: qualityColor }}>
            {metrics.qualityImprovement > 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
          </div>
          <div className="mtc-metric-content">
            <span className="mtc-metric-value" style={{ color: qualityColor }}>
              {metrics.qualityImprovement > 0 ? '+' : ''}{metrics.qualityImprovement}%
            </span>
            <span className="mtc-metric-label">Quality</span>
          </div>
        </div>
        <div className="mtc-metric">
          <div className="mtc-metric-icon" style={{ background: `${latencyColor}20`, color: latencyColor }}>
            {metrics.latencyChange <= 0 ? <ArrowDownIcon /> : <ArrowUpIcon />}
          </div>
          <div className="mtc-metric-content">
            <span className="mtc-metric-value" style={{ color: latencyColor }}>
              {metrics.latencyChange <= 0 ? '' : '+'}{metrics.latencyChange}%
            </span>
            <span className="mtc-metric-label">Latency</span>
          </div>
        </div>
      </div>
      {metrics.observations.length > 0 && (
        <div className="mtc-observations">
          <h5>Observations</h5>
          <ul>
            {metrics.observations.map((obs, i) => (
              <li key={i}>
                <CheckIcon />
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ModelTestComparisonProps {
  baseModelId: string;
  fineTunedModelId: string;
  outputType: OutputType;
  onClose: () => void;
}

export function ModelTestComparison({
  baseModelId,
  fineTunedModelId,
  outputType,
  onClose,
}: ModelTestComparisonProps) {
  const [prompt, setPrompt] = useState('');
  const [imageInput, setImageInput] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [baseResult, setBaseResult] = useState<TestResult | null>(null);
  const [fineTunedResult, setFineTunedResult] = useState<TestResult | null>(null);
  const [baseLoading, setBaseLoading] = useState(false);
  const [fineTunedLoading, setFineTunedLoading] = useState(false);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageInput(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run comparison test
  const runTest = useCallback(async () => {
    if (!prompt.trim() && outputType !== 'image') return;

    setIsRunning(true);
    setBaseLoading(true);
    setFineTunedLoading(true);
    setBaseResult(null);
    setFineTunedResult(null);
    setMetrics(null);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('outputType', outputType);
    if (imageInput) {
      formData.append('image', imageInput);
    }

    try {
      // Run both tests in parallel
      const [baseResponse, fineTunedResponse] = await Promise.all([
        authenticatedFetch(`${API_URL}/api/training/test/${baseModelId}`, {
          method: 'POST',
          body: formData,
        }),
        authenticatedFetch(`${API_URL}/api/training/test/${fineTunedModelId}`, {
          method: 'POST',
          body: formData,
        }),
      ]);

      // Process base result
      if (baseResponse.ok) {
        const data = await baseResponse.json();
        setBaseResult({
          output: data.output,
          latencyMs: data.latencyMs,
          tokensUsed: data.tokensUsed,
        });
      } else {
        setBaseResult({
          output: null,
          latencyMs: 0,
          error: 'Failed to generate output',
        });
      }
      setBaseLoading(false);

      // Process fine-tuned result
      if (fineTunedResponse.ok) {
        const data = await fineTunedResponse.json();
        setFineTunedResult({
          output: data.output,
          latencyMs: data.latencyMs,
          tokensUsed: data.tokensUsed,
        });
      } else {
        setFineTunedResult({
          output: null,
          latencyMs: 0,
          error: 'Failed to generate output',
        });
      }
      setFineTunedLoading(false);

      // Calculate metrics
      if (baseResponse.ok && fineTunedResponse.ok) {
        const baseData = await baseResponse.json();
        const fineTunedData = await fineTunedResponse.json();

        setMetrics({
          qualityImprovement: Math.round((fineTunedData.qualityScore - baseData.qualityScore) / baseData.qualityScore * 100),
          latencyChange: Math.round((fineTunedData.latencyMs - baseData.latencyMs) / baseData.latencyMs * 100),
          observations: fineTunedData.observations || [],
        });
      }
    } catch (err) {
      console.error('Test error:', err);
      setBaseResult({ output: null, latencyMs: 0, error: 'Test failed' });
      setFineTunedResult({ output: null, latencyMs: 0, error: 'Test failed' });
      setBaseLoading(false);
      setFineTunedLoading(false);
    } finally {
      setIsRunning(false);
    }
  }, [prompt, imageInput, outputType, baseModelId, fineTunedModelId]);

  const needsImage = outputType === 'image' || outputType === 'video';

  return (
    <motion.div
      className="mtc-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="mtc-modal"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <div className="mtc-header">
          <div className="mtc-header-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 3h6v2H9V3z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 5v3.5L5 18c-.4.8.2 2 1.2 2h11.6c1 0 1.6-1.2 1.2-2L15 8.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Model Comparison Test</h2>
          </div>
          <button className="mtc-close-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="mtc-content">
          {/* Input Section */}
          <div className="mtc-input-section">
            <h3>Test Input</h3>
            
            <textarea
              className="mtc-prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                outputType === 'text'
                  ? 'Enter a prompt to test both models...'
                  : outputType === 'image'
                    ? 'Enter an image generation prompt...'
                    : outputType === 'video'
                      ? 'Enter a video generation prompt...'
                      : 'Enter an audio generation prompt...'
              }
              rows={3}
            />

            {needsImage && (
              <div className="mtc-image-upload">
                <label className="mtc-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                  />
                  <UploadIcon />
                  <span>{imagePreview ? 'Change Image' : 'Upload Reference Image'}</span>
                </label>
                {imagePreview && (
                  <div className="mtc-image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button onClick={() => { setImageInput(null); setImagePreview(null); }}>
                      <CloseIcon />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="mtc-run-btn"
              onClick={runTest}
              disabled={isRunning || (!prompt.trim() && !imageInput)}
            >
              {isRunning ? (
                <>
                  <motion.div
                    className="mtc-spinner"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span>Running Test...</span>
                </>
              ) : (
                <>
                  <PlayIcon />
                  <span>Run Comparison Test</span>
                </>
              )}
            </button>
          </div>

          {/* Comparison Section */}
          <div className="mtc-comparison-section">
            <div className="mtc-comparison-grid">
              <OutputDisplay
                type={outputType}
                output={baseResult?.output ?? null}
                latency={baseResult?.latencyMs}
                tokens={baseResult?.tokensUsed}
                error={baseResult?.error}
                label="Before (Base Model)"
                isLoading={baseLoading}
              />
              <div className="mtc-comparison-divider">
                <span>VS</span>
              </div>
              <OutputDisplay
                type={outputType}
                output={fineTunedResult?.output ?? null}
                latency={fineTunedResult?.latencyMs}
                tokens={fineTunedResult?.tokensUsed}
                error={fineTunedResult?.error}
                label="After (Fine-Tuned)"
                isLoading={fineTunedLoading}
              />
            </div>

            <MetricsDisplay metrics={metrics} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ModelTestComparison;

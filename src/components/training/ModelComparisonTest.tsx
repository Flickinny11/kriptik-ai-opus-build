/**
 * Model Comparison Test - Before/After Testing for Trained Models
 *
 * Deploys temporary endpoints for both original and fine-tuned models,
 * runs the same prompt through both, and displays results side-by-side.
 *
 * Features:
 * - Text generation comparison
 * - Image generation comparison
 * - Video generation comparison
 * - Audio generation comparison (with playback)
 * - Real-time cost tracking
 * - Temporary endpoint auto-cleanup
 *
 * 3D Photorealistic Liquid Glass Design - NO Lucide React icons
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import './ModelComparisonTest.css';

// =============================================================================
// TYPES
// =============================================================================

type ModelModality = 'text' | 'image' | 'video' | 'audio';

interface ComparisonResult {
  original: {
    output: string | null;
    latencyMs: number;
    error?: string;
  };
  finetuned: {
    output: string | null;
    latencyMs: number;
    error?: string;
  };
  timestamp: string;
  prompt: string;
}

interface ModelComparisonTestProps {
  trainingJobId: string;
  baseModelId: string;
  fineTunedModelPath: string;
  modality: ModelModality;
  onClose: () => void;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
  </svg>
);

const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10M3.51 15a9 9 0 0014.85 3.36L23 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ModelComparisonTest({
  trainingJobId,
  baseModelId,
  fineTunedModelPath,
  modality,
  onClose,
}: ModelComparisonTestProps) {
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const [originalEndpoint, setOriginalEndpoint] = useState<string | null>(null);
  const [fineTunedEndpoint, setFineTunedEndpoint] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioOriginalRef = useRef<HTMLAudioElement>(null);
  const audioFineTunedRef = useRef<HTMLAudioElement>(null);
  const [playingOriginal, setPlayingOriginal] = useState(false);
  const [playingFineTuned, setPlayingFineTuned] = useState(false);

  // Deploy temporary test endpoints
  const deployTestEndpoints = useCallback(async () => {
    setIsDeploying(true);
    setDeploymentStatus('deploying');
    setError(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/comparison/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingJobId,
          baseModelId,
          fineTunedModelPath,
          modality,
          testWindowMinutes: 10, // Auto-cleanup after 10 minutes
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to deploy test endpoints');
      }

      const data = await response.json();
      setOriginalEndpoint(data.originalEndpoint);
      setFineTunedEndpoint(data.fineTunedEndpoint);
      setDeploymentStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setDeploymentStatus('error');
    } finally {
      setIsDeploying(false);
    }
  }, [trainingJobId, baseModelId, fineTunedModelPath, modality]);

  // Run comparison test
  const runComparison = useCallback(async () => {
    if (!prompt.trim() || !originalEndpoint || !fineTunedEndpoint) return;

    setIsRunning(true);
    setError(null);

    try {
      const requestBody: Record<string, unknown> = { prompt };
      
      // Add image for image-to-image or video generation
      if (imageFile && (modality === 'image' || modality === 'video')) {
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
        requestBody.image = imageBase64;
      }

      const response = await authenticatedFetch(`${API_URL}/api/training/comparison/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingJobId,
          originalEndpoint,
          fineTunedEndpoint,
          modality,
          ...requestBody,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Comparison failed');
      }

      const result = await response.json();
      
      setResults(prev => [{
        original: result.original,
        finetuned: result.finetuned,
        timestamp: new Date().toISOString(),
        prompt: prompt,
      }, ...prev]);

      setTotalCost(prev => prev + (result.cost || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsRunning(false);
    }
  }, [prompt, imageFile, originalEndpoint, fineTunedEndpoint, modality, trainingJobId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Call cleanup endpoint to tear down temporary pods
      if (originalEndpoint || fineTunedEndpoint) {
        authenticatedFetch(`${API_URL}/api/training/comparison/cleanup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trainingJobId }),
        }).catch(console.error);
      }
    };
  }, [trainingJobId, originalEndpoint, fineTunedEndpoint]);

  // Audio playback handlers
  const toggleOriginalAudio = () => {
    if (audioOriginalRef.current) {
      if (playingOriginal) {
        audioOriginalRef.current.pause();
      } else {
        audioOriginalRef.current.play();
      }
      setPlayingOriginal(!playingOriginal);
    }
  };

  const toggleFineTunedAudio = () => {
    if (audioFineTunedRef.current) {
      if (playingFineTuned) {
        audioFineTunedRef.current.pause();
      } else {
        audioFineTunedRef.current.play();
      }
      setPlayingFineTuned(!playingFineTuned);
    }
  };

  // Render output based on modality
  const renderOutput = (output: string | null, type: 'original' | 'finetuned', audioRef?: React.RefObject<HTMLAudioElement>, isPlaying?: boolean, togglePlay?: () => void) => {
    if (!output) {
      return <div className="mct-output-empty">No output</div>;
    }

    switch (modality) {
      case 'text':
        return <div className="mct-output-text">{output}</div>;

      case 'image':
        return (
          <div className="mct-output-image">
            <img src={output} alt={`${type} output`} />
            <a href={output} download className="mct-download-btn">
              <DownloadIcon />
            </a>
          </div>
        );

      case 'video':
        return (
          <div className="mct-output-video">
            <video src={output} controls autoPlay={false} muted />
            <a href={output} download className="mct-download-btn">
              <DownloadIcon />
            </a>
          </div>
        );

      case 'audio':
        return (
          <div className="mct-output-audio">
            <audio ref={audioRef} src={output} onEnded={() => type === 'original' ? setPlayingOriginal(false) : setPlayingFineTuned(false)} />
            <button className="mct-play-btn" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <div className="mct-audio-waveform">
              {/* Animated waveform visualization */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="mct-waveform-bar"
                  animate={isPlaying ? {
                    height: [10, Math.random() * 30 + 10, 10],
                  } : { height: 10 }}
                  transition={{
                    duration: 0.5,
                    repeat: isPlaying ? Infinity : 0,
                    delay: i * 0.05,
                  }}
                />
              ))}
            </div>
            <a href={output} download className="mct-download-btn">
              <DownloadIcon />
            </a>
          </div>
        );

      default:
        return <div className="mct-output-text">{output}</div>;
    }
  };

  return (
    <div className="mct-overlay">
      <motion.div
        className="mct-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        {/* Glass layers */}
        <div className="mct-glass-layer mct-glass-layer--1" />
        <div className="mct-glass-layer mct-glass-layer--2" />

        {/* Header */}
        <header className="mct-header">
          <div>
            <h2>Model Comparison Test</h2>
            <p>Compare original vs fine-tuned model outputs</p>
          </div>
          <div className="mct-header-actions">
            <div className="mct-cost-badge">
              <span>Test Cost:</span>
              <strong>${totalCost.toFixed(4)}</strong>
            </div>
            <button className="mct-close-btn" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Status bar */}
        <div className="mct-status-bar">
          <div className={`mct-status-indicator mct-status-indicator--${deploymentStatus}`}>
            {deploymentStatus === 'deploying' && <div className="mct-spinner" />}
            {deploymentStatus === 'ready' && <CheckIcon />}
            <span>
              {deploymentStatus === 'idle' && 'Endpoints not deployed'}
              {deploymentStatus === 'deploying' && 'Deploying test endpoints...'}
              {deploymentStatus === 'ready' && 'Endpoints ready'}
              {deploymentStatus === 'error' && 'Deployment failed'}
            </span>
          </div>

          {deploymentStatus === 'idle' && (
            <button className="mct-deploy-btn" onClick={deployTestEndpoints} disabled={isDeploying}>
              <RefreshIcon />
              Deploy Test Endpoints
            </button>
          )}
        </div>

        {/* Input Section */}
        <div className="mct-input-section">
          <div className="mct-model-labels">
            <div className="mct-model-label mct-model-label--original">
              <span>Original</span>
              <span className="mct-model-id">{baseModelId.split('/').pop()}</span>
            </div>
            <div className="mct-vs">VS</div>
            <div className="mct-model-label mct-model-label--finetuned">
              <span>Fine-Tuned</span>
              <span className="mct-model-id">Your Model</span>
            </div>
          </div>

          <div className="mct-prompt-container">
            <textarea
              className="mct-prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                modality === 'text' ? 'Enter your prompt...' :
                modality === 'image' ? 'Describe the image you want to generate...' :
                modality === 'video' ? 'Describe the video you want to generate...' :
                'Enter text for speech synthesis...'
              }
              rows={3}
              disabled={deploymentStatus !== 'ready'}
            />

            {(modality === 'image' || modality === 'video') && (
              <div className="mct-image-upload">
                <label className="mct-upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    hidden
                  />
                  {imageFile ? (
                    <div className="mct-upload-preview">
                      <img src={URL.createObjectURL(imageFile)} alt="Input" />
                      <span>{imageFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <UploadIcon />
                      <span>Upload reference image (optional)</span>
                    </>
                  )}
                </label>
              </div>
            )}

            <button
              className="mct-run-btn"
              onClick={runComparison}
              disabled={!prompt.trim() || deploymentStatus !== 'ready' || isRunning}
            >
              {isRunning ? (
                <>
                  <div className="mct-spinner" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon />
                  Run Comparison
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mct-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Results */}
        <div className="mct-results">
          <AnimatePresence>
            {results.map((result, index) => (
              <motion.div
                key={result.timestamp}
                className="mct-result-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="mct-result-header">
                  <span className="mct-result-prompt">{result.prompt}</span>
                  <span className="mct-result-time">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="mct-result-grid">
                  {/* Original output */}
                  <div className="mct-result-column mct-result-column--original">
                    <div className="mct-result-column-header">
                      <span>Original</span>
                      <span className="mct-latency">{result.original.latencyMs}ms</span>
                    </div>
                    {result.original.error ? (
                      <div className="mct-output-error">{result.original.error}</div>
                    ) : (
                      renderOutput(
                        result.original.output,
                        'original',
                        audioOriginalRef,
                        playingOriginal,
                        toggleOriginalAudio
                      )
                    )}
                  </div>

                  {/* Fine-tuned output */}
                  <div className="mct-result-column mct-result-column--finetuned">
                    <div className="mct-result-column-header">
                      <span>Fine-Tuned</span>
                      <span className="mct-latency">{result.finetuned.latencyMs}ms</span>
                    </div>
                    {result.finetuned.error ? (
                      <div className="mct-output-error">{result.finetuned.error}</div>
                    ) : (
                      renderOutput(
                        result.finetuned.output,
                        'finetuned',
                        audioFineTunedRef,
                        playingFineTuned,
                        toggleFineTunedAudio
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {results.length === 0 && deploymentStatus === 'ready' && (
            <div className="mct-no-results">
              <ImageIcon />
              <p>Run a comparison to see results</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default ModelComparisonTest;

/**
 * Universal Model Tester - Multi-modality model testing interface
 *
 * Adapts to different model types (LLM, Image, Audio, Video, Code)
 * and provides side-by-side comparison with pretrained models.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import { TextPromptInput } from './inputs/TextPromptInput';
import { ImageInput } from './inputs/ImageInput';
import { AudioInput } from './inputs/AudioInput';
import { VideoInput } from './inputs/VideoInput';
import { CodeInput } from './inputs/CodeInput';
import { ComparisonView } from './ComparisonView';

type ModelModality = 'llm' | 'image' | 'audio' | 'video' | 'code';

interface ComparisonResult {
  id: string;
  pretrained: {
    output: unknown;
    outputUrl?: string;
    latency: number;
    cost: number;
    tokensUsed?: number;
  };
  finetuned: {
    output: unknown;
    outputUrl?: string;
    latency: number;
    cost: number;
    tokensUsed?: number;
  };
  prompt: string;
  timestamp: string;
}

interface TestSession {
  id: string;
  status: 'creating' | 'ready' | 'active' | 'expired' | 'terminated';
  expiresAt: string;
  totalCost: number;
}

interface UniversalModelTesterProps {
  pretrainedModelId: string;
  finetunedModelId: string;
  modality: ModelModality;
  onClose?: () => void;
}

export function UniversalModelTester({
  pretrainedModelId,
  finetunedModelId,
  modality,
  onClose,
}: UniversalModelTesterProps) {
  // Session state
  const [session, setSession] = useState<TestSession | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Input state
  const [textPrompt, setTextPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Config state
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [steps, setSteps] = useState(30);
  const [guidance, setGuidance] = useState(7.5);
  const [resolution, setResolution] = useState({ width: 1024, height: 1024 });
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(24);
  const [language, setLanguage] = useState('python');
  const [codeMode, setCodeMode] = useState<'completion' | 'generation' | 'explanation'>('generation');

  // Results state
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Deploy test endpoints
  const deployEndpoints = useCallback(async () => {
    setIsDeploying(true);
    setDeployError(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/test/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pretrainedModel: pretrainedModelId,
          finetunedModel: finetunedModelId,
          modality,
          expiryMinutes: 10,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to deploy test endpoints');
      }

      const data = await response.json();
      setSession(data.session);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  }, [pretrainedModelId, finetunedModelId, modality]);

  // Auto-deploy on mount
  useEffect(() => {
    deployEndpoints();
  }, [deployEndpoints]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (session?.id) {
        authenticatedFetch(`${API_URL}/api/training/test/sessions/${session.id}`, {
          method: 'DELETE',
        }).catch(console.error);
      }
    };
  }, [session?.id]);

  // Run comparison
  const runComparison = useCallback(async () => {
    if (!session || session.status !== 'ready') return;

    setIsRunning(true);
    setError(null);

    try {
      const prompt = modality === 'code' ? codeInput : textPrompt;

      const response = await authenticatedFetch(`${API_URL}/api/training/test/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pretrainedModelId,
          finetunedModelId,
          modality,
          textPrompt: prompt,
          temperature,
          maxTokens,
          steps,
          guidance,
        }),
      });

      if (!response.ok) {
        throw new Error('Comparison failed');
      }

      const data = await response.json();

      const newResult: ComparisonResult = {
        id: data.result.id,
        pretrained: data.original,
        finetuned: data.finetuned,
        prompt,
        timestamp: new Date().toISOString(),
      };

      setResults(prev => [newResult, ...prev]);
      setTotalCost(prev => prev + (data.cost || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsRunning(false);
    }
  }, [
    session, modality, codeInput, textPrompt, pretrainedModelId,
    finetunedModelId, temperature, maxTokens, steps, guidance,
  ]);

  // Handle preference feedback
  const handlePreference = async (
    resultId: string,
    preference: 'pretrained' | 'finetuned' | 'equal'
  ) => {
    // Would send preference to backend for DPO data collection
    console.log(`Preference for ${resultId}: ${preference}`);
  };

  // Extend session
  const extendSession = async () => {
    if (!session?.id) return;

    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/training/test/sessions/${session.id}/extend`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes: 10 }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
      }
    } catch {
      console.error('Failed to extend session');
    }
  };

  // Render input based on modality
  const renderInput = () => {
    switch (modality) {
      case 'llm':
        return (
          <TextPromptInput
            value={textPrompt}
            onChange={setTextPrompt}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            maxTokens={maxTokens}
            onMaxTokensChange={setMaxTokens}
            onSubmit={runComparison}
            isLoading={isRunning}
            placeholder="Enter your prompt to compare models..."
          />
        );

      case 'code':
        return (
          <CodeInput
            value={codeInput}
            onChange={setCodeInput}
            language={language}
            onLanguageChange={setLanguage}
            mode={codeMode}
            onModeChange={setCodeMode}
            maxTokens={maxTokens}
            onMaxTokensChange={setMaxTokens}
            onSubmit={runComparison}
            isLoading={isRunning}
          />
        );

      case 'image':
        return (
          <ImageInput
            prompt={textPrompt}
            onPromptChange={setTextPrompt}
            image={imageFile}
            onImageChange={setImageFile}
            steps={steps}
            onStepsChange={setSteps}
            guidance={guidance}
            onGuidanceChange={setGuidance}
            resolution={resolution}
            onResolutionChange={setResolution}
            onSubmit={runComparison}
            isLoading={isRunning}
          />
        );

      case 'audio':
        return (
          <AudioInput
            prompt={textPrompt}
            onPromptChange={setTextPrompt}
            referenceAudio={audioFile}
            onReferenceAudioChange={setAudioFile}
            duration={duration}
            onDurationChange={setDuration}
            onSubmit={runComparison}
            isLoading={isRunning}
          />
        );

      case 'video':
        return (
          <VideoInput
            prompt={textPrompt}
            onPromptChange={setTextPrompt}
            referenceVideo={videoFile}
            onReferenceVideoChange={setVideoFile}
            duration={duration}
            onDurationChange={setDuration}
            fps={fps}
            onFpsChange={setFps}
            resolution={resolution}
            onResolutionChange={setResolution}
            onSubmit={runComparison}
            isLoading={isRunning}
          />
        );

      default:
        return null;
    }
  };

  const modalityLabels: Record<ModelModality, string> = {
    llm: 'Text Generation',
    code: 'Code Generation',
    image: 'Image Generation',
    audio: 'Audio Generation',
    video: 'Video Generation',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl"
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800/95 via-stone-900/95 to-stone-950/95" />
        <div className="absolute inset-0 backdrop-blur-xl" />
        <div className="absolute inset-0 border border-white/10 rounded-2xl" />

        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-white">Model Comparison Test</h2>
              <p className="text-sm text-white/60">
                {modalityLabels[modality]} - Compare original vs fine-tuned
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    session.status === 'ready' ? 'bg-green-500' :
                    session.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500'
                  }`} />
                  <span className="text-white/60">
                    {session.status === 'ready' ? 'Ready' : session.status}
                  </span>
                  <button
                    onClick={extendSession}
                    className="ml-2 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Extend
                  </button>
                </div>
              )}
              <div className="px-3 py-1 rounded-lg bg-white/10 text-sm">
                <span className="text-white/60">Cost: </span>
                <span className="text-white font-medium">${totalCost.toFixed(4)}</span>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-hidden grid grid-cols-5 gap-6 p-6">
            {/* Input Panel */}
            <div className="col-span-2 space-y-4 overflow-y-auto">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-sm font-medium text-white/80 mb-4">Model Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/40">Original:</span>
                    <span className="text-white/80 truncate ml-2">
                      {pretrainedModelId.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Fine-tuned:</span>
                    <span className="text-cyan-400 truncate ml-2">Your Model</span>
                  </div>
                </div>
              </div>

              {/* Deployment Status */}
              {!session && (
                <div className="p-6 text-center">
                  {isDeploying ? (
                    <div className="space-y-3">
                      <div className="w-8 h-8 mx-auto border-2 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
                      <p className="text-white/60">Deploying test endpoints...</p>
                    </div>
                  ) : deployError ? (
                    <div className="space-y-3">
                      <p className="text-red-400">{deployError}</p>
                      <button
                        onClick={deployEndpoints}
                        className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Input Form */}
              {session?.status === 'ready' && renderInput()}

              {/* Error Display */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 text-red-300 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Results Panel */}
            <div className="col-span-3 overflow-y-auto space-y-6">
              <AnimatePresence>
                {results.length === 0 && session?.status === 'ready' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full text-white/40"
                  >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <p className="mt-4 text-center">
                      Run a comparison to see side-by-side results
                    </p>
                  </motion.div>
                )}

                {results.map((result) => (
                  <ComparisonView
                    key={result.id}
                    result={result}
                    modality={modality}
                    pretrainedLabel={pretrainedModelId.split('/').pop() || 'Original'}
                    finetunedLabel="Fine-Tuned"
                    onPreferenceSelect={(pref) => handlePreference(result.id, pref)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default UniversalModelTester;

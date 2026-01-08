/**
 * Training Config - Configure hyperparameters and training settings
 *
 * Dynamic configuration based on modality, GPU recommendations,
 * and advanced options.
 */

import { useState } from 'react';
import { Cpu, Zap, Timer, Settings, ChevronDown, ChevronUp, Sparkles, HardDrive, AlertCircle } from 'lucide-react';
import type { ModelModality, TrainingMethod } from '@/store/useTrainingStore';
import type { GPURecommendation } from './types';

interface TrainingConfigProps {
  modality: ModelModality;
  method: TrainingMethod;
  config: TrainingConfigValues;
  gpuRecommendation?: GPURecommendation;
  onChange: (config: TrainingConfigValues) => void;
}

export interface TrainingConfigValues {
  epochs: number;
  batchSize: number;
  learningRate: number;
  warmupSteps: number;
  maxSteps?: number;
  gradientAccumulation: number;
  gradientCheckpointing: boolean;
  fp16: boolean;
  bf16: boolean;

  // LoRA specific
  loraR?: number;
  loraAlpha?: number;
  loraDropout?: number;
  targetModules?: string[];

  // LLM specific
  maxSeqLength?: number;
  useUnsloth?: boolean;
  quantization?: '4bit' | '8bit' | 'none';

  // Scheduler
  scheduler: 'cosine' | 'linear' | 'constant' | 'constant_with_warmup';

  // Output
  hubPrivate: boolean;
  pushToHub: boolean;
  hubModelId?: string;

  // GPU
  gpuType?: string;
  gpuCount: number;
}

const DEFAULT_CONFIGS: Record<ModelModality, Partial<TrainingConfigValues>> = {
  llm: {
    epochs: 3,
    batchSize: 4,
    learningRate: 2e-4,
    warmupSteps: 100,
    gradientAccumulation: 4,
    gradientCheckpointing: true,
    fp16: false,
    bf16: true,
    loraR: 16,
    loraAlpha: 32,
    loraDropout: 0.05,
    maxSeqLength: 2048,
    useUnsloth: true,
    quantization: '4bit',
    scheduler: 'cosine',
    hubPrivate: true,
    pushToHub: true,
    gpuCount: 1,
  },
  image: {
    epochs: 100,
    batchSize: 1,
    learningRate: 1e-4,
    warmupSteps: 500,
    gradientAccumulation: 4,
    gradientCheckpointing: true,
    fp16: true,
    bf16: false,
    loraR: 4,
    loraAlpha: 4,
    scheduler: 'constant_with_warmup',
    hubPrivate: true,
    pushToHub: true,
    gpuCount: 1,
  },
  video: {
    epochs: 50,
    batchSize: 1,
    learningRate: 5e-5,
    warmupSteps: 200,
    gradientAccumulation: 8,
    gradientCheckpointing: true,
    fp16: true,
    bf16: false,
    loraR: 8,
    loraAlpha: 16,
    scheduler: 'cosine',
    hubPrivate: true,
    pushToHub: true,
    gpuCount: 1,
  },
  audio: {
    epochs: 200,
    batchSize: 8,
    learningRate: 1e-5,
    warmupSteps: 500,
    gradientAccumulation: 2,
    gradientCheckpointing: false,
    fp16: true,
    bf16: false,
    scheduler: 'cosine',
    hubPrivate: true,
    pushToHub: true,
    gpuCount: 1,
  },
  multimodal: {
    epochs: 10,
    batchSize: 2,
    learningRate: 1e-4,
    warmupSteps: 200,
    gradientAccumulation: 4,
    gradientCheckpointing: true,
    fp16: false,
    bf16: true,
    loraR: 16,
    loraAlpha: 32,
    scheduler: 'cosine',
    hubPrivate: true,
    pushToHub: true,
    gpuCount: 1,
  },
};

const GPU_OPTIONS = [
  { id: 'RTX_4090', name: 'RTX 4090', vram: '24GB', price: 0.74 },
  { id: 'A100_40GB', name: 'A100 40GB', vram: '40GB', price: 1.89 },
  { id: 'A100_80GB', name: 'A100 80GB', vram: '80GB', price: 2.89 },
  { id: 'H100_80GB', name: 'H100 80GB', vram: '80GB', price: 3.89 },
  { id: 'A6000', name: 'RTX A6000', vram: '48GB', price: 0.79 },
  { id: 'L40S', name: 'L40S', vram: '48GB', price: 1.29 },
];

export function TrainingConfig({ modality, method, config, gpuRecommendation, onChange }: TrainingConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleChange = (field: keyof TrainingConfigValues, value: unknown) => {
    onChange({ ...config, [field]: value });
  };

  const isLoRAMethod = method === 'lora' || method === 'qlora';

  return (
    <div className="space-y-6">
      {/* GPU Recommendation Banner */}
      {gpuRecommendation && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">
                Recommended: {gpuRecommendation.gpuType}
              </h4>
              <p className="text-xs text-white/60">
                Estimated {gpuRecommendation.vramRequired}GB VRAM needed •
                ~${gpuRecommendation.estimatedCost.toFixed(2)}/hr •
                {gpuRecommendation.estimatedTime} estimated
              </p>
            </div>
            <button
              onClick={() => handleChange('gpuType', gpuRecommendation.gpuType)}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Basic Training Parameters */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            <Timer className="w-4 h-4 inline-block mr-2 opacity-60" />
            Epochs
          </label>
          <input
            type="number"
            value={config.epochs}
            onChange={(e) => handleChange('epochs', parseInt(e.target.value) || 1)}
            min={1}
            max={1000}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            <Zap className="w-4 h-4 inline-block mr-2 opacity-60" />
            Batch Size
          </label>
          <input
            type="number"
            value={config.batchSize}
            onChange={(e) => handleChange('batchSize', parseInt(e.target.value) || 1)}
            min={1}
            max={128}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Learning Rate
          </label>
          <select
            value={config.learningRate}
            onChange={(e) => handleChange('learningRate', parseFloat(e.target.value))}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value={1e-5}>1e-5 (Very Low)</option>
            <option value={2e-5}>2e-5 (Low)</option>
            <option value={5e-5}>5e-5</option>
            <option value={1e-4}>1e-4 (Medium)</option>
            <option value={2e-4}>2e-4 (Default)</option>
            <option value={5e-4}>5e-4</option>
            <option value={1e-3}>1e-3 (High)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Scheduler
          </label>
          <select
            value={config.scheduler}
            onChange={(e) => handleChange('scheduler', e.target.value as TrainingConfigValues['scheduler'])}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="cosine">Cosine</option>
            <option value="linear">Linear</option>
            <option value="constant">Constant</option>
            <option value="constant_with_warmup">Constant with Warmup</option>
          </select>
        </div>
      </div>

      {/* GPU Selection */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          <Cpu className="w-4 h-4 inline-block mr-2 opacity-60" />
          GPU Selection
        </label>
        <div className="grid grid-cols-3 gap-3">
          {GPU_OPTIONS.map((gpu) => {
            const isRecommended = gpuRecommendation?.gpuType === gpu.id;
            const isSelected = config.gpuType === gpu.id;
            return (
              <button
                key={gpu.id}
                onClick={() => handleChange('gpuType', gpu.id)}
                className={`relative p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-blue-500 text-[10px] font-medium text-white rounded">
                    REC
                  </span>
                )}
                <div className="text-sm font-medium text-white">{gpu.name}</div>
                <div className="text-xs text-white/40">{gpu.vram}</div>
                <div className="text-xs text-green-400">${gpu.price}/hr</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* LoRA Configuration */}
      {isLoRAMethod && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 opacity-60" />
            LoRA Configuration
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Rank (r)</label>
              <select
                value={config.loraR || 16}
                onChange={(e) => handleChange('loraR', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value={4}>4 (Small)</option>
                <option value={8}>8</option>
                <option value={16}>16 (Default)</option>
                <option value={32}>32</option>
                <option value={64}>64 (Large)</option>
                <option value={128}>128</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Alpha</label>
              <select
                value={config.loraAlpha || 32}
                onChange={(e) => handleChange('loraAlpha', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32 (Default)</option>
                <option value={64}>64</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Dropout</label>
              <select
                value={config.loraDropout || 0.05}
                onChange={(e) => handleChange('loraDropout', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value={0}>0</option>
                <option value={0.05}>0.05 (Default)</option>
                <option value={0.1}>0.1</option>
                <option value={0.2}>0.2</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* LLM-specific options */}
      {modality === 'llm' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Max Sequence Length
            </label>
            <select
              value={config.maxSeqLength || 2048}
              onChange={(e) => handleChange('maxSeqLength', parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048 (Default)</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Quantization
            </label>
            <select
              value={config.quantization || '4bit'}
              onChange={(e) => handleChange('quantization', e.target.value as '4bit' | '8bit' | 'none')}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="4bit">4-bit (QLoRA)</option>
              <option value="8bit">8-bit</option>
              <option value="none">None (Full Precision)</option>
            </select>
          </div>
        </div>
      )}

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
          <span className="text-sm text-white">Use Unsloth (2x faster)</span>
          <input
            type="checkbox"
            checked={config.useUnsloth || false}
            onChange={(e) => handleChange('useUnsloth', e.target.checked)}
            className="w-5 h-5 rounded accent-blue-500"
          />
        </label>
        <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
          <span className="text-sm text-white">Gradient Checkpointing</span>
          <input
            type="checkbox"
            checked={config.gradientCheckpointing}
            onChange={(e) => handleChange('gradientCheckpointing', e.target.checked)}
            className="w-5 h-5 rounded accent-blue-500"
          />
        </label>
        <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
          <span className="text-sm text-white">FP16 Mixed Precision</span>
          <input
            type="checkbox"
            checked={config.fp16}
            onChange={(e) => handleChange('fp16', e.target.checked)}
            className="w-5 h-5 rounded accent-blue-500"
          />
        </label>
        <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
          <span className="text-sm text-white">BF16 (Better for LLMs)</span>
          <input
            type="checkbox"
            checked={config.bf16}
            onChange={(e) => handleChange('bf16', e.target.checked)}
            className="w-5 h-5 rounded accent-blue-500"
          />
        </label>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Warmup Steps</label>
                <input
                  type="number"
                  value={config.warmupSteps}
                  onChange={(e) => handleChange('warmupSteps', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Max Steps (0 = unlimited)</label>
                <input
                  type="number"
                  value={config.maxSteps || 0}
                  onChange={(e) => handleChange('maxSteps', parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Gradient Accumulation</label>
                <input
                  type="number"
                  value={config.gradientAccumulation}
                  onChange={(e) => handleChange('gradientAccumulation', parseInt(e.target.value) || 1)}
                  min={1}
                  max={64}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">GPU Count</label>
                <select
                  value={config.gpuCount}
                  onChange={(e) => handleChange('gpuCount', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value={1}>1 GPU</option>
                  <option value={2}>2 GPUs</option>
                  <option value={4}>4 GPUs</option>
                  <option value={8}>8 GPUs</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HuggingFace Publishing */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
        <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 opacity-60" />
          Model Output
        </h4>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-white">Push to HuggingFace Hub</span>
            <input
              type="checkbox"
              checked={config.pushToHub}
              onChange={(e) => handleChange('pushToHub', e.target.checked)}
              className="w-5 h-5 rounded accent-blue-500"
            />
          </label>
          {config.pushToHub && (
            <>
              <div>
                <label className="block text-xs text-white/60 mb-1">Model ID (username/model-name)</label>
                <input
                  type="text"
                  value={config.hubModelId || ''}
                  onChange={(e) => handleChange('hubModelId', e.target.value)}
                  placeholder="username/my-model"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-white/30"
                />
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white">Private Repository</span>
                <input
                  type="checkbox"
                  checked={config.hubPrivate}
                  onChange={(e) => handleChange('hubPrivate', e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-500"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* VRAM Warning */}
      {gpuRecommendation && config.gpuType && (
        <VRAMWarning
          selectedGpu={config.gpuType}
          requiredVram={gpuRecommendation.vramRequired}
        />
      )}
    </div>
  );
}

function VRAMWarning({ selectedGpu, requiredVram }: { selectedGpu: string; requiredVram: number }) {
  const gpu = GPU_OPTIONS.find((g) => g.id === selectedGpu);
  if (!gpu) return null;

  const availableVram = parseInt(gpu.vram);
  const isInsufficient = requiredVram > availableVram;

  if (!isInsufficient) return null;

  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-yellow-400">
            Insufficient VRAM
          </h4>
          <p className="text-xs text-white/60 mt-1">
            {requiredVram}GB VRAM required, but {gpu.name} only has {gpu.vram}.
            Consider reducing batch size, enabling gradient checkpointing,
            or selecting a GPU with more VRAM.
          </p>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_CONFIGS };

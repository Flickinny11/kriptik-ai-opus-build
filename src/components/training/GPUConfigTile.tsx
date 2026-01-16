/**
 * GPU Configuration Tile - GPU Selection and Provider
 *
 * Visual GPU selection with VRAM, speed, and cost information.
 */

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ImplementationTile } from '@/store/useTrainingStore';

interface GPUConfigTileProps {
  tile: ImplementationTile;
  onModify: (modification: { type: string; value?: string }) => void;
  isLoading?: boolean;
}

interface GPUOption {
  id: string;
  name: string;
  vram: number;
  speed: string;
  costPerHour: number;
  recommended?: boolean;
}

type ProviderType = 'runpod' | 'modal';

const GPU_OPTIONS: GPUOption[] = [
  { id: 'rtx4090', name: 'RTX 4090', vram: 24, speed: 'Fast', costPerHour: 0.74, recommended: false },
  { id: 'a100-40gb', name: 'A100 40GB', vram: 40, speed: 'Very Fast', costPerHour: 1.89, recommended: false },
  { id: 'a100-80gb', name: 'A100 80GB', vram: 80, speed: 'Very Fast', costPerHour: 2.49, recommended: true },
  { id: 'h100-80gb', name: 'H100 80GB', vram: 80, speed: 'Fastest', costPerHour: 3.99, recommended: false },
  { id: 'h100-nvl', name: 'H100 NVL', vram: 94, speed: 'Fastest', costPerHour: 6.84, recommended: false },
];

const PROVIDERS: ProviderType[] = ['runpod', 'modal'];

export function GPUConfigTile({ tile, onModify, isLoading }: GPUConfigTileProps): ReactNode {
  const [provider, setProvider] = useState<ProviderType>('runpod');
  
  const metadata = tile.metadata || {};
  const currentGpu = tile.userSelection || tile.recommendation || 'A100 80GB x1';
  const gpuCount = Number(metadata.gpuCount) || 1;
  const minVram = Number(metadata.minVram) || 24;
  const requiresNvlink = Boolean(metadata.requiresNvlink);

  const handleGpuSelect = (gpu: GPUOption) => {
    const value = `${gpu.name} x${gpuCount}`;
    onModify({ type: 'select_alternative', value });
  };

  const filteredGpus = GPU_OPTIONS.filter(gpu => gpu.vram >= minVram);

  const renderProviderButtons = (): ReactNode => {
    return PROVIDERS.map((p) => (
      <button
        key={p}
        type="button"
        onClick={() => setProvider(p)}
        className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
          provider === p
            ? 'bg-white/10 text-white border border-white/20'
            : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10'
        }`}
      >
        {p === 'runpod' ? 'RunPod' : 'Modal'}
      </button>
    ));
  };

  const renderGpuOptions = (): ReactNode => {
    return filteredGpus.map((gpu) => {
      const isSelected = currentGpu.toLowerCase().includes(gpu.name.toLowerCase());
      return (
        <motion.button
          key={gpu.id}
          type="button"
          onClick={() => handleGpuSelect(gpu)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={isLoading}
          className={`w-full p-3 rounded-xl transition-all duration-200 ${
            isSelected
              ? 'bg-violet-500/20 border border-violet-500/40 ring-1 ring-violet-500/30'
              : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-violet-500/30' : 'bg-white/10'}`}>
                <svg className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-white/80'}`}>{gpu.name}</p>
                  {gpu.recommended && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/20 text-cyan-400">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40">{gpu.vram}GB VRAM - {gpu.speed}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${isSelected ? 'text-violet-400' : 'text-white/70'}`}>
                ${gpu.costPerHour}/hr
              </p>
            </div>
          </div>
        </motion.button>
      );
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />

      <div className="relative p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">GPU Configuration</h3>
            <p className="text-xs text-white/50">Select compute resources</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Selected Configuration</p>
              <p className="text-lg font-semibold text-white">{currentGpu}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Provider</p>
              <p className="text-sm font-medium text-white capitalize">{provider}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {renderProviderButtons()}
        </div>

        <div className="space-y-2">
          {renderGpuOptions()}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">GPU Count</p>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                    gpuCount === count
                      ? 'bg-violet-500/30 text-violet-400 border border-violet-500/30'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>

        {requiresNvlink && (
          <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400">Requires NVLink for multi-GPU training</p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            className="w-6 h-6 border-2 border-white/20 border-t-violet-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default GPUConfigTile;

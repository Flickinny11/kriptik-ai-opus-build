/**
 * Data Source Tile - Training Data Configuration
 *
 * Specialized tile for data source selection with upload and dataset search.
 */

import { useState, useRef, type DragEvent, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImplementationTile } from '@/store/useTrainingStore';

interface DataSourceTileProps {
  tile: ImplementationTile;
  onModify: (modification: { type: string; value?: string }) => void;
  isLoading?: boolean;
}

type SourceType = 'upload' | 'huggingface' | 'hybrid';

interface SourceButton {
  key: SourceType;
  label: string;
  description: string;
}

export function DataSourceTile({ tile, onModify, isLoading }: DataSourceTileProps): ReactNode {
  const [activeSource, setActiveSource] = useState<SourceType>(
    (tile.userSelection || tile.recommendation) as SourceType || 'hybrid'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metadata = tile.metadata || {};
  const dataType = String(metadata.dataType || 'text');
  const minSamples = Number(metadata.minSamples) || 1000;
  const recommendedSamples = Number(metadata.recommendedSamples) || 10000;
  const qualityRequirements = metadata.qualityRequirements as string[] | undefined;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSourceChange = (source: SourceType) => {
    setActiveSource(source);
    onModify({ type: 'select_alternative', value: source === 'upload' ? 'user_upload' : source });
  };

  const sourceButtons: SourceButton[] = [
    { key: 'upload', label: 'Upload', description: 'Your own data' },
    { key: 'huggingface', label: 'HuggingFace', description: 'Public datasets' },
    { key: 'hybrid', label: 'Hybrid', description: 'Best of both' },
  ];

  const renderSourceButtons = (): ReactNode => {
    return sourceButtons.map((btn) => (
      <button
        key={btn.key}
        type="button"
        onClick={() => handleSourceChange(btn.key)}
        className={`flex-1 p-3 rounded-xl text-center transition-all duration-200 ${
          activeSource === btn.key
            ? 'bg-cyan-500/20 border border-cyan-500/30 ring-1 ring-cyan-500/30'
            : 'bg-white/5 border border-white/5 hover:bg-white/10'
        }`}
      >
        <p className={`text-sm font-medium ${activeSource === btn.key ? 'text-cyan-400' : 'text-white'}`}>
          {btn.label}
        </p>
        <p className="text-[10px] text-white/40">{btn.description}</p>
      </button>
    ));
  };

  const renderQualityRequirements = (): ReactNode => {
    if (!qualityRequirements || !Array.isArray(qualityRequirements)) {
      return null;
    }
    return (
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-white/40 mb-2">Quality Requirements</p>
        <div className="flex flex-wrap gap-1">
          {qualityRequirements.slice(0, 4).map((req: string, idx: number) => (
            <span key={idx} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/60">
              {req}
            </span>
          ))}
        </div>
      </div>
    );
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Training Data</h3>
            <p className="text-xs text-white/50">Configure your data source</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-center">
            <p className="text-[10px] text-white/40">Type</p>
            <p className="text-xs font-medium text-white capitalize">{dataType}</p>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-center">
            <p className="text-[10px] text-white/40">Minimum</p>
            <p className="text-xs font-medium text-white">{minSamples.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-center">
            <p className="text-[10px] text-white/40">Recommended</p>
            <p className="text-xs font-medium text-white">{recommendedSamples.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {renderSourceButtons()}
        </div>

        <AnimatePresence mode="wait">
          {(activeSource === 'upload' || activeSource === 'hybrid') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,.jsonl,.csv,.parquet,.txt"
                  className="hidden"
                />
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-white/70">Drop files here or click to upload</p>
                  <p className="text-xs text-white/40 mt-1">JSON, JSONL, CSV, Parquet, or TXT</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {(activeSource === 'huggingface' || activeSource === 'hybrid') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search HuggingFace datasets..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {renderQualityRequirements()}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            className="w-6 h-6 border-2 border-white/20 border-t-cyan-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default DataSourceTile;

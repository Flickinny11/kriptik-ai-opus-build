/**
 * Model Selector - Search and select base models from HuggingFace
 * 
 * Allows users to search for models by task type, view details,
 * and select for fine-tuning.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, Download, Check, ExternalLink, Loader2, Filter, X } from 'lucide-react';
import { useTrainingStore, type ModelModality, type TrainingMethod, type ModelInfo } from '@/store/useTrainingStore';

interface ModelSelectorProps {
  modality: ModelModality;
  method?: TrainingMethod;
  selectedModel?: ModelInfo;
  onSelect: (model: ModelInfo) => void;
  onSearch?: (query: string) => void;
}

const POPULAR_MODELS: Record<ModelModality, ModelInfo[]> = {
  llm: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', author: 'meta-llama', downloads: 1500000, likes: 5000, tags: ['text-generation', 'llama'], modelSize: '70B', license: 'llama3.3' },
    { id: 'Qwen/Qwen3-32B', name: 'Qwen3 32B', author: 'Qwen', downloads: 800000, likes: 3000, tags: ['text-generation', 'multilingual'], modelSize: '32B', license: 'apache-2.0' },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct v0.3', author: 'mistralai', downloads: 2000000, likes: 6000, tags: ['text-generation', 'instruct'], modelSize: '7B', license: 'apache-2.0' },
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', author: 'deepseek-ai', downloads: 500000, likes: 2000, tags: ['text-generation', 'reasoning'], modelSize: '685B MoE', license: 'mit' },
  ],
  image: [
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', author: 'stabilityai', downloads: 5000000, likes: 15000, tags: ['text-to-image', 'diffusion'], modelSize: '6.9B', license: 'openrail++' },
    { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1 Dev', author: 'black-forest-labs', downloads: 2000000, likes: 8000, tags: ['text-to-image', 'flux'], modelSize: '12B', license: 'apache-2.0' },
    { id: 'stabilityai/stable-diffusion-3.5-large', name: 'SD 3.5 Large', author: 'stabilityai', downloads: 1000000, likes: 5000, tags: ['text-to-image', 'sd3'], modelSize: '8B', license: 'openrail++' },
  ],
  video: [
    { id: 'Wan-AI/Wan2.1-T2V-14B', name: 'Wan 2.1 T2V 14B', author: 'Wan-AI', downloads: 300000, likes: 2000, tags: ['text-to-video'], modelSize: '14B', license: 'apache-2.0' },
    { id: 'tencent/HunyuanVideo', name: 'HunyuanVideo', author: 'tencent', downloads: 200000, likes: 1500, tags: ['text-to-video'], modelSize: '13B', license: 'mit' },
    { id: 'hpcai-tech/Open-Sora', name: 'Open-Sora 2.0', author: 'hpcai-tech', downloads: 150000, likes: 1000, tags: ['text-to-video'], modelSize: '8B', license: 'apache-2.0' },
  ],
  audio: [
    { id: 'coqui/XTTS-v2', name: 'XTTS v2', author: 'coqui', downloads: 500000, likes: 3000, tags: ['text-to-speech', 'voice-clone'], modelSize: '1.6B', license: 'coqui-public' },
    { id: 'collabora/WhisperSpeech', name: 'WhisperSpeech', author: 'collabora', downloads: 200000, likes: 1500, tags: ['text-to-speech'], modelSize: '900M', license: 'mit' },
    { id: 'suno/bark', name: 'Bark', author: 'suno', downloads: 400000, likes: 2500, tags: ['text-to-speech', 'expressive'], modelSize: '1.1B', license: 'mit' },
    { id: 'facebook/musicgen-large', name: 'MusicGen Large', author: 'facebook', downloads: 300000, likes: 2000, tags: ['music-generation'], modelSize: '3.3B', license: 'cc-by-nc' },
  ],
  multimodal: [
    { id: 'llava-hf/llava-v1.6-34b-hf', name: 'LLaVA 1.6 34B', author: 'llava-hf', downloads: 100000, likes: 800, tags: ['multimodal', 'vision-language'], modelSize: '34B', license: 'apache-2.0' },
  ],
};

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function ModelSelector({ modality, method: _method, selectedModel, onSelect, onSearch }: ModelSelectorProps) {
  void _method; // May be used for filtering in future
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [licenseFilter, setLicenseFilter] = useState<string | null>(null);
  
  const { modelSearchResults, isSearching } = useTrainingStore();
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedSearch && onSearch) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch]);

  const displayModels = searchQuery
    ? modelSearchResults
    : POPULAR_MODELS[modality] || [];

  const filteredModels = licenseFilter
    ? displayModels.filter((m) => m.license?.toLowerCase().includes(licenseFilter.toLowerCase()))
    : displayModels;

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white mb-2">Select Base Model</h3>
        <p className="text-sm text-white/60">
          Choose a pre-trained model to fine-tune for your use case
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${modality} models on HuggingFace...`}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
            >
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            showFilters || licenseFilter
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <label className="text-sm font-medium text-white/80 mb-2 block">License</label>
              <div className="flex flex-wrap gap-2">
                {['apache-2.0', 'mit', 'openrail++', 'llama'].map((license) => (
                  <button
                    key={license}
                    onClick={() => setLicenseFilter(licenseFilter === license ? null : license)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      licenseFilter === license
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {license}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-white/60">Searching HuggingFace...</span>
        </div>
      )}

      {/* Model grid */}
      {!isSearching && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
          {filteredModels.map((model) => {
            const isSelected = selectedModel?.id === model.id;
            return (
              <motion.button
                key={model.id}
                onClick={() => onSelect(model)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{model.name}</h4>
                    <p className="text-xs text-white/40">{model.author}</p>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center ml-2">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-white/60 mb-3">
                  {model.downloads !== undefined && (
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatNumber(model.downloads)}
                    </span>
                  )}
                  {model.likes !== undefined && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {formatNumber(model.likes)}
                    </span>
                  )}
                  {model.modelSize && (
                    <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">
                      {model.modelSize}
                    </span>
                  )}
                </div>

                {model.tags && model.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {model.license && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <span className="text-[10px] text-white/40">
                      License: {model.license}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* No results */}
      {!isSearching && filteredModels.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-white/60">No models found for "{searchQuery}"</p>
          <p className="text-sm text-white/40 mt-1">Try a different search term</p>
        </div>
      )}

      {/* Selected model details */}
      {selectedModel && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-white">{selectedModel.name}</h4>
              <p className="text-sm text-white/60">by {selectedModel.author}</p>
            </div>
            <a
              href={`https://huggingface.co/${selectedModel.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white/80 transition-colors"
            >
              View on HF
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {selectedModel.description && (
            <p className="text-sm text-white/60 mt-2">{selectedModel.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

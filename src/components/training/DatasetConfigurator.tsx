/**
 * Dataset Configurator - Configure training dataset
 * 
 * Upload files, select HuggingFace datasets, preview data samples,
 * and configure columns/fields.
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, Database, FileText, Image as ImageIcon, Music, Video, Eye, X } from 'lucide-react';
import type { ModelModality, DatasetConfig } from '@/store/useTrainingStore';

interface DatasetConfiguratorProps {
  modality: ModelModality;
  config?: DatasetConfig;
  onChange: (config: DatasetConfig) => void;
}

const modalityFormats: Record<ModelModality, DatasetConfig['format'][]> = {
  llm: ['jsonl', 'csv', 'parquet'],
  image: ['images'],
  video: ['video'],
  audio: ['audio'],
  multimodal: ['jsonl', 'images'],
};

const formatDescriptions: Record<DatasetConfig['format'], string> = {
  jsonl: 'JSON Lines - one JSON object per line with prompt/response fields',
  csv: 'CSV - comma-separated values with header row',
  parquet: 'Parquet - columnar storage format for large datasets',
  images: 'Images - folder of images with caption files or metadata',
  audio: 'Audio - WAV/MP3 files with transcriptions',
  video: 'Video - MP4/WebM files with descriptions',
};

const formatIcons: Record<DatasetConfig['format'], typeof FileText> = {
  jsonl: FileText,
  csv: FileText,
  parquet: Database,
  images: ImageIcon,
  audio: Music,
  video: Video,
};

export function DatasetConfigurator({ modality, config, onChange }: DatasetConfiguratorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConfig: DatasetConfig = config || {
    source: 'upload',
    format: modalityFormats[modality][0],
    validationSplit: 0.1,
  };

  const handleSourceChange = useCallback((source: DatasetConfig['source']) => {
    onChange({ ...currentConfig, source });
  }, [currentConfig, onChange]);

  const handleFormatChange = useCallback((format: DatasetConfig['format']) => {
    onChange({ ...currentConfig, format });
  }, [currentConfig, onChange]);

  const handleFieldChange = useCallback((field: keyof DatasetConfig, value: unknown) => {
    onChange({ ...currentConfig, [field]: value });
  }, [currentConfig, onChange]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...fileArray]);
    onChange({
      ...currentConfig,
      source: 'upload',
      uploadedFiles: [...(currentConfig.uploadedFiles || []), ...fileArray.map((f) => f.name)],
    });
  }, [currentConfig, onChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const previewFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewData(e.target?.result as string);
    };
    reader.readAsText(file.slice(0, 5000)); // Preview first 5KB
  }, []);

  const availableFormats = modalityFormats[modality];

  const getAcceptedTypes = (format: DatasetConfig['format']): string => {
    switch (format) {
      case 'jsonl':
      case 'csv':
        return '.json,.jsonl,.csv,.txt';
      case 'parquet':
        return '.parquet';
      case 'images':
        return 'image/*';
      case 'audio':
        return 'audio/*';
      case 'video':
        return 'video/*';
      default:
        return '*';
    }
  };

  const getFileExtensions = (format: DatasetConfig['format']): string[] => {
    switch (format) {
      case 'jsonl':
        return ['.jsonl', '.json'];
      case 'csv':
        return ['.csv'];
      case 'parquet':
        return ['.parquet'];
      case 'images':
        return ['.jpg', '.png', '.webp'];
      case 'audio':
        return ['.wav', '.mp3', '.flac'];
      case 'video':
        return ['.mp4', '.webm'];
      default:
        return [];
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Source selection */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          Data Source
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSourceChange('upload')}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
              currentConfig.source === 'upload'
                ? 'bg-blue-500/20 border-blue-500/50'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Upload className="w-5 h-5 text-white/60" />
            <div className="text-left">
              <div className="font-medium text-white">Upload Files</div>
              <div className="text-xs text-white/60">Upload your own data</div>
            </div>
          </button>
          <button
            onClick={() => handleSourceChange('huggingface')}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
              currentConfig.source === 'huggingface'
                ? 'bg-blue-500/20 border-blue-500/50'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Database className="w-5 h-5 text-white/60" />
            <div className="text-left">
              <div className="font-medium text-white">HuggingFace</div>
              <div className="text-xs text-white/60">Use existing dataset</div>
            </div>
          </button>
        </div>
      </div>

      {/* Format selection (for upload) */}
      {currentConfig.source === 'upload' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            Data Format
          </label>
          <div className="grid grid-cols-3 gap-3">
            {availableFormats.map((format) => {
              const Icon = formatIcons[format];
              return (
                <button
                  key={format}
                  onClick={() => handleFormatChange(format)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    currentConfig.format === format
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon className="w-6 h-6 text-white/60" />
                  <span className="text-sm font-medium text-white uppercase">{format}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/40">
            {formatDescriptions[currentConfig.format]}
          </p>
        </div>
      )}

      {/* Upload area */}
      {currentConfig.source === 'upload' && (
        <div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/20 hover:border-white/40 hover:bg-white/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={getAcceptedTypes(currentConfig.format)}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <Upload className="w-10 h-10 text-white/40 mx-auto mb-3" />
            <p className="text-white/80">
              {isDragging ? 'Drop files here...' : 'Drag & drop files, or click to select'}
            </p>
            <p className="text-sm text-white/40 mt-1">
              Supported: {getFileExtensions(currentConfig.format).join(', ')}
            </p>
          </div>

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white">{file.name}</span>
                    <span className="text-xs text-white/40">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); previewFile(file); }}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-white/40" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HuggingFace dataset search */}
      {currentConfig.source === 'huggingface' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Dataset ID
          </label>
          <input
            type="text"
            value={currentConfig.huggingfaceId || datasetSearch}
            onChange={(e) => {
              setDatasetSearch(e.target.value);
              handleFieldChange('huggingfaceId', e.target.value);
            }}
            placeholder="username/dataset-name"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
          />
          <p className="mt-2 text-xs text-white/40">
            Enter the HuggingFace dataset ID (e.g., "tatsu-lab/alpaca" or "laion/laion2B-en")
          </p>
        </div>
      )}

      {/* Column configuration (for text data) */}
      {(currentConfig.format === 'jsonl' || currentConfig.format === 'csv') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Prompt Column
            </label>
            <input
              type="text"
              value={currentConfig.promptColumn || ''}
              onChange={(e) => handleFieldChange('promptColumn', e.target.value)}
              placeholder="prompt"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Response Column
            </label>
            <input
              type="text"
              value={currentConfig.responseColumn || ''}
              onChange={(e) => handleFieldChange('responseColumn', e.target.value)}
              placeholder="response"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      )}

      {/* Image data configuration */}
      {currentConfig.format === 'images' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Image Column
            </label>
            <input
              type="text"
              value={currentConfig.imageColumn || ''}
              onChange={(e) => handleFieldChange('imageColumn', e.target.value)}
              placeholder="image"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Caption Column
            </label>
            <input
              type="text"
              value={currentConfig.captionColumn || ''}
              onChange={(e) => handleFieldChange('captionColumn', e.target.value)}
              placeholder="caption"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      )}

      {/* Data limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Validation Split
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.05"
              value={currentConfig.validationSplit || 0.1}
              onChange={(e) => handleFieldChange('validationSplit', parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-white/60 w-12">
              {((currentConfig.validationSplit || 0.1) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Max Samples
          </label>
          <input
            type="number"
            value={currentConfig.maxSamples || ''}
            onChange={(e) => handleFieldChange('maxSamples', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="No limit"
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Preview modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[80vh] bg-zinc-900 rounded-xl overflow-hidden border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-medium text-white">Data Preview</h3>
              <button onClick={() => setPreviewData(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <pre className="p-4 overflow-auto text-sm text-white/80 font-mono">
              {previewData}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

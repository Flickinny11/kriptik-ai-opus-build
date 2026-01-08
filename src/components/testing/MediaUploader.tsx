/**
 * Media Uploader - Drag-drop upload with auto-format
 * 
 * Handles image, audio, and video uploads with automatic formatting.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, AlertCircle, Check, Image, Music, Video, FileText } from 'lucide-react';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface MediaUploaderProps {
  accept: 'image' | 'audio' | 'video' | 'all';
  modelId: string;
  onUpload: (result: UploadResult) => void;
  maxSizeMB?: number;
}

interface UploadResult {
  originalUrl: string;
  processedUrl: string;
  processingInfo: {
    resized: boolean;
    reformatted: boolean;
    details: string;
  };
  mediaType: 'image' | 'audio' | 'video';
}

const acceptTypes: Record<string, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
  all: 'image/*,audio/*,video/*',
};

const acceptExtensions: Record<string, string> = {
  image: '.jpg, .jpeg, .png, .webp, .gif',
  audio: '.wav, .mp3, .flac, .ogg',
  video: '.mp4, .webm, .mov, .avi',
  all: '.jpg, .png, .webp, .wav, .mp3, .mp4, .webm',
};

export function MediaUploader({ accept, modelId, onUpload, maxSizeMB = 100 }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMediaType = (file: File): 'image' | 'audio' | 'video' | null => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return null;
  };

  const getMediaIcon = (type: 'image' | 'audio' | 'video' | null) => {
    switch (type) {
      case 'image': return Image;
      case 'audio': return Music;
      case 'video': return Video;
      default: return FileText;
    }
  };

  const validateFile = (file: File): string | null => {
    // Check size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `File too large (${sizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`;
    }

    // Check type
    const mediaType = getMediaType(file);
    if (!mediaType) {
      return 'Unsupported file type';
    }

    if (accept !== 'all' && mediaType !== accept) {
      return `Please upload a ${accept} file`;
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [accept, maxSizeMB]);

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
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('modelId', modelId);
      formData.append('mediaType', getMediaType(selectedFile) || 'image');

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await authenticatedFetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadResult(result);
      onUpload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setUploadResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const MediaIcon = selectedFile ? getMediaIcon(getMediaType(selectedFile)) : Upload;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : selectedFile
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes[accept]}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />

        {/* Preview */}
        {previewUrl && selectedFile ? (
          <div className="space-y-3">
            <div className="relative inline-block">
              {getMediaType(selectedFile) === 'image' && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-48 rounded-lg mx-auto"
                />
              )}
              {getMediaType(selectedFile) === 'audio' && (
                <div className="flex items-center gap-3 p-4 bg-white/10 rounded-lg">
                  <Music className="w-8 h-8 text-blue-400" />
                  <audio src={previewUrl} controls className="h-8" />
                </div>
              )}
              {getMediaType(selectedFile) === 'video' && (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-48 rounded-lg mx-auto"
                />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-white/60">
              {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </div>
          </div>
        ) : (
          <>
            <MediaIcon className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/80">
              {isDragging ? 'Drop file here...' : 'Drag & drop or click to select'}
            </p>
            <p className="text-sm text-white/40 mt-1">
              Supported: {acceptExtensions[accept]}
            </p>
            <p className="text-xs text-white/30 mt-1">
              Max size: {maxSizeMB}MB
            </p>
          </>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
            <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-white/60 mt-2">
              {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload result / Processing info */}
      <AnimatePresence>
        {uploadResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
          >
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Check className="w-4 h-4" />
              <span className="font-medium">Upload successful!</span>
            </div>
            <div className="text-sm text-white/60 space-y-1">
              {uploadResult.processingInfo.resized && (
                <p>✓ Resized to model requirements</p>
              )}
              {uploadResult.processingInfo.reformatted && (
                <p>✓ Converted to optimal format</p>
              )}
              <p className="text-white/40">{uploadResult.processingInfo.details}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload button */}
      {selectedFile && !uploadResult && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </span>
          ) : (
            'Upload & Process'
          )}
        </button>
      )}
    </div>
  );
}

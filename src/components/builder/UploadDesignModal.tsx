import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloseIcon,
  UploadIcon,
  ImageIcon,
  LoadingIcon,
  CheckIcon,
  AlertCircleIcon
} from '../ui/icons';
import { cn } from '@/lib/utils';
import { UploadDesignIcon } from '../ui/AbstractIcons';
import { apiClient, ImageToCodeResult } from '@/lib/api-client';

interface UploadDesignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: ImageToCodeResult) => void;
}

type UploadMethod = 'file' | 'camera' | 'url';

export default function UploadDesignModal({ open, onOpenChange, onComplete }: UploadDesignModalProps) {
  const [method, setMethod] = useState<UploadMethod | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setMethod(null);
    setFile(null);
    setPreview(null);
    setImageUrl('');
    setError('');
    setIsProcessing(false);
    onOpenChange(false);
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleConvert = async () => {
    setIsProcessing(true);
    setError('');

    try {
      const imageSource = method === 'url' && imageUrl ? imageUrl : preview;

      if (!imageSource) {
        throw new Error('No image to convert');
      }

      // Use the streaming image-to-code API
      const stream = apiClient.imageToCode([imageSource]);
      let result: ImageToCodeResult | null = null;

      for await (const event of stream) {
        if (event.type === 'complete') {
          result = event.data;
        } else if (event.type === 'error') {
          throw new Error(event.data.error);
        }
        // Progress events can be used for UI updates if needed
      }

      if (!result) {
        throw new Error('No result received from image-to-code conversion');
      }

      onComplete(result);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert image to code');
      setIsProcessing(false);
    }
  };

  const methodOptions = [
    {
      id: 'file' as const,
      icon: ImageIcon,
      label: 'Upload File',
      description: 'Upload an image from your device'
    },
    {
      id: 'camera' as const,
      icon: ImageIcon,
      label: 'Capture Photo',
      description: 'Take a photo with your camera'
    },
    {
      id: 'url' as const,
      icon: ImageIcon,
      label: 'Image URL',
      description: 'Paste a URL to an image'
    }
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-lg rounded-3xl overflow-hidden",
              "bg-gradient-to-b from-slate-900 to-slate-950",
              "border border-slate-800/50 shadow-2xl shadow-amber-500/10"
            )}
          >
            {/* Header */}
            <div className="relative p-6 border-b border-slate-800/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
              >
                <CloseIcon size={20} />
              </button>

              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                  }}
                >
                  <UploadDesignIcon size={36} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Upload Design
                  </h2>
                  <p className="text-sm text-slate-400">
                    Convert your design to code
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {!method && !preview && (
                <div className="space-y-4">
                  {methodOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setMethod(option.id);
                        if (option.id === 'file') {
                          fileInputRef.current?.click();
                        } else if (option.id === 'camera') {
                          cameraInputRef.current?.click();
                        }
                      }}
                      className={cn(
                        "w-full p-4 rounded-2xl flex items-center gap-4 text-left",
                        "bg-slate-800/30 border border-slate-700/30",
                        "hover:bg-slate-800/50 hover:border-amber-500/30",
                        "transition-all duration-200 group"
                      )}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)',
                          border: '1px solid rgba(251, 191, 36, 0.2)'
                        }}
                      >
                        <option.icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {option.label}
                        </h3>
                        <p className="text-sm text-slate-400">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {method === 'url' && !preview && (
                <div className="space-y-4">
                  <button
                    onClick={() => setMethod(null)}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    ← Back to options
                  </button>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Image URL</label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setError('');
                      }}
                      placeholder="https://example.com/design.png"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl",
                        "bg-slate-800/50 border border-slate-700/50",
                        "text-white placeholder:text-slate-500",
                        "focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                        "transition-all duration-200"
                      )}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircleIcon size={16} />
                      <span className="text-sm text-red-300">{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleConvert}
                    disabled={!imageUrl.trim() || isProcessing}
                    style={{
                      background: imageUrl.trim() && !isProcessing
                        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.9) 0%, rgba(249, 115, 22, 0.9) 100%)'
                        : 'rgba(100, 100, 120, 0.3)',
                      boxShadow: imageUrl.trim() && !isProcessing
                        ? '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-black flex items-center justify-center gap-2",
                      "transition-all duration-200",
                      imageUrl.trim() && !isProcessing
                        ? "hover:translate-y-[1px]"
                        : "opacity-50 cursor-not-allowed text-slate-400"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <LoadingIcon size={20} className="animate-spin" />
                        Converting...
                      </>
                    ) : (
                      'Convert to Code'
                    )}
                  </button>
                </div>
              )}

              {(method === 'file' || method === 'camera') && !preview && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={cn(
                    "relative p-8 rounded-2xl border-2 border-dashed text-center",
                    "transition-all duration-200",
                    dragActive
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                  )}
                >
                  <button
                    onClick={() => setMethod(null)}
                    className="absolute top-2 left-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    ← Back
                  </button>

                  <UploadIcon size={48} className="mx-auto mb-4" />
                  <p className="text-slate-300 mb-2">
                    Drag and drop your image here
                  </p>
                  <p className="text-sm text-slate-500 mb-4">or</p>
                  <button
                    onClick={() => method === 'camera' ? cameraInputRef.current?.click() : fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                  >
                    {method === 'camera' ? 'Open Camera' : 'Browse Files'}
                  </button>
                  <p className="text-xs text-slate-500 mt-4">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              )}

              {preview && (
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                      setMethod(null);
                    }}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    ← Upload different image
                  </button>

                  <div className="relative rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-700/50">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full max-h-64 object-contain"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                      <CheckIcon size={12} />
                      <span className="text-xs text-emerald-300">Ready</span>
                    </div>
                  </div>

                  {file && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                      <ImageIcon size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircleIcon size={16} />
                      <span className="text-sm text-red-300">{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    style={{
                      background: !isProcessing
                        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.9) 0%, rgba(249, 115, 22, 0.9) 100%)'
                        : 'rgba(100, 100, 120, 0.3)',
                      boxShadow: !isProcessing
                        ? '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-black flex items-center justify-center gap-2",
                      "transition-all duration-200",
                      !isProcessing
                        ? "hover:translate-y-[1px]"
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <LoadingIcon size={20} className="animate-spin" />
                        Converting to Code...
                      </>
                    ) : (
                      'Convert to Code'
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


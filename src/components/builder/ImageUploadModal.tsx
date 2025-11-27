/**
 * ImageUploadModal - Convert images/designs to code
 *
 * Supports:
 * - File upload (drag & drop or click)
 * - URL input (paste image URLs)
 * - Figma file key input
 * - Progress streaming from backend
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    Link,
    Figma,
    Image as ImageIcon,
    Loader2,
    CheckCircle,
    AlertCircle,
    Sparkles,
    Code2,
    Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { apiClient, ImageToCodeResult } from '@/lib/api-client';

interface ImageUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: (result: ImageToCodeResult) => void;
    mode?: 'upload' | 'url' | 'figma' | 'clone';
}

type InputMode = 'upload' | 'url' | 'figma';

interface UploadedImage {
    id: string;
    type: 'file' | 'url';
    preview: string;
    name: string;
    dataUrl?: string;
}

export default function ImageUploadModal({
    open,
    onOpenChange,
    onComplete,
    mode = 'upload',
}: ImageUploadModalProps) {
    const [inputMode, setInputMode] = useState<InputMode>(
        mode === 'clone' ? 'url' : mode as InputMode
    );
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [urlInput, setUrlInput] = useState('');
    const [figmaInput, setFigmaInput] = useState('');
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState<{ stage: string; content: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ImageToCodeResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((files: FileList | null) => {
        if (!files) return;

        Array.from(files).forEach((file) => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setImages((prev) => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        type: 'file',
                        preview: dataUrl,
                        name: file.name,
                        dataUrl,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files);
        },
        [handleFileSelect]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const addUrl = useCallback(() => {
        if (!urlInput.trim()) return;

        // Basic URL validation
        try {
            new URL(urlInput);
        } catch {
            setError('Please enter a valid URL');
            return;
        }

        setImages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'url',
                preview: urlInput,
                name: new URL(urlInput).pathname.split('/').pop() || 'Image',
            },
        ]);
        setUrlInput('');
        setError(null);
    }, [urlInput]);

    const removeImage = useCallback((id: string) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
    }, []);

    const handleConvert = useCallback(async () => {
        if (images.length === 0) {
            setError('Please add at least one image');
            return;
        }

        setIsConverting(true);
        setError(null);
        setProgress(null);

        try {
            // Prepare image URLs - use data URLs for uploaded files
            const imageUrls = images.map((img) =>
                img.type === 'file' ? img.dataUrl! : img.preview
            );

            // Use streaming API
            for await (const event of apiClient.imageToCode(imageUrls, {
                framework: 'react',
                styling: 'tailwind',
                includeResponsive: true,
                includeAccessibility: true,
                includeInteractions: true,
            })) {
                if (event.type === 'progress') {
                    setProgress(event.data);
                } else if (event.type === 'complete') {
                    setResult(event.data);
                    onComplete?.(event.data);
                } else if (event.type === 'error') {
                    setError(event.data.error);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Conversion failed');
        } finally {
            setIsConverting(false);
        }
    }, [images, onComplete]);

    const handleClose = useCallback(() => {
        if (isConverting) return;
        setImages([]);
        setUrlInput('');
        setFigmaInput('');
        setError(null);
        setProgress(null);
        setResult(null);
        onOpenChange(false);
    }, [isConverting, onOpenChange]);

    const modeButtons: Array<{ id: InputMode; icon: typeof Upload; label: string }> = [
        { id: 'upload', icon: Upload, label: 'Upload' },
        { id: 'url', icon: Link, label: 'URL' },
        { id: 'figma', icon: Figma, label: 'Figma' },
    ];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl bg-slate-900 border-slate-700/50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                            Design to Code
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Result view */}
                {result ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                            <div>
                                <p className="font-medium text-emerald-400">
                                    Conversion Complete!
                                </p>
                                <p className="text-sm text-slate-400">
                                    Generated {result.components.length} component(s)
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-slate-300">
                                Generated Components
                            </h4>
                            {result.components.map((comp, i) => (
                                <div
                                    key={i}
                                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <Code2 className="h-4 w-4 text-amber-400" />
                                        <span className="font-mono text-sm text-white">
                                            {comp.path}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
                            <Button variant="outline" onClick={handleClose}>
                                Close
                            </Button>
                            <Button
                                variant="gradient"
                                onClick={() => {
                                    onComplete?.(result);
                                    handleClose();
                                }}
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Use Components
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mode selector */}
                        <div className="flex gap-2 p-1 rounded-xl bg-slate-800/50">
                            {modeButtons.map((btn) => (
                                <button
                                    key={btn.id}
                                    onClick={() => setInputMode(btn.id)}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200',
                                        inputMode === btn.id
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                    )}
                                >
                                    <btn.icon className="h-4 w-4" />
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Input area */}
                        <div className="space-y-4">
                            {inputMode === 'upload' && (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className={cn(
                                        'relative h-48 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
                                        'flex flex-col items-center justify-center gap-3',
                                        'border-slate-700 hover:border-amber-500/50 bg-slate-800/30 hover:bg-slate-800/50'
                                    )}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />
                                    <Upload className="h-10 w-10 text-slate-500" />
                                    <div className="text-center">
                                        <p className="text-slate-300 font-medium">
                                            Drop images here or click to upload
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            PNG, JPG, WebP up to 10MB
                                        </p>
                                    </div>
                                </div>
                            )}

                            {inputMode === 'url' && (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={urlInput}
                                            onChange={(e) => setUrlInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                                            placeholder="Paste image URL..."
                                            className={cn(
                                                'flex-1 px-4 py-3 rounded-xl',
                                                'bg-slate-800/50 border border-slate-700',
                                                'text-white placeholder:text-slate-500',
                                                'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
                                                'transition-all duration-200'
                                            )}
                                        />
                                        <Button onClick={addUrl} variant="secondary">
                                            Add
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Enter the URL of a design screenshot, mockup, or webpage
                                    </p>
                                </div>
                            )}

                            {inputMode === 'figma' && (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={figmaInput}
                                        onChange={(e) => setFigmaInput(e.target.value)}
                                        placeholder="Figma file URL or key..."
                                        className={cn(
                                            'w-full px-4 py-3 rounded-xl',
                                            'bg-slate-800/50 border border-slate-700',
                                            'text-white placeholder:text-slate-500',
                                            'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
                                            'transition-all duration-200'
                                        )}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Paste a Figma share link or file key. Requires Figma API token configured.
                                    </p>
                                </div>
                            )}

                            {/* Image previews */}
                            {images.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-slate-300">
                                        Images ({images.length})
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {images.map((img) => (
                                            <div
                                                key={img.id}
                                                className="relative group rounded-lg overflow-hidden bg-slate-800"
                                            >
                                                <img
                                                    src={img.preview}
                                                    alt={img.name}
                                                    className="w-full h-24 object-cover"
                                                />
                                                <button
                                                    onClick={() => removeImage(img.id)}
                                                    className={cn(
                                                        'absolute top-1 right-1 p-1.5 rounded-lg',
                                                        'bg-black/60 text-white opacity-0 group-hover:opacity-100',
                                                        'hover:bg-red-500 transition-all duration-200'
                                                    )}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                                                    <p className="text-xs text-white truncate">
                                                        {img.name}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Progress */}
                        <AnimatePresence>
                            {isConverting && progress && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                                        <span className="font-medium text-white capitalize">
                                            {progress.stage}...
                                        </span>
                                    </div>
                                    <div className="max-h-32 overflow-auto">
                                        <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                                            {progress.content.slice(-500)}
                                        </pre>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                disabled={isConverting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="gradient"
                                onClick={handleConvert}
                                disabled={isConverting || images.length === 0}
                            >
                                {isConverting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Converting...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generate Code
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}


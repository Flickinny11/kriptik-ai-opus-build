/**
 * Upload Dropzone
 *
 * Drag-and-drop file upload for zip/folder import.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadIcon, FileIcon, FolderIcon, CloseIcon, LoadingIcon, CheckIcon } from '../ui/icons';

const accentColor = '#c8ff64';

interface UploadDropzoneProps {
    onUpload: (files: Map<string, string>, sourceName: string) => void;
    onCancel: () => void;
    isUploading?: boolean;
}

export function UploadDropzone({
    onUpload,
    onCancel,
    isUploading = false,
}: UploadDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<Map<string, string>>(new Map());
    const [sourceName, setSourceName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const processFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        setIsProcessing(true);
        setError(null);

        try {
            const files = new Map<string, string>();
            let name = '';

            for (const file of Array.from(fileList)) {
                // Handle zip files
                if (file.name.endsWith('.zip')) {
                    name = file.name.replace('.zip', '');
                    // For now, we'll need to handle zip extraction on the server
                    // Store the raw file content
                    const content = await file.text();
                    files.set(file.name, content);
                    setError('Zip files will be extracted on the server');
                } else {
                    // Handle individual files
                    const content = await file.text();
                    // Use webkitRelativePath for folder uploads, or just name
                    const path = (file as any).webkitRelativePath || file.name;
                    files.set(path, content);

                    if (!name) {
                        // Extract folder name from path
                        const parts = path.split('/');
                        name = parts.length > 1 ? parts[0] : file.name;
                    }
                }
            }

            setUploadedFiles(files);
            setSourceName(name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process files');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const items = e.dataTransfer.items;
        if (!items) {
            await processFiles(e.dataTransfer.files);
            return;
        }

        // Handle directory drops if supported
        const entries: FileSystemEntry[] = [];
        for (const item of Array.from(items)) {
            const entry = item.webkitGetAsEntry?.();
            if (entry) entries.push(entry);
        }

        if (entries.length > 0 && entries[0].isDirectory) {
            setIsProcessing(true);
            setError(null);

            try {
                const files = new Map<string, string>();
                await readDirectory(entries[0] as FileSystemDirectoryEntry, '', files);
                setUploadedFiles(files);
                setSourceName(entries[0].name);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to read directory');
            } finally {
                setIsProcessing(false);
            }
        } else {
            await processFiles(e.dataTransfer.files);
        }
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        await processFiles(e.target.files);
    };

    const handleSubmit = () => {
        if (uploadedFiles.size > 0) {
            onUpload(uploadedFiles, sourceName || 'Uploaded Files');
        }
    };

    const clearFiles = () => {
        setUploadedFiles(new Map());
        setSourceName('');
        setError(null);
    };

    const fileCount = uploadedFiles.size;
    const relevantFiles = Array.from(uploadedFiles.keys())
        .filter(f => /\.(tsx?|jsx?|vue|svelte|css|scss|json)$/.test(f))
        .slice(0, 10);

    return (
        <div className="space-y-4">
            {/* Dropzone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                        ? 'border-current bg-white/5'
                        : 'border-white/20 hover:border-white/30 hover:bg-white/[0.02]'
                }`}
                style={{
                    borderColor: isDragOver ? accentColor : undefined,
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                        <LoadingIcon size={48} style={{ color: accentColor }} className="animate-spin" />
                        <p className="text-white/60">Processing files...</p>
                    </div>
                ) : fileCount > 0 ? (
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ background: `${accentColor}20` }}
                        >
                            <CheckIcon size={32} style={{ color: accentColor }} />
                        </div>
                        <div>
                            <p className="font-medium text-white">{fileCount} files loaded</p>
                            <p className="text-sm text-white/50">{sourceName}</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearFiles();
                            }}
                            className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1"
                        >
                            <CloseIcon size={12} />
                            Clear
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.1)' }}
                        >
                            <UploadIcon size={32} className="text-white/50" />
                        </div>
                        <div>
                            <p className="font-medium text-white">
                                Drop your project folder here
                            </p>
                            <p className="text-sm text-white/50 mt-1">
                                or click to browse for a folder or zip file
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* File preview */}
            {relevantFiles.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 rounded-lg bg-black/30 border border-white/10"
                >
                    <p className="text-xs text-white/50 mb-2">Detected Files:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {relevantFiles.map(file => (
                            <div key={file} className="flex items-center gap-2 text-sm">
                                <FileIcon size={12} className="text-white/40" />
                                <span className="text-white/70 font-mono truncate">{file}</span>
                            </div>
                        ))}
                        {fileCount > relevantFiles.length && (
                            <p className="text-xs text-white/40 pt-1">
                                +{fileCount - relevantFiles.length} more files
                            </p>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Error display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                >
                    Cancel
                </button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={fileCount === 0 || isUploading}
                    className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: accentColor, color: 'black' }}
                >
                    {isUploading ? (
                        <>
                            <LoadingIcon size={16} className="animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <FolderIcon size={16} />
                            Import Files
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}

// Helper function to read directory recursively
async function readDirectory(
    entry: FileSystemDirectoryEntry,
    basePath: string,
    files: Map<string, string>
): Promise<void> {
    const reader = entry.createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });

    for (const entry of entries) {
        const path = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory) {
            await readDirectory(entry as FileSystemDirectoryEntry, path, files);
        } else {
            const file = await new Promise<File>((resolve, reject) => {
                (entry as FileSystemFileEntry).file(resolve, reject);
            });

            // Only read relevant files
            if (/\.(tsx?|jsx?|vue|svelte|css|scss|sass|less|json|yaml|yml|md|mdx)$/.test(file.name)) {
                const content = await file.text();
                files.set(path, content);
            }
        }
    }
}


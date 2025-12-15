/**
 * Import Project Modal
 *
 * Handles importing projects from ZIP files, GitHub repos, and AI builders.
 * Includes dependency notification system for external API credentials.
 *
 * Design: Premium liquid glass matching KripTik AI aesthetic
 * Colors: Warm amber/copper glow, no purple
 * Typography: Cal Sans / Outfit
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import DependencyNotificationStep, { type RequiredDependency } from './DependencyNotificationStep';
import '../../styles/realistic-glass.css';

// ============================================================================
// TYPES
// ============================================================================

export type ImportType = 'zip' | 'github' | 'builder';
export type ImportStep = 'input' | 'analyzing' | 'dependencies' | 'fixing' | 'complete';

export interface ImportProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    importType: ImportType;
}

interface ImportResult {
    projectId: string;
    projectName: string;
    filesImported: number;
    framework: string;
    dependencies: RequiredDependency[];
}

// ============================================================================
// CUSTOM SVG ICONS
// ============================================================================

function IconClose({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}

function IconUpload({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}

function IconGitHub({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
    );
}

function IconExternalBuilder({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M14 9l3 3-3 3" />
        </svg>
    );
}

function IconFolder({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function IconCheck({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function IconSpinner({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}

function IconArrowRight({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
    );
}

// ============================================================================
// BUILDER LOGOS
// ============================================================================

function LovableLogo({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FF6B6B" />
            <path d="M12 7l2.5 4.5L17 12l-2.5.5L12 17l-2.5-4.5L7 12l2.5-.5L12 7z" fill="white" />
        </svg>
    );
}

function BoltLogo({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#1a1a1a" />
            <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" fill="#FFD93D" />
        </svg>
    );
}

function V0Logo({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#000" />
            <text x="6" y="17" fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">v0</text>
        </svg>
    );
}

function ReplicateLogo({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#2563EB" />
            <path d="M8 8h8v2H8zM8 12h6v2H8zM8 16h4v2H8z" fill="white" />
        </svg>
    );
}

// ============================================================================
// BUILDER OPTIONS
// ============================================================================

const BUILDER_OPTIONS = [
    { id: 'lovable', name: 'Lovable', logo: LovableLogo, domain: 'lovable.dev' },
    { id: 'bolt', name: 'Bolt', logo: BoltLogo, domain: 'bolt.new' },
    { id: 'v0', name: 'v0', logo: V0Logo, domain: 'v0.dev' },
    { id: 'replicate', name: 'Replicate', logo: ReplicateLogo, domain: 'replicate.com' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function ImportProjectModal({
    isOpen,
    onClose,
    importType,
}: ImportProjectModalProps) {
    const navigate = useNavigate();
    const { addProject } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<ImportStep>('input');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [dependencies, setDependencies] = useState<RequiredDependency[]>([]);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Input states
    const [githubUrl, setGithubUrl] = useState('');
    const [branch, setBranch] = useState('main');
    const [selectedBuilder, setSelectedBuilder] = useState<string | null>(null);
    const [builderUrl, setBuilderUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Reset state on close
    const handleClose = useCallback(() => {
        setStep('input');
        setProgress(0);
        setStatusMessage('');
        setDependencies([]);
        setProjectId(null);
        setProjectName('');
        setError(null);
        setGithubUrl('');
        setBranch('main');
        setSelectedBuilder(null);
        setBuilderUrl('');
        setSelectedFile(null);
        onClose();
    }, [onClose]);

    // Handle file selection
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.zip')) {
                setError('Please select a ZIP file');
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                setError('File size must be under 100MB');
                return;
            }
            setSelectedFile(file);
            setError(null);
        }
    }, []);

    // Handle ZIP import
    const handleZipImport = useCallback(async () => {
        if (!selectedFile) {
            setError('Please select a ZIP file');
            return;
        }

        setStep('analyzing');
        setProgress(10);
        setStatusMessage('Uploading ZIP file...');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            setProgress(30);
            setStatusMessage('Extracting files...');

            const response = await fetch('/api/import/zip', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Import failed' }));
                throw new Error(errData.error || 'Failed to import ZIP file');
            }

            const result: ImportResult = await response.json();

            setProgress(60);
            setStatusMessage('Analyzing project structure...');

            await new Promise(resolve => setTimeout(resolve, 1000));

            setProjectId(result.projectId);
            setProjectName(result.projectName);

            if (result.dependencies && result.dependencies.length > 0) {
                setDependencies(result.dependencies);
                setStep('dependencies');
            } else {
                await startFixProcess(result.projectId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import ZIP file');
            setStep('input');
        }
    }, [selectedFile]);

    // Handle GitHub import
    const handleGitHubImport = useCallback(async () => {
        if (!githubUrl.trim()) {
            setError('Please enter a GitHub repository URL');
            return;
        }

        const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
        if (!githubPattern.test(githubUrl)) {
            setError('Please enter a valid GitHub repository URL');
            return;
        }

        setStep('analyzing');
        setProgress(10);
        setStatusMessage('Cloning repository...');

        try {
            const { data } = await apiClient.post<ImportResult>('/api/import/github', {
                repoUrl: githubUrl,
                branch,
            });

            setProgress(50);
            setStatusMessage('Analyzing codebase...');

            await new Promise(resolve => setTimeout(resolve, 1000));

            setProjectId(data.projectId);
            setProjectName(data.projectName);

            if (data.dependencies && data.dependencies.length > 0) {
                setDependencies(data.dependencies);
                setStep('dependencies');
            } else {
                await startFixProcess(data.projectId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clone repository');
            setStep('input');
        }
    }, [githubUrl, branch]);

    // Handle builder import
    const handleBuilderImport = useCallback(async () => {
        if (!selectedBuilder) {
            setError('Please select an AI builder');
            return;
        }
        if (!builderUrl.trim()) {
            setError('Please enter the project URL');
            return;
        }

        setStep('analyzing');
        setProgress(10);
        setStatusMessage(`Importing from ${selectedBuilder}...`);

        try {
            const { data } = await apiClient.post<ImportResult>('/api/import/builder', {
                builderType: selectedBuilder,
                projectUrl: builderUrl,
            });

            setProgress(50);
            setStatusMessage('Analyzing project...');

            await new Promise(resolve => setTimeout(resolve, 1000));

            setProjectId(data.projectId);
            setProjectName(data.projectName);

            if (data.dependencies && data.dependencies.length > 0) {
                setDependencies(data.dependencies);
                setStep('dependencies');
            } else {
                await startFixProcess(data.projectId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import from builder');
            setStep('input');
        }
    }, [selectedBuilder, builderUrl]);

    // Start the fix process
    const startFixProcess = useCallback(async (projectIdToFix: string) => {
        setStep('fixing');
        setProgress(70);
        setStatusMessage('Running Fix My App analysis...');

        try {
            await apiClient.post(`/api/import/${projectIdToFix}/fix`, {
                credentials: dependencies.reduce((acc, dep) => {
                    return { ...acc, ...dep.values };
                }, {}),
            });

            // Simulate progress updates
            for (let p = 70; p <= 95; p += 5) {
                await new Promise(resolve => setTimeout(resolve, 500));
                setProgress(p);
                if (p === 80) setStatusMessage('Analyzing intent...');
                if (p === 85) setStatusMessage('Detecting issues...');
                if (p === 90) setStatusMessage('Preparing fix strategy...');
            }

            setProgress(100);
            setStep('complete');

            // Add project to store
            addProject({
                id: projectIdToFix,
                name: projectName || 'Imported Project',
                description: `Imported from ${importType}`,
                createdAt: new Date(),
                lastEdited: 'Just now',
                framework: 'react',
                status: 'development',
            });

            toast.success('Project imported successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Fix process failed');
            setStep('input');
        }
    }, [dependencies, projectName, importType, addProject]);

    // Handle dependencies complete
    const handleDependenciesComplete = useCallback(async (completedDeps: RequiredDependency[]) => {
        setDependencies(completedDeps);
        if (projectId) {
            // Save credentials first
            try {
                await apiClient.post(`/api/import/${projectId}/credentials`, {
                    credentials: completedDeps.reduce((acc, dep) => {
                        return { ...acc, ...dep.values };
                    }, {}),
                });
            } catch (err) {
                console.error('Failed to save credentials:', err);
            }
            await startFixProcess(projectId);
        }
    }, [projectId, startFixProcess]);

    // Handle submit based on import type
    const handleSubmit = useCallback(() => {
        setError(null);
        switch (importType) {
            case 'zip':
                handleZipImport();
                break;
            case 'github':
                handleGitHubImport();
                break;
            case 'builder':
                handleBuilderImport();
                break;
        }
    }, [importType, handleZipImport, handleGitHubImport, handleBuilderImport]);

    // Get title based on import type
    const getTitle = () => {
        switch (importType) {
            case 'zip':
                return 'Import ZIP File';
            case 'github':
                return 'Clone GitHub Repository';
            case 'builder':
                return 'Import from AI Builder';
            default:
                return 'Import Project';
        }
    };

    // Get icon based on import type
    const getIcon = () => {
        switch (importType) {
            case 'zip':
                return <IconUpload size={28} />;
            case 'github':
                return <IconGitHub size={28} />;
            case 'builder':
                return <IconExternalBuilder size={28} />;
            default:
                return <IconFolder size={28} />;
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={handleClose}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(12px)',
                    }}
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-2xl max-h-[90vh] overflow-auto"
                    style={{
                        borderRadius: 24,
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 50%, rgba(248,248,250,0.5) 100%)',
                        backdropFilter: 'blur(40px) saturate(200%)',
                        boxShadow: `
                            0 30px 80px rgba(0, 0, 0, 0.2),
                            0 15px 40px rgba(0, 0, 0, 0.15),
                            inset 0 2px 4px rgba(255, 255, 255, 0.9),
                            inset 0 -1px 2px rgba(0, 0, 0, 0.02),
                            0 0 0 1px rgba(255, 255, 255, 0.5)
                        `,
                    }}
                >
                    {/* Header */}
                    <div
                        className="p-6 border-b"
                        style={{
                            borderColor: 'rgba(0, 0, 0, 0.06)',
                            background: 'linear-gradient(145deg, rgba(255,200,170,0.15) 0%, rgba(255,180,150,0.08) 100%)',
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)',
                                        boxShadow: `
                                            0 4px 0 rgba(200, 180, 160, 0.4),
                                            0 8px 20px rgba(0, 0, 0, 0.1),
                                            inset 0 1px 2px rgba(255,255,255,0.9)
                                        `,
                                        color: '#1a1a1a',
                                    }}
                                >
                                    {getIcon()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                                        {getTitle()}
                                    </h2>
                                    <p className="text-sm" style={{ color: '#404040' }}>
                                        {step === 'input' && 'Import your project to fix it with KripTik AI'}
                                        {step === 'analyzing' && 'Analyzing your project...'}
                                        {step === 'dependencies' && 'Set up required credentials'}
                                        {step === 'fixing' && 'Running Fix My App...'}
                                        {step === 'complete' && 'Import complete!'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-xl transition-all"
                                style={{
                                    background: 'rgba(0, 0, 0, 0.05)',
                                    color: '#404040',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                }}
                            >
                                <IconClose size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Input Step */}
                        {step === 'input' && (
                            <div className="space-y-6">
                                {/* ZIP Import */}
                                {importType === 'zip' && (
                                    <div className="space-y-4">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            accept=".zip"
                                            className="hidden"
                                        />
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className={cn(
                                                "relative p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer",
                                                selectedFile
                                                    ? "border-emerald-500/50 bg-emerald-50/30"
                                                    : "border-slate-300/50 hover:border-amber-400/50 hover:bg-amber-50/20"
                                            )}
                                        >
                                            <div className="flex flex-col items-center gap-4 text-center">
                                                {selectedFile ? (
                                                    <>
                                                        <div
                                                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                                            style={{
                                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                                                            }}
                                                        >
                                                            <IconCheck size={32} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold" style={{ color: '#1a1a1a' }}>
                                                                {selectedFile.name}
                                                            </p>
                                                            <p className="text-sm" style={{ color: '#404040' }}>
                                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div
                                                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                                            style={{
                                                                background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
                                                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                                                                color: '#404040',
                                                            }}
                                                        >
                                                            <IconUpload size={32} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold" style={{ color: '#1a1a1a' }}>
                                                                Click to upload ZIP file
                                                            </p>
                                                            <p className="text-sm" style={{ color: '#666' }}>
                                                                or drag and drop (max 100MB)
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* GitHub Import */}
                                {importType === 'github' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                                                Repository URL
                                            </label>
                                            <input
                                                type="url"
                                                value={githubUrl}
                                                onChange={(e) => {
                                                    setGithubUrl(e.target.value);
                                                    setError(null);
                                                }}
                                                placeholder="https://github.com/username/repository"
                                                className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.6)',
                                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                                    color: '#1a1a1a',
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                                                Branch
                                            </label>
                                            <input
                                                type="text"
                                                value={branch}
                                                onChange={(e) => setBranch(e.target.value)}
                                                placeholder="main"
                                                className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.6)',
                                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                                    color: '#1a1a1a',
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Builder Import */}
                                {importType === 'builder' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                                                Select AI Builder
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {BUILDER_OPTIONS.map((builder) => (
                                                    <button
                                                        key={builder.id}
                                                        onClick={() => {
                                                            setSelectedBuilder(builder.id);
                                                            setError(null);
                                                        }}
                                                        className={cn(
                                                            "p-4 rounded-xl transition-all flex items-center gap-3",
                                                            selectedBuilder === builder.id
                                                                ? "ring-2 ring-amber-400"
                                                                : "hover:bg-white/50"
                                                        )}
                                                        style={{
                                                            background: selectedBuilder === builder.id
                                                                ? 'linear-gradient(145deg, rgba(255,200,170,0.3) 0%, rgba(255,180,150,0.2) 100%)'
                                                                : 'rgba(255, 255, 255, 0.5)',
                                                            border: '1px solid rgba(0, 0, 0, 0.06)',
                                                        }}
                                                    >
                                                        <builder.logo size={32} />
                                                        <div className="text-left">
                                                            <p className="font-semibold" style={{ color: '#1a1a1a' }}>
                                                                {builder.name}
                                                            </p>
                                                            <p className="text-xs" style={{ color: '#666' }}>
                                                                {builder.domain}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {selectedBuilder && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                                                    Project URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={builderUrl}
                                                    onChange={(e) => {
                                                        setBuilderUrl(e.target.value);
                                                        setError(null);
                                                    }}
                                                    placeholder={`https://${BUILDER_OPTIONS.find(b => b.id === selectedBuilder)?.domain}/...`}
                                                    className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.6)',
                                                        border: '1px solid rgba(0, 0, 0, 0.08)',
                                                        color: '#1a1a1a',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Error display */}
                                {error && (
                                    <div
                                        className="p-4 rounded-xl"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                        }}
                                    >
                                        <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
                                    </div>
                                )}

                                {/* Submit button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={
                                        (importType === 'zip' && !selectedFile) ||
                                        (importType === 'github' && !githubUrl.trim()) ||
                                        (importType === 'builder' && (!selectedBuilder || !builderUrl.trim()))
                                    }
                                    className="glass-button glass-button--glow w-full justify-center py-3"
                                    style={{
                                        color: '#1a1a1a',
                                        opacity: (
                                            (importType === 'zip' && !selectedFile) ||
                                            (importType === 'github' && !githubUrl.trim()) ||
                                            (importType === 'builder' && (!selectedBuilder || !builderUrl.trim()))
                                        ) ? 0.5 : 1,
                                    }}
                                >
                                    <span>Start Import</span>
                                    <IconArrowRight size={18} />
                                </button>
                            </div>
                        )}

                        {/* Analyzing Step */}
                        {step === 'analyzing' && (
                            <div className="py-12 space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <div
                                        className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,200,170,0.4) 0%, rgba(255,180,150,0.3) 100%)',
                                            boxShadow: '0 8px 32px rgba(194, 90, 0, 0.15)',
                                            color: '#c25a00',
                                        }}
                                    >
                                        <IconSpinner size={40} />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold" style={{ color: '#1a1a1a' }}>
                                            {statusMessage}
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#666' }}>
                                            This may take a moment...
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span style={{ color: '#666' }}>Progress</span>
                                        <span style={{ color: '#c25a00' }}>{progress}%</span>
                                    </div>
                                    <div
                                        className="h-2 rounded-full overflow-hidden"
                                        style={{ background: 'rgba(0, 0, 0, 0.08)' }}
                                    >
                                        <motion.div
                                            className="h-full rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            style={{
                                                background: 'linear-gradient(90deg, #c25a00, #d97706)',
                                                boxShadow: '0 0 12px rgba(194, 90, 0, 0.4)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Dependencies Step */}
                        {step === 'dependencies' && (
                            <DependencyNotificationStep
                                dependencies={dependencies}
                                onComplete={handleDependenciesComplete}
                            />
                        )}

                        {/* Fixing Step */}
                        {step === 'fixing' && (
                            <div className="py-12 space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <div
                                        className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,200,170,0.4) 0%, rgba(255,180,150,0.3) 100%)',
                                            boxShadow: '0 8px 32px rgba(194, 90, 0, 0.15)',
                                            color: '#c25a00',
                                        }}
                                    >
                                        <IconSpinner size={40} />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold" style={{ color: '#1a1a1a' }}>
                                            {statusMessage}
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#666' }}>
                                            KripTik AI is preparing your project...
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span style={{ color: '#666' }}>Progress</span>
                                        <span style={{ color: '#c25a00' }}>{progress}%</span>
                                    </div>
                                    <div
                                        className="h-2 rounded-full overflow-hidden"
                                        style={{ background: 'rgba(0, 0, 0, 0.08)' }}
                                    >
                                        <motion.div
                                            className="h-full rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            style={{
                                                background: 'linear-gradient(90deg, #c25a00, #d97706)',
                                                boxShadow: '0 0 12px rgba(194, 90, 0, 0.4)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Complete Step */}
                        {step === 'complete' && (
                            <div className="py-12 space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <div
                                        className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
                                            color: 'white',
                                        }}
                                    >
                                        <IconCheck size={40} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                                            Import Complete!
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#666' }}>
                                            {projectName || 'Your project'} is ready to be fixed
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="glass-button flex-1 justify-center py-3"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleClose();
                                            if (projectId) {
                                                navigate(`/fix-my-app?projectId=${projectId}`);
                                            }
                                        }}
                                        className="glass-button glass-button--glow flex-1 justify-center py-3"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        <span>Open in Fix My App</span>
                                        <IconArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

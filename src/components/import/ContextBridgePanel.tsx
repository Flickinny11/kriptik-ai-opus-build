/**
 * Context Bridge Panel
 *
 * Main import interface for existing codebases.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CloseIcon,
    DownloadIcon,
    GitHubIcon,
    UploadIcon,
    Loader2Icon,
    RefreshCwIcon,
    CheckIcon,
    CodeIcon,
} from '../ui/icons';
import { GitHubConnector } from './GitHubConnector';
import { UploadDropzone } from './UploadDropzone';
import { CodebaseExplorer } from './CodebaseExplorer';
import { PatternViewer } from './PatternViewer';
import { ConventionSummary } from './ConventionSummary';

const accentColor = '#c8ff64';

interface Repository {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    description: string | null;
    private: boolean;
    defaultBranch: string;
    language: string | null;
    updatedAt: Date | string;
}

interface CodebaseProfile {
    id: string;
    structure: {
        root: { name: string; path: string; type: 'file' | 'directory'; children?: unknown[] };
        totalFiles: number;
        totalDirectories: number;
    };
    technologies: {
        framework: string | null;
        language: string;
        styling: string[];
        stateManagement: string | null;
        testing: string[];
        typescript: boolean;
    };
    patterns: Array<{
        type: 'architecture' | 'naming' | 'component' | 'state-management' | 'styling' | 'api';
        name: string;
        description: string;
        examples: Array<{ file: string; code: string }>;
        confidence: number;
    }>;
    conventions: {
        indentation: 'tabs' | 'spaces';
        indentSize: number;
        quoteStyle: 'single' | 'double';
        semicolons: boolean;
        componentStyle: 'functional' | 'class' | 'mixed';
        namingConventions: {
            components: 'PascalCase' | 'camelCase';
            files: 'kebab-case' | 'camelCase' | 'PascalCase';
            variables: 'camelCase' | 'snake_case';
        };
        trailingCommas: boolean;
    };
}

interface ContextBridgePanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
    onImportComplete?: (profile: CodebaseProfile) => void;
}

type ImportSource = 'github' | 'upload' | null;
type ViewMode = 'import' | 'profile';

export function ContextBridgePanel({
    isOpen,
    onClose,
    projectId = 'default',
    onImportComplete,
}: ContextBridgePanelProps) {
    const [importSource, setImportSource] = useState<ImportSource>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('import');
    const [profile, setProfile] = useState<CodebaseProfile | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle GitHub import
    const handleGitHubImport = useCallback(async (
        repo: Repository,
        branch: string,
        accessToken: string
    ) => {
        setIsImporting(true);
        setError(null);

        try {
            const response = await fetch('/api/context/import/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    projectId,
                    owner: repo.owner,
                    repo: repo.name,
                    branch,
                    accessToken,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setProfile(data.profile);
                setViewMode('profile');
                onImportComplete?.(data.profile);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    }, [projectId, onImportComplete]);

    // Handle file upload import
    const handleUploadImport = useCallback(async (
        files: Map<string, string>,
        sourceName: string
    ) => {
        setIsImporting(true);
        setError(null);

        try {
            // Convert Map to object for JSON
            const filesObj: Record<string, string> = {};
            files.forEach((content, path) => {
                filesObj[path] = content;
            });

            const response = await fetch('/api/context/import/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    projectId,
                    files: filesObj,
                    sourceName,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setProfile(data.profile);
                setViewMode('profile');
                onImportComplete?.(data.profile);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    }, [projectId, onImportComplete]);

    // Reset to import view
    const handleNewImport = () => {
        setImportSource(null);
        setViewMode('import');
        setProfile(null);
        setError(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-3xl z-50 flex flex-col overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.98) 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accentColor}20` }}
                                >
                                    <DownloadIcon size={20} style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Context Bridge</h2>
                                    <p className="text-xs text-white/50">
                                        {viewMode === 'import'
                                            ? 'Import existing codebase'
                                            : 'Codebase analysis results'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {viewMode === 'profile' && (
                                    <button
                                        onClick={handleNewImport}
                                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                    >
                                        <RefreshCwIcon size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <CloseIcon size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Error display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                                >
                                    <span className="flex-1">{error}</span>
                                    <button onClick={() => setError(null)}>
                                        <CloseIcon size={16} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <AnimatePresence mode="wait">
                                {/* Import View */}
                                {viewMode === 'import' && !importSource && (
                                    <motion.div
                                        key="source-select"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="space-y-4"
                                    >
                                        <p className="text-white/60 mb-6">
                                            Import your existing codebase to enable seamless continuation.
                                            KripTik will analyze your code structure, patterns, and conventions.
                                        </p>

                                        {/* Import source buttons */}
                                        <motion.button
                                            whileHover={{ scale: 1.02, x: 4 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setImportSource('github')}
                                            className="w-full p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center gap-4 text-left"
                                        >
                                            <div
                                                className="w-12 h-12 rounded-lg flex items-center justify-center"
                                                style={{ background: 'rgba(255,255,255,0.1)' }}
                                            >
                                                <GitHubIcon size={24} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-white">Import from GitHub</h3>
                                                <p className="text-sm text-white/50">
                                                    Connect to your GitHub repository
                                                </p>
                                            </div>
                                        </motion.button>

                                        <motion.button
                                            whileHover={{ scale: 1.02, x: 4 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setImportSource('upload')}
                                            className="w-full p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center gap-4 text-left"
                                        >
                                            <div
                                                className="w-12 h-12 rounded-lg flex items-center justify-center"
                                                style={{ background: 'rgba(255,255,255,0.1)' }}
                                            >
                                                <UploadIcon size={24} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-white">Upload Files</h3>
                                                <p className="text-sm text-white/50">
                                                    Drag and drop a folder or zip file
                                                </p>
                                            </div>
                                        </motion.button>
                                    </motion.div>
                                )}

                                {/* GitHub Connector */}
                                {viewMode === 'import' && importSource === 'github' && (
                                    <motion.div
                                        key="github"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                    >
                                        <GitHubConnector
                                            onSelect={handleGitHubImport}
                                            onCancel={() => setImportSource(null)}
                                        />
                                    </motion.div>
                                )}

                                {/* Upload Dropzone */}
                                {viewMode === 'import' && importSource === 'upload' && (
                                    <motion.div
                                        key="upload"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                    >
                                        <UploadDropzone
                                            onUpload={handleUploadImport}
                                            onCancel={() => setImportSource(null)}
                                            isUploading={isImporting}
                                        />
                                    </motion.div>
                                )}

                                {/* Profile View */}
                                {viewMode === 'profile' && profile && (
                                    <motion.div
                                        key="profile"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="space-y-6"
                                    >
                                        {/* Success banner */}
                                        <div
                                            className="flex items-center gap-3 p-4 rounded-xl"
                                            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}
                                        >
                                            <CheckIcon size={20} style={{ color: accentColor }} />
                                            <div>
                                                <p className="font-medium text-white">Codebase imported successfully!</p>
                                                <p className="text-sm text-white/60">
                                                    {profile.structure.totalFiles} files analyzed across {profile.structure.totalDirectories} directories
                                                </p>
                                            </div>
                                        </div>

                                        {/* Technology stack */}
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/30">
                                            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                                <CodeIcon size={16} style={{ color: accentColor }} />
                                                Technology Stack
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.technologies.framework && (
                                                    <TechBadge label={profile.technologies.framework} type="framework" />
                                                )}
                                                <TechBadge label={profile.technologies.language} type="language" />
                                                {profile.technologies.typescript && (
                                                    <TechBadge label="TypeScript" type="language" />
                                                )}
                                                {profile.technologies.styling.map(s => (
                                                    <TechBadge key={s} label={s} type="styling" />
                                                ))}
                                                {profile.technologies.stateManagement && (
                                                    <TechBadge label={profile.technologies.stateManagement} type="state" />
                                                )}
                                                {profile.technologies.testing.map(t => (
                                                    <TechBadge key={t} label={t} type="testing" />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Two-column layout */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <CodebaseExplorer tree={profile.structure.root as any} />
                                            <ConventionSummary conventions={profile.conventions} />
                                        </div>

                                        {/* Patterns */}
                                        <PatternViewer patterns={profile.patterns} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Loading overlay */}
                        <AnimatePresence>
                            {isImporting && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10"
                                >
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Loader2Icon size={48} style={{ color: accentColor }} />
                                    </motion.div>
                                    <p className="text-white/80 mt-4 font-medium">Analyzing codebase...</p>
                                    <p className="text-white/50 text-sm mt-1">
                                        This may take a minute for large projects
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Tech badge component
function TechBadge({ label, type }: { label: string; type: string }) {
    const colors: Record<string, string> = {
        framework: '#61dafb',
        language: '#3178c6',
        styling: '#c6538c',
        state: '#f59e0b',
        testing: '#22c55e',
    };
    const color = colors[type] || '#6b7280';

    return (
        <span
            className="px-2 py-1 rounded text-xs font-medium capitalize"
            style={{ background: `${color}20`, color }}
        >
            {label}
        </span>
    );
}


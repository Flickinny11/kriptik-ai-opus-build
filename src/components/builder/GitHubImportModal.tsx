/**
 * GitHubImportModal - Import GitHub repositories into KripTik projects
 *
 * Supports:
 * - Repository URL input
 * - Repository info preview
 * - Branch selection
 * - Import progress tracking
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitHubIcon,
    LoadingIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    CodeIcon,
    GlobeIcon
} from '../ui/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface GitHubImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: (result: GitHubImportResult) => void;
}

interface RepoInfo {
    name: string;
    fullName: string;
    description: string | null;
    defaultBranch: string;
    language: string | null;
    stars: number;
    forks: number;
    size: number;
    isPrivate: boolean;
    lastUpdated: string;
}

interface GitHubImportResult {
    projectId: string;
    projectName: string;
    filesImported: number;
    framework: string;
    sourceRepo: string;
}

import { API_URL as API_BASE_URL } from '../../lib/api-config';

export default function GitHubImportModal({
    open,
    onOpenChange,
    onComplete,
}: GitHubImportModalProps) {
    const [repoUrl, setRepoUrl] = useState('');
    const [branch, setBranch] = useState('');
    const [projectName, setProjectName] = useState('');
    const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<GitHubImportResult | null>(null);

    const fetchRepoInfo = useCallback(async () => {
        if (!repoUrl.trim()) {
            setError('Please enter a repository URL');
            return;
        }

        setIsLoading(true);
        setError(null);
        setRepoInfo(null);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/export/github/repo-info?url=${encodeURIComponent(repoUrl)}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to fetch repository info');
            }

            const data = await response.json();
            setRepoInfo(data);
            setBranch(data.defaultBranch);
            setProjectName(data.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch repository');
        } finally {
            setIsLoading(false);
        }
    }, [repoUrl]);

    const handleImport = useCallback(async () => {
        if (!repoInfo) return;

        setIsImporting(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/export/github/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    repoUrl,
                    branch: branch || repoInfo.defaultBranch,
                    projectName: projectName || repoInfo.name,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Import failed');
            }

            const data = await response.json();
            setResult(data);
            onComplete?.(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    }, [repoInfo, repoUrl, branch, projectName, onComplete]);

    const handleClose = useCallback(() => {
        if (isImporting) return;
        setRepoUrl('');
        setBranch('');
        setProjectName('');
        setRepoInfo(null);
        setError(null);
        setResult(null);
        onOpenChange(false);
    }, [isImporting, onOpenChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !repoInfo && !isLoading) {
                e.preventDefault();
                fetchRepoInfo();
            }
        },
        [repoInfo, isLoading, fetchRepoInfo]
    );

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg bg-slate-900 border-slate-700/50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                            <GitHubIcon size={20} />
                        </div>
                        <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                            Clone from GitHub
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Result view */}
                {result ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircleIcon size={20} />
                            <div>
                                <p className="font-medium text-emerald-400">Import Complete!</p>
                                <p className="text-sm text-slate-400">
                                    Imported {result.filesImported} files from {result.sourceRepo}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Project</span>
                                <span className="font-medium text-white">{result.projectName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Framework</span>
                                <span className="font-medium text-amber-400">{result.framework}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Files</span>
                                <span className="font-medium text-white">{result.filesImported}</span>
                            </div>
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
                                <CodeIcon size={16} className="mr-2" />
                                Open Project
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* URL Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">
                                Repository URL
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="https://github.com/owner/repo"
                                    className={cn(
                                        'flex-1 px-4 py-3 rounded-xl',
                                        'bg-slate-800/50 border border-slate-700',
                                        'text-white placeholder:text-slate-500',
                                        'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
                                        'transition-all duration-200'
                                    )}
                                />
                                {!repoInfo && (
                                    <Button
                                        onClick={fetchRepoInfo}
                                        disabled={isLoading || !repoUrl.trim()}
                                        variant="secondary"
                                    >
                                        {isLoading ? (
                                            <LoadingIcon size={16} className="animate-spin" />
                                        ) : (
                                            'Fetch'
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Repository Info */}
                        <AnimatePresence>
                            {repoInfo && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-white flex items-center gap-2">
                                                {repoInfo.fullName}
                                                {repoInfo.isPrivate && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                                        Private
                                                    </span>
                                                )}
                                            </h3>
                                            {repoInfo.description && (
                                                <p className="text-sm text-slate-400 mt-1">
                                                    {repoInfo.description}
                                                </p>
                                            )}
                                        </div>
                                        <a
                                            href={repoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            <GlobeIcon size={16} />
                                        </a>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm">
                                        {repoInfo.language && (
                                            <span className="flex items-center gap-1.5 text-slate-400">
                                                <span className="w-3 h-3 rounded-full bg-amber-500" />
                                                {repoInfo.language}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1.5 text-slate-400">
                                            <span className="h-3.5 w-3.5">⭐</span>
                                            {repoInfo.stars.toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-slate-400">
                                            <span className="h-3.5 w-3.5">🔱</span>
                                            {repoInfo.forks.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Branch input */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 mb-1 block">
                                                Branch
                                            </label>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700">
                                                <span className="text-slate-500">🌿</span>
                                                <input
                                                    type="text"
                                                    value={branch}
                                                    onChange={(e) => setBranch(e.target.value)}
                                                    placeholder={repoInfo.defaultBranch}
                                                    className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 mb-1 block">
                                                Project Name
                                            </label>
                                            <input
                                                type="text"
                                                value={projectName}
                                                onChange={(e) => setProjectName(e.target.value)}
                                                placeholder={repoInfo.name}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400"
                                >
                                    <AlertCircleIcon size={16} />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                disabled={isImporting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="gradient"
                                onClick={handleImport}
                                disabled={!repoInfo || isImporting}
                            >
                                {isImporting ? (
                                    <>
                                        <LoadingIcon size={16} className="mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <GitHubIcon size={16} className="mr-2" />
                                        Import Repository
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}


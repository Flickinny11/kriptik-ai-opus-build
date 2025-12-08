/**
 * GitHub Connector
 *
 * GitHub OAuth and repository selection.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Github,
    Lock,
    Unlock,
    GitBranch,
    Loader2,
    Check,
    ChevronDown,
    Clock,
} from 'lucide-react';

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

interface GitHubConnectorProps {
    onSelect: (repo: Repository, branch: string, accessToken: string) => void;
    onCancel: () => void;
}

export function GitHubConnector({
    onSelect,
    onCancel,
}: GitHubConnectorProps) {
    const [accessToken, setAccessToken] = useState('');
    const [repos, setRepos] = useState<Repository[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
    const [branches, setBranches] = useState<string[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch repos when token is entered
    const fetchRepos = async () => {
        if (!accessToken.trim()) {
            setError('Please enter your GitHub personal access token');
            return;
        }

        setIsLoadingRepos(true);
        setError(null);

        try {
            const response = await fetch(`/api/context/github/repos?accessToken=${encodeURIComponent(accessToken)}`, {
                credentials: 'include',
            });

            const data = await response.json();
            if (data.success) {
                setRepos(data.repos);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
        } finally {
            setIsLoadingRepos(false);
        }
    };

    // Fetch branches when repo is selected
    useEffect(() => {
        if (!selectedRepo || !accessToken) return;

        const fetchBranches = async () => {
            setIsLoadingBranches(true);

            try {
                const response = await fetch(
                    `/api/context/github/branches?owner=${selectedRepo.owner}&repo=${selectedRepo.name}&accessToken=${encodeURIComponent(accessToken)}`,
                    { credentials: 'include' }
                );

                const data = await response.json();
                if (data.success) {
                    setBranches(data.branches);
                    setSelectedBranch(selectedRepo.defaultBranch);
                }
            } catch {
                setBranches([selectedRepo.defaultBranch]);
                setSelectedBranch(selectedRepo.defaultBranch);
            } finally {
                setIsLoadingBranches(false);
            }
        };

        fetchBranches();
    }, [selectedRepo, accessToken]);

    const filteredRepos = repos.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / 86400000);
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    };

    const getLanguageColor = (language: string | null) => {
        const colors: Record<string, string> = {
            TypeScript: '#3178c6',
            JavaScript: '#f7df1e',
            Python: '#3572A5',
            Java: '#b07219',
            Go: '#00ADD8',
            Rust: '#dea584',
            Ruby: '#701516',
            PHP: '#4F5D95',
            CSS: '#563d7c',
            HTML: '#e34c26',
        };
        return colors[language || ''] || '#6b7280';
    };

    return (
        <div className="space-y-6">
            {/* Token input */}
            <div>
                <label className="block text-sm font-medium text-white mb-2">
                    GitHub Personal Access Token
                </label>
                <p className="text-xs text-white/50 mb-3">
                    Generate a token at{' '}
                    <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        style={{ color: accentColor }}
                    >
                        github.com/settings/tokens
                    </a>
                    {' '}with "repo" scope
                </p>
                <div className="flex gap-2">
                    <input
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="flex-1 px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all font-mono text-sm"
                        style={{ '--tw-ring-color': `${accentColor}50` } as any}
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={fetchRepos}
                        disabled={isLoadingRepos}
                        className="px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                        style={{ background: accentColor, color: 'black' }}
                    >
                        {isLoadingRepos ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Github className="w-4 h-4" />
                        )}
                        Connect
                    </motion.button>
                </div>
            </div>

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

            {/* Repository list */}
            {repos.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Search */}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search repositories..."
                        className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all text-sm"
                        style={{ '--tw-ring-color': `${accentColor}50` } as any}
                    />

                    {/* Repo grid */}
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                        {filteredRepos.map(repo => (
                            <motion.button
                                key={repo.id}
                                onClick={() => setSelectedRepo(repo)}
                                whileHover={{ scale: 1.01 }}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${
                                    selectedRepo?.id === repo.id
                                        ? 'border-current bg-white/5'
                                        : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]'
                                }`}
                                style={{
                                    borderColor: selectedRepo?.id === repo.id ? accentColor : undefined,
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white truncate">
                                                {repo.name}
                                            </span>
                                            {repo.private ? (
                                                <Lock className="w-3 h-3 text-white/40" />
                                            ) : (
                                                <Unlock className="w-3 h-3 text-white/40" />
                                            )}
                                        </div>
                                        {repo.description && (
                                            <p className="text-xs text-white/50 mt-1 line-clamp-1">
                                                {repo.description}
                                            </p>
                                        )}
                                    </div>
                                    {selectedRepo?.id === repo.id && (
                                        <Check className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} />
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                                    {repo.language && (
                                        <span className="flex items-center gap-1">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ background: getLanguageColor(repo.language) }}
                                            />
                                            {repo.language}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(repo.updatedAt)}
                                    </span>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Branch selector */}
            {selectedRepo && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    <label className="block text-sm font-medium text-white">
                        Select Branch
                    </label>
                    <div className="relative">
                        <button
                            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                            disabled={isLoadingBranches}
                            className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white flex items-center justify-between hover:border-white/20 transition-all"
                        >
                            <span className="flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-white/50" />
                                {isLoadingBranches ? 'Loading...' : selectedBranch}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showBranchDropdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto"
                                >
                                    {branches.map(branch => (
                                        <button
                                            key={branch}
                                            onClick={() => {
                                                setSelectedBranch(branch);
                                                setShowBranchDropdown(false);
                                            }}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${
                                                branch === selectedBranch ? 'text-white' : 'text-white/70'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <GitBranch className="w-3 h-3" />
                                                {branch}
                                            </span>
                                            {branch === selectedBranch && (
                                                <Check className="w-4 h-4" style={{ color: accentColor }} />
                                            )}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

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
                    onClick={() => {
                        if (selectedRepo && selectedBranch) {
                            onSelect(selectedRepo, selectedBranch, accessToken);
                        }
                    }}
                    disabled={!selectedRepo || !selectedBranch}
                    className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: accentColor, color: 'black' }}
                >
                    <Github className="w-4 h-4" />
                    Import Repository
                </motion.button>
            </div>
        </div>
    );
}


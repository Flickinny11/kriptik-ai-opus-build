/**
 * Codebase Explorer
 *
 * Visual file tree with technology icons and pattern markers.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';

interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
    size?: number;
    extension?: string;
}

interface CodebaseExplorerProps {
    tree: TreeNode;
    className?: string;
}

// File type icons/colors
const FILE_ICONS: Record<string, { icon: string; color: string }> = {
    '.tsx': { icon: '⚛️', color: '#61dafb' },
    '.ts': { icon: '📘', color: '#3178c6' },
    '.jsx': { icon: '⚛️', color: '#61dafb' },
    '.js': { icon: '📒', color: '#f7df1e' },
    '.vue': { icon: '💚', color: '#42b883' },
    '.svelte': { icon: '🔥', color: '#ff3e00' },
    '.css': { icon: '🎨', color: '#264de4' },
    '.scss': { icon: '🎨', color: '#c6538c' },
    '.json': { icon: '📋', color: '#6b7280' },
    '.md': { icon: '📝', color: '#6b7280' },
    '.html': { icon: '🌐', color: '#e34c26' },
    '.py': { icon: '🐍', color: '#3572A5' },
    '.go': { icon: '🔹', color: '#00ADD8' },
    '.rs': { icon: '🦀', color: '#dea584' },
};

function TreeItem({
    node,
    depth = 0,
}: {
    node: TreeNode;
    depth?: number;
}) {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isDir = node.type === 'directory';
    const fileInfo = FILE_ICONS[node.extension || ''] || { icon: '📄', color: '#6b7280' };

    return (
        <div>
            <motion.button
                onClick={() => isDir && setIsOpen(!isOpen)}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded text-left transition-colors"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {isDir ? (
                    <>
                        <ChevronRight
                            className={`w-3 h-3 text-white/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                        {isOpen ? (
                            <FolderOpen className="w-4 h-4 text-amber-400" />
                        ) : (
                            <Folder className="w-4 h-4 text-amber-400" />
                        )}
                    </>
                ) : (
                    <>
                        <span className="w-3" />
                        <span className="text-sm">{fileInfo.icon}</span>
                    </>
                )}
                <span className={`text-sm truncate ${isDir ? 'text-white/80 font-medium' : 'text-white/60'}`}>
                    {node.name}
                </span>
                {!isDir && node.size !== undefined && (
                    <span className="text-[10px] text-white/30 ml-auto">
                        {formatSize(node.size)}
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {isDir && isOpen && node.children && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        {node.children
                            .sort((a, b) => {
                                // Directories first, then alphabetically
                                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map((child) => (
                                <TreeItem key={child.path} node={child} depth={depth + 1} />
                            ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CodebaseExplorer({
    tree,
    className = '',
}: CodebaseExplorerProps) {
    return (
        <div className={`rounded-xl border border-white/10 bg-black/30 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-400" />
                    Project Structure
                </h3>
            </div>

            {/* Tree */}
            <div className="p-2 max-h-96 overflow-y-auto scrollbar-thin">
                {tree.children && tree.children.length > 0 ? (
                    tree.children
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map((child) => (
                            <TreeItem key={child.path} node={child} />
                        ))
                ) : (
                    <p className="text-sm text-white/40 text-center py-4">No files found</p>
                )}
            </div>
        </div>
    );
}


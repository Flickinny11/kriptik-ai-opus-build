/**
 * Sandpack File Explorer Component
 *
 * File tree connected to Sandpack's virtual file system
 */

import { useState, useMemo } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import {
    Folder,
    FolderOpen,
    FileCode,
    FileJson,
    FileText,
    File,
    ChevronRight,
    ChevronDown,
    Plus,
    Trash2,
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from '../ui/context-menu';
import { cn } from '../../lib/utils';

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
}

function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'tsx':
        case 'ts':
        case 'jsx':
        case 'js':
            return <FileCode className="h-4 w-4 text-blue-400" />;
        case 'json':
            return <FileJson className="h-4 w-4 text-yellow-400" />;
        case 'css':
        case 'scss':
        case 'sass':
            return <File className="h-4 w-4 text-pink-400" />;
        case 'html':
            return <FileCode className="h-4 w-4 text-orange-400" />;
        case 'md':
            return <FileText className="h-4 w-4 text-gray-400" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
            return <File className="h-4 w-4 text-green-400" />;
        default:
            return <FileText className="h-4 w-4 text-gray-400" />;
    }
}

function buildFileTree(files: Record<string, any>): FileNode[] {
    const root: FileNode[] = [];
    const pathMap = new Map<string, FileNode>();

    // Sort paths to ensure parents are created before children
    const sortedPaths = Object.keys(files).sort();

    for (const fullPath of sortedPaths) {
        const parts = fullPath.split('/').filter(Boolean);
        let currentPath = '';
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

            let existingNode = pathMap.get(currentPath);

            if (!existingNode) {
                existingNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : [],
                };
                pathMap.set(currentPath, existingNode);
                currentLevel.push(existingNode);
            }

            if (!isFile && existingNode.children) {
                currentLevel = existingNode.children;
            }
        }
    }

    // Sort: folders first, then alphabetically
    const sortNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        }).map(node => ({
            ...node,
            children: node.children ? sortNodes(node.children) : undefined,
        }));
    };

    return sortNodes(root);
}

interface FileTreeNodeProps {
    node: FileNode;
    depth: number;
    activeFile: string;
    onSelectFile: (path: string) => void;
    onDeleteFile: (path: string) => void;
    openFolders: Set<string>;
    toggleFolder: (path: string) => void;
}

function FileTreeNode({
    node,
    depth,
    activeFile,
    onSelectFile,
    onDeleteFile,
    openFolders,
    toggleFolder,
}: FileTreeNodeProps) {
    const isOpen = openFolders.has(node.path);
    const isActive = activeFile === node.path;

    const handleClick = () => {
        if (node.type === 'folder') {
            toggleFolder(node.path);
        } else {
            onSelectFile(node.path);
        }
    };

    return (
        <div>
            <ContextMenu>
                <ContextMenuTrigger>
                    <div
                        className={cn(
                            "flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm transition-colors",
                            "hover:bg-accent/50",
                            isActive && "bg-accent text-accent-foreground"
                        )}
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                        onClick={handleClick}
                    >
                        {node.type === 'folder' && (
                            isOpen
                                ? <ChevronDown className="h-3 w-3 shrink-0" />
                                : <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        {node.type === 'folder' ? (
                            isOpen
                                ? <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
                                : <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                        ) : (
                            getFileIcon(node.name)
                        )}
                        <span className={cn(
                            "truncate",
                            isActive ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {node.name}
                        </span>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    {node.type === 'file' && (
                        <>
                            <ContextMenuItem onClick={() => onSelectFile(node.path)}>
                                <FileCode className="mr-2 h-4 w-4" />
                                Open
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                        </>
                    )}
                    <ContextMenuItem onClick={() => onDeleteFile(node.path)}>
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {node.type === 'folder' && isOpen && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            activeFile={activeFile}
                            onSelectFile={onSelectFile}
                            onDeleteFile={onDeleteFile}
                            openFolders={openFolders}
                            toggleFolder={toggleFolder}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SandpackFileExplorer() {
    const { sandpack } = useSandpack();
    const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['/src', '/public']));
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');

    const fileTree = useMemo(() => buildFileTree(sandpack.files), [sandpack.files]);

    const toggleFolder = (path: string) => {
        setOpenFolders(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleSelectFile = (path: string) => {
        sandpack.setActiveFile(path);
    };

    const handleDeleteFile = (path: string) => {
        if (confirm(`Delete ${path}?`)) {
            sandpack.deleteFile(path);
        }
    };

    const handleCreateFile = () => {
        if (newFileName.trim()) {
            const path = newFileName.startsWith('/') ? newFileName : `/src/${newFileName}`;
            sandpack.addFile({ [path]: '' });
            sandpack.setActiveFile(path);
            setNewFileName('');
            setIsCreatingFile(false);
        }
    };

    return (
        <div className="h-full bg-card flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Explorer
                </h2>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsCreatingFile(true)}
                    title="New File"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* New File Input */}
            {isCreatingFile && (
                <div className="p-2 border-b border-border">
                    <Input
                        autoFocus
                        placeholder="filename.tsx"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFile();
                            if (e.key === 'Escape') {
                                setIsCreatingFile(false);
                                setNewFileName('');
                            }
                        }}
                        onBlur={() => {
                            if (!newFileName) setIsCreatingFile(false);
                        }}
                        className="h-7 text-sm"
                    />
                </div>
            )}

            {/* File Tree */}
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {fileTree.map((node) => (
                        <FileTreeNode
                            key={node.path}
                            node={node}
                            depth={0}
                            activeFile={sandpack.activeFile}
                            onSelectFile={handleSelectFile}
                            onDeleteFile={handleDeleteFile}
                            openFolders={openFolders}
                            toggleFolder={toggleFolder}
                        />
                    ))}
                </div>
            </ScrollArea>

            {/* File count */}
            <div className="p-2 border-t border-border text-xs text-muted-foreground text-center">
                {Object.keys(sandpack.files).length} files
            </div>
        </div>
    );
}


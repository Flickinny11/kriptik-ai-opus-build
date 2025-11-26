
import { Folder, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface FileNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    isOpen?: boolean;
}

const initialFiles: FileNode[] = [
    {
        id: 'root',
        name: 'src',
        type: 'folder',
        isOpen: true,
        children: [
            {
                id: 'components',
                name: 'components',
                type: 'folder',
                isOpen: true,
                children: [
                    { id: 'App.tsx', name: 'App.tsx', type: 'file' },
                    { id: 'Button.tsx', name: 'Button.tsx', type: 'file' },
                ]
            },
            { id: 'main.tsx', name: 'main.tsx', type: 'file' },
            { id: 'index.css', name: 'index.css', type: 'file' },
        ]
    },
    { id: 'package.json', name: 'package.json', type: 'file' },
    { id: 'vite.config.ts', name: 'vite.config.ts', type: 'file' },
];

export default function FileExplorer() {
    const renderNode = (node: FileNode, depth = 0) => {
        return (
            <div key={node.id}>
                <div
                    className="flex items-center gap-2 py-1 px-2 hover:bg-accent/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    {node.type === 'folder' && (
                        node.isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                    )}
                    {node.type === 'folder' ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                    ) : (
                        <FileCode className="h-4 w-4 text-yellow-500" />
                    )}
                    <span>{node.name}</span>
                </div>
                {node.type === 'folder' && node.isOpen && node.children?.map(child => renderNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="h-full bg-card border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Explorer</h2>
            </div>
            <ScrollArea className="flex-1">
                <div className="py-2">
                    {initialFiles.map(node => renderNode(node))}
                </div>
            </ScrollArea>
        </div>
    );
}

/**
 * Sandpack Preview Component
 *
 * Live preview of the generated code using Sandpack
 */

import { useState } from 'react';
import {
    SandpackPreview as SandpackPreviewBase,
    SandpackConsole,
    useSandpack,
} from '@codesandbox/sandpack-react';
import { RefreshCw, Smartphone, Tablet, Monitor, Terminal, ExternalLink, MousePointer2, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useEditorStore } from '../../store/useEditorStore';
import { cn } from '../../lib/utils';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; label: string }> = {
    mobile: { width: 375, label: '375px' },
    tablet: { width: 768, label: '768px' },
    desktop: { width: 1280, label: '100%' },
};

export default function SandpackPreviewWindow() {
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const [showConsole, setShowConsole] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { isSelectionMode, toggleSelectionMode } = useEditorStore();
    const { sandpack } = useSandpack();

    const handleRefresh = () => {
        // Force a refresh by resetting the bundler
        sandpack.runSandpack();
    };

    const handleOpenExternal = () => {
        // Open preview in a new tab (if URL available)
        // This would require the preview URL from sandpack
        window.open('about:blank', '_blank');
    };

    return (
        <div className={cn(
            "h-full flex flex-col bg-background",
            isFullscreen && "fixed inset-0 z-50"
        )}>
            {/* Toolbar */}
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
                <div className="flex items-center gap-2">
                    {/* Viewport Selector */}
                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 rounded-sm",
                                viewport === 'mobile' && "bg-background shadow-sm"
                            )}
                            onClick={() => setViewport('mobile')}
                            title="Mobile (375px)"
                        >
                            <Smartphone className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 rounded-sm",
                                viewport === 'tablet' && "bg-background shadow-sm"
                            )}
                            onClick={() => setViewport('tablet')}
                            title="Tablet (768px)"
                        >
                            <Tablet className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 rounded-sm",
                                viewport === 'desktop' && "bg-background shadow-sm"
                            )}
                            onClick={() => setViewport('desktop')}
                            title="Desktop (100%)"
                        >
                            <Monitor className="h-3 w-3" />
                        </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {VIEWPORT_SIZES[viewport].label}
                    </span>

                    {/* Status indicator */}
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            sandpack.status === 'running' ? "bg-green-500" :
                            sandpack.status === 'idle' ? "bg-yellow-500" :
                            "bg-red-500"
                        )} />
                        <span className="text-xs text-muted-foreground capitalize">
                            {sandpack.status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={isSelectionMode ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleSelectionMode}
                        title="Select Element (click to edit source)"
                    >
                        <MousePointer2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={showConsole ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowConsole(!showConsole)}
                        title="Toggle Console"
                    >
                        <Terminal className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRefresh}
                        title="Refresh Preview"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title="Toggle Fullscreen"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleOpenExternal}
                        title="Open in New Tab"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Preview Container */}
            <div className="flex-1 bg-muted/50 p-4 flex items-start justify-center overflow-auto">
                <div
                    className={cn(
                        "bg-white rounded-lg shadow-2xl overflow-hidden border border-border transition-all duration-300",
                        viewport === 'desktop' ? "w-full h-full" : "h-[600px]"
                    )}
                    style={{
                        width: viewport !== 'desktop' ? VIEWPORT_SIZES[viewport].width : '100%',
                        maxWidth: '100%',
                    }}
                >
                    <SandpackPreviewBase
                        showNavigator={false}
                        showRefreshButton={false}
                        showOpenInCodeSandbox={false}
                        style={{ height: '100%' }}
                    />
                </div>
            </div>

            {/* Console Panel */}
            {showConsole && (
                <div className="h-48 border-t border-border bg-black shrink-0">
                    <div className="h-8 border-b border-border/50 flex items-center px-3 bg-card/50">
                        <Terminal className="h-3 w-3 mr-2 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Console</span>
                    </div>
                    <div className="h-[calc(100%-2rem)] overflow-auto">
                        <SandpackConsole
                            showHeader={false}
                            style={{ height: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* Selection Mode Indicator */}
            {isSelectionMode && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4 z-10">
                    Click an element to view its source code
                </div>
            )}
        </div>
    );
}


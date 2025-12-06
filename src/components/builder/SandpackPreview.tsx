/**
 * Sandpack Preview Component - Liquid Glass Design
 *
 * Live preview of the generated code using Sandpack
 * with premium liquid glass styling
 */

import { useState } from 'react';
import {
    SandpackPreview as SandpackPreviewBase,
    SandpackConsole,
    useSandpack,
} from '@codesandbox/sandpack-react';
import { RefreshCw, Smartphone, Tablet, Monitor, Terminal, ExternalLink, MousePointer2, Maximize2 } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; label: string }> = {
    mobile: { width: 375, label: '375px' },
    tablet: { width: 768, label: '768px' },
    desktop: { width: 1280, label: '100%' },
};

// Liquid Glass Device Button
function DeviceButton({
    icon: Icon,
    isActive,
    onClick,
    title
}: {
    icon: React.ElementType;
    isActive: boolean;
    onClick: () => void;
    title: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'transparent',
                boxShadow: isActive
                    ? `inset 0 0 12px rgba(255, 160, 120, 0.2), 0 2px 8px rgba(255, 140, 100, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : isHovered
                        ? `0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.4)`
                        : 'none',
                transform: isHovered && !isActive ? 'scale(1.05)' : 'scale(1)',
            }}
        >
            <Icon
                className="w-4 h-4"
                style={{ color: isActive ? '#92400e' : isHovered ? '#1a1a1a' : '#666' }}
            />

            {/* Shine effect */}
            {(isActive || isHovered) && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isHovered ? '150%' : '-100%',
                        width: '60%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                        transform: 'skewX(-15deg)',
                        transition: 'left 0.4s ease',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </button>
    );
}

// Liquid Glass Icon Button
function GlassIconButton({
    icon: Icon,
    onClick,
    isActive = false,
    title
}: {
    icon: React.ElementType;
    onClick?: () => void;
    isActive?: boolean;
    title?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.55) 0%, rgba(255,180,150,0.4) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                backdropFilter: 'blur(12px)',
                boxShadow: isActive
                    ? `inset 0 0 12px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(255, 140, 100, 0.12), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : isHovered
                        ? `0 4px 14px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`
                        : `0 2px 6px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.3)`,
                transform: isHovered ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
            }}
        >
            <Icon
                className="w-4 h-4"
                style={{ color: isActive ? '#c25a00' : '#1a1a1a' }}
            />

            {/* Shine effect */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.4s ease',
                    pointerEvents: 'none',
                }}
            />
        </button>
    );
}

export default function SandpackPreviewWindow() {
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const [showConsole, setShowConsole] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { isSelectionMode, toggleSelectionMode } = useEditorStore();
    const { sandpack } = useSandpack();

    const handleRefresh = () => {
        sandpack.runSandpack();
    };

    const handleOpenExternal = () => {
        window.open('about:blank', '_blank');
    };

    return (
        <div
            className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={{ background: 'transparent' }}
        >
            {/* Toolbar - Liquid Glass */}
            <div
                className="h-14 flex items-center justify-between px-4 shrink-0"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                    backdropFilter: 'blur(16px)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <div className="flex items-center gap-3">
                    {/* Viewport Selector - Liquid Glass Pill */}
                    <div
                        className="flex gap-1 p-1.5 rounded-xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                            boxShadow: `
                                0 2px 8px rgba(0,0,0,0.04),
                                inset 0 1px 2px rgba(255,255,255,0.9),
                                0 0 0 1px rgba(255,255,255,0.4)
                            `,
                        }}
                    >
                        <DeviceButton
                            icon={Smartphone}
                            isActive={viewport === 'mobile'}
                            onClick={() => setViewport('mobile')}
                            title="Mobile (375px)"
                        />
                        <DeviceButton
                            icon={Tablet}
                            isActive={viewport === 'tablet'}
                            onClick={() => setViewport('tablet')}
                            title="Tablet (768px)"
                        />
                        <DeviceButton
                            icon={Monitor}
                            isActive={viewport === 'desktop'}
                            onClick={() => setViewport('desktop')}
                            title="Desktop (100%)"
                        />
                    </div>

                    <span className="text-xs font-medium" style={{ color: '#666' }}>
                        {VIEWPORT_SIZES[viewport].label}
                    </span>

                    {/* Status indicator */}
                    <div
                        className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg"
                        style={{
                            background: sandpack.status === 'running'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : sandpack.status === 'idle'
                                    ? 'rgba(234, 179, 8, 0.1)'
                                    : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${
                                sandpack.status === 'running'
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : sandpack.status === 'idle'
                                        ? 'rgba(234, 179, 8, 0.2)'
                                        : 'rgba(239, 68, 68, 0.2)'
                            }`,
                        }}
                    >
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{
                                background: sandpack.status === 'running'
                                    ? '#10b981'
                                    : sandpack.status === 'idle'
                                        ? '#eab308'
                                        : '#ef4444',
                            }}
                        />
                        <span
                            className="text-xs font-medium capitalize"
                            style={{
                                color: sandpack.status === 'running'
                                    ? '#059669'
                                    : sandpack.status === 'idle'
                                        ? '#ca8a04'
                                        : '#dc2626',
                            }}
                        >
                            {sandpack.status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <GlassIconButton
                        icon={MousePointer2}
                        isActive={isSelectionMode}
                        onClick={toggleSelectionMode}
                        title="Select Element"
                    />
                    <GlassIconButton
                        icon={Terminal}
                        isActive={showConsole}
                        onClick={() => setShowConsole(!showConsole)}
                        title="Toggle Console"
                    />
                    <GlassIconButton
                        icon={RefreshCw}
                        onClick={handleRefresh}
                        title="Refresh Preview"
                    />
                    <GlassIconButton
                        icon={Maximize2}
                        isActive={isFullscreen}
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title="Toggle Fullscreen"
                    />
                    <GlassIconButton
                        icon={ExternalLink}
                        onClick={handleOpenExternal}
                        title="Open in New Tab"
                    />
                </div>
            </div>

            {/* Preview Container - Liquid Glass Frame */}
            <div
                className="flex-1 p-4 flex items-start justify-center overflow-auto"
                style={{
                    background: 'linear-gradient(180deg, rgba(200,195,190,0.3) 0%, rgba(180,175,170,0.2) 100%)',
                }}
            >
                {/* Device Frame */}
                <div
                    className={`transition-all duration-500 ${viewport === 'desktop' ? 'w-full h-full' : 'h-[600px]'}`}
                    style={{
                        width: viewport !== 'desktop' ? VIEWPORT_SIZES[viewport].width : '100%',
                        maxWidth: '100%',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: `
                            0 25px 80px rgba(0,0,0,0.15),
                            0 10px 30px rgba(0,0,0,0.1),
                            inset 0 2px 4px rgba(255,255,255,0.95),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `,
                        padding: '4px',
                    }}
                >
                    {/* Inner frame for preview */}
                    <div
                        className="w-full h-full rounded-2xl overflow-hidden"
                        style={{
                            background: '#ffffff',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)',
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
            </div>

            {/* Console Panel - Dark Glass */}
            {showConsole && (
                <div
                    className="h-48 shrink-0"
                    style={{
                        background: 'linear-gradient(145deg, rgba(30,30,35,0.98) 0%, rgba(20,20,25,1) 100%)',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        className="h-9 flex items-center px-4"
                        style={{
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)',
                        }}
                    >
                        <Terminal className="h-3.5 w-3.5 mr-2" style={{ color: '#666' }} />
                        <span className="text-xs font-medium" style={{ color: '#888' }}>Console</span>
                    </div>
                    <div className="h-[calc(100%-2.25rem)] overflow-auto">
                        <SandpackConsole
                            showHeader={false}
                            style={{ height: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* Selection Mode Indicator */}
            {isSelectionMode && (
                <div
                    className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-xl text-sm font-medium z-10"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,200,170,0.9) 0%, rgba(255,180,150,0.8) 100%)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: `
                            0 8px 32px rgba(255, 140, 100, 0.3),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255, 200, 170, 0.6)
                        `,
                        color: '#92400e',
                        animation: 'fadeSlideIn 0.3s ease-out',
                    }}
                >
                    Click an element to view its source code
                </div>
            )}

            <style>{`
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -10px);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                }
            `}</style>
        </div>
    );
}

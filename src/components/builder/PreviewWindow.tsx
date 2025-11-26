import { RefreshCw, Smartphone, Tablet, Monitor, MousePointer2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useEditorStore } from '../../store/useEditorStore';
import { cn } from '../../lib/utils';

export default function PreviewWindow() {
    const { isSelectionMode, toggleSelectionMode, setSelectedElement } = useEditorStore();

    const handleElementClick = (e: React.MouseEvent) => {
        if (!isSelectionMode) return;

        e.preventDefault();
        e.stopPropagation();

        // In a real implementation, we would use a more sophisticated method to map
        // DOM elements to source code (e.g. using data-source-loc attributes injected by babel plugin)
        // For this demo, we'll simulate finding a component

        setSelectedElement({
            file: 'src/components/Hero.tsx',
            line: 10, // Simulated line number
            componentName: 'Hero'
        });

        toggleSelectionMode(); // Turn off selection mode after picking
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm">
                            <Smartphone className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm">
                            <Tablet className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm bg-background shadow-sm">
                            <Monitor className="h-3 w-3" />
                        </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">1280 x 800</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isSelectionMode ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleSelectionMode}
                        title="Select Element"
                    >
                        <MousePointer2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 bg-muted/50 p-8 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden border border-border relative">
                    {/* Simulated App Content for Selection Demo */}
                    <div
                        className={cn(
                            "w-full h-full p-8 overflow-auto",
                            isSelectionMode && "cursor-crosshair [&_*]:hover:outline [&_*]:hover:outline-2 [&_*]:hover:outline-primary [&_*]:hover:bg-primary/5"
                        )}
                        onClick={handleElementClick}
                    >
                        <div className="max-w-2xl mx-auto space-y-8">
                            <h1 className="text-4xl font-bold text-gray-900">Welcome to KripTik AI</h1>
                            <p className="text-lg text-gray-600">
                                Build production-ready apps at the speed of thought.
                                Our AI-powered editor helps you write better code, faster.
                            </p>
                            <div className="flex gap-4">
                                <button className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                                    Get Started
                                </button>
                                <button className="px-6 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors text-gray-900">
                                    Learn More
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mt-12">
                                <div className="p-6 border border-gray-100 rounded-xl bg-gray-50">
                                    <h3 className="font-semibold mb-2 text-gray-900">AI Powered</h3>
                                    <p className="text-sm text-gray-500">Smart suggestions and automated refactoring.</p>
                                </div>
                                <div className="p-6 border border-gray-100 rounded-xl bg-gray-50">
                                    <h3 className="font-semibold mb-2 text-gray-900">Production Ready</h3>
                                    <p className="text-sm text-gray-500">Built-in quality checks and deployment pipelines.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isSelectionMode && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">
                            Select an element to edit
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

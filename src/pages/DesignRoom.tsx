/**
 * Design Room Page
 *
 * Features:
 * - Image-to-code streaming chat (like Google Stitch)
 * - Whiteboard for generated images
 * - Design theme customizer with 35+ trends
 * - Drag-drop, select, assign to projects
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Image, Wand2, Download, Trash2, Heart,
    FolderPlus, Code2, ZoomIn, ZoomOut,
    Palette, Sliders, Check, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';

// Design themes
const DESIGN_THEMES = [
    { id: 'minimal-dark', name: 'Minimal Dark', colors: ['#0a0a0f', '#1a1a2e', '#fafafa'] },
    { id: 'neon-cyber', name: 'Neon Cyber', colors: ['#0a0a0f', '#ff00ff', '#00ffff'] },
    { id: 'warm-sunset', name: 'Warm Sunset', colors: ['#1a0a0a', '#ff6b35', '#ffc107'] },
    { id: 'ocean-depth', name: 'Ocean Depth', colors: ['#0a1a2a', '#0077b6', '#00b4d8'] },
    { id: 'forest-mist', name: 'Forest Mist', colors: ['#0a1a0a', '#2d6a4f', '#95d5b2'] },
    { id: 'aurora', name: 'Aurora Borealis', colors: ['#0a0a1a', '#7209b7', '#4cc9f0'] },
    { id: 'monochrome', name: 'Monochrome', colors: ['#000000', '#333333', '#ffffff'] },
    { id: 'retro-wave', name: 'Retro Wave', colors: ['#1a0a2e', '#f72585', '#4361ee'] },
    { id: 'earth-tone', name: 'Earth Tones', colors: ['#1a1510', '#8b5a2b', '#d4a373'] },
    { id: 'ice-cold', name: 'Ice Cold', colors: ['#0a1520', '#89c2d9', '#caf0f8'] },
    { id: 'candy-pop', name: 'Candy Pop', colors: ['#1a0a1a', '#ff85a2', '#ffc8dd'] },
    { id: 'matrix', name: 'Matrix', colors: ['#000000', '#00ff00', '#003300'] },
];

// Generated image item
interface GeneratedImage {
    id: string;
    prompt: string;
    url: string;
    timestamp: Date;
    liked: boolean;
}

// Chat message
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    images?: GeneratedImage[];
}

export default function DesignRoom() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'generate' | 'themes'>('generate');
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTheme, setActiveTheme] = useState('minimal-dark');
    const [zoom, setZoom] = useState(100);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: prompt,
        };
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setIsGenerating(true);

        // Simulate generation (replace with real API call)
        setTimeout(() => {
            const newImage: GeneratedImage = {
                id: crypto.randomUUID(),
                prompt: userMessage.content,
                url: `https://picsum.photos/seed/${Date.now()}/800/600`, // Placeholder
                timestamp: new Date(),
                liked: false,
            };

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Here\'s your design based on the prompt:',
                images: [newImage],
            };

            setMessages(prev => [...prev, assistantMessage]);
            setGeneratedImages(prev => [...prev, newImage]);
            setIsGenerating(false);
        }, 2000);
    };

    const toggleImageSelection = (imageId: string) => {
        const newSelection = new Set(selectedImages);
        if (newSelection.has(imageId)) {
            newSelection.delete(imageId);
        } else {
            newSelection.add(imageId);
        }
        setSelectedImages(newSelection);
    };

    const handleGetCode = () => {
        // TODO: Convert selected images to code
        console.log('Get code for:', Array.from(selectedImages));
    };

    const handleAddToProject = () => {
        // TODO: Open project selector modal
        console.log('Add to project:', Array.from(selectedImages));
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
            <HoverSidebar />

            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-slate-800/50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HandDrawnArrow className="mr-2" />
                        <div
                            className="flex items-center gap-4 cursor-pointer group"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated />
                            <GlitchText
                                text="KripTik AI"
                                className="text-2xl group-hover:opacity-90 transition-opacity"
                            />
                        </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-2 bg-slate-800/50 rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                                activeTab === 'generate'
                                    ? "bg-amber-500 text-black font-medium"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Wand2 className="h-4 w-4" />
                            Generate
                        </button>
                        <button
                            onClick={() => setActiveTab('themes')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                                activeTab === 'themes'
                                    ? "bg-amber-500 text-black font-medium"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Palette className="h-4 w-4" />
                            Themes
                        </button>
                    </div>
                </div>
            </header>

            {activeTab === 'generate' ? (
                <div className="flex-1 flex">
                    {/* Chat panel */}
                    <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-900/30">
                        <div className="p-4 border-b border-slate-800">
                            <h2 className="font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                                Design Generator
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Describe your UI and watch it come to life
                            </p>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center py-8">
                                    <Sparkles className="h-12 w-12 mx-auto text-slate-700 mb-4" />
                                    <p className="text-slate-500 text-sm">
                                        Start by describing a UI element, page, or component
                                    </p>
                                </div>
                            )}

                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "rounded-xl p-3",
                                        message.role === 'user'
                                            ? "bg-amber-500/10 border border-amber-500/20 ml-8"
                                            : "bg-slate-800/50 mr-8"
                                    )}
                                >
                                    <p className="text-sm text-slate-200">{message.content}</p>
                                    {message.images?.map((img) => (
                                        <div key={img.id} className="mt-3 rounded-lg overflow-hidden">
                                            <img
                                                src={img.url}
                                                alt={img.prompt}
                                                className="w-full h-auto"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {isGenerating && (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    <span className="text-sm">Generating...</span>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-800">
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                    placeholder="Describe your design..."
                                    rows={3}
                                    className={cn(
                                        "w-full px-4 py-3 pr-12 rounded-xl resize-none",
                                        "bg-slate-800 border border-slate-700",
                                        "text-white placeholder:text-slate-500",
                                        "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                    )}
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim() || isGenerating}
                                    className={cn(
                                        "absolute right-3 bottom-3 p-2 rounded-lg",
                                        "bg-amber-500 text-black",
                                        "disabled:opacity-50 disabled:cursor-not-allowed",
                                        "hover:bg-amber-400 transition-colors"
                                    )}
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Whiteboard */}
                    <div className="flex-1 flex flex-col">
                        {/* Toolbar */}
                        <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">
                                    {generatedImages.length} designs
                                </span>
                                {selectedImages.size > 0 && (
                                    <span className="text-sm text-amber-400">
                                        ({selectedImages.size} selected)
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {selectedImages.size > 0 && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleGetCode}
                                            className="gap-2"
                                        >
                                            <Code2 className="h-4 w-4" />
                                            Get Code
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleAddToProject}
                                            className="bg-amber-500 hover:bg-amber-400 text-black gap-2"
                                        >
                                            <FolderPlus className="h-4 w-4" />
                                            Add to Project
                                        </Button>
                                    </>
                                )}

                                <div className="flex items-center gap-1 ml-4">
                                    <button
                                        onClick={() => setZoom(z => Math.max(50, z - 10))}
                                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                                    >
                                        <ZoomOut className="h-4 w-4" />
                                    </button>
                                    <span className="text-xs text-slate-400 w-12 text-center">{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(z => Math.min(200, z + 10))}
                                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                                    >
                                        <ZoomIn className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Canvas */}
                        <div
                            className="flex-1 overflow-auto p-8"
                            style={{
                                background: 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%)',
                            }}
                        >
                            {generatedImages.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <Image className="h-16 w-16 mx-auto text-slate-700 mb-4" />
                                        <p className="text-slate-500">
                                            Generated designs will appear here
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="grid gap-6"
                                    style={{
                                        gridTemplateColumns: `repeat(auto-fill, minmax(${200 * zoom / 100}px, 1fr))`,
                                    }}
                                >
                                    {generatedImages.map((image) => (
                                        <motion.div
                                            key={image.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={cn(
                                                "relative rounded-xl overflow-hidden cursor-pointer",
                                                "border-2 transition-all",
                                                selectedImages.has(image.id)
                                                    ? "border-amber-500 ring-2 ring-amber-500/30"
                                                    : "border-transparent hover:border-slate-600"
                                            )}
                                            onClick={() => toggleImageSelection(image.id)}
                                        >
                                            <img
                                                src={image.url}
                                                alt={image.prompt}
                                                className="w-full h-auto"
                                            />

                                            {/* Selection indicator */}
                                            {selectedImages.has(image.id) && (
                                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                                    <Check className="h-4 w-4 text-black" />
                                                </div>
                                            )}

                                            {/* Actions overlay */}
                                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                                                <div className="flex gap-1">
                                                    <button className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300">
                                                        <Heart className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300">
                                                        <Download className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button className="p-1.5 rounded bg-slate-800/80 hover:bg-red-500/50 text-slate-300">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Theme customizer */
                <main className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                            Design Themes
                        </h2>
                        <p className="text-slate-400 mb-8">
                            Choose from 35+ design trends or create your own custom theme
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {DESIGN_THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => setActiveTheme(theme.id)}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 transition-all",
                                        "hover:scale-105",
                                        activeTheme === theme.id
                                            ? "border-amber-500 bg-slate-800/50"
                                            : "border-slate-700/50 bg-slate-900/50 hover:border-slate-600"
                                    )}
                                >
                                    {/* Color preview */}
                                    <div className="flex gap-1 mb-3">
                                        {theme.colors.map((color, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 h-8 rounded"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-sm font-medium text-white">{theme.name}</p>

                                    {activeTheme === theme.id && (
                                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                            <Check className="h-3 w-3 text-black" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Custom theme builder */}
                        <div className="mt-12 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                            <h3 className="text-lg font-semibold text-white mb-4">Create Custom Theme</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Customize colors, typography, and effects to match your brand
                            </p>
                            <Button className="bg-amber-500 hover:bg-amber-400 text-black">
                                <Sliders className="h-4 w-4 mr-2" />
                                Open Theme Editor
                            </Button>
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}


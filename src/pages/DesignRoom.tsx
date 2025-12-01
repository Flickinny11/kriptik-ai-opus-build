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
import { motion } from 'framer-motion';
import {
    Send, Image, Wand2, Download, Trash2, Heart,
    FolderPlus, Code2, ZoomIn, ZoomOut,
    Palette, Sliders, Check, Sparkles
} from 'lucide-react';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';
import '../styles/realistic-glass.css';

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
        <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
            <HoverSidebar />

            {/* Header - 3D Glass */}
            <header
                className="sticky top-0 z-40"
                style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.45) 100%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    boxShadow: `
                        0 4px 20px rgba(0, 0, 0, 0.06),
                        0 1px 0 rgba(255, 255, 255, 0.8),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.04),
                        inset 0 1px 1px rgba(255, 255, 255, 0.9)
                    `,
                }}
            >
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
                    <div className="flex gap-2 glass-panel rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                                activeTab === 'generate' && "glass-button--glow"
                            )}
                            style={{
                                background: activeTab === 'generate' ? 'rgba(160,56,16,0.9)' : 'transparent',
                                color: activeTab === 'generate' ? 'white' : '#666',
                                fontWeight: activeTab === 'generate' ? 500 : 400,
                            }}
                        >
                            <Wand2 className="h-4 w-4" />
                            Generate
                        </button>
                        <button
                            onClick={() => setActiveTab('themes')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                                activeTab === 'themes' && "glass-button--glow"
                            )}
                            style={{
                                background: activeTab === 'themes' ? 'rgba(160,56,16,0.9)' : 'transparent',
                                color: activeTab === 'themes' ? 'white' : '#666',
                                fontWeight: activeTab === 'themes' ? 500 : 400,
                            }}
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
                    <div className="w-96 flex flex-col glass-panel" style={{ borderRight: '1px solid rgba(0,0,0,0.08)', borderRadius: 0 }}>
                        <div className="p-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                            <h2 className="font-semibold" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                                Design Generator
                            </h2>
                            <p className="text-sm mt-1" style={{ color: '#666' }}>
                                Describe your UI and watch it come to life
                            </p>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center py-8">
                                    <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: '#a03810' }} />
                                    <p className="text-sm" style={{ color: '#888' }}>
                                        Start by describing a UI element, page, or component
                                    </p>
                                </div>
                            )}

                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className="rounded-xl p-3"
                                    style={{
                                        background: message.role === 'user' ? 'rgba(160,56,16,0.1)' : 'rgba(255,255,255,0.5)',
                                        border: message.role === 'user' ? '1px solid rgba(160,56,16,0.2)' : '1px solid rgba(0,0,0,0.08)',
                                        marginLeft: message.role === 'user' ? '32px' : 0,
                                        marginRight: message.role === 'user' ? 0 : '32px',
                                    }}
                                >
                                    <p className="text-sm" style={{ color: '#1a1a1a' }}>{message.content}</p>
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
                                <div className="flex items-center gap-2" style={{ color: '#666' }}>
                                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#a03810' }} />
                                    <span className="text-sm">Generating...</span>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
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
                                    className="glass-input w-full resize-none"
                                    style={{ paddingRight: '48px', color: '#1a1a1a' }}
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim() || isGenerating}
                                    className="absolute right-3 bottom-3 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: 'linear-gradient(135deg, #a03810, #ea580c)', color: 'white' }}
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Whiteboard */}
                    <div className="flex-1 flex flex-col">
                        {/* Toolbar */}
                        <div className="h-12 flex items-center justify-between px-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm" style={{ color: '#666' }}>
                                    {generatedImages.length} designs
                                </span>
                                {selectedImages.size > 0 && (
                                    <span className="text-sm" style={{ color: '#a03810' }}>
                                        ({selectedImages.size} selected)
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {selectedImages.size > 0 && (
                                    <>
                                        <button
                                            onClick={handleGetCode}
                                            className="glass-button glass-button--small"
                                            style={{ color: '#1a1a1a' }}
                                        >
                                            <Code2 className="h-4 w-4 mr-1 inline" />
                                            Get Code
                                        </button>
                                        <button
                                            onClick={handleAddToProject}
                                            className="glass-button glass-button--small glass-button--glow"
                                            style={{ color: '#a03810' }}
                                        >
                                            <FolderPlus className="h-4 w-4 mr-1 inline" />
                                            Add to Project
                                        </button>
                                    </>
                                )}

                                <div className="flex items-center gap-1 ml-4">
                                    <button
                                        onClick={() => setZoom(z => Math.max(50, z - 10))}
                                        className="p-1.5 rounded transition-colors"
                                        style={{ color: '#666' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <ZoomOut className="h-4 w-4" />
                                    </button>
                                    <span className="text-xs w-12 text-center" style={{ color: '#666' }}>{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(z => Math.min(200, z + 10))}
                                        className="p-1.5 rounded transition-colors"
                                        style={{ color: '#666' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                                background: 'linear-gradient(145deg, #d8d4cf, #ccc8c3)',
                            }}
                        >
                            {generatedImages.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <Image className="h-16 w-16 mx-auto mb-4" style={{ color: '#888' }} />
                                        <p style={{ color: '#888' }}>
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
                                            className="relative rounded-xl overflow-hidden cursor-pointer glass-panel border-2 transition-all"
                                            style={{
                                                borderColor: selectedImages.has(image.id) ? '#a03810' : 'transparent',
                                                boxShadow: selectedImages.has(image.id) ? '0 0 0 2px rgba(160,56,16,0.3)' : undefined,
                                            }}
                                            onClick={() => toggleImageSelection(image.id)}
                                        >
                                            <img
                                                src={image.url}
                                                alt={image.prompt}
                                                className="w-full h-auto"
                                            />

                                            {/* Selection indicator */}
                                            {selectedImages.has(image.id) && (
                                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#a03810' }}>
                                                    <Check className="h-4 w-4 text-white" />
                                                </div>
                                            )}

                                            {/* Actions overlay */}
                                            <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                                                <div className="flex gap-1">
                                                    <button className="p-1.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.5)', color: '#1a1a1a' }}>
                                                        <Heart className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button className="p-1.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.5)', color: '#1a1a1a' }}>
                                                        <Download className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button className="p-1.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.5)', color: '#dc2626' }}>
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
                        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                            Design Themes
                        </h2>
                        <p className="mb-8" style={{ color: '#666' }}>
                            Choose from 35+ design trends or create your own custom theme
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {DESIGN_THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => setActiveTheme(theme.id)}
                                    className="glass-panel relative p-4 rounded-xl border-2 transition-all hover:scale-105"
                                    style={{
                                        borderColor: activeTheme === theme.id ? '#a03810' : 'transparent',
                                    }}
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
                                    <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{theme.name}</p>

                                    {activeTheme === theme.id && (
                                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#a03810' }}>
                                            <Check className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Custom theme builder */}
                        <div className="mt-12 p-6 rounded-2xl glass-panel">
                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Create Custom Theme</h3>
                            <p className="text-sm mb-6" style={{ color: '#666' }}>
                                Customize colors, typography, and effects to match your brand
                            </p>
                            <button className="glass-button glass-button--glow" style={{ color: '#a03810' }}>
                                <Sliders className="h-4 w-4 mr-2 inline" />
                                Open Theme Editor
                            </button>
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}


import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { useUserStore } from '../store/useUserStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import TemplateGallery from '../components/templates/TemplateGallery';
import TemplateCustomizationModal from '../components/templates/TemplateCustomizationModal';
import WelcomeModal from '../components/onboarding/WelcomeModal';
import {
    Sparkles,
    Upload,
    Figma,
    Github,
    Globe,
    Image,
    Zap,
    ArrowRight,
    Clock,
    MoreHorizontal,
    Settings,
    CreditCard,
    LogOut,
    ChevronDown,
    Palette,
    Code,
    Rocket
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '@/lib/utils';

// Animated prompt suggestions
const PROMPT_IDEAS = [
    "Build a SaaS dashboard with user analytics...",
    "Create an AI-powered image editor...",
    "Design a modern e-commerce store...",
    "Make a real-time collaboration tool...",
    "Build a social media scheduler...",
    "Create a fitness tracking app...",
    "Design a restaurant booking system...",
    "Build an AI chatbot for customer support...",
    "Create a project management dashboard...",
    "Make a personal finance tracker...",
];

// Action buttons for project creation
const ACTION_BUTTONS = [
    { id: 'upload', icon: Upload, label: 'Upload Design', color: 'text-amber-400' },
    { id: 'figma', icon: Figma, label: 'Import from Figma', color: 'text-purple-400' },
    { id: 'github', icon: Github, label: 'Clone from GitHub', color: 'text-slate-300' },
    { id: 'clone', icon: Globe, label: 'Clone Website', color: 'text-cyan-400' },
    { id: 'image', icon: Image, label: 'Image to Code', color: 'text-pink-400' },
];

// Animated typing placeholder
function AnimatedPlaceholder() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayText, setDisplayText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentIdea = PROMPT_IDEAS[currentIndex];
        const speed = isDeleting ? 30 : 50;

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                if (displayText.length < currentIdea.length) {
                    setDisplayText(currentIdea.slice(0, displayText.length + 1));
                } else {
                    setTimeout(() => setIsDeleting(true), 2000);
                }
            } else {
                if (displayText.length > 0) {
                    setDisplayText(displayText.slice(0, -1));
                } else {
                    setIsDeleting(false);
                    setCurrentIndex((prev) => (prev + 1) % PROMPT_IDEAS.length);
                }
            }
        }, speed);

        return () => clearTimeout(timeout);
    }, [displayText, isDeleting, currentIndex]);

    return (
        <span className="text-slate-500 pointer-events-none">
            {displayText}
            <span className="animate-pulse">|</span>
        </span>
    );
}

// Credit usage meter component
function CreditMeter({ used, total }: { used: number; total: number }) {
    const percentage = Math.min((used / total) * 100, 100);
    const remaining = total - used;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Credits Used</span>
                <span className="font-mono text-amber-400">{remaining} left</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-500",
                        percentage > 80 ? "bg-red-500" :
                        percentage > 50 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className="text-xs text-slate-500">
                {used} of {total} credits this month
            </p>
        </div>
    );
}

// User menu with credit meter
function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useUserStore();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl",
                    "bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50",
                    "transition-all duration-200"
                )}
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <span className="text-sm font-bold text-black">
                        {user?.name?.charAt(0) || 'U'}
                    </span>
                </div>
                <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-400">Builder Plan</p>
                </div>
                <ChevronDown className={cn(
                    "h-4 w-4 text-slate-400 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute right-0 mt-2 w-72 rounded-2xl",
                    "bg-slate-900 border border-slate-700/50 shadow-2xl shadow-black/50",
                    "animate-in fade-in slide-in-from-top-2 duration-200",
                    "overflow-hidden z-50"
                )}>
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                <span className="text-lg font-bold text-black">
                                    {user?.name?.charAt(0) || 'U'}
                                </span>
                            </div>
                            <div>
                                <p className="font-semibold text-white">{user?.name || 'User'}</p>
                                <p className="text-xs text-slate-400">{user?.email || 'user@email.com'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Credit meter */}
                    <div className="p-4 border-b border-slate-700/50">
                        <CreditMeter used={342} total={500} />
                    </div>

                    {/* Menu items */}
                    <div className="p-2">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
                            <Settings className="h-4 w-4" />
                            <span className="text-sm">Settings</span>
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
                            <CreditCard className="h-4 w-4" />
                            <span className="text-sm">Billing & Credits</span>
                        </button>
                        <div className="my-2 border-t border-slate-700/50" />
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm">Sign Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Project thumbnail card
function ProjectThumbnail({ project }: { project: any }) {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate(`/builder/${project.id}`)}
            className={cn(
                "group relative rounded-2xl overflow-hidden",
                "bg-slate-900 border border-slate-800",
                "hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10",
                "transition-all duration-300",
                "text-left"
            )}
        >
            {/* Thumbnail preview */}
            <div className="aspect-[16/10] bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                {/* Fake browser chrome */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-slate-800/80 backdrop-blur flex items-center gap-1.5 px-3">
                    <div className="w-2 h-2 rounded-full bg-red-400/60" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                    <div className="w-2 h-2 rounded-full bg-green-400/60" />
                    <div className="flex-1 mx-3 h-3 bg-slate-700 rounded-full" />
                </div>

                {/* Placeholder content lines */}
                <div className="absolute inset-0 pt-10 p-4 space-y-2">
                    <div className="h-8 w-24 bg-slate-700/50 rounded" />
                    <div className="h-3 w-full bg-slate-700/30 rounded" />
                    <div className="h-3 w-3/4 bg-slate-700/30 rounded" />
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="h-16 bg-slate-700/30 rounded" />
                        <div className="h-16 bg-slate-700/30 rounded" />
                        <div className="h-16 bg-slate-700/30 rounded" />
                    </div>
                </div>

                {/* Hover overlay */}
                <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    "flex items-end justify-center pb-4"
                )}>
                    <span className="flex items-center gap-2 text-sm text-white font-medium">
                        Continue Building <ArrowRight className="h-4 w-4" />
                    </span>
                </div>
            </div>

            {/* Project info */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                                Updated 2h ago
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>

                {/* Tags */}
                <div className="flex gap-2 mt-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400">
                        {project.framework || 'React'}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                        Active
                    </span>
                </div>
            </div>
        </button>
    );
}

// Main dashboard component
export default function Dashboard() {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const { projects, addProject } = useProjectStore();
    const { setGalleryOpen } = useTemplateStore();
    const { hasCompletedOnboarding, setWelcomeModalOpen } = useOnboardingStore();

    useEffect(() => {
        if (!hasCompletedOnboarding) {
            setTimeout(() => setWelcomeModalOpen(true), 500);
        }
    }, [hasCompletedOnboarding, setWelcomeModalOpen]);

    const handleGenerate = () => {
        if (!prompt.trim()) return;

        // Auto-generate project name from prompt
        const projectName = prompt.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'New Project';

        // Create project and navigate to builder
        addProject({
            id: crypto.randomUUID(),
            name: projectName,
            description: prompt,
            framework: 'react',
            createdAt: new Date(),
            lastEdited: 'Just now',
            status: 'development',
        });

        navigate('/builder/new', { state: { prompt, projectName } });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <WelcomeModal />
            <TemplateGallery />
            <TemplateCustomizationModal />

            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-slate-800/50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-black" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                            KripTik AI
                        </span>
                    </div>
                    <UserMenu />
                </div>
            </header>

            {/* Main content */}
            <main className="container mx-auto px-4 py-8 md:py-16">
                {/* Hero section with prompt */}
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="text-white">What do you want to</span>{' '}
                        <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                            build today?
                        </span>
                    </h1>
                    <p className="text-slate-400 text-lg mb-8">
                        Describe your app and let AI bring it to life in minutes
                    </p>

                    {/* Prompt input */}
                    <div className={cn(
                        "relative rounded-2xl transition-all duration-300",
                        isFocused
                            ? "shadow-xl shadow-amber-500/20"
                            : "shadow-lg shadow-black/20"
                    )}>
                        <div className={cn(
                            "relative rounded-2xl overflow-hidden",
                            "bg-slate-900 border-2",
                            isFocused ? "border-amber-500/50" : "border-slate-800"
                        )}>
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder=""
                                    className={cn(
                                        "w-full min-h-[120px] p-5 pr-24 resize-none",
                                        "bg-transparent text-white text-lg",
                                        "placeholder:text-slate-500",
                                        "focus:outline-none"
                                    )}
                                    rows={3}
                                />

                                {/* Animated placeholder */}
                                {!prompt && !isFocused && (
                                    <div className="absolute inset-0 p-5 pointer-events-none text-lg">
                                        <AnimatedPlaceholder />
                                    </div>
                                )}

                                {/* Generate button */}
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim()}
                                    className={cn(
                                        "absolute bottom-4 right-4",
                                        "h-12 px-6 rounded-xl font-semibold",
                                        "bg-gradient-to-r from-amber-500 to-orange-500",
                                        "hover:from-amber-400 hover:to-orange-400",
                                        "text-black shadow-lg shadow-amber-500/25",
                                        "disabled:opacity-50 disabled:cursor-not-allowed",
                                        "transition-all duration-200"
                                    )}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Generate
                                </Button>
                            </div>

                            {/* Action buttons */}
                            <div className="border-t border-slate-800 px-4 py-3 flex items-center gap-2 flex-wrap">
                                {ACTION_BUTTONS.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => console.log(action.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                                            "bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50",
                                            "text-sm text-slate-300 hover:text-white",
                                            "transition-all duration-200"
                                        )}
                                    >
                                        <action.icon className={cn("h-4 w-4", action.color)} />
                                        <span className="hidden sm:inline">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick templates */}
                    <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                        <span className="text-sm text-slate-500">Quick start:</span>
                        {[
                            { icon: Palette, label: 'Landing Page' },
                            { icon: Code, label: 'Dashboard' },
                            { icon: Rocket, label: 'SaaS App' },
                        ].map((template) => (
                            <button
                                key={template.label}
                                onClick={() => setPrompt(`Build a ${template.label.toLowerCase()} with modern design...`)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full",
                                    "bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50",
                                    "text-sm text-slate-400 hover:text-white",
                                    "transition-all duration-200"
                                )}
                            >
                                <template.icon className="h-3.5 w-3.5" />
                                {template.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setGalleryOpen(true)}
                            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                            View all templates →
                        </button>
                    </div>
                </div>

                {/* Projects section */}
                {projects.length > 0 && (
                    <div className="mt-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white">Your Projects</h2>
                            <Button variant="outline" size="sm" className="border-slate-700 text-slate-400">
                                View All
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {projects.slice(0, 8).map((project) => (
                                <ProjectThumbnail key={project.id} project={project} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state for new users */}
                {projects.length === 0 && (
                    <div className="mt-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/50 mb-4">
                            <Rocket className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Ready to build something amazing?</h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Enter a prompt above to generate your first app, or browse our templates for inspiration.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

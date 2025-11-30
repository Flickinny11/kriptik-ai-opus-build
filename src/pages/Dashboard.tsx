import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { useUserStore } from '../store/useUserStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useCostStore } from '../store/useCostStore';
import TemplateGallery from '../components/templates/TemplateGallery';
import TemplateCustomizationModal from '../components/templates/TemplateCustomizationModal';
import WelcomeModal from '../components/onboarding/WelcomeModal';
import UploadDesignModal from '../components/builder/UploadDesignModal';
import FigmaImportModal from '../components/builder/FigmaImportModal';
import GitHubCloneModal from '../components/builder/GitHubCloneModal';
import NewProjectModal from '../components/dashboard/NewProjectModal';
import { FixMyAppIntro } from '../components/fix-my-app/FixMyAppIntro';
import { ImageToCodeResult } from '@/lib/api-client';
import {
    ArrowRight,
    Clock,
    MoreHorizontal,
    Settings,
    CreditCard,
    LogOut,
    ChevronDown,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import {
    UploadDesignIcon,
    ImageToCodeIcon,
    LandingPageIcon,
    DashboardIcon as DashboardAbstractIcon,
    SaasAppIcon,
    FixBrokenAppIcon
} from '../components/ui/AbstractIcons';
import { Layers } from 'lucide-react';
import { GenerateButton3D } from '../components/ui/GenerateButton3D';
import '../components/ui/premium-buttons/Premium3DButtons.css';

// Figma Logo SVG (from Simple Icons)
const FigmaLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
    <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
    <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
    <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
  </svg>
);

// GitHub Logo SVG (from Simple Icons)
const GitHubLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

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
    const { balance, fetchCredits, isLoading: creditsLoading } = useCostStore();
    const menuRef = useRef<HTMLDivElement>(null);

    // Fetch credits when menu opens
    useEffect(() => {
        if (isOpen) {
            fetchCredits();
        }
    }, [isOpen, fetchCredits]);

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
                                <p className="text-xs text-slate-400">{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Credit meter */}
                    <div className="p-4 border-b border-slate-700/50">
                        {creditsLoading ? (
                            <div className="text-xs text-slate-400 animate-pulse">Loading credits...</div>
                        ) : (
                            <CreditMeter
                                used={balance.totalUsedThisMonth}
                                total={balance.limit === Infinity ? balance.available + balance.totalUsedThisMonth : balance.limit}
                            />
                        )}
                        <p className="mt-2 text-xs text-emerald-400 font-mono">
                            {balance.available.toLocaleString()} credits available
                        </p>
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

// Project thumbnail card - 3D with visible edges and photorealistic depth
function ProjectThumbnail({ project }: { project: any }) {
    const navigate = useNavigate();

    return (
        <div 
            className="group relative"
            style={{
                perspective: '1200px',
                perspectiveOrigin: 'center center',
            }}
        >
            {/* 3D Card Container */}
            <button
                onClick={() => navigate(`/builder/${project.id}`)}
                className="relative w-full text-left transition-all duration-500"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(4deg) rotateY(-3deg)',
                    borderRadius: '16px',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(20px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'rotateX(4deg) rotateY(-3deg)';
                }}
            >
                {/* Right edge - visible thickness */}
                <div 
                    className="absolute top-2 -right-3 w-3 h-[calc(100%-16px)] rounded-r-lg"
                    style={{
                        background: 'linear-gradient(90deg, #0a0a0a 0%, #141414 100%)',
                        transform: 'rotateY(90deg) translateZ(0px)',
                        transformOrigin: 'left center',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                    }}
                />
                
                {/* Bottom edge - visible thickness */}
                <div 
                    className="absolute -bottom-3 left-2 right-2 h-3 rounded-b-lg"
                    style={{
                        background: 'linear-gradient(180deg, #0a0a0a 0%, #050505 100%)',
                        transform: 'rotateX(-90deg) translateZ(0px)',
                        transformOrigin: 'top center',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                    }}
                />

                {/* Main card face */}
                <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                        background: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
                        border: '1px solid rgba(60,60,70,0.5)',
                        boxShadow: `
                            0 20px 40px rgba(0,0,0,0.4),
                            0 10px 20px rgba(0,0,0,0.3),
                            0 4px 8px rgba(0,0,0,0.2),
                            inset 0 1px 0 rgba(255,255,255,0.04)
                        `,
                        transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                >
                    {/* Thumbnail preview */}
                    <div className="aspect-[16/10] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 100%)' }}>
                        {/* Browser chrome */}
                        <div className="absolute top-0 left-0 right-0 h-6 flex items-center gap-1.5 px-3" style={{ background: 'rgba(20,20,25,0.95)' }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: '#dc2626', boxShadow: '0 0 4px rgba(220,38,38,0.5)' }} />
                            <div className="w-2 h-2 rounded-full" style={{ background: '#404040' }} />
                            <div className="w-2 h-2 rounded-full" style={{ background: '#404040' }} />
                            <div className="flex-1 mx-3 h-3 rounded-full" style={{ background: '#1a1a1a' }} />
                        </div>

                        {/* Content preview */}
                        <div className="absolute inset-0 pt-10 p-4 space-y-2">
                            <div className="h-6 w-20 rounded" style={{ background: 'linear-gradient(90deg, #2a2a2a 0%, #1f1f1f 100%)' }} />
                            <div className="h-2 w-full rounded" style={{ background: 'rgba(35,35,40,0.6)' }} />
                            <div className="h-2 w-3/4 rounded" style={{ background: 'rgba(35,35,40,0.5)' }} />
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                <div className="h-12 rounded" style={{ background: 'rgba(35,35,40,0.5)' }} />
                                <div className="h-12 rounded" style={{ background: 'rgba(35,35,40,0.5)' }} />
                                <div className="h-12 rounded" style={{ background: 'rgba(35,35,40,0.5)' }} />
                            </div>
                        </div>

                        {/* Hover overlay */}
                        <div 
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' }}
                        >
                            <span className="flex items-center gap-2 text-sm text-white font-medium">
                                Continue Building <ArrowRight className="h-4 w-4" />
                            </span>
                        </div>
                    </div>

                    {/* Project info */}
                    <div className="p-4" style={{ background: 'linear-gradient(180deg, #141414 0%, #0f0f0f 100%)' }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="font-semibold truncate" style={{ color: '#e5e5e5', fontFamily: 'Inter, sans-serif' }}>{project.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3" style={{ color: '#525252' }} />
                                    <span className="text-xs" style={{ color: '#525252' }}>Updated 2h ago</span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); }}
                                className="p-1.5 rounded-lg transition-all"
                                style={{ color: '#525252' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.color = '#dc2626'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#525252'; }}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Tags */}
                        <div className="flex gap-2 mt-3">
                            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: '#1f1f1f', color: '#737373', border: '1px solid #2a2a2a' }}>
                                {project.framework || 'React'}
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                                Active
                            </span>
                        </div>
                    </div>
                </div>
            </button>
        </div>
    );
}

// Main dashboard component
export default function Dashboard() {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const { projects, addProject, fetchProjects, isLoading: projectsLoading } = useProjectStore();
    const { setGalleryOpen } = useTemplateStore();
    const { hasCompletedOnboarding, setWelcomeModalOpen } = useOnboardingStore();

    // Modal states
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [figmaModalOpen, setFigmaModalOpen] = useState(false);
    const [githubModalOpen, setGithubModalOpen] = useState(false);

    // Fix My App intro state
    const [showFixMyAppIntro, setShowFixMyAppIntro] = useState(false);

    // Get user auth state
    const { user, isAuthenticated, isLoading: authLoading } = useUserStore();

    // Fetch projects only when user is authenticated
    useEffect(() => {
        if (isAuthenticated && user?.id) {
            console.log('[Dashboard] User authenticated, fetching projects...');
            fetchProjects();
        }
    }, [isAuthenticated, user?.id, fetchProjects]);

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

    // Handle action button clicks
    const handleActionClick = useCallback((actionId: string) => {
        switch (actionId) {
            case 'upload':
                setUploadModalOpen(true);
                break;
            case 'figma':
                setFigmaModalOpen(true);
                break;
            case 'github':
                setGithubModalOpen(true);
                break;
            case 'image':
                // Redirect to Design Room for Image to Code
                navigate('/design-room');
                break;
        }
    }, [navigate]);

    // Handle image-to-code result
    const handleImageToCodeComplete = useCallback((result: ImageToCodeResult) => {
        // Create a new project with the generated components
        const projectId = crypto.randomUUID();
        const projectName = result.components[0]?.name || 'Design Import';

        addProject({
            id: projectId,
            name: projectName,
            description: `Generated from design - ${result.analysis.layout} layout with ${result.analysis.detectedElements.length} elements`,
            framework: 'react',
            createdAt: new Date(),
            lastEdited: 'Just now',
            status: 'development',
        });

        // Navigate to builder with the generated code
        navigate(`/builder/${projectId}`, {
            state: {
                generatedComponents: result.components,
                analysis: result.analysis,
            },
        });
    }, [addProject, navigate]);

    // Handle GitHub import result
    const handleGitHubImportComplete = useCallback((result: { projectId: string; projectName: string; filesImported: number; framework: string; sourceRepo: string }) => {
        // Add project to store
        addProject({
            id: result.projectId,
            name: result.projectName,
            description: `Imported from GitHub: ${result.sourceRepo}`,
            framework: result.framework as 'react' | 'nextjs' | 'node' | 'vue' | 'svelte',
            createdAt: new Date(),
            lastEdited: 'Just now',
            status: 'development',
        });

        // Navigate to builder
        navigate(`/builder/${result.projectId}`);
    }, [addProject, navigate]);

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f7f4 0%, #f0ede8 50%, #e8e4dd 100%)' }}>
            {/* Hover Sidebar */}
            <HoverSidebar />

            <WelcomeModal />
            <TemplateGallery />
            <TemplateCustomizationModal />
            <UploadDesignModal
                open={uploadModalOpen}
                onOpenChange={setUploadModalOpen}
                onComplete={handleImageToCodeComplete}
            />
            <FigmaImportModal
                open={figmaModalOpen}
                onOpenChange={setFigmaModalOpen}
                onComplete={(result) => {
                    addProject({
                        id: result.projectId,
                        name: result.projectName,
                        description: 'Imported from Figma',
                        framework: 'react',
                        createdAt: new Date(),
                        lastEdited: 'Just now',
                        status: 'development',
                    });
                    navigate(`/builder/${result.projectId}`);
                }}
            />
            <GitHubCloneModal
                open={githubModalOpen}
                onOpenChange={setGithubModalOpen}
                onComplete={handleGitHubImportComplete}
            />

            {/* Header - Black 3D */}
            <header 
                className="sticky top-0 z-30"
                style={{ 
                    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                    boxShadow: `
                        0 4px 0 #000,
                        0 8px 20px rgba(0,0,0,0.4),
                        0 16px 40px rgba(0,0,0,0.2),
                        inset 0 1px 0 rgba(255,255,255,0.05)
                    `,
                    borderBottom: '1px solid #2a2a2a',
                    transform: 'perspective(1000px) rotateX(0.5deg)',
                    transformOrigin: 'center top',
                }}
            >
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Hand-drawn arrow hint + Logo + Title */}
                    <div className="flex items-center gap-2">
                        {/* Hover hint arrow */}
                        <HandDrawnArrow className="mr-2" />

                        {/* Logo + Title - clicking navigates to dashboard */}
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
                    <UserMenu />
                </div>
            </header>

            {/* Main content */}
            <main className="container mx-auto px-4 py-8 md:py-16">
                {/* Hero section with prompt */}
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h1 
                        className="text-4xl md:text-5xl font-bold mb-4"
                        style={{ 
                            fontFamily: 'Syne, sans-serif',
                            background: 'linear-gradient(135deg, #1a1a1a 0%, #1a1a1a 45%, #dc2626 55%, #991b1b 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            textShadow: 'none',
                        }}
                    >
                        What do you want to build today?
                    </h1>
                    <p className="text-lg mb-8" style={{ color: '#525252', fontFamily: 'Inter, sans-serif' }}>
                        Describe your app and let AI bring it to life in minutes
                    </p>

                    {/* Prompt input - 3D Semi-translucent */}
                    <div 
                        className="relative rounded-3xl transition-all duration-500"
                        style={{
                            transform: `perspective(2000px) rotateX(${isFocused ? '0' : '2'}deg) rotateY(${isFocused ? '0' : '-1'}deg)`,
                            transformStyle: 'preserve-3d',
                            boxShadow: isFocused 
                                ? `
                                    0 25px 60px rgba(0,0,0,0.25),
                                    0 15px 35px rgba(220, 38, 38, 0.15),
                                    0 5px 15px rgba(0,0,0,0.1)
                                ` 
                                : `
                                    0 20px 50px rgba(0,0,0,0.2),
                                    0 10px 25px rgba(0,0,0,0.15),
                                    0 4px 10px rgba(0,0,0,0.1)
                                `
                        }}
                    >
                        {/* 3D Bottom edge */}
                        <div 
                            className="absolute -bottom-3 left-3 right-3 h-6 rounded-b-3xl"
                            style={{
                                background: 'linear-gradient(180deg, rgba(10,10,10,0.9) 0%, rgba(0,0,0,1) 100%)',
                                transform: 'translateZ(-20px) rotateX(-10deg)',
                                transformOrigin: 'top center',
                            }}
                        />
                        <div 
                            className="relative rounded-3xl overflow-hidden"
                            style={{
                                background: 'linear-gradient(145deg, rgba(26, 26, 26, 0.95) 0%, rgba(13, 13, 13, 0.98) 100%)',
                                backdropFilter: 'blur(20px)',
                                border: isFocused ? '2px solid rgba(220, 38, 38, 0.4)' : '2px solid rgba(60,60,60,0.5)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
                            }}
                        >
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder=""
                                    className="w-full min-h-[120px] p-5 pr-40 resize-none bg-transparent text-lg focus:outline-none"
                                    style={{ color: '#e5e5e5', fontFamily: 'Inter, sans-serif' }}
                                    rows={3}
                                />

                                {/* Animated placeholder */}
                                {!prompt && !isFocused && (
                                    <div className="absolute inset-0 p-5 pointer-events-none text-lg">
                                        <AnimatedPlaceholder />
                                    </div>
                                )}

                                {/* Generate button with 3D effects */}
                                <div className="absolute bottom-4 right-4">
                                    <GenerateButton3D
                                        onClick={handleGenerate}
                                        disabled={!prompt.trim()}
                                    />
                                </div>
                            </div>

                            {/* Action buttons - Half size, 3D semi-translucent */}
                            <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(60,60,60,0.5)' }}>
                                {[
                                    { id: 'upload', label: 'Upload', icon: <UploadDesignIcon size={16} /> },
                                    { id: 'figma', label: 'Figma', icon: <FigmaLogo size={14} /> },
                                    { id: 'github', label: 'GitHub', icon: <GitHubLogo size={14} /> },
                                    { id: 'image', label: 'Image→Code', icon: <ImageToCodeIcon size={16} /> },
                                ].map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleActionClick(action.id)}
                                        className="group"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            background: 'linear-gradient(145deg, rgba(45,45,50,0.7) 0%, rgba(30,30,35,0.8) 100%)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(80,80,90,0.3)',
                                            boxShadow: `
                                                0 2px 0 rgba(0,0,0,0.4),
                                                0 4px 8px rgba(0,0,0,0.3),
                                                inset 0 1px 0 rgba(255,255,255,0.05)
                                            `,
                                            transform: 'perspective(500px) rotateX(2deg) translateZ(0)',
                                            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                                            fontFamily: 'Inter, sans-serif',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            color: '#a3a3a3',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'perspective(500px) rotateX(0deg) translateY(-2px) translateZ(5px)';
                                            e.currentTarget.style.boxShadow = `
                                                0 4px 0 rgba(0,0,0,0.4),
                                                0 8px 16px rgba(0,0,0,0.4),
                                                0 2px 8px rgba(220,38,38,0.15),
                                                inset 0 1px 0 rgba(255,255,255,0.1)
                                            `;
                                            e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)';
                                            e.currentTarget.style.color = '#e5e5e5';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'perspective(500px) rotateX(2deg) translateZ(0)';
                                            e.currentTarget.style.boxShadow = `
                                                0 2px 0 rgba(0,0,0,0.4),
                                                0 4px 8px rgba(0,0,0,0.3),
                                                inset 0 1px 0 rgba(255,255,255,0.05)
                                            `;
                                            e.currentTarget.style.borderColor = 'rgba(80,80,90,0.3)';
                                            e.currentTarget.style.color = '#a3a3a3';
                                        }}
                                    >
                                        <span style={{ opacity: 0.8 }}>{action.icon}</span>
                                        <span className="hidden sm:inline">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick templates - 3D blended into background */}
                    <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
                        <span className="text-sm" style={{ color: '#737373', fontFamily: 'Inter, sans-serif' }}>Quick start:</span>
                        {[
                            { icon: LandingPageIcon, label: 'Landing Page' },
                            { icon: DashboardAbstractIcon, label: 'Dashboard' },
                            { icon: SaasAppIcon, label: 'SaaS App' },
                        ].map((template, idx) => (
                            <button
                                key={template.label}
                                onClick={() => setPrompt(`Build a ${template.label.toLowerCase()} with modern design...`)}
                                className="group"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 16px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(145deg, rgba(35,35,40,0.85) 0%, rgba(20,20,25,0.9) 100%)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(70,70,80,0.4)',
                                    boxShadow: `
                                        0 3px 0 rgba(0,0,0,0.5),
                                        0 6px 12px rgba(0,0,0,0.25),
                                        0 12px 24px rgba(0,0,0,0.15),
                                        inset 0 1px 0 rgba(255,255,255,0.04)
                                    `,
                                    transform: `perspective(800px) rotateX(3deg) rotateY(${idx === 0 ? '2' : idx === 2 ? '-2' : '0'}deg)`,
                                    transformStyle: 'preserve-3d',
                                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: '#a3a3a3',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(-4px) scale(1.02)';
                                    e.currentTarget.style.boxShadow = `
                                        0 6px 0 rgba(0,0,0,0.5),
                                        0 12px 20px rgba(0,0,0,0.3),
                                        0 20px 40px rgba(0,0,0,0.2),
                                        0 4px 12px rgba(220,38,38,0.1),
                                        inset 0 1px 0 rgba(255,255,255,0.08)
                                    `;
                                    e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)';
                                    e.currentTarget.style.color = '#e5e5e5';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = `perspective(800px) rotateX(3deg) rotateY(${idx === 0 ? '2' : idx === 2 ? '-2' : '0'}deg)`;
                                    e.currentTarget.style.boxShadow = `
                                        0 3px 0 rgba(0,0,0,0.5),
                                        0 6px 12px rgba(0,0,0,0.25),
                                        0 12px 24px rgba(0,0,0,0.15),
                                        inset 0 1px 0 rgba(255,255,255,0.04)
                                    `;
                                    e.currentTarget.style.borderColor = 'rgba(70,70,80,0.4)';
                                    e.currentTarget.style.color = '#a3a3a3';
                                }}
                            >
                                <span style={{ opacity: 0.9 }}><template.icon size={22} /></span>
                                <span>{template.label}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => setGalleryOpen(true)}
                            className="text-sm transition-colors"
                            style={{ 
                                color: '#dc2626', 
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 600,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#dc2626'}
                        >
                            View all templates →
                        </button>
                    </div>
                </div>

                {/* My Stuff Section */}
                <div className="mt-16">
                    {/* Section Header with Actions */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 
                                className="text-2xl font-bold"
                                style={{ 
                                    color: '#1a1a1a', 
                                    fontFamily: 'Syne, sans-serif',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                            >
                                My Stuff
                            </h2>
                            <p className="text-sm mt-1" style={{ color: '#737373', fontFamily: 'Inter, sans-serif' }}>
                                {projects.length} project{projects.length !== 1 ? 's' : ''} • Build something new or fix an existing app
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4">
                            {/* Fix Broken App Button - 3D Carbon Fiber */}
                            <button
                                onClick={() => setShowFixMyAppIntro(true)}
                                className="group"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 20px',
                                    borderRadius: '14px',
                                    background: `
                                        repeating-linear-gradient(
                                            45deg,
                                            rgba(26,26,30,0.95) 0px,
                                            rgba(26,26,30,0.95) 2px,
                                            rgba(35,35,40,0.95) 2px,
                                            rgba(35,35,40,0.95) 4px
                                        )
                                    `,
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(70,70,80,0.5)',
                                    boxShadow: `
                                        0 4px 0 rgba(0,0,0,0.6),
                                        0 8px 16px rgba(0,0,0,0.35),
                                        0 16px 32px rgba(0,0,0,0.2),
                                        inset 0 1px 0 rgba(255,255,255,0.03)
                                    `,
                                    transform: 'perspective(600px) rotateX(2deg) rotateY(-1deg)',
                                    transformStyle: 'preserve-3d',
                                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#a3a3a3',
                                    cursor: 'pointer',
                                    letterSpacing: '0.03em',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(-4px)';
                                    e.currentTarget.style.boxShadow = `
                                        0 8px 0 rgba(0,0,0,0.6),
                                        0 16px 28px rgba(0,0,0,0.4),
                                        0 24px 48px rgba(0,0,0,0.25),
                                        0 4px 16px rgba(220,38,38,0.15),
                                        inset 0 1px 0 rgba(255,255,255,0.05)
                                    `;
                                    e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)';
                                    e.currentTarget.style.color = '#e5e5e5';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'perspective(600px) rotateX(2deg) rotateY(-1deg)';
                                    e.currentTarget.style.boxShadow = `
                                        0 4px 0 rgba(0,0,0,0.6),
                                        0 8px 16px rgba(0,0,0,0.35),
                                        0 16px 32px rgba(0,0,0,0.2),
                                        inset 0 1px 0 rgba(255,255,255,0.03)
                                    `;
                                    e.currentTarget.style.borderColor = 'rgba(70,70,80,0.5)';
                                    e.currentTarget.style.color = '#a3a3a3';
                                }}
                            >
                                <span style={{ opacity: 0.9 }}><FixBrokenAppIcon size={24} /></span>
                                <span>Fix Broken App</span>
                            </button>

                            {/* Create New Button - Modern Creative Design */}
                            <NewProjectModal />
                        </div>
                    </div>

                    {/* Loading State - only show when authenticated and loading */}
                    {(projectsLoading || authLoading) && isAuthenticated && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: '#dc2626' }} />
                            <p style={{ color: '#737373' }}>Loading your projects...</p>
                        </div>
                    )}

                    {/* Projects Grid */}
                    {!projectsLoading && !authLoading && projects.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {projects.map((project) => (
                                <ProjectThumbnail key={project.id} project={project} />
                            ))}
                        </div>
                    )}

                    {/* Empty State - 3D Card */}
                    {!projectsLoading && !authLoading && projects.length === 0 && (
                        <div 
                            className="relative rounded-3xl overflow-hidden"
                            style={{
                                perspective: '1500px',
                            }}
                        >
                            <div
                                style={{
                                    background: 'linear-gradient(145deg, rgba(26,26,30,0.95) 0%, rgba(13,13,17,0.98) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(60,60,70,0.4)',
                                    borderRadius: '24px',
                                    boxShadow: `
                                        0 20px 50px rgba(0,0,0,0.3),
                                        0 10px 25px rgba(0,0,0,0.2),
                                        0 4px 10px rgba(0,0,0,0.15),
                                        inset 0 1px 0 rgba(255,255,255,0.03)
                                    `,
                                    transform: 'rotateX(2deg)',
                                    transformStyle: 'preserve-3d',
                                }}
                            >
                                <div className="relative py-16 px-8 text-center">
                                    {/* 3D Icon Container */}
                                    <div
                                        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                                        style={{
                                            background: 'linear-gradient(145deg, #262630 0%, #1a1a22 100%)',
                                            boxShadow: `
                                                0 6px 0 rgba(0,0,0,0.5),
                                                0 12px 24px rgba(0,0,0,0.4),
                                                0 20px 40px rgba(0,0,0,0.3),
                                                inset 0 1px 0 rgba(255,255,255,0.05)
                                            `,
                                            border: '1px solid rgba(60,60,70,0.5)',
                                            transform: 'translateZ(30px)',
                                        }}
                                    >
                                        <Layers className="h-10 w-10" style={{ color: '#dc2626' }} />
                                    </div>

                                    <h3 className="text-2xl font-bold mb-3" style={{ color: '#e5e5e5', fontFamily: 'Syne, sans-serif' }}>
                                        Ready to build something amazing?
                                    </h3>
                                    <p className="max-w-md mx-auto mb-8" style={{ color: '#737373', fontFamily: 'Inter, sans-serif' }}>
                                        Enter a prompt above to generate your first app, browse our templates, or import an existing project.
                                    </p>

                                    {/* Empty State Actions */}
                                    <div className="flex items-center justify-center gap-4 flex-wrap">
                                        <button
                                            onClick={() => setShowFixMyAppIntro(true)}
                                            className="group"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '12px 20px',
                                                borderRadius: '14px',
                                                background: `
                                                    repeating-linear-gradient(
                                                        45deg,
                                                        rgba(26,26,30,0.95) 0px,
                                                        rgba(26,26,30,0.95) 2px,
                                                        rgba(35,35,40,0.95) 2px,
                                                        rgba(35,35,40,0.95) 4px
                                                    )
                                                `,
                                                backdropFilter: 'blur(12px)',
                                                border: '1px solid rgba(70,70,80,0.5)',
                                                boxShadow: `
                                                    0 4px 0 rgba(0,0,0,0.6),
                                                    0 8px 16px rgba(0,0,0,0.35),
                                                    0 16px 32px rgba(0,0,0,0.2),
                                                    inset 0 1px 0 rgba(255,255,255,0.03)
                                                `,
                                                transform: 'perspective(600px) rotateX(2deg)',
                                                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                color: '#a3a3a3',
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'perspective(600px) rotateX(0deg) translateY(-4px)';
                                                e.currentTarget.style.boxShadow = `
                                                    0 8px 0 rgba(0,0,0,0.6),
                                                    0 16px 28px rgba(0,0,0,0.4),
                                                    0 4px 16px rgba(220,38,38,0.15),
                                                    inset 0 1px 0 rgba(255,255,255,0.05)
                                                `;
                                                e.currentTarget.style.color = '#e5e5e5';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'perspective(600px) rotateX(2deg)';
                                                e.currentTarget.style.boxShadow = `
                                                    0 4px 0 rgba(0,0,0,0.6),
                                                    0 8px 16px rgba(0,0,0,0.35),
                                                    0 16px 32px rgba(0,0,0,0.2),
                                                    inset 0 1px 0 rgba(255,255,255,0.03)
                                                `;
                                                e.currentTarget.style.color = '#a3a3a3';
                                            }}
                                        >
                                            <span style={{ opacity: 0.9 }}><FixBrokenAppIcon size={24} /></span>
                                            <span>Fix Broken App</span>
                                        </button>

                                        <NewProjectModal />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Fix My App Intro Modal */}
                {showFixMyAppIntro && (
                    <FixMyAppIntro onComplete={() => {
                        setShowFixMyAppIntro(false);
                        navigate('/fix-my-app');
                    }} />
                )}
            </main>
        </div>
    );
}

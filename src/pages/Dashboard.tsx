import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import NotificationsSection from '../components/dashboard/NotificationsSection';
import ImportProjectModal, { type ImportType } from '../components/dashboard/ImportProjectModal';
import { FixMyAppIntro } from '../components/fix-my-app/FixMyAppIntro';
import { NotificationPreferencesModal } from '../components/fix-my-app/NotificationPreferencesModal';
import { useToast } from '@/components/ui/use-toast';
import { ImageToCodeResult } from '@/lib/api-client';
import {
    SettingsIcon,
    ChevronDownIcon,
    LoadingIcon,
    CreditCardIcon,
    LogOutIcon,
} from '../components/ui/icons';
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
import { GenerateButton3D } from '../components/ui/GenerateButton3D';
import { ProjectCard3D } from '../components/ui/ProjectCard3D';
import { FixMyAppFlipCard } from '../components/ui/FixMyAppFlipCard';
import '../components/ui/premium-buttons/Premium3DButtons.css';
import '../components/ui/FixMyAppFlipCard.css';
import '../components/ui/ProjectCard3D.css';
import '../styles/realistic-glass.css';

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
                <span style={{ color: '#666' }}>Credits Used</span>
                <span className="font-mono" style={{ color: '#c25a00' }}>{remaining.toLocaleString()} left</span>
            </div>
            <div
                className="h-2 rounded-full overflow-hidden"
                style={{
                    background: 'rgba(0,0,0,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                }}
            >
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${percentage}%`,
                        background: percentage > 80
                            ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                            : percentage > 50
                                ? 'linear-gradient(90deg, #c25a00, #d97706)'
                                : 'linear-gradient(90deg, #16a34a, #22c55e)',
                        boxShadow: percentage > 80
                            ? '0 0 12px rgba(220, 38, 38, 0.4)'
                            : percentage > 50
                                ? '0 0 12px rgba(194, 90, 0, 0.4)'
                                : '0 0 12px rgba(22, 163, 74, 0.4)',
                    }}
                />
            </div>
            <p className="text-xs" style={{ color: '#999' }}>
                {used.toLocaleString()} of {total.toLocaleString()} credits this month
            </p>
        </div>
    );
}

// User menu with credit meter - Liquid Glass Style
function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const { user, isAuthenticated } = useUserStore();
    const { balance, fetchCredits, isLoading: creditsLoading } = useCostStore();
    const menuRef = useRef<HTMLDivElement>(null);

    // Fetch credits when menu opens
    useEffect(() => {
        if (isOpen && isAuthenticated) {
            fetchCredits();
        }
    }, [isOpen, isAuthenticated, fetchCredits]);

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
            {/* Liquid Glass Badge Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => { setIsOpen(true); setIsButtonHovered(true); }}
                onMouseLeave={() => setIsButtonHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    borderRadius: '50px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',

                    // Liquid glass background
                    background: isButtonHovered
                        ? 'linear-gradient(145deg, rgba(255,230,215,0.7) 0%, rgba(255,220,200,0.55) 40%, rgba(255,210,185,0.5) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 40%, rgba(248,248,250,0.45) 100%)',
                    backdropFilter: 'blur(24px) saturate(200%)',

                    // Liquid glass shadow with warm glow
                    boxShadow: isButtonHovered
                        ? `
                            0 4px 0 rgba(200, 180, 160, 0.5),
                            0 16px 50px rgba(255, 150, 100, 0.2),
                            0 8px 25px rgba(255, 130, 80, 0.15),
                            inset 0 2px 2px rgba(255, 255, 255, 1),
                            inset 0 -2px 2px rgba(0, 0, 0, 0.02),
                            0 0 20px rgba(255, 180, 140, 0.3),
                            0 0 0 1px rgba(255, 220, 200, 0.7)
                        `
                        : `
                            0 4px 0 rgba(200, 195, 190, 0.5),
                            0 12px 40px rgba(0, 0, 0, 0.08),
                            0 4px 12px rgba(0, 0, 0, 0.05),
                            inset 0 2px 2px rgba(255, 255, 255, 0.95),
                            inset 0 -2px 2px rgba(0, 0, 0, 0.03),
                            0 0 0 1px rgba(255, 255, 255, 0.6)
                        `,

                    transform: isButtonHovered ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                }}
            >
                {/* Shine animation overlay */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isButtonHovered ? '150%' : '-100%',
                        width: '60%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        transform: 'skewX(-15deg)',
                        transition: 'left 0.6s ease',
                        pointerEvents: 'none',
                    }}
                />

                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(135deg, #c25a00 0%, #a04800 100%)',
                        boxShadow: '0 2px 8px rgba(194, 90, 0, 0.3)',
                    }}
                >
                    <span className="text-sm font-bold text-white">
                        {user?.name?.charAt(0) || 'U'}
                    </span>
                </div>
                <div className="hidden md:block text-left">
                    <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{user?.name || 'User'}</p>
                    <p className="text-xs" style={{ color: '#666' }}>Builder Plan</p>
                </div>
                <ChevronDownIcon
                    size={16}
                    className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Liquid Glass Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-3 w-80 z-50"
                    style={{
                        borderRadius: '24px',
                        overflow: 'hidden',

                        // Liquid glass background
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 50%, rgba(248,248,250,0.55) 100%)',
                        backdropFilter: 'blur(40px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(200%)',

                        // Multi-layer liquid glass shadow
                        boxShadow: `
                            0 30px 80px rgba(0, 0, 0, 0.15),
                            0 15px 40px rgba(0, 0, 0, 0.1),
                            0 8px 20px rgba(0, 0, 0, 0.08),
                            inset 0 2px 4px rgba(255, 255, 255, 0.9),
                            inset 0 -1px 2px rgba(0, 0, 0, 0.02),
                            0 0 0 1px rgba(255, 255, 255, 0.5)
                        `,

                        animation: 'slideIn 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                >
                    {/* Top highlight */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '10%',
                            right: '10%',
                            height: '1px',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                        }}
                    />

                    {/* Header */}
                    <div
                        className="p-4"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,200,170,0.2) 0%, rgba(255,180,150,0.1) 100%)',
                            borderBottom: '1px solid rgba(255,255,255,0.3)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, #c25a00 0%, #a04800 100%)',
                                    boxShadow: '0 4px 16px rgba(194, 90, 0, 0.3), inset 0 1px 2px rgba(255,255,255,0.2)',
                                }}
                            >
                                <span className="text-lg font-bold text-white">
                                    {user?.name?.charAt(0) || 'U'}
                                </span>
                            </div>
                            <div>
                                <p className="font-semibold" style={{ color: '#1a1a1a' }}>{user?.name || 'User'}</p>
                                <p className="text-xs" style={{ color: '#666' }}>{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Credit meter */}
                    <div className="p-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        {creditsLoading ? (
                            <div className="text-xs animate-pulse" style={{ color: '#666' }}>Loading credits...</div>
                        ) : (
                            <CreditMeter
                                used={balance.totalUsedThisMonth}
                                total={balance.limit === Infinity ? balance.available + balance.totalUsedThisMonth : balance.limit}
                            />
                        )}
                        <p className="mt-2 text-xs font-mono" style={{ color: '#16a34a' }}>
                            {balance.available.toLocaleString()} credits available
                        </p>
                    </div>

                    {/* Menu items - Liquid Glass Buttons */}
                    <div className="p-2">
                        <MenuButton icon={SettingsIcon} label="Settings" />
                        <MenuButton icon={CreditCardIcon} label="Billing & Credits" />
                        <div className="my-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                        <MenuButton icon={LogOutIcon} label="Sign Out" danger />
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}

// Liquid Glass Menu Button Component
function MenuButton({ icon: Icon, label, danger = false }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; danger?: boolean }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: isHovered
                    ? danger
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'linear-gradient(145deg, rgba(255,220,200,0.4) 0%, rgba(255,200,170,0.25) 100%)'
                    : 'transparent',
                boxShadow: isHovered && !danger
                    ? 'inset 0 0 20px rgba(255, 160, 120, 0.1), 0 0 0 1px rgba(255, 200, 170, 0.3)'
                    : 'none',
                color: danger ? '#dc2626' : '#1a1a1a',
            }}
        >
            <Icon size={16} />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

// Valid "in-progress" fixing statuses - ONLY these show the flip card
const ACTIVE_FIXING_STATUSES = ['analyzing', 'creating_intent', 'building', 'verifying'];

// Project thumbnail card - Uses different cards based on fix status
// Memoized to prevent unnecessary re-renders when other projects update
const ProjectThumbnail = memo(function ProjectThumbnail({ project }: { project: any }) {
    const navigate = useNavigate();

    const lastModified = project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Today';
    const frameworks = project.framework || 'React';

    // Check if project is being fixed (active Fix My App workflow)
    // STRICT CHECK: Only show flip card for explicitly active statuses
    const isBeingFixed = typeof project.fixingStatus === 'string' &&
        ACTIVE_FIXING_STATUSES.includes(project.fixingStatus);

    // Use the premium 3D flip card for projects in Fix My App workflow
    if (isBeingFixed) {
        return (
            <div className="group" style={{ marginBottom: '24px' }}>
                <FixMyAppFlipCard
                    onClick={() => navigate(`/builder/${project.id}`)}
                    projectName={project.name}
                    fixingStatus={project.fixingStatus}
                    fixingProgress={project.fixingProgress || 0}
                    importSource={project.importSource}
                    currentThought={project.currentThought}
                    orchestrationPhase={project.currentPhase || 1}
                    totalPhases={6}
                    hasProblems={project.hasProblems || false}
                    problemDescription={project.problemDescription}
                />
                {/* Minimal info below the flip card */}
                <div className="mt-3 px-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] rounded-full" style={{ background: 'rgba(0,0,0,0.06)', color: '#404040' }}>
                            {frameworks}
                        </span>
                        <span className="text-xs" style={{ color: '#666' }}>Modified {lastModified}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Regular project card (premium 3D flip card with dark monitor styling)
    // All info is displayed on the card itself now
    const cardStatus = project.fixingStatus === 'completed' ? 'fixed' : 'active';

    return (
        <div className="group" style={{ marginBottom: '24px' }}>
            {/* Premium 3D Flip Card for regular projects */}
            <ProjectCard3D
                onClick={() => navigate(`/builder/${project.id}`)}
                thumbnail={project.thumbnail}
                projectName={project.name}
                framework={frameworks}
                lastModified={lastModified}
                status={cardStatus}
                description={project.description}
                linesOfCode={project.linesOfCode}
                components={project.components}
            />
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if key project properties changed
    const prev = prevProps.project;
    const next = nextProps.project;
    return (
        prev.id === next.id &&
        prev.name === next.name &&
        prev.fixingStatus === next.fixingStatus &&
        prev.fixingProgress === next.fixingProgress &&
        prev.currentThought === next.currentThought &&
        prev.currentPhase === next.currentPhase &&
        prev.updatedAt === next.updatedAt
    );
});

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

    // Fix My App post-capture notification modal state
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [fixSessionId, setFixSessionId] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();

    // Import Project modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importType, setImportType] = useState<ImportType>('zip');
    const [showImportDropdown, setShowImportDropdown] = useState(false);

    // Get user auth state
    const { user, isAuthenticated, isLoading: authLoading } = useUserStore();

    // If not authenticated, redirect to login (prevents "blank profile" state in embedded browsers)
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [authLoading, isAuthenticated, navigate]);

    // Fetch projects only when user is authenticated
    useEffect(() => {
        if (isAuthenticated && user?.id) {
            console.log('[Dashboard] User authenticated, fetching projects...');
            fetchProjects();
        }
    }, [isAuthenticated, user?.id, fetchProjects]);

    // Track which projects are being fixed (for selective polling)
    // Using state instead of ref so we can conditionally enable/disable polling
    const [hasFixingProjects, setHasFixingProjects] = useState(false);

    // Check if any projects are in active fixing workflow
    useEffect(() => {
        const activelyFixing = projects.some(p => 
            p.fixingStatus && 
            ['analyzing', 'creating_intent', 'building', 'verifying'].includes(p.fixingStatus)
        );
        setHasFixingProjects(activelyFixing);
    }, [projects]);

    // Poll ONLY when there are projects being fixed
    // This interval is COMPLETELY DISABLED when no projects are in the fixing workflow
    useEffect(() => {
        // Don't set up polling if not authenticated or no fixing projects
        if (!isAuthenticated || !hasFixingProjects) {
            console.log('[Dashboard] Polling disabled - no active Fix My App projects');
            return;
        }

        console.log('[Dashboard] Starting Fix My App polling (5s interval)...');
        
        const pollInterval = setInterval(() => {
            console.log('[Dashboard] Polling for Fix My App progress...');
            fetchProjects();
        }, 5000);

        return () => {
            console.log('[Dashboard] Stopping Fix My App polling');
            clearInterval(pollInterval);
        };
    }, [isAuthenticated, hasFixingProjects, fetchProjects]);

    useEffect(() => {
        if (!hasCompletedOnboarding) {
            setTimeout(() => setWelcomeModalOpen(true), 500);
        }
    }, [hasCompletedOnboarding, setWelcomeModalOpen]);

    // Handle return from extension capture (Fix My App flow)
    // When user is redirected back with ?fixSession=<sessionId>, show notification modal
    useEffect(() => {
        const fixSession = searchParams.get('fixSession');
        if (fixSession && isAuthenticated) {
            console.log('[Dashboard] Fix My App capture complete, session:', fixSession);
            
            // Store session ID for the modal
            setFixSessionId(fixSession);
            
            // Show notification preferences modal
            setShowNotificationModal(true);
            
            // Clear the query param so refresh doesn't re-trigger
            searchParams.delete('fixSession');
            setSearchParams(searchParams, { replace: true });
            
            // Show success toast
            toast({
                title: 'Capture Complete!',
                description: 'KripTik AI is analyzing your project and will start building automatically.',
            });
            
            // Refresh projects to show the new Fix My App project
            fetchProjects();
        }
    }, [searchParams, isAuthenticated, setSearchParams, fetchProjects, toast]);

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
        <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
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
            <ImportProjectModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                importType={importType}
            />

            {/* Header - 3D Glass with visible edges */}
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
                {/* Bottom edge - visible glass thickness */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
                    style={{
                        background: 'linear-gradient(180deg, rgba(200,200,205,0.4) 0%, rgba(180,180,185,0.3) 100%)',
                        transform: 'translateY(100%)',
                    }}
                />
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
                            fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif',
                            color: '#1a1a1a',
                        }}
                    >
                        What do you want to build today?
                    </h1>
                    <p className="text-lg mb-8" style={{ color: '#404040', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                        Describe your app and let AI bring it to life in minutes
                    </p>

                    {/* Prompt input - Realistic Glass */}
                    <div
                        className={cn("glass-input relative transition-all duration-500", isFocused && "focused")}
                    >
                        <div className="relative">
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder=""
                                    className="w-full min-h-[120px] p-6 pr-44 resize-none bg-transparent text-lg focus:outline-none"
                                    style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}
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

                            {/* Action buttons - Realistic Glass Pills */}
                            <div className="px-6 py-4 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
                                {[
                                    { id: 'upload', label: 'Upload', icon: <UploadDesignIcon size={18} /> },
                                    { id: 'figma', label: 'Figma', icon: <FigmaLogo size={16} /> },
                                    { id: 'github', label: 'GitHub', icon: <GitHubLogo size={16} /> },
                                    { id: 'image', label: 'Image→Code', icon: <ImageToCodeIcon size={18} /> },
                                ].map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleActionClick(action.id)}
                                        className="glass-button glass-button--small"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        <span>{action.icon}</span>
                                        <span className="hidden sm:inline">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick templates - Realistic Glass Pills */}
                    <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
                        <span className="text-sm" style={{ color: '#404040', fontFamily: '-apple-system, sans-serif' }}>Quick start:</span>
                        {[
                            { icon: LandingPageIcon, label: 'Landing Page' },
                            { icon: DashboardAbstractIcon, label: 'Dashboard' },
                            { icon: SaasAppIcon, label: 'SaaS App' },
                        ].map((template) => (
                            <button
                                key={template.label}
                                onClick={() => setPrompt(`Build a ${template.label.toLowerCase()} with modern design...`)}
                                className="glass-button"
                                style={{ color: '#1a1a1a' }}
                            >
                                <span><template.icon size={20} /></span>
                                <span>{template.label}</span>
                                {/* Three dots indicator */}
                                <span className="glass-dots ml-2">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </span>
                            </button>
                        ))}
                        <button
                            onClick={() => setGalleryOpen(true)}
                            className="text-sm transition-colors font-medium"
                            style={{ color: '#404040' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#1a1a1a'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#404040'}
                        >
                            View all templates →
                        </button>
                    </div>

                    {/* Notifications - positioned under quick start buttons */}
                    {isAuthenticated && user?.id && (
                        <div className="mt-10 flex justify-center">
                            <NotificationsSection userId={user.id} />
                        </div>
                    )}
                </div>

                {/* My Stuff Section */}
                <div className="mt-12">
                    {/* Section Header with Actions */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2
                                className="text-2xl font-bold"
                                style={{
                                    color: '#1a1a1a',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif',
                                }}
                            >
                                My Stuff
                            </h2>
                            <p className="text-sm mt-1" style={{ color: '#404040' }}>
                                {projects.length} project{projects.length !== 1 ? 's' : ''} • Build something new or fix an existing app
                            </p>
                        </div>

                        {/* Action Buttons - Realistic Glass */}
                        <div className="flex items-center gap-3">
                            {/* Import Project Button with Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowImportDropdown(!showImportDropdown)}
                                    onBlur={() => setTimeout(() => setShowImportDropdown(false), 200)}
                                    className="glass-button"
                                    style={{ color: '#1a1a1a' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>Import Project</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, transition: 'transform 0.2s', transform: showImportDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>

                                {/* Import Dropdown */}
                                {showImportDropdown && (
                                    <div
                                        className="absolute right-0 mt-2 w-64 z-50"
                                        style={{
                                            borderRadius: 16,
                                            background: 'linear-gradient(145deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 100%)',
                                            backdropFilter: 'blur(24px) saturate(180%)',
                                            boxShadow: '0 20px 50px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)',
                                        }}
                                    >
                                        <div className="p-2">
                                            <button
                                                onClick={() => { setImportType('zip'); setShowImportModal(true); setShowImportDropdown(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/50"
                                                style={{ color: '#1a1a1a' }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                                    <path d="M12 11v6" />
                                                    <path d="M9 14l3-3 3 3" />
                                                </svg>
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">Import ZIP File</p>
                                                    <p className="text-xs" style={{ color: '#666' }}>Upload a project ZIP file</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => { setImportType('github'); setShowImportModal(true); setShowImportDropdown(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/50"
                                                style={{ color: '#1a1a1a' }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                                                </svg>
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">Clone GitHub Repo</p>
                                                    <p className="text-xs" style={{ color: '#666' }}>Import from a repository</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => { setImportType('builder'); setShowImportModal(true); setShowImportDropdown(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/50"
                                                style={{ color: '#1a1a1a' }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                                    <path d="M9 3v18" />
                                                    <path d="M14 9l3 3-3 3" />
                                                </svg>
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">Import from AI Builder</p>
                                                    <p className="text-xs" style={{ color: '#666' }}>Lovable, Bolt, v0, and more</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Fix Broken App Button */}
                            <button
                                onClick={() => setShowFixMyAppIntro(true)}
                                className="glass-button glass-button--glow"
                                style={{ color: '#1a1a1a' }}
                            >
                                <span><FixBrokenAppIcon size={22} /></span>
                                <span>Fix Broken App</span>
                            </button>

                            {/* Create New Button */}
                            <NewProjectModal />
                        </div>
                    </div>

                    {/* Loading State */}
                    {(projectsLoading || authLoading) && isAuthenticated && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <LoadingIcon size={40} className="animate-spin mb-4" />
                            <p style={{ color: '#404040' }}>Loading your projects...</p>
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

                    {/* Empty State - Realistic Glass Panel */}
                    {!projectsLoading && !authLoading && projects.length === 0 && (
                        <div className="glass-panel">
                            <div className="relative py-16 px-8 text-center">
                                {/* Glass Icon Container */}
                                <div
                                    className="glass-button inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                                    style={{ padding: 0 }}
                                >
                                    <DashboardAbstractIcon size={40} />
                                </div>

                                <h3 className="text-2xl font-bold mb-3" style={{ color: '#1a1a1a' }}>
                                    Ready to build something amazing?
                                </h3>
                                <p className="max-w-md mx-auto mb-8" style={{ color: '#404040' }}>
                                    Enter a prompt above to generate your first app, browse our templates, or import an existing project.
                                </p>

                                {/* Empty State Actions */}
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    <button
                                        onClick={() => { setImportType('zip'); setShowImportModal(true); }}
                                        className="glass-button"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span>Import Project</span>
                                    </button>

                                    <button
                                        onClick={() => setShowFixMyAppIntro(true)}
                                        className="glass-button glass-button--glow"
                                        style={{ color: '#1a1a1a' }}
                                    >
                                        <span><FixBrokenAppIcon size={22} /></span>
                                        <span>Fix Broken App</span>
                                    </button>

                                    <NewProjectModal />
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

                {/* Fix My App Notification Preferences Modal - shows after capture return */}
                <NotificationPreferencesModal
                    isOpen={showNotificationModal}
                    onClose={() => setShowNotificationModal(false)}
                    onSave={(prefs) => {
                        setShowNotificationModal(false);
                        toast({
                            title: 'Notifications Enabled',
                            description: 'You\'ll be notified when credentials are needed or your app is ready.',
                        });
                    }}
                    projectId={fixSessionId || undefined}
                />
            </main>
        </div>
    );
}

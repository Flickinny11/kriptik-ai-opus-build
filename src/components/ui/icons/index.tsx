/**
 * KripTik AI Icon System
 *
 * Comprehensive icon library replacing Lucide icons with custom SVGs
 * - Brand icons for third-party services
 * - Status/action icons with gradients
 * - File type icons for code editors
 * - Abstract icons from the landing page
 *
 * All icons follow the KripTik warm glass theme:
 * - Primary: #1a1a1a
 * - Secondary: #666
 * - Muted: #999
 * - Accent: #c25a00
 */

import React from 'react';
import { OpenAIIcon, AnthropicIcon, StripeIcon, AWSIcon, VercelIcon, GitHubIcon, FigmaIcon, SlackIcon, DiscordIcon, HuggingFaceIcon, RunPodIcon, CloudflareIcon, SupabaseIcon, TursoIcon, PlanetScaleIcon, NetlifyIcon, GoogleIcon, CloudinaryIcon, S3Icon, ReplicateIcon, ModalIcon, OpenRouterIcon } from './BrandIcons';
import type { IconProps } from './StatusIcons';

// Brand Icons - Third-party service logos
export {
    OpenAIIcon,
    AnthropicIcon,
    StripeIcon,
    AWSIcon,
    VercelIcon,
    GitHubIcon,
    FigmaIcon,
    SlackIcon,
    DiscordIcon,
    HuggingFaceIcon,
    RunPodIcon,
    CloudflareIcon,
    SupabaseIcon,
    TursoIcon,
    PlanetScaleIcon,
    NetlifyIcon,
    GoogleIcon,
    CloudinaryIcon,
    S3Icon,
    ReplicateIcon,
    ModalIcon,
    OpenRouterIcon,
    BrandIcons,
} from './BrandIcons';

// Status Icons - Indicators, actions, and UI elements
export type { IconProps } from './StatusIcons';
export {
    CheckIcon,
    LoadingIcon,
    ErrorIcon,
    WarningIcon,
    InfoIcon,
    SettingsIcon,
    SearchIcon,
    ClockIcon,
    BrainIcon,
    CodeIcon,
    PlusIcon,
    CloseIcon,
    EyeIcon,
    EyeOffIcon,
    TrashIcon,
    CopyIcon,
    RefreshIcon,
    DownloadIcon,
    UploadIcon,
    LockIcon,
    ShieldIcon,
    KeyIcon,
    PlugIcon,
    ZapIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    ChevronUpIcon,
    MoreHorizontalIcon,
    CreditCardIcon,
    LogOutIcon,
    UserIcon,
    WalletIcon,
    GlobeIcon,
    ActivityIcon,
    BellIcon,
    MoonIcon,
    SunIcon,
    CloudIcon,
    DatabaseIcon,
    ServerIcon,
    WorkflowIcon,
    LayersIcon,
    LayoutDashboardIcon,
    Code2Icon,
    XIcon,
    AlertCircleIcon,
    CheckCircleIcon,
    CircleIcon,
    MessageSquareIcon,
    UserPlusIcon,
    SparklesIcon,
    LayoutTemplateIcon,
    RocketIcon,
    KeyboardIcon,
    UsersIcon,
    PlayIcon,
    PauseIcon,
    StopIcon,
    DollarSignIcon,
    GiftIcon,
    XCircleIcon,
    LightbulbIcon,
    TrendingUpIcon,
    CoinsIcon,
    AlertTriangleIcon,
    CheckCircle2Icon,
    BotIcon,
    GhostIcon,
    SquareIcon,
    BarChart3Icon,
    ImagePlusIcon,
    PaperclipIcon,
    SendIcon,
    MicIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    MenuIcon,
    TerminalIcon,
    ExternalLinkIcon,
    LinkIcon,
    FilterIcon,
    MaximizeIcon,
    MinimizeIcon,
    StarIcon,
    HeartIcon,
    TargetIcon,
    EditIcon,
    SaveIcon,
    ShareIcon,
    WandIcon,
    VolumeIcon,
    HelpCircleIcon,
    PaletteIcon,
    SmartphoneIcon,
    TabletIcon,
    MonitorIcon,
    FolderGitIcon,
    GitBranchIcon,
    RefreshCwIcon,
    TestTubeIcon,
    AccessibilityIcon,
    FileJsonIcon,
    FileCodeIcon,
    MousePointer2Icon,
    TrophyIcon,
    GavelIcon,
    UnlinkIcon,
    Link2Icon,
    Loader2Icon,
    TagIcon,
    GitMergeIcon,
    GitPullRequestIcon,
    StatusIcons,
} from './StatusIcons';

// File Type Icons - Code editor and file browser
export {
    FolderIcon,
    FolderOpenIcon,
    FileIcon,
    JSIcon,
    TSIcon,
    TSXIcon,
    JSONIcon,
    CSSIcon,
    HTMLIcon,
    PythonIcon,
    RustIcon,
    GoIcon,
    JavaIcon,
    MarkdownIcon,
    ImageIcon,
    ConfigIcon,
    GitIcon,
    SQLIcon,
    YAMLIcon,
    ENVIcon,
    PackageIcon,
    LockFileIcon,
    getFileIcon,
    FileTypeIcons,
} from './FileTypeIcons';

// Re-export Abstract Icons from parent directory
export {
    UploadDesignIcon,
    ImageToCodeIcon,
    LandingPageIcon,
    DashboardIcon,
    SaasAppIcon,
    FixBrokenAppIcon,
    NewProjectIcon,
    AbstractIcons,
} from '../AbstractIcons';

// Helper to get brand icon by service ID
export const getBrandIcon = (serviceId: string, size = 24) => {
    const icons: Record<string, React.FC<IconProps>> = {
        'openai': OpenAIIcon,
        'anthropic': AnthropicIcon,
        'stripe': StripeIcon,
        'aws': AWSIcon,
        'aws-s3': S3Icon,
        'vercel': VercelIcon,
        'github': GitHubIcon,
        'figma': FigmaIcon,
        'slack': SlackIcon,
        'discord': DiscordIcon,
        'huggingface': HuggingFaceIcon,
        'runpod': RunPodIcon,
        'cloudflare': CloudflareIcon,
        'supabase': SupabaseIcon,
        'turso': TursoIcon,
        'planetscale': PlanetScaleIcon,
        'netlify': NetlifyIcon,
        'google': GoogleIcon,
        'cloudinary': CloudinaryIcon,
        'replicate': ReplicateIcon,
        'modal': ModalIcon,
        'openrouter': OpenRouterIcon,
    };

    const Icon = icons[serviceId.toLowerCase()];
    if (Icon) {
        return <Icon size={size} />;
    }
    return null;
};

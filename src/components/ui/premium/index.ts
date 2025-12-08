/**
 * KripTik AI Premium UI Component Library
 * 
 * A comprehensive collection of premium, glass-morphism styled components
 * for building beautiful, consistent user interfaces.
 * 
 * Usage:
 * ```tsx
 * import { GlassPanel, GlassButton, FadeIn, Card3D } from '@/components/ui/premium';
 * ```
 */

// ============================================
// Glass Components
// ============================================
export {
  GlassPanel,
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  GlassToggle,
  GlassModal,
  GlassBadge,
  GLASS_TOKENS,
} from '../glass';

// ============================================
// 3D Card Components
// ============================================
export {
  Card3D,
  FeatureCard3D,
  FlipCard3D,
  StatusCard3D,
  ProjectCard3D,
} from '../cards';

// ============================================
// Animation System
// ============================================
export {
  // Variants
  fadeInUp,
  fadeInDown,
  scaleIn,
  slideInLeft,
  slideInRight,
  staggerContainer,
  staggerItem,
  hoverScale,
  hoverLift,
  tapScale,
  buttonPress,
  pulseGlow,
  warmGlowPulse,
  toastSlideIn,
  pageFade,
  pageSlideUp,
  
  // Transitions
  EASE_PREMIUM,
  EASE_SNAP,
  EASE_SMOOTH,
  transitionDefault,
  transitionFast,
  transitionSlow,
  transitionSpring,
  transitionModal,
  DELAY,
  DURATION,
  
  // Hooks
  useScrollAnimation,
  useStaggerAnimation,
  useCounterAnimation,
  useSmoothValue,
  useTypewriter,
  useHoverAnimation,
  useAnimationPreference,
  
  // Components
  FadeIn,
  ScaleIn,
  Stagger,
  StaggerChild,
  Presence,
  ModalAnimation,
  ToastAnimation,
  PageTransition,
  HoverScale,
  Pulse,
  Skeleton,
  LayoutAnimationGroup,
} from '../../lib/animations';

// ============================================
// Code Editor Components
// ============================================
export {
  kriptikNight,
  kriptikGlass,
  kriptikAmber,
  editorThemes,
  CodeBlock,
  EditorWrapper,
  type EditorTheme,
  type EditorThemeName,
} from '../editor';

// ============================================
// Layout Components
// ============================================
export {
  DashboardGrid,
  GridItem,
  DashboardSection,
  DashboardLayout,
  DashboardHeader,
  SplitPane,
} from '../layout';

// ============================================
// Chart Components
// ============================================
export {
  CHART_COLORS,
  CHART_STYLES,
  getSeriesColor,
  getSeriesGradient,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ProgressRing,
  SparkLine,
  MiniBar,
} from '../charts';

// ============================================
// Navigation Components
// ============================================
export {
  SidebarNav,
  TabNav,
  Breadcrumbs,
  StepNav,
} from '../navigation';

// ============================================
// Icon Components
// ============================================
export {
  KripTikNiteLogo,
  ClaudeLogo,
  GPTLogo,
  GeminiLogo,
  MistralLogo,
  GrokLogo,
  DeepSeekLogo,
  QwenLogo,
  CodestralLogo,
  getModelLogo,
} from '../AIBrandLogos';

export {
  OrchestratorIcon,
  UserAvatarIcon,
  AIAssistantIcon,
  SendMessageIcon,
  StopIcon,
  PauseIcon,
  PlayIcon,
} from '../ChatIcons';


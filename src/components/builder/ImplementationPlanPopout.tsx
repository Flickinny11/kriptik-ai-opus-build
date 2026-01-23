/**
 * ImplementationPlanPopout - Enhanced Plan UI
 *
 * Premium fullscreen overlay with 3D glass morphism styling.
 * Features glitch-out animations, slot-machine text reveals,
 * and inline NLP modification for each phase/task.
 *
 * REPLACES the inline ImplementationPlan for all users.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { API_URL } from '@/lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

interface PlanTask {
  id: string;
  content: string;
  originalContent: string;
  isModified: boolean;
  isModifying: boolean;
}

interface PlanPhase {
  id: string;
  title: string;
  description: string;
  type: 'frontend' | 'backend' | 'infrastructure' | 'testing';
  tasks: PlanTask[];
  isExpanded: boolean;
  isModified: boolean;
  modificationHistory: string[];
}

interface ImplementationPlanPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (phases: PlanPhase[]) => void;
  prompt: string;
  projectId?: string;
  designModeEnabled?: boolean;
}

// API Response types
interface ReconfigureResponse {
  success: boolean;
  updatedPhase?: {
    id: string;
    title: string;
    description: string;
    tasks: Array<{ id: string; description: string }>;
  };
  error?: string;
}

// ============================================================================
// DESIGN TOKENS (3D Glass Morphism)
// ============================================================================

const GLASS_TOKENS = {
  overlay: 'rgba(8, 10, 15, 0.85)',
  cardBg: 'linear-gradient(145deg, rgba(22, 24, 30, 0.95) 0%, rgba(14, 16, 22, 0.98) 100%)',
  cardBgHover: 'linear-gradient(145deg, rgba(28, 30, 38, 0.96) 0%, rgba(18, 20, 28, 0.99) 100%)',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(200, 255, 100, 0.25)',
  borderFrontend: 'rgba(245, 168, 108, 0.3)',
  borderBackend: 'rgba(16, 185, 129, 0.3)',
  borderInfra: 'rgba(99, 179, 237, 0.3)',
  borderTesting: 'rgba(245, 158, 11, 0.3)',
  shadow: `
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 15px 40px rgba(0, 0, 0, 0.35),
    inset 0 1px 2px rgba(255, 255, 255, 0.04),
    0 0 0 1px rgba(255, 255, 255, 0.03)
  `,
  shadowHover: `
    0 30px 100px rgba(0, 0, 0, 0.55),
    0 20px 50px rgba(200, 255, 100, 0.08),
    inset 0 0 30px rgba(200, 255, 100, 0.04),
    inset 0 1px 2px rgba(255, 255, 255, 0.06),
    0 0 0 1px rgba(200, 255, 100, 0.12)
  `,
  blur: 'blur(40px) saturate(180%)',
};

// ============================================================================
// CUSTOM ICONS (3D Interlocking Shapes - NO Lucide)
// ============================================================================

function IconLayers({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="layerGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        fill="url(#layerGrad1)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M2 17l10 5 10-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function IconCube({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="cubeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L2 7v10l10 5 10-5V7L12 2z"
        fill="url(#cubeGrad)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path d="M22 7l-10 5-10-5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function IconGrid({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

function IconCircuit({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.8" />
      <circle cx="5" cy="5" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="19" cy="5" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="5" cy="19" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="19" cy="19" r="2" fill="currentColor" fillOpacity="0.5" />
      <path d="M7 7l3 3m4 4l3 3M17 7l-3 3m-4 4l-3 3" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function IconCheck({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 12l5 5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEdit({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowRight({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 12h14m-6-6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkle({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}

// ============================================================================
// PHASE TYPE CONFIG
// ============================================================================

const PHASE_CONFIG: Record<string, { icon: typeof IconLayers; color: string; border: string }> = {
  frontend: { icon: IconLayers, color: 'text-amber-400', border: GLASS_TOKENS.borderFrontend },
  backend: { icon: IconCube, color: 'text-emerald-400', border: GLASS_TOKENS.borderBackend },
  infrastructure: { icon: IconCircuit, color: 'text-sky-400', border: GLASS_TOKENS.borderInfra },
  testing: { icon: IconGrid, color: 'text-amber-500', border: GLASS_TOKENS.borderTesting },
};

// ============================================================================
// SLOT MACHINE TEXT ANIMATION
// ============================================================================

function SlotMachineText({
  text,
  isAnimating,
  onComplete,
}: {
  text: string;
  isAnimating: boolean;
  onComplete?: () => void;
}) {
  const [revealed, setRevealed] = useState(isAnimating ? 0 : text.length);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAnimating) {
      setRevealed(0);
      intervalRef.current = setInterval(() => {
        setRevealed((prev) => {
          if (prev >= text.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            onComplete?.();
            return text.length;
          }
          return prev + 1;
        });
      }, 25);
    } else {
      setRevealed(text.length);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAnimating, text, onComplete]);

  if (!isAnimating) {
    return <span>{text}</span>;
  }

  return (
    <span className="relative">
      <span>{text.slice(0, revealed)}</span>
      <span
        className="inline-block transition-all duration-100"
        style={{
          filter: 'blur(4px)',
          opacity: 0.4,
        }}
      >
        {text.slice(revealed, revealed + 8)}
      </span>
      {revealed < text.length && (
        <span className="absolute -right-1 w-[2px] h-[1em] bg-amber-400 animate-pulse" />
      )}
    </span>
  );
}

// ============================================================================
// GLITCH ANIMATION WRAPPER
// ============================================================================

function GlitchOut({
  children,
  isGlitching,
  onComplete,
}: {
  children: React.ReactNode;
  isGlitching: boolean;
  onComplete?: () => void;
}) {
  useEffect(() => {
    if (isGlitching) {
      const timer = setTimeout(() => onComplete?.(), 400);
      return () => clearTimeout(timer);
    }
  }, [isGlitching, onComplete]);

  return (
    <motion.div
      animate={
        isGlitching
          ? {
              filter: [
                'none',
                'hue-rotate(90deg) blur(2px)',
                'invert(0.1) blur(1px)',
                'hue-rotate(-90deg)',
                'blur(10px)',
              ],
              opacity: [1, 0.8, 0.7, 0.5, 0],
              x: [0, -3, 4, -2, 0],
              y: [0, 2, -1, 3, 0],
            }
          : { filter: 'none', opacity: 1, x: 0, y: 0 }
      }
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// TASK ITEM COMPONENT
// ============================================================================

function TaskItem({
  task,
  phaseType,
  onModify,
}: {
  task: PlanTask;
  phaseType: string;
  onModify: (newContent: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isGlitching, setIsGlitching] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const config = PHASE_CONFIG[phaseType] || PHASE_CONFIG.frontend;

  const handleStartEdit = () => {
    setEditValue('');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!editValue.trim()) {
      setIsEditing(false);
      return;
    }
    setIsGlitching(true);
  };

  const handleGlitchComplete = () => {
    setIsGlitching(false);
    setIsRevealing(true);
    onModify(editValue);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      className={cn(
        'relative group rounded-xl p-4',
        'border transition-all duration-300',
        task.isModified
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-slate-700/30 bg-slate-800/20 hover:border-slate-600/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            'border-2 transition-colors',
            task.isModified ? 'border-amber-500 bg-amber-500/20' : 'border-slate-600'
          )}
        >
          {task.isModified && <IconCheck size={10} className="text-amber-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <GlitchOut isGlitching={isGlitching} onComplete={handleGlitchComplete}>
            <p className="text-sm text-slate-200 leading-relaxed">
              <SlotMachineText
                text={task.content}
                isAnimating={isRevealing}
                onComplete={() => setIsRevealing(false)}
              />
            </p>
          </GlitchOut>

          {task.isModified && task.originalContent !== task.content && (
            <p className="text-xs text-slate-500 line-through mt-1">{task.originalContent}</p>
          )}
        </div>

        <button
          onClick={handleStartEdit}
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'p-2 rounded-lg hover:bg-slate-700/50',
            config.color
          )}
          title="Modify task"
        >
          <IconEdit size={14} />
        </button>
      </div>

      {/* Inline modification input */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-slate-700/30">
              <textarea
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Describe how you want to modify this task..."
                className={cn(
                  'w-full p-3 rounded-lg resize-none',
                  'bg-slate-900/60 border border-slate-700/50',
                  'text-sm text-white placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/40'
                )}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!editValue.trim()}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                    'bg-gradient-to-r from-amber-500 to-orange-500 text-black',
                    'hover:from-amber-400 hover:to-orange-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// PHASE CARD COMPONENT
// ============================================================================

function PhaseCard({
  phase,
  onToggle,
  onModifyTask,
  onModifyPhase,
}: {
  phase: PlanPhase;
  onToggle: () => void;
  onModifyTask: (taskId: string, newContent: string) => void;
  onModifyPhase: (prompt: string) => void;
}) {
  const [isEditingPhase, setIsEditingPhase] = useState(false);
  const [phaseEditValue, setPhaseEditValue] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const config = PHASE_CONFIG[phase.type] || PHASE_CONFIG.frontend;
  const Icon = config.icon;

  const handlePhaseModify = () => {
    if (!phaseEditValue.trim()) {
      setIsEditingPhase(false);
      return;
    }
    onModifyPhase(phaseEditValue);
    setIsEditingPhase(false);
    setPhaseEditValue('');
  };

  return (
    <motion.div
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: isHovered ? GLASS_TOKENS.cardBgHover : GLASS_TOKENS.cardBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: `1px solid ${isHovered ? GLASS_TOKENS.borderHover : config.border}`,
        boxShadow: isHovered ? GLASS_TOKENS.shadowHover : GLASS_TOKENS.shadow,
        transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Glass shine effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 10% 10%, rgba(255,255,255,0.03) 0%, transparent 50%)
          `,
          opacity: isHovered ? 0.8 : 0.5,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.08) 50%, transparent 90%)',
          borderRadius: '20px 20px 0 0',
        }}
      />

      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.01] transition-colors relative z-10"
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br shadow-lg',
              config.color
            )}
            style={{
              background: `linear-gradient(145deg, ${config.border}, transparent)`,
            }}
          >
            <Icon size={24} className={config.color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-lg">{phase.title}</h3>
              {phase.isModified && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  Modified
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{phase.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{phase.tasks.length} tasks</span>
          <motion.div
            animate={{ rotate: phase.isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            <IconChevron size={20} />
          </motion.div>
        </div>
      </button>

      {/* Modify phase button */}
      <div className="absolute top-5 right-16">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingPhase(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={cn(
            'opacity-0 group-hover:opacity-100 p-2 rounded-lg',
            'hover:bg-slate-700/50 transition-all',
            config.color
          )}
          style={{ opacity: isHovered ? 1 : 0 }}
          title="Modify entire phase"
        >
          <IconEdit size={14} />
        </button>
      </div>

      {/* Phase modification input */}
      <AnimatePresence>
        {isEditingPhase && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/30 relative z-10"
          >
            <div className="p-4">
              <textarea
                ref={inputRef}
                value={phaseEditValue}
                onChange={(e) => setPhaseEditValue(e.target.value)}
                placeholder="Describe how you want to modify this entire phase..."
                className={cn(
                  'w-full p-3 rounded-lg resize-none',
                  'bg-slate-900/60 border border-slate-700/50',
                  'text-sm text-white placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/40'
                )}
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditingPhase(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePhaseModify}
                  disabled={!phaseEditValue.trim()}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                    'bg-gradient-to-r from-amber-500 to-orange-500 text-black',
                    'hover:from-amber-400 hover:to-orange-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Apply to Phase
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks */}
      <AnimatePresence>
        {phase.isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden relative z-10"
          >
            <div className="px-5 pb-5 space-y-2">
              {phase.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  phaseType={phase.type}
                  onModify={(newContent) => onModifyTask(task.id, newContent)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function LoadingState({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-6">
      {/* Animated orb */}
      <div className="relative w-20 h-20">
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute inset-2 rounded-full bg-slate-900"
          animate={{ rotate: 360 }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div className="absolute top-1/2 left-0 w-2 h-2 -translate-y-1/2 rounded-full bg-amber-400" />
          <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 rounded-full bg-orange-400" />
        </motion.div>
        <IconSparkle size={24} className="absolute inset-0 m-auto text-amber-400" />
      </div>

      {/* Stage text */}
      <div className="text-center">
        <p className="text-lg font-medium text-white">{stage}</p>
        <p className="text-sm text-slate-500 mt-1">Analyzing your requirements...</p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ImplementationPlanPopout({
  isOpen,
  onClose,
  onApprove,
  prompt,
  projectId,
  designModeEnabled = false,
}: ImplementationPlanPopoutProps) {
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Analyzing prompt');
  const [error, setError] = useState<string | null>(null);

  // Fetch plan from API
  const fetchPlan = useCallback(async () => {
    if (!prompt) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/plan/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': apiClient.getUserId() || 'anonymous',
        },
        credentials: 'include',
        body: JSON.stringify({ prompt, projectId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate plan: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            try {
              const parsedData = JSON.parse(currentData);

              if (currentEvent === 'progress') {
                setLoadingStage(parsedData.stage);
              } else if (currentEvent === 'complete') {
                const apiPlan = parsedData.plan;
                const transformedPhases: PlanPhase[] = apiPlan.phases.map(
                  (phase: {
                    id: string;
                    title: string;
                    description: string;
                    type: string;
                    steps: Array<{ id: string; description: string }>;
                  }) => ({
                    id: phase.id,
                    title: phase.title,
                    description: phase.description,
                    type: phase.type || 'frontend',
                    isExpanded: false,
                    isModified: false,
                    modificationHistory: [],
                    tasks: phase.steps.map((step) => ({
                      id: step.id,
                      content: step.description,
                      originalContent: step.description,
                      isModified: false,
                      isModifying: false,
                    })),
                  })
                );
                setPhases(transformedPhases);
                setIsLoading(false);
              } else if (currentEvent === 'error') {
                setError(parsedData.message || 'Failed to generate plan');
                setIsLoading(false);
              }
            } catch {
              console.error('Failed to parse SSE data');
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      console.error('Plan generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      // Use fallback phases
      setPhases(generateFallbackPhases());
      setIsLoading(false);
    }
  }, [prompt, projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchPlan();
    }
  }, [isOpen, fetchPlan]);

  // Fallback phases for when API fails
  function generateFallbackPhases(): PlanPhase[] {
    return [
      {
        id: 'frontend',
        title: 'Frontend Development',
        description: 'UI components and user interface',
        type: 'frontend',
        isExpanded: true,
        isModified: false,
        modificationHistory: [],
        tasks: [
          {
            id: 'f1',
            content: 'Set up project structure with React + Vite',
            originalContent: 'Set up project structure with React + Vite',
            isModified: false,
            isModifying: false,
          },
          {
            id: 'f2',
            content: 'Create main layout components',
            originalContent: 'Create main layout components',
            isModified: false,
            isModifying: false,
          },
          {
            id: 'f3',
            content: 'Implement core UI features',
            originalContent: 'Implement core UI features',
            isModified: false,
            isModifying: false,
          },
        ],
      },
      {
        id: 'backend',
        title: 'Backend Services',
        description: 'API endpoints and data management',
        type: 'backend',
        isExpanded: false,
        isModified: false,
        modificationHistory: [],
        tasks: [
          {
            id: 'b1',
            content: 'Configure database and ORM',
            originalContent: 'Configure database and ORM',
            isModified: false,
            isModifying: false,
          },
          {
            id: 'b2',
            content: 'Create API endpoints',
            originalContent: 'Create API endpoints',
            isModified: false,
            isModifying: false,
          },
        ],
      },
    ];
  }

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId ? { ...phase, isExpanded: !phase.isExpanded } : phase
      )
    );
  };

  // Modify a task
  const modifyTask = async (phaseId: string, taskId: string, newContent: string) => {
    setPhases((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase;
        return {
          ...phase,
          isModified: true,
          tasks: phase.tasks.map((task) =>
            task.id === taskId
              ? { ...task, content: newContent, isModified: true }
              : task
          ),
        };
      })
    );

    // Call API to reconfigure
    try {
      await apiClient.post('/api/plan/reconfigure', {
        phaseId,
        taskId,
        modification: newContent,
      });
    } catch (err) {
      console.error('Failed to reconfigure task:', err);
    }
  };

  // Modify entire phase
  const modifyPhase = async (phaseId: string, prompt: string) => {
    setPhases((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase;
        return {
          ...phase,
          isModified: true,
          modificationHistory: [...phase.modificationHistory, prompt],
        };
      })
    );

    // Call API to reconfigure phase
    try {
      const { data } = await apiClient.post<ReconfigureResponse>('/api/plan/reconfigure', {
        phaseId,
        modification: prompt,
      });

      if (data.success && data.updatedPhase) {
        const updatedPhase = data.updatedPhase;
        setPhases((prev) =>
          prev.map((phase) => {
            if (phase.id !== phaseId) return phase;
            return {
              ...phase,
              tasks: updatedPhase.tasks.map(
                (task: { id: string; description: string }) => ({
                  id: task.id,
                  content: task.description,
                  originalContent: task.description,
                  isModified: false,
                  isModifying: false,
                })
              ),
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to reconfigure phase:', err);
    }
  };

  // Handle approve
  const handleApprove = () => {
    onApprove(phases);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: GLASS_TOKENS.overlay }}
      >
        {/* Backdrop blur */}
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl"
          style={{
            background: GLASS_TOKENS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: `1px solid ${GLASS_TOKENS.border}`,
            boxShadow: GLASS_TOKENS.shadow,
          }}
        >
          {/* Glass effects */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 20% 10%, rgba(245,168,108,0.04) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 90%, rgba(16,185,129,0.03) 0%, transparent 40%)
              `,
            }}
          />

          {/* Top edge highlight */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.1) 50%, transparent 95%)',
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between p-6 border-b border-slate-700/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <IconSparkle size={24} className="text-black" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Implementation Plan</h2>
                <p className="text-sm text-slate-400">
                  Review and customize your build plan
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <IconClose size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="relative z-10 overflow-y-auto max-h-[calc(85vh-180px)] p-6">
            {isLoading ? (
              <LoadingState stage={loadingStage} />
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400">{error}</p>
                <button
                  onClick={fetchPlan}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Prompt summary */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-500">Building:</span>{' '}
                    <span className="text-white font-medium">
                      {prompt?.slice(0, 150)}
                      {(prompt?.length || 0) > 150 ? '...' : ''}
                    </span>
                  </p>
                  {designModeEnabled && (
                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-2">
                      <IconLayers size={14} />
                      Design Mode enabled - mockups will be generated after approval
                    </p>
                  )}
                </div>

                {/* Phases */}
                <div className="space-y-3">
                  {phases.map((phase) => (
                    <PhaseCard
                      key={phase.id}
                      phase={phase}
                      onToggle={() => togglePhase(phase.id)}
                      onModifyTask={(taskId, content) => modifyTask(phase.id, taskId, content)}
                      onModifyPhase={(prompt) => modifyPhase(phase.id, prompt)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-between p-6 border-t border-slate-700/30 bg-slate-900/50">
            <div className="text-sm text-slate-500">
              {phases.filter((p) => p.isModified).length > 0 && (
                <span className="text-amber-400">
                  {phases.filter((p) => p.isModified).length} phase(s) modified
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className={cn(
                  'px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2',
                  'bg-gradient-to-r from-amber-500 to-orange-500',
                  'hover:from-amber-400 hover:to-orange-400',
                  'text-black shadow-lg shadow-amber-500/25',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all duration-200'
                )}
              >
                {designModeEnabled ? 'Continue to Design Mode' : 'Approve & Build'}
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ImplementationPlanPopout;

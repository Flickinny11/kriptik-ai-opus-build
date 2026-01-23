/**
 * DesignModeOverlay - Visual Mockup Grid
 *
 * Premium overlay displaying AI-generated UI mockups for each view
 * in the implementation plan. Features navigation lines showing
 * screen flows and inline modification capabilities.
 *
 * Uses VL-JEPA for semantic element extraction and tethering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface SemanticElement {
  id: string;
  type: 'button' | 'input' | 'nav' | 'card' | 'form' | 'image' | 'text' | 'list' | 'modal';
  boundingBox: { x: number; y: number; width: number; height: number };
  label: string;
  confidence: number;
  suggestedComponent?: string;
}

interface MockupData {
  id: string;
  viewName: string;
  imageBase64: string;
  blueprint?: {
    viewName: string;
    platform: string;
    components: Array<{ id: string; type: string; label: string }>;
  };
  elements: SemanticElement[];
  matchRate: number;
  generatedAt: Date;
  inferenceTime: number;
  isGenerating?: boolean;
  error?: string;
}

interface NavigationFlow {
  from: string;
  to: string;
  type: 'navigates' | 'submits' | 'toggles' | 'opens';
  label?: string;
}

// API Response types
interface MockupGenerateResponse {
  success: boolean;
  mockup?: {
    id: string;
    viewName: string;
    imageBase64: string;
    elements: SemanticElement[];
    matchRate: number;
    inferenceTime: number;
  };
  error?: string;
}

interface PlanPhase {
  id: string;
  title: string;
  description: string;
  type: string;
}

interface DesignModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (mockups: MockupData[]) => void;
  phases: PlanPhase[];
  projectId?: string;
  stylePreferences?: {
    colorScheme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    typography?: 'modern' | 'classic' | 'playful';
  };
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const GLASS_TOKENS = {
  overlay: 'rgba(8, 10, 15, 0.9)',
  cardBg: 'linear-gradient(145deg, rgba(22, 24, 30, 0.95) 0%, rgba(14, 16, 22, 0.98) 100%)',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(200, 255, 100, 0.25)',
  shadow: `
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 15px 40px rgba(0, 0, 0, 0.35),
    inset 0 1px 2px rgba(255, 255, 255, 0.04)
  `,
  blur: 'blur(40px) saturate(180%)',
};

// ============================================================================
// CUSTOM ICONS
// ============================================================================

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

function IconRefresh({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M23 4v6h-6M1 20v-6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconZoomIn({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function IconLayers({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" fillOpacity="0.3" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

// ============================================================================
// MOCKUP CARD COMPONENT
// ============================================================================

function MockupCard({
  mockup,
  isSelected,
  onClick,
  onRegenerate,
  onModify,
}: {
  mockup: MockupData;
  isSelected: boolean;
  onClick: () => void;
  onRegenerate: () => void;
  onModify: (prompt: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifyValue, setModifyValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleModifySubmit = () => {
    if (!modifyValue.trim()) {
      setShowModifyInput(false);
      return;
    }
    onModify(modifyValue);
    setShowModifyInput(false);
    setModifyValue('');
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300',
        isSelected && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900'
      )}
      style={{
        background: GLASS_TOKENS.cardBg,
        border: `1px solid ${isHovered ? GLASS_TOKENS.borderHover : GLASS_TOKENS.border}`,
        boxShadow: GLASS_TOKENS.shadow,
        transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'none',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Image container */}
      <div className="relative aspect-[9/16] bg-slate-800 overflow-hidden">
        {mockup.isGenerating ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-amber-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-amber-500/50 border-t-amber-500"
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              <IconLayers size={24} className="absolute inset-0 m-auto text-amber-400" />
            </div>
            <p className="absolute bottom-8 text-sm text-slate-400">Generating mockup...</p>
          </div>
        ) : mockup.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
              <IconClose size={24} className="text-red-400" />
            </div>
            <p className="text-sm text-red-400 text-center">{mockup.error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : mockup.imageBase64 ? (
          <>
            <img
              src={`data:image/png;base64,${mockup.imageBase64}`}
              alt={mockup.viewName}
              className="w-full h-full object-cover"
            />
            {/* Element overlay on hover */}
            {isHovered && mockup.elements.length > 0 && (
              <div className="absolute inset-0 bg-black/50">
                {mockup.elements.map((element) => (
                  <div
                    key={element.id}
                    className="absolute border border-amber-500/50 bg-amber-500/10 rounded"
                    style={{
                      left: `${element.boundingBox.x}%`,
                      top: `${element.boundingBox.y}%`,
                      width: `${element.boundingBox.width}%`,
                      height: `${element.boundingBox.height}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] text-amber-400 whitespace-nowrap bg-black/80 px-1 rounded">
                      {element.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <IconLayers size={48} className="text-slate-600" />
          </div>
        )}

        {/* Action buttons */}
        {isHovered && !mockup.isGenerating && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
              title="Regenerate"
            >
              <IconRefresh size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModifyInput(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
              title="Modify"
            >
              <IconEdit size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Open fullscreen preview
              }}
              className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
              title="Zoom"
            >
              <IconZoomIn size={14} />
            </button>
          </div>
        )}

        {/* Match rate indicator */}
        {mockup.matchRate > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
            <span className={cn(
              'text-xs font-medium',
              mockup.matchRate >= 0.9 ? 'text-emerald-400' :
              mockup.matchRate >= 0.7 ? 'text-amber-400' : 'text-red-400'
            )}>
              {Math.round(mockup.matchRate * 100)}% match
            </span>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
            <IconCheck size={14} className="text-black" />
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 border-t border-slate-700/30">
        <h4 className="text-sm font-medium text-white truncate">{mockup.viewName}</h4>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-500">
            {mockup.elements.length} elements
          </span>
          {mockup.inferenceTime > 0 && (
            <span className="text-xs text-slate-500">
              {(mockup.inferenceTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Modify input overlay */}
      <AnimatePresence>
        {showModifyInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              ref={inputRef}
              value={modifyValue}
              onChange={(e) => setModifyValue(e.target.value)}
              placeholder="Describe the changes you want..."
              className={cn(
                'w-full p-3 rounded-lg resize-none',
                'bg-slate-900/80 border border-slate-700',
                'text-sm text-white placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/40'
              )}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleModifySubmit();
                }
                if (e.key === 'Escape') setShowModifyInput(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowModifyInput(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModifySubmit}
                disabled={!modifyValue.trim()}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                  'bg-gradient-to-r from-amber-500 to-orange-500 text-black',
                  'hover:from-amber-400 hover:to-orange-400',
                  'disabled:opacity-50'
                )}
              >
                Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// NAVIGATION LINES (SVG)
// ============================================================================

function NavigationLines({
  flows,
  mockups,
  containerRef,
}: {
  flows: NavigationFlow[];
  mockups: MockupData[];
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; label?: string }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateLines = () => {
      const container = containerRef.current;
      if (!container) return;

      const newLines: typeof lines = [];

      flows.forEach((flow) => {
        const fromEl = container.querySelector(`[data-mockup-id="${flow.from}"]`);
        const toEl = container.querySelector(`[data-mockup-id="${flow.to}"]`);

        if (fromEl && toEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          newLines.push({
            x1: fromRect.left + fromRect.width / 2 - containerRect.left,
            y1: fromRect.bottom - containerRect.top,
            x2: toRect.left + toRect.width / 2 - containerRect.left,
            y2: toRect.top - containerRect.top,
            label: flow.label,
          });
        }
      });

      setLines(newLines);
    };

    updateLines();
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, [flows, mockups, containerRef]);

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-0">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(245,168,108,0.5)" />
        </marker>
      </defs>
      {lines.map((line, i) => (
        <g key={i}>
          <path
            d={`M${line.x1},${line.y1} C${line.x1},${(line.y1 + line.y2) / 2} ${line.x2},${(line.y1 + line.y2) / 2} ${line.x2},${line.y2}`}
            fill="none"
            stroke="rgba(245,168,108,0.3)"
            strokeWidth="2"
            strokeDasharray="4 4"
            markerEnd="url(#arrowhead)"
          />
          {line.label && (
            <text
              x={(line.x1 + line.x2) / 2}
              y={(line.y1 + line.y2) / 2}
              fill="rgba(245,168,108,0.7)"
              fontSize="10"
              textAnchor="middle"
            >
              {line.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DesignModeOverlay({
  isOpen,
  onClose,
  onApprove,
  phases,
  projectId: _projectId,
  stylePreferences,
}: DesignModeOverlayProps) {
  void _projectId; // Reserved for future use
  const [mockups, setMockups] = useState<MockupData[]>([]);
  const [selectedMockups, setSelectedMockups] = useState<Set<string>>(new Set());
  const [navigationFlows, setNavigationFlows] = useState<NavigationFlow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate mockups for each phase
  const generateMockups = useCallback(async () => {
    if (phases.length === 0) return;

    setIsGenerating(true);
    setProgress({ current: 0, total: phases.length });

    // Initialize mockups with loading state
    const initialMockups: MockupData[] = phases.map((phase) => ({
      id: phase.id,
      viewName: phase.title,
      imageBase64: '',
      elements: [],
      matchRate: 0,
      generatedAt: new Date(),
      inferenceTime: 0,
      isGenerating: true,
    }));
    setMockups(initialMockups);

    // Generate each mockup
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      setProgress({ current: i + 1, total: phases.length });

      try {
        const { data } = await apiClient.post<MockupGenerateResponse>('/api/design-mode/mockup/generate', {
          prompt: phase.description,
          viewName: phase.title,
          platform: 'web',
          stylePreferences,
          planContext: { phase, phases },
        });

        if (data.success && data.mockup) {
          const mockupData = data.mockup;
          setMockups((prev) =>
            prev.map((m) =>
              m.id === phase.id
                ? {
                    ...m,
                    imageBase64: mockupData.imageBase64,
                    elements: mockupData.elements || [],
                    matchRate: mockupData.matchRate || 0,
                    inferenceTime: mockupData.inferenceTime || 0,
                    isGenerating: false,
                  }
                : m
            )
          );

          // Auto-select all mockups
          setSelectedMockups((prev) => new Set([...prev, phase.id]));
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch (err) {
        console.error(`Failed to generate mockup for ${phase.title}:`, err);
        setMockups((prev) =>
          prev.map((m) =>
            m.id === phase.id
              ? {
                  ...m,
                  isGenerating: false,
                  error: err instanceof Error ? err.message : 'Generation failed',
                }
              : m
          )
        );
      }
    }

    setIsGenerating(false);

    // Generate navigation flows based on phase order
    const flows: NavigationFlow[] = [];
    for (let i = 0; i < phases.length - 1; i++) {
      flows.push({
        from: phases[i].id,
        to: phases[i + 1].id,
        type: 'navigates',
      });
    }
    setNavigationFlows(flows);
  }, [phases, stylePreferences]);

  // Regenerate a single mockup
  const regenerateMockup = async (mockupId: string) => {
    const mockup = mockups.find((m) => m.id === mockupId);
    const phase = phases.find((p) => p.id === mockupId);
    if (!mockup || !phase) return;

    setMockups((prev) =>
      prev.map((m) =>
        m.id === mockupId ? { ...m, isGenerating: true, error: undefined } : m
      )
    );

    try {
      const { data } = await apiClient.post<MockupGenerateResponse>('/api/design-mode/mockup/generate', {
        prompt: phase.description,
        viewName: phase.title,
        platform: 'web',
        stylePreferences,
        planContext: { phase, phases },
      });

      if (data.success && data.mockup) {
        const mockupData = data.mockup;
        setMockups((prev) =>
          prev.map((m) =>
            m.id === mockupId
              ? {
                  ...m,
                  imageBase64: mockupData.imageBase64,
                  elements: mockupData.elements || [],
                  matchRate: mockupData.matchRate || 0,
                  inferenceTime: mockupData.inferenceTime || 0,
                  isGenerating: false,
                }
              : m
          )
        );
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (err) {
      setMockups((prev) =>
        prev.map((m) =>
          m.id === mockupId
            ? {
                ...m,
                isGenerating: false,
                error: err instanceof Error ? err.message : 'Generation failed',
              }
            : m
        )
      );
    }
  };

  // Modify a mockup with new prompt
  const modifyMockup = async (mockupId: string, prompt: string) => {
    const mockup = mockups.find((m) => m.id === mockupId);
    if (!mockup) return;

    setMockups((prev) =>
      prev.map((m) =>
        m.id === mockupId ? { ...m, isGenerating: true, error: undefined } : m
      )
    );

    try {
      const { data } = await apiClient.post<MockupGenerateResponse>('/api/design-mode/mockup/modify', {
        mockupId,
        prompt,
      });

      if (data.success && data.mockup) {
        const mockupData = data.mockup;
        setMockups((prev) =>
          prev.map((m) =>
            m.id === mockupId
              ? {
                  ...m,
                  imageBase64: mockupData.imageBase64,
                  elements: mockupData.elements || [],
                  matchRate: mockupData.matchRate || 0,
                  inferenceTime: mockupData.inferenceTime || 0,
                  isGenerating: false,
                }
              : m
          )
        );
      } else {
        throw new Error(data.error || 'Modification failed');
      }
    } catch (err) {
      setMockups((prev) =>
        prev.map((m) =>
          m.id === mockupId
            ? {
                ...m,
                isGenerating: false,
                error: err instanceof Error ? err.message : 'Modification failed',
              }
            : m
        )
      );
    }
  };

  // Toggle mockup selection
  const toggleSelection = (mockupId: string) => {
    setSelectedMockups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mockupId)) {
        newSet.delete(mockupId);
      } else {
        newSet.add(mockupId);
      }
      return newSet;
    });
  };

  // Handle approve
  const handleApprove = () => {
    const selectedMockupData = mockups.filter((m) => selectedMockups.has(m.id));
    onApprove(selectedMockupData);
    onClose();
  };

  // Generate mockups when opened
  useEffect(() => {
    if (isOpen && phases.length > 0 && mockups.length === 0) {
      generateMockups();
    }
  }, [isOpen, phases, mockups.length, generateMockups]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: GLASS_TOKENS.overlay }}
      >
        {/* Backdrop blur */}
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-6 border-b border-slate-700/30 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <IconLayers size={24} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Design Mode</h2>
              <p className="text-sm text-slate-400">
                {isGenerating
                  ? `Generating mockups... (${progress.current}/${progress.total})`
                  : `${mockups.length} views generated`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {selectedMockups.size} of {mockups.length} selected
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <IconClose size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isGenerating && (
          <div className="relative z-10 h-1 bg-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Mockup grid */}
        <div
          ref={containerRef}
          className="relative z-10 flex-1 overflow-auto p-6"
        >
          <NavigationLines
            flows={navigationFlows}
            mockups={mockups}
            containerRef={containerRef}
          />

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mockups.map((mockup) => (
              <div key={mockup.id} data-mockup-id={mockup.id}>
                <MockupCard
                  mockup={mockup}
                  isSelected={selectedMockups.has(mockup.id)}
                  onClick={() => toggleSelection(mockup.id)}
                  onRegenerate={() => regenerateMockup(mockup.id)}
                  onModify={(prompt) => modifyMockup(mockup.id, prompt)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between p-6 border-t border-slate-700/30 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={generateMockups}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-50"
            >
              <IconRefresh size={16} />
              Regenerate All
            </button>
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
              disabled={selectedMockups.size === 0 || isGenerating}
              className={cn(
                'px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2',
                'bg-gradient-to-r from-amber-500 to-orange-500',
                'hover:from-amber-400 hover:to-orange-400',
                'text-black shadow-lg shadow-amber-500/25',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200'
              )}
            >
              Approve & Build
              <IconArrowRight size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DesignModeOverlay;

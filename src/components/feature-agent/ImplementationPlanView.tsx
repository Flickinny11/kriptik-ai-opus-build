import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImplementationPlan, ImplementationPhase, PhaseStep } from '@/store/useFeatureAgentTileStore';

export interface PhaseModification {
  stepId: string;
  modification: string;
}

interface ImplementationPlanViewProps {
  plan: ImplementationPlan;
  onApprovePhase: (phaseId: string) => void;
  onModifyPhase: (phaseId: string, modifications: PhaseModification[]) => void;
  onApproveAll: () => void;
}

function svgCheck(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.3l2.2 2.2L13 2.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function svgPencil(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.9 2.2l2.9 2.9-8.3 8.3-3.4.5.5-3.4 8.3-8.3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.8 3.3l2.9 2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function pillLabel(plan: ImplementationPlan): string {
  if (plan.parallelFrontendBackend) return 'PARALLEL';
  if (plan.frontendFirst) return 'FRONTEND FIRST';
  if (plan.backendFirst) return 'BACKEND FIRST';
  return 'STRATEGY';
}

export function ImplementationPlanView({ plan, onApprovePhase, onModifyPhase, onApproveAll }: ImplementationPlanViewProps) {
  const phases = useMemo(() => [...plan.phases].sort((a, b) => a.order - b.order), [plan.phases]);
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(phases[0]?.id ?? null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [mods, setMods] = useState<Record<string, Record<string, string>>>({});
  const [regeneratingPhaseId, setRegeneratingPhaseId] = useState<string | null>(null);

  const approvedCount = phases.filter(p => p.approved).length;

  const togglePhase = (phaseId: string) => setOpenPhaseId(prev => (prev === phaseId ? null : phaseId));

  const beginModify = (phase: ImplementationPhase) => {
    setEditingPhaseId(phase.id);
    setMods((prev) => {
      if (prev[phase.id]) return prev;
      const base: Record<string, string> = {};
      for (const step of phase.steps) base[step.id] = '';
      return { ...prev, [phase.id]: base };
    });
    setOpenPhaseId(phase.id);
  };

  const saveModify = async (phase: ImplementationPhase) => {
    const map = mods[phase.id] || {};
    const payload: PhaseModification[] = Object.entries(map)
      .filter(([, v]) => v.trim().length > 0)
      .map(([stepId, modification]) => ({ stepId, modification: modification.trim() }));

    setRegeneratingPhaseId(phase.id);
    setEditingPhaseId(null);
    try {
      await onModifyPhase(phase.id, payload);
    } finally {
      setRegeneratingPhaseId(null);
    }
  };

  const renderStep = (phase: ImplementationPhase, step: PhaseStep) => {
    const isEditing = editingPhaseId === phase.id;
    const modValue = mods[phase.id]?.[step.id] ?? '';
    const typeLabel = step.type.toUpperCase();

    return (
      <div
        key={step.id}
        style={{
          padding: 10,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 22px rgba(0,0,0,0.18)',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 750,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                marginBottom: 6,
              }}
            >
              {typeLabel} · {Math.max(0, step.estimatedTokens)} TOKENS
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap' }}>
              {step.description}
            </div>
          </div>
        </div>

        {isEditing && (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={modValue}
              onChange={(e) =>
                setMods((prev) => ({
                  ...prev,
                  [phase.id]: { ...(prev[phase.id] || {}), [step.id]: e.target.value },
                }))
              }
              rows={2}
              placeholder="Modify this step..."
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 12,
                padding: 10,
                outline: 'none',
                border: '1px solid rgba(245,168,108,0.22)',
                background: 'rgba(0,0,0,0.18)',
                color: 'rgba(255,255,255,0.92)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
            Implementation Plan
          </div>
          <div style={{ fontSize: 10, fontWeight: 650, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {approvedCount}/{phases.length} phases approved
          </div>
        </div>

        <button
          onClick={onApproveAll}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 12,
            border: '1px solid rgba(122,232,160,0.22)',
            background: 'linear-gradient(145deg, rgba(64,200,112,0.16), rgba(255,255,255,0.03))',
            color: 'rgba(255,255,255,0.92)',
            fontSize: 11,
            fontWeight: 750,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: '0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Approve all phases"
        >
          {svgCheck(14)} <span style={{ marginLeft: 8 }}>Approve All</span>
        </button>
      </div>

      {/* What is Done */}
      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 22px rgba(0,0,0,0.18)',
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
          What Is Considered Done
        </div>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap' }}>
          {plan.whatIsDone}
        </div>
      </div>

      {/* Approach */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.03)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 22px rgba(0,0,0,0.18)',
            padding: 12,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
            Approach
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              Parallel Agents: <span style={{ fontWeight: 750 }}>{plan.parallelAgentsNeeded}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              Strategy: <span style={{ fontWeight: 750 }}>{pillLabel(plan)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.03)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 22px rgba(0,0,0,0.18)',
            padding: 12,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
            Estimate
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              Tokens: <span style={{ fontWeight: 750 }}>{Math.max(0, plan.estimatedTokenUsage).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              Cost: <span style={{ fontWeight: 750 }}>${Math.max(0, plan.estimatedCostUSD).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phases.map((phase) => {
          const isOpen = openPhaseId === phase.id;
          const isEditing = editingPhaseId === phase.id;
          const isRegen = regeneratingPhaseId === phase.id;

          return (
            <div
              key={phase.id}
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 26px rgba(0,0,0,0.18)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => togglePhase(phase.id)}
                style={{
                  width: '100%',
                  padding: '12px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
                      Phase {phase.order}
                    </div>
                    {phase.approved && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(122,232,160,0.22)',
                        background: 'rgba(64,200,112,0.14)',
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: 10,
                        fontWeight: 750,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        {svgCheck(12)} <span style={{ marginLeft: 2 }}>Approved</span>
                      </div>
                    )}
                    {phase.modified && !phase.approved && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(245,168,108,0.22)',
                        background: 'rgba(245,168,108,0.12)',
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: 10,
                        fontWeight: 750,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        {svgPencil(12)} <span style={{ marginLeft: 2 }}>Modified</span>
                      </div>
                    )}
                    {isRegen && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.14)',
                        color: 'rgba(255,255,255,0.78)',
                        fontSize: 10,
                        fontWeight: 750,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        <span>Regenerating…</span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 650, color: 'rgba(255,255,255,0.92)' }}>
                    {phase.name}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-wrap' }}>
                    {phase.description}
                  </div>
                </div>

                <div style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d={isOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    style={{ padding: '0 12px 12px' }}
                  >
                    <div style={{ marginTop: 6 }}>
                      {phase.steps.map((s) => renderStep(phase, s))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => beginModify(phase)}
                            style={{
                              height: 34,
                              padding: '0 12px',
                              borderRadius: 12,
                              border: '1px solid rgba(245,168,108,0.25)',
                              background: 'linear-gradient(145deg, rgba(245,168,108,0.14), rgba(255,255,255,0.03))',
                              color: 'rgba(255,255,255,0.92)',
                              fontSize: 11,
                              fontWeight: 750,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              boxShadow: '0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
                              cursor: 'pointer',
                            }}
                            title="Modify this phase"
                            disabled={isRegen}
                          >
                            {svgPencil(14)} <span style={{ marginLeft: 8 }}>Modify</span>
                          </button>

                          <button
                            onClick={() => onApprovePhase(phase.id)}
                            style={{
                              height: 34,
                              padding: '0 12px',
                              borderRadius: 12,
                              border: '1px solid rgba(122,232,160,0.22)',
                              background: 'linear-gradient(145deg, rgba(64,200,112,0.16), rgba(255,255,255,0.03))',
                              color: 'rgba(255,255,255,0.92)',
                              fontSize: 11,
                              fontWeight: 750,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              boxShadow: '0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
                              cursor: 'pointer',
                            }}
                            title="Approve this phase"
                            disabled={isRegen}
                          >
                            {svgCheck(14)} <span style={{ marginLeft: 8 }}>Approve</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => saveModify(phase)}
                          style={{
                            height: 34,
                            padding: '0 12px',
                            borderRadius: 12,
                            border: '1px solid rgba(245,168,108,0.25)',
                            background: 'linear-gradient(145deg, rgba(245,168,108,0.14), rgba(255,255,255,0.03))',
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: 11,
                            fontWeight: 750,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            boxShadow: '0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                          }}
                          title="Save changes for this phase"
                          disabled={isRegen}
                        >
                          Save Changes
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}



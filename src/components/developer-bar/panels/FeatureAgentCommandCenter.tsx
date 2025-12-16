/**
 * Feature Agent Command Center - Premium 3D AI Agent Control
 *
 * Features:
 * - Real OpenRouter models with high/low/thinking variations
 * - 3D skewed agent tiles with matte slate texture
 * - Expandable streaming reasoning window
 * - Realistic layered shadows
 * - GitHub PR creation integration
 * - Liquid glass UI elements
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { useFeatureAgentTileStore } from '@/store/useFeatureAgentTileStore';
import { useFeatureAgentStore, type RunningAgent, type GhostModeAgentConfig } from '@/store/feature-agent-store';
import './AgentsCommandCenter.css';

// Custom SVG Icons (no lucide-react)
function IconGhost() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5C5.24 1.5 3 3.74 3 6.5v5.5c0 .28.22.5.5.5.14 0 .27-.05.35-.15L5 11.2l.65.65c.09.1.22.15.35.15s.27-.05.35-.15L8 10.2l1.65 1.65c.09.1.22.15.35.15s.27-.05.35-.15l.65-.65 1.15 1.15c.09.1.21.15.35.15.28 0 .5-.22.5-.5V6.5c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="0.75" fill="currentColor" />
      <circle cx="10" cy="6" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4l5.5 3.5L12.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5c-2.21 0-4 1.79-4 4v2l-.8 1.6c-.12.24.05.4.3.4h9c.25 0 .42-.16.3-.4L11 7.5v-2c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 11c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 13H3a1 1 0 01-1-1V2a1 1 0 011-1h6l3 3v8a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 1v3H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8h4M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Default Ghost Mode Config
const DEFAULT_GHOST_CONFIG: GhostModeAgentConfig = {
  maxBudgetUSD: 50,
  notifyEmail: false,
  emailAddress: '',
  notifySMS: false,
  phoneNumber: '',
  notifySlack: false,
  slackWebhookUrl: '',
  notifyPush: true,
  notifyOnErrors: true,
  notifyOnDecisions: true,
  notifyOnBudgetThreshold: true,
  budgetThresholdPercent: 80,
  notifyOnCompletion: true,
  mergeWhenComplete: false,
};

// Saved contact info storage key
const SAVED_CONTACTS_KEY = 'kriptik-ghost-mode-contacts';

interface SavedContacts {
  emails: string[];
  phones: string[];
}

function getSavedContacts(): SavedContacts {
  try {
    const saved = localStorage.getItem(SAVED_CONTACTS_KEY);
    return saved ? JSON.parse(saved) : { emails: [], phones: [] };
  } catch {
    return { emails: [], phones: [] };
  }
}

function saveContact(type: 'email' | 'phone', value: string) {
  const contacts = getSavedContacts();
  if (type === 'email' && !contacts.emails.includes(value)) {
    contacts.emails.push(value);
  } else if (type === 'phone' && !contacts.phones.includes(value)) {
    contacts.phones.push(value);
  }
  localStorage.setItem(SAVED_CONTACTS_KEY, JSON.stringify(contacts));
}

// Production AI Models - Comprehensive list with thinking/codex variants
const AI_MODELS = [
  // ========================================================================
  // ANTHROPIC CLAUDE - Thinking Models (Extended reasoning with budget_tokens)
  // ========================================================================
  {
    id: 'anthropic/claude-sonnet-4.5-thinking',
    name: 'Claude Sonnet 4.5',
    variant: 'Thinking',
    provider: 'anthropic',
    color: '#F5A86C',
    desc: 'Extended thinking with 64K reasoning budget',
    icon: 'https://cdn.simpleicons.org/anthropic/F5A86C',
    thinkingEnabled: true,
    thinkingBudget: 64000
  },
  {
    id: 'anthropic/claude-opus-4.5-thinking',
    name: 'Claude Opus 4.5',
    variant: 'Thinking',
    provider: 'anthropic',
    color: '#D4A574',
    desc: 'Maximum reasoning with extended thinking',
    icon: 'https://cdn.simpleicons.org/anthropic/D4A574',
    thinkingEnabled: true,
    thinkingBudget: 128000
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    variant: 'Fast',
    provider: 'anthropic',
    color: '#CC7A50',
    desc: 'Lightning fast, cost-effective',
    icon: 'https://cdn.simpleicons.org/anthropic/CC7A50',
    thinkingEnabled: false
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    variant: 'Balanced',
    provider: 'anthropic',
    color: '#E8845B',
    desc: 'Best balance of speed & quality',
    icon: 'https://cdn.simpleicons.org/anthropic/E8845B',
    thinkingEnabled: false
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    variant: 'Maximum',
    provider: 'anthropic',
    color: '#B8956A',
    desc: 'Highest reasoning capability',
    icon: 'https://cdn.simpleicons.org/anthropic/B8956A',
    thinkingEnabled: false
  },
  // ========================================================================
  // OPENAI GPT-5 SERIES - Latest generation models
  // ========================================================================
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    variant: 'Flagship',
    provider: 'openai',
    color: '#00A67E',
    desc: 'Latest flagship model, multimodal',
    icon: 'https://cdn.simpleicons.org/openai/00A67E'
  },
  {
    id: 'openai/gpt-5.1-codex-high',
    name: 'GPT-5.1 Codex',
    variant: 'High',
    provider: 'openai',
    color: '#10A37F',
    desc: 'Maximum code generation quality',
    icon: 'https://cdn.simpleicons.org/openai/10A37F',
    codexTier: 'high'
  },
  {
    id: 'openai/gpt-5.1-codex-medium',
    name: 'GPT-5.1 Codex',
    variant: 'Medium',
    provider: 'openai',
    color: '#0D9668',
    desc: 'Balanced code quality & speed',
    icon: 'https://cdn.simpleicons.org/openai/0D9668',
    codexTier: 'medium'
  },
  {
    id: 'openai/gpt-5.1-codex-low',
    name: 'GPT-5.1 Codex',
    variant: 'Low',
    provider: 'openai',
    color: '#0B8751',
    desc: 'Fast code generation, cost-effective',
    icon: 'https://cdn.simpleicons.org/openai/0B8751',
    codexTier: 'low'
  },
  {
    id: 'openai/gpt-5.1-thinking',
    name: 'GPT-5.1',
    variant: 'Thinking',
    provider: 'openai',
    color: '#00C78C',
    desc: 'Extended reasoning with chain-of-thought',
    icon: 'https://cdn.simpleicons.org/openai/00C78C',
    thinkingEnabled: true
  },
  // ========================================================================
  // GOOGLE GEMINI - Latest Pro model
  // ========================================================================
  {
    id: 'google/gemini-3-pro',
    name: 'Gemini 3 Pro',
    variant: 'Pro',
    provider: 'google',
    color: '#4285F4',
    desc: '2M context, multimodal reasoning',
    icon: 'https://cdn.simpleicons.org/google/4285F4'
  },
  // ========================================================================
  // XAI GROK - Fast & Thinking variants
  // ========================================================================
  {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast',
    variant: 'Speed',
    provider: 'xai',
    color: '#1DA1F2',
    desc: 'Ultra-fast code generation',
    icon: null
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1',
    variant: 'Fast',
    provider: 'xai',
    color: '#14B8A6',
    desc: 'Rapid responses, great quality',
    icon: null
  },
  {
    id: 'x-ai/grok-4.1-thinking',
    name: 'Grok 4.1',
    variant: 'Thinking',
    provider: 'xai',
    color: '#0D9488',
    desc: 'Extended reasoning mode',
    icon: null,
    thinkingEnabled: true
  },
  // ========================================================================
  // GLM (ZHIPU) - Vision turbo model
  // ========================================================================
  {
    id: 'zhipu/glm-4.6v-turbo',
    name: 'GLM-4.6V',
    variant: 'Turbo',
    provider: 'zhipu',
    color: '#FF6B35',
    desc: 'Vision-first, blazing fast',
    icon: null,
    supportsVision: true
  },
  // ========================================================================
  // DEEPSEEK - Latest V3.2 & R1
  // ========================================================================
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    variant: 'Latest',
    provider: 'deepseek',
    color: '#06B6D4',
    desc: 'Latest release, ultra cost-effective',
    icon: null
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    variant: 'Reasoning',
    provider: 'deepseek',
    color: '#0891B2',
    desc: 'Deep reasoning capabilities',
    icon: null
  },
  // ========================================================================
  // KRIP-TOE-NITE - Intelligent Auto-Router
  // ========================================================================
  {
    id: 'krip-toe-nite',
    name: 'Krip-Toe-Nite',
    variant: 'Auto-Select',
    provider: 'kriptik',
    color: '#C8FF64',
    desc: 'Intelligent model routing for optimal cost/quality',
    icon: null
  },
];

interface AgentThought {
  timestamp: number;
  type: 'thinking' | 'action' | 'result';
  content: string;
}

interface AgentDiff {
  file: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface Agent {
  id: string;
  name: string;
  model: string;
  modelName: string;
  status: 'idle' | 'thinking' | 'building' | 'verifying' | 'complete' | 'error';
  task: string;
  progress: number;
  thoughts: AgentThought[];
  currentAction?: string;
  summary?: string;
  diffs?: AgentDiff[];
  branchName?: string;
  prUrl?: string;
  tokensUsed?: number;
  startTime?: Date;
  endTime?: Date;
}

interface FeatureAgentCommandCenterProps {
  projectId?: string;
}

type DeveloperModeAgentModel =
  | 'krip-toe-nite'
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-3-5'
  | 'gpt-5-codex'
  | 'gemini-2-5-pro'
  | 'deepseek-r1';

function mapUiModelToDeveloperModeModel(uiModelId: string): DeveloperModeAgentModel {
  if (uiModelId === 'krip-toe-nite') return 'krip-toe-nite';
  if (uiModelId === 'anthropic/claude-opus-4.5') return 'claude-opus-4-5';
  if (uiModelId === 'anthropic/claude-sonnet-4.5') return 'claude-sonnet-4-5';
  if (uiModelId === 'anthropic/claude-sonnet-4') return 'claude-sonnet-4-5';
  if (uiModelId === 'anthropic/claude-3.5-haiku') return 'claude-haiku-3-5';
  if (uiModelId.startsWith('deepseek/')) return 'deepseek-r1';
  if (uiModelId.startsWith('openai/')) return 'gpt-5-codex';
  return 'claude-sonnet-4-5';
}

// Running Agent Tile Mini-View
interface RunningAgentTileProps {
  agent: RunningAgent;
  index: number;
  onClick: () => void;
  onStop: () => void;
}

// Ghost Mode Configuration Panel
interface GhostModeConfigPanelProps {
  onSaveConfig: (config: GhostModeAgentConfig) => void;
  currentConfig: GhostModeAgentConfig | null;
}

function GhostModeConfigPanel({ onSaveConfig, currentConfig }: GhostModeConfigPanelProps) {
  const [config, setConfig] = useState<GhostModeAgentConfig>(currentConfig || DEFAULT_GHOST_CONFIG);
  const [savedContacts, setSavedContacts] = useState<SavedContacts>(getSavedContacts());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateConfig = <K extends keyof GhostModeAgentConfig>(key: K, value: GhostModeAgentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setSaveSuccess(false);
  };

  const handleSaveEmail = () => {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      saveContact('email', newEmail);
      setSavedContacts(getSavedContacts());
      updateConfig('emailAddress', newEmail);
      setNewEmail('');
      setShowEmailInput(false);
      setErrors((prev) => { const next = { ...prev }; delete next.newEmail; return next; });
    } else {
      setErrors((prev) => ({ ...prev, newEmail: 'Invalid email format' }));
    }
  };

  const handleSavePhone = () => {
    if (newPhone && /^\+?[\d\s-]{10,}$/.test(newPhone)) {
      saveContact('phone', newPhone);
      setSavedContacts(getSavedContacts());
      updateConfig('phoneNumber', newPhone);
      setNewPhone('');
      setShowPhoneInput(false);
      setErrors((prev) => { const next = { ...prev }; delete next.newPhone; return next; });
    } else {
      setErrors((prev) => ({ ...prev, newPhone: 'Invalid phone format' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (config.maxBudgetUSD <= 0) {
      newErrors.budget = 'Budget must be greater than 0';
    }
    if (config.notifyEmail && !config.emailAddress?.trim()) {
      newErrors.email = 'Select or add an email address';
    }
    if (config.notifySMS && !config.phoneNumber?.trim()) {
      newErrors.phone = 'Select or add a phone number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (config.notifyPush && 'Notification' in window) {
      await Notification.requestPermission();
    }
    onSaveConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="acc-v2__ghost-config">
      <div className="acc-v2__ghost-header">
        <div className="acc-v2__ghost-icon"><IconGhost /></div>
        <div className="acc-v2__ghost-title-area">
          <h3 className="acc-v2__ghost-title">Ghost Mode Configuration</h3>
          <p className="acc-v2__ghost-subtitle">Configure autonomous agent execution settings</p>
        </div>
      </div>

      <div className="acc-v2__ghost-content">
        {/* Token Usage Budget */}
        <div className="acc-v2__ghost-section">
          <label className="acc-v2__ghost-label">Token Usage Max Budget</label>
          <div className="acc-v2__ghost-budget-row">
            <span className="acc-v2__ghost-budget-prefix">$</span>
            <input
              type="number"
              className={`acc-v2__ghost-budget-input ${errors.budget ? 'acc-v2__ghost-input--error' : ''}`}
              value={config.maxBudgetUSD}
              onChange={(e) => updateConfig('maxBudgetUSD', parseFloat(e.target.value) || 0)}
              min={1}
              step={1}
            />
            <span className="acc-v2__ghost-budget-suffix">USD</span>
          </div>
          {errors.budget && <span className="acc-v2__ghost-error">{errors.budget}</span>}
        </div>

        {/* Alert Scenarios */}
        <div className="acc-v2__ghost-section">
          <label className="acc-v2__ghost-label">Alert Me When</label>
          <div className="acc-v2__ghost-alerts">
            <label className="acc-v2__ghost-checkbox-label">
              <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyOnErrors} onChange={(e) => updateConfig('notifyOnErrors', e.target.checked)} />
              <span className="acc-v2__ghost-checkbox-custom" />
              <span>Errors Occur</span>
            </label>
            <label className="acc-v2__ghost-checkbox-label">
              <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyOnDecisions} onChange={(e) => updateConfig('notifyOnDecisions', e.target.checked)} />
              <span className="acc-v2__ghost-checkbox-custom" />
              <span>Decisions Needed</span>
            </label>
            <label className="acc-v2__ghost-checkbox-label">
              <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyOnBudgetThreshold} onChange={(e) => updateConfig('notifyOnBudgetThreshold', e.target.checked)} />
              <span className="acc-v2__ghost-checkbox-custom" />
              <span>Budget Threshold ({config.budgetThresholdPercent}%)</span>
            </label>
            <label className="acc-v2__ghost-checkbox-label">
              <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyOnCompletion} onChange={(e) => updateConfig('notifyOnCompletion', e.target.checked)} />
              <span className="acc-v2__ghost-checkbox-custom" />
              <span>Task Completion</span>
            </label>
          </div>
        </div>

        {/* Notification Methods */}
        <div className="acc-v2__ghost-section">
          <label className="acc-v2__ghost-label">Notification Methods</label>
          <div className="acc-v2__ghost-notify-methods">
            <label className="acc-v2__ghost-checkbox-label">
              <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyPush} onChange={(e) => updateConfig('notifyPush', e.target.checked)} />
              <span className="acc-v2__ghost-checkbox-custom" /><IconBell /><span>KripTik Notifications</span>
            </label>

            <div className="acc-v2__ghost-notify-row">
              <label className="acc-v2__ghost-checkbox-label">
                <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifySMS} onChange={(e) => updateConfig('notifySMS', e.target.checked)} />
                <span className="acc-v2__ghost-checkbox-custom" /><IconPhone /><span>SMS</span>
              </label>
              {config.notifySMS && (
                <div className="acc-v2__ghost-contact-select">
                  {savedContacts.phones.length > 0 && (
                    <select className="acc-v2__ghost-select" value={config.phoneNumber || ''} onChange={(e) => updateConfig('phoneNumber', e.target.value)}>
                      <option value="">Select phone...</option>
                      {savedContacts.phones.map((phone) => (<option key={phone} value={phone}>{phone}</option>))}
                    </select>
                  )}
                  {!showPhoneInput ? (
                    <button className="acc-v2__ghost-add-btn" onClick={() => setShowPhoneInput(true)}>+ Add New</button>
                  ) : (
                    <div className="acc-v2__ghost-input-row">
                      <input type="tel" className={`acc-v2__ghost-input ${errors.newPhone ? 'acc-v2__ghost-input--error' : ''}`} placeholder="+1 555-555-5555" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                      <button className="acc-v2__ghost-save-btn" onClick={handleSavePhone}><IconSave /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {errors.phone && <span className="acc-v2__ghost-error">{errors.phone}</span>}

            <div className="acc-v2__ghost-notify-row">
              <label className="acc-v2__ghost-checkbox-label">
                <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.notifyEmail} onChange={(e) => updateConfig('notifyEmail', e.target.checked)} />
                <span className="acc-v2__ghost-checkbox-custom" /><IconMail /><span>Email</span>
              </label>
              {config.notifyEmail && (
                <div className="acc-v2__ghost-contact-select">
                  {savedContacts.emails.length > 0 && (
                    <select className="acc-v2__ghost-select" value={config.emailAddress || ''} onChange={(e) => updateConfig('emailAddress', e.target.value)}>
                      <option value="">Select email...</option>
                      {savedContacts.emails.map((email) => (<option key={email} value={email}>{email}</option>))}
                    </select>
                  )}
                  {!showEmailInput ? (
                    <button className="acc-v2__ghost-add-btn" onClick={() => setShowEmailInput(true)}>+ Add New</button>
                  ) : (
                    <div className="acc-v2__ghost-input-row">
                      <input type="email" className={`acc-v2__ghost-input ${errors.newEmail ? 'acc-v2__ghost-input--error' : ''}`} placeholder="your@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                      <button className="acc-v2__ghost-save-btn" onClick={handleSaveEmail}><IconSave /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {errors.email && <span className="acc-v2__ghost-error">{errors.email}</span>}
          </div>
        </div>

        {/* Auto-Merge Option */}
        <div className="acc-v2__ghost-section acc-v2__ghost-section--merge">
          <label className="acc-v2__ghost-checkbox-label">
            <input type="checkbox" className="acc-v2__ghost-checkbox" checked={config.mergeWhenComplete} onChange={(e) => updateConfig('mergeWhenComplete', e.target.checked)} />
            <span className="acc-v2__ghost-checkbox-custom" />
            <span>Auto-merge when feature passes verification</span>
          </label>
        </div>
      </div>

      <div className="acc-v2__ghost-footer">
        <button className={`acc-v2__ghost-enable-btn ${saveSuccess ? 'acc-v2__ghost-enable-btn--success' : ''}`} onClick={handleSave}>
          {saveSuccess ? <><IconCheck /><span>Settings Saved</span></> : <><IconGhost /><span>Save Ghost Mode Settings</span></>}
        </button>
      </div>
    </div>
  );
}

function RunningAgentTile({ agent, index, onClick, onStop }: RunningAgentTileProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const modelData = AI_MODELS.find((m) => m.id === agent.model);
  const isActive = !['complete', 'failed', 'paused'].includes(agent.status);
  const updateAgentInStore = useFeatureAgentStore((s) => s.updateAgentStatus);

  const handleStopClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirm) {
      await onStop();
      // Mark agent as paused so it moves to history
      updateAgentInStore(agent.id, { status: 'paused' });
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  return (
    <motion.div
      className={`acc-v2__running-tile ${isActive ? 'acc-v2__running-tile--active' : ''}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      onClick={onClick}
      style={{ '--tile-color': modelData?.color || '#F5A86C' } as React.CSSProperties}
    >
      {isActive && (
        <motion.div
          className="acc-v2__running-tile-pulse"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="acc-v2__running-tile-header">
        <div className="acc-v2__running-tile-model">
          {modelData?.icon ? (
            <img src={modelData.icon} alt="" className="acc-v2__running-tile-icon" />
          ) : (
            <div
              className="acc-v2__running-tile-icon-placeholder"
              style={{ background: modelData?.color }}
            >
              {modelData?.provider === 'kriptik' ? 'K' : 'DS'}
            </div>
          )}
          <span className="acc-v2__running-tile-name">{agent.name}</span>
        </div>
        <div className="acc-v2__running-tile-right">
          {agent.ghostModeEnabled && (
            <span className="acc-v2__running-tile-ghost-badge">GHOST</span>
          )}
          <div className={`acc-v2__running-tile-status acc-v2__running-tile-status--${agent.status}`}>
            {isActive && <span className="acc-v2__running-tile-status-dot" />}
            <span>{agent.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <p className="acc-v2__running-tile-task">{agent.taskPrompt}</p>

      <div className="acc-v2__running-tile-footer">
        <div className="acc-v2__running-tile-progress">
          <div className="acc-v2__running-tile-progress-bar">
            <motion.div
              className="acc-v2__running-tile-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${agent.progress}%` }}
            />
          </div>
          <span className="acc-v2__running-tile-progress-pct">{agent.progress}%</span>
        </div>
        <button
          className={`acc-v2__running-tile-stop ${showConfirm ? 'acc-v2__running-tile-stop--confirm' : ''}`}
          onClick={handleStopClick}
          title={showConfirm ? 'Click again to confirm' : 'Stop agent'}
        >
          {showConfirm ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>Confirm</span>
            </>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export function FeatureAgentCommandCenter({ projectId }: FeatureAgentCommandCenterProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[1].id);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'running' | 'history' | 'ghost'>('active');
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [ghostConfig, setGhostConfig] = useState<GhostModeAgentConfig | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openTile = useFeatureAgentTileStore((s) => s.openTile);

  // Running agents from persisted store
  const runningAgents = useFeatureAgentStore((s) => s.runningAgents);
  const addRunningAgent = useFeatureAgentStore((s) => s.addRunningAgent);
  const updateAgentInStore = useFeatureAgentStore((s) => s.updateAgentStatus);

  // Load ghost config from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kriptik-ghost-mode-config');
      if (saved) setGhostConfig(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Save ghost config
  const handleSaveGhostConfig = (config: GhostModeAgentConfig) => {
    setGhostConfig(config);
    localStorage.setItem('kriptik-ghost-mode-config', JSON.stringify(config));
  };

  // Sorted running agents - only active ones (most recent first)
  const sortedRunningAgents = useMemo(
    () => [...runningAgents]
      .filter((a) => !['complete', 'failed', 'paused'].includes(a.status))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [runningAgents]
  );

  // History agents (completed/failed/paused)
  const sortedHistoryAgents = useMemo(
    () => [...runningAgents]
      .filter((a) => ['complete', 'failed', 'paused'].includes(a.status))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [runningAgents]
  );

  const selectedModelData = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[1];

  // Deploy agent using the backend orchestration system
  const deployAgent = useCallback(async () => {
    if (!taskPrompt.trim() || isDeploying || agents.length >= 6) return;
    if (!projectId) {
      setAgents(prev => [...prev, {
        id: `agent-${Date.now()}`,
        name: 'Feature Agent',
        model: selectedModel,
        modelName: selectedModelData.name,
        status: 'error',
        task: taskPrompt.trim(),
        progress: 0,
        thoughts: [{
          timestamp: Date.now(),
          type: 'result',
          content: 'No project selected. Open Builder with a projectId (e.g. /builder/:projectId) to deploy feature agents.'
        }],
        startTime: new Date(),
      }]);
      return;
    }

    setIsDeploying(true);

    const agentName = `Agent ${agents.length + 1}`;
    const optimisticId = `agent-${Date.now()}`;

    // Create optimistic agent
    const newAgent: Agent = {
      id: optimisticId,
      name: agentName,
      model: selectedModel,
      modelName: selectedModelData.name,
      status: 'thinking',
      task: taskPrompt.trim(),
      progress: 0,
      thoughts: [{
        timestamp: Date.now(),
        type: 'thinking',
        content: 'Initializing agent and analyzing task requirements...'
      }],
      startTime: new Date(),
    };

    setAgents(prev => [...prev, newAgent]);
    setTaskPrompt('');

    try {
      // Create a Feature Agent (Intent Lock -> Plan -> Approval -> Credentials -> Execution)
      const { data: created } = await apiClient.post<{ success: boolean; agent: any }>(
        '/api/developer-mode/feature-agent',
        {
          projectId,
          name: agentName,
          taskPrompt: taskPrompt.trim(),
          model: mapUiModelToDeveloperModeModel(selectedModel),
          ghostModeConfig: ghostConfig || undefined,
        }
      );
      const realAgentId = created.agent?.id as string;

      // Update agent with response
      setAgents(prev => prev.map(a =>
        a.id === optimisticId
          ? {
            ...a,
            id: realAgentId || optimisticId,
            status: 'thinking' as const,
            progress: 5,
            thoughts: [
              ...a.thoughts,
              { timestamp: Date.now(), type: 'action' as const, content: 'Feature Agent created. Intent Lock and plan generation starting...' }
            ]
          }
          : a
      ));

      // Open the Feature Agent Tile popout (real SSE stream)
      if (realAgentId) {
        openTile(realAgentId, {
          agentName,
          modelName: selectedModelData.name,
          position: { x: 90 + (agents.length * 22), y: 130 + (agents.length * 18) },
        });
      }

      // Add to running agents store for persistence
      if (realAgentId) {
        addRunningAgent({
          id: realAgentId,
          name: agentName,
          model: selectedModel,
          modelName: selectedModelData.name,
          status: 'implementing',
          progress: 5,
          taskPrompt: taskPrompt.trim(),
          startedAt: new Date().toISOString(),
          ghostModeEnabled: !!ghostConfig,
          ghostModeConfig: ghostConfig || undefined,
        });
      }

      // Start polling for coarse status updates (tile receives real-time stream)
      if (realAgentId) pollAgentStatus(realAgentId);

    } catch (error) {
      console.error('Deploy failed:', error);
      setAgents(prev => prev.map(a =>
        a.id === optimisticId
          ? { ...a, status: 'error' as const, thoughts: [...a.thoughts, { timestamp: Date.now(), type: 'result' as const, content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] }
          : a
      ));
    } finally {
      setIsDeploying(false);
    }
  }, [taskPrompt, selectedModel, selectedModelData, projectId, agents.length, isDeploying, openTile, addRunningAgent]);

  // Poll for agent status updates
  const pollAgentStatus = useCallback(async (agentId: string) => {
    const poll = async () => {
      try {
        const { data: statusResp } = await apiClient.get<{ success: boolean; agent: any }>(
          `/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}`
        );
        const status = statusResp.agent;

        setAgents(prev => prev.map(a => {
          if (a.id !== agentId) return a;

          const newThoughts = [...a.thoughts];
          if (status?.progress?.currentStep && status.progress.currentStep !== a.currentAction) {
            newThoughts.push({
              timestamp: Date.now(),
              type: 'action',
              content: status.progress.currentStep
            });
          }

          return {
            ...a,
            status: (status?.status === 'complete' ? 'complete' : status?.status === 'failed' ? 'error' : a.status),
            progress: typeof status?.progress?.progress === 'number' ? status.progress.progress : a.progress,
            thoughts: newThoughts,
            currentAction: status?.progress?.currentStep,
            branchName: status?.branchName,
            tokensUsed: status?.progress?.tokensUsed,
            endTime: status?.status === 'complete' ? new Date() : undefined,
          };
        }));

        // Sync to persisted store
        const newStatus = status?.status === 'complete' ? 'complete' : status?.status === 'failed' ? 'failed' : undefined;
        if (newStatus || typeof status?.progress?.progress === 'number') {
          updateAgentInStore(agentId, {
            status: newStatus || 'implementing',
            progress: typeof status?.progress?.progress === 'number' ? status.progress.progress : undefined,
          });
        }

        // Continue polling if not complete
        const agent = agents.find(a => a.id === agentId);
        if (agent && !['complete', 'error'].includes(agent.status)) {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Poll failed:', error);
      }
    };

    poll();
  }, [agents, updateAgentInStore]);

  // Stop running agent
  const stopRunningAgent = useCallback(async (agentId: string) => {
    try {
      await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/stop`, {});
      updateAgentInStore(agentId, { status: 'paused' });
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  }, [updateAgentInStore]);

  // Open running agent tile
  const openRunningAgentTile = useCallback((agent: RunningAgent) => {
    openTile(agent.id, {
      agentName: agent.name,
      modelName: agent.modelName,
      position: { x: 100, y: 140 },
    });
  }, [openTile]);

  // Create GitHub PR
  const createPR = useCallback(async (agent: Agent) => {
    if (!agent.branchName) return;

    try {
      // No route is currently defined for PR creation in developer-mode routes.
      // Keep the UI flow, but avoid calling a non-existent endpoint.
      setAgents(prev => prev.map(a =>
        a.id === agent.id
          ? {
            ...a,
            thoughts: [
              ...a.thoughts,
              { timestamp: Date.now(), type: 'result' as const, content: 'PR creation endpoint is not configured yet for Developer Mode.' }
            ]
          }
          : a
      ));
    } catch (error) {
      console.error('PR creation failed:', error);
    }
  }, []);

  const getStatusConfig = (status: Agent['status']) => {
    const configs = {
      thinking: { label: 'THINKING', glow: true },
      building: { label: 'BUILDING', glow: true },
      verifying: { label: 'VERIFYING', glow: true },
      complete: { label: 'COMPLETE', glow: false },
      error: { label: 'ERROR', glow: false },
      idle: { label: 'IDLE', glow: false },
    };
    return configs[status] || configs.idle;
  };

  return (
    <div className="acc-v2">
      {/* Subtle gradient background without particles */}
      <div className="acc-v2__bg">
        <div className="acc-v2__bg-gradient" />
        <div className="acc-v2__bg-noise" />
      </div>

      {/* Content */}
      <div className="acc-v2__content">
        {/* Header */}
        <div className="acc-v2__header">
          <div className="acc-v2__header-row">
            <div className="acc-v2__logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="url(#acc-grad)" />
                <defs>
                  <linearGradient id="acc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5A86C" />
                    <stop offset="100%" stopColor="#D46A4A" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="acc-v2__title-area">
              <h1 className="acc-v2__title">Feature Agent Command Center</h1>
              <span className="acc-v2__stats">
                {agents.filter(a => ['thinking', 'building', 'verifying'].includes(a.status)).length} running · {agents.length}/6 feature agents
              </span>
            </div>
          </div>

          {/* Liquid Glass Tabs */}
          <div className="acc-v2__tabs">
            {(['active', 'running', 'history', 'ghost'] as const).map(tab => (
              <button
                key={tab}
                className={`acc-v2__tab ${activeTab === tab ? 'acc-v2__tab--active' : ''} ${tab === 'ghost' ? 'acc-v2__tab--ghost' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span className="acc-v2__tab-text">
                  {tab === 'active' ? 'DEPLOY' : tab === 'running' ? 'RUNNING' : tab === 'history' ? 'HISTORY' : 'GHOST MODE'}
                </span>
                {tab === 'running' && sortedRunningAgents.length > 0 && (
                  <span className="acc-v2__tab-badge">{sortedRunningAgents.length}</span>
                )}
                {tab === 'ghost' && ghostConfig && (
                  <span className="acc-v2__tab-badge acc-v2__tab-badge--ghost"><IconCheck /></span>
                )}
                {activeTab === tab && <div className="acc-v2__tab-glow" />}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="acc-v2__body">
          <AnimatePresence mode="wait">
            {activeTab === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__active"
              >
                {/* Deploy Section - Liquid Glass */}
                <div className="acc-v2__deploy-card">
                  <div className="acc-v2__deploy-header">
                    <span className="acc-v2__deploy-title">Deploy New Feature Agent</span>
                    <span className="acc-v2__deploy-slots">{6 - agents.length} feature agents available</span>
                  </div>

                  {/* Model Dropdown */}
                  <div className="acc-v2__model-select" ref={dropdownRef}>
                    <button
                      className="acc-v2__model-trigger"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <div className="acc-v2__model-selected">
                        {selectedModelData.icon ? (
                          <img src={selectedModelData.icon} alt="" className="acc-v2__model-icon" />
                        ) : (
                          <div
                            className="acc-v2__model-icon-placeholder"
                            style={{ background: selectedModelData.color }}
                          >
                            {selectedModelData.provider === 'kriptik' ? 'K' : 'DS'}
                          </div>
                        )}
                        <div className="acc-v2__model-info">
                          <span className="acc-v2__model-name">{selectedModelData.name}</span>
                          <span className="acc-v2__model-variant">{selectedModelData.variant}</span>
                        </div>
                      </div>
                      <svg className={`acc-v2__model-chevron ${isDropdownOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          className="acc-v2__model-dropdown"
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                        >
                          {AI_MODELS.map((model) => (
                            <button
                              key={model.id}
                              className={`acc-v2__model-option ${selectedModel === model.id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setIsDropdownOpen(false);
                              }}
                            >
                              {model.icon ? (
                                <img src={model.icon} alt="" className="acc-v2__model-icon" />
                              ) : (
                                <div
                                  className="acc-v2__model-icon-placeholder"
                                  style={{ background: model.color }}
                                >
                                  {model.provider === 'kriptik' ? 'K' : 'DS'}
                                </div>
                              )}
                              <div className="acc-v2__model-info">
                                <span className="acc-v2__model-name">{model.name}</span>
                                <span className="acc-v2__model-desc">{model.desc}</span>
                              </div>
                              <span
                                className="acc-v2__model-badge"
                                style={{ background: `${model.color}20`, color: model.color }}
                              >
                                {model.variant}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Prompt Input */}
                  <div className="acc-v2__prompt-container">
                    <textarea
                      value={taskPrompt}
                      onChange={(e) => setTaskPrompt(e.target.value)}
                      placeholder="Describe what you want this agent to build..."
                      className="acc-v2__prompt"
                      rows={3}
                      disabled={agents.length >= 6}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) {
                          deployAgent();
                        }
                      }}
                    />
                  </div>

                  <div className="acc-v2__deploy-footer">
                    <div className="acc-v2__deploy-hint">
                      <kbd>⌘</kbd><span>+ Enter to deploy</span>
                    </div>
                    <motion.button
                      className="acc-v2__deploy-btn"
                      onClick={deployAgent}
                      disabled={!taskPrompt.trim() || isDeploying || agents.length >= 6}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isDeploying ? (
                        <motion.div
                          className="acc-v2__spinner"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                          Deploy Feature Agent
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Agent Tiles - No skew */}
                <div className="acc-v2__agents acc-v2__agents--no-skew">
                  <AnimatePresence>
                    {agents.map((agent, index) => {
                      const status = getStatusConfig(agent.status);
                      const isExpanded = expandedAgentId === agent.id;
                      const modelData = AI_MODELS.find(m => m.id === agent.model);

                      return (
                        <motion.div
                          key={agent.id}
                          className={`acc-v2__tile acc-v2__tile--no-skew ${isExpanded ? 'acc-v2__tile--expanded-vertical' : ''} acc-v2__tile--${agent.status}`}
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 25,
                            delay: index * 0.05
                          }}
                          onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                          style={{
                            '--tile-color': modelData?.color || '#F5A86C',
                            zIndex: isExpanded ? 100 : agents.length - index,
                          } as React.CSSProperties}
                        >
                          {/* Tile Glow for active states */}
                          {status.glow && (
                            <motion.div
                              className="acc-v2__tile-glow"
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}

                          {/* Tile Header */}
                          <div className="acc-v2__tile-header">
                            <div className="acc-v2__tile-model">
                              {modelData?.icon ? (
                                <img src={modelData.icon} alt="" className="acc-v2__tile-model-icon" />
                              ) : (
                                <div
                                  className="acc-v2__tile-model-placeholder"
                                  style={{ background: modelData?.color }}
                                >
                                  {modelData?.provider === 'kriptik' ? 'K' : 'DS'}
                                </div>
                              )}
                              <span className="acc-v2__tile-model-name">{agent.modelName}</span>
                            </div>
                            <div className={`acc-v2__tile-status acc-v2__tile-status--${agent.status}`}>
                              {status.glow && <span className="acc-v2__tile-status-dot" />}
                              {status.label}
                            </div>
                          </div>

                          {/* Task Description */}
                          <p className="acc-v2__tile-task">{agent.task}</p>

                          {/* Progress Bar */}
                          {agent.status !== 'idle' && agent.status !== 'complete' && (
                            <div className="acc-v2__tile-progress">
                              <div className="acc-v2__tile-progress-bar">
                                <motion.div
                                  className="acc-v2__tile-progress-fill"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${agent.progress}%` }}
                                />
                              </div>
                              <span className="acc-v2__tile-progress-pct">{agent.progress}%</span>
                            </div>
                          )}

                          {/* Expanded Content - Vertical Only */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                className="acc-v2__tile-expanded acc-v2__tile-expanded--vertical"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {/* Streaming Thoughts */}
                                <div className="acc-v2__tile-thoughts">
                                  <div className="acc-v2__tile-thoughts-header">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                                      <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                    AGENT REASONING
                                  </div>
                                  <div className="acc-v2__tile-thoughts-list">
                                    {agent.thoughts.slice(-5).map((thought, i) => (
                                      <motion.div
                                        key={i}
                                        className={`acc-v2__thought acc-v2__thought--${thought.type}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                      >
                                        {thought.content}
                                      </motion.div>
                                    ))}
                                    {agent.status === 'thinking' && (
                                      <motion.span
                                        className="acc-v2__cursor"
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Summary & Actions for completed agents */}
                                {agent.status === 'complete' && (
                                  <div className="acc-v2__tile-complete">
                                    {agent.summary && (
                                      <div className="acc-v2__tile-summary">
                                        <div className="acc-v2__tile-summary-header">Summary</div>
                                        <p>{agent.summary}</p>
                                      </div>
                                    )}

                                    {agent.diffs && agent.diffs.length > 0 && (
                                      <div className="acc-v2__tile-diffs">
                                        <div className="acc-v2__tile-diffs-header">
                                          Changes ({agent.diffs.length} files)
                                        </div>
                                        {agent.diffs.map((diff, i) => (
                                          <div key={i} className="acc-v2__tile-diff">
                                            <span className="acc-v2__tile-diff-file">{diff.file}</span>
                                            <span className="acc-v2__tile-diff-stats">
                                              <span className="additions">+{diff.additions}</span>
                                              <span className="deletions">-{diff.deletions}</span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="acc-v2__tile-actions">
                                      {agent.prUrl ? (
                                        <a
                                          href={agent.prUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="acc-v2__tile-btn acc-v2__tile-btn--primary"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M6 3H3v10h10v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                            <path d="M7 9L13 3M13 3H9M13 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                          View PR
                                        </a>
                                      ) : (
                                        <button
                                          className="acc-v2__tile-btn acc-v2__tile-btn--primary"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            createPR(agent);
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="11" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M5 6v4M7 12h2c1 0 2-1 2-2V8" stroke="currentColor" strokeWidth="1.5" />
                                          </svg>
                                          Create PR
                                        </button>
                                      )}
                                      <button
                                        className="acc-v2__tile-btn"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Review Changes
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty slots indicator */}
                  {agents.length === 0 && (
                    <div className="acc-v2__empty">
                      <div className="acc-v2__empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                          <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
                          <path d="M24 18v12M18 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                        </svg>
                      </div>
                      <span>No agents deployed</span>
                      <p>Deploy your first agent to start building</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'running' && (
              <motion.div
                key="running"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__running"
              >
                {sortedRunningAgents.length === 0 ? (
                  <div className="acc-v2__empty">
                    <div className="acc-v2__empty-icon">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="10" y="10" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
                        <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      </svg>
                    </div>
                    <span>No agents running</span>
                    <p>Deploy a feature agent to see it here</p>
                  </div>
                ) : (
                  <div className="acc-v2__running-list">
                    <AnimatePresence mode="popLayout">
                      {sortedRunningAgents.map((agent, index) => (
                        <RunningAgentTile
                          key={agent.id}
                          agent={agent}
                          index={index}
                          onClick={() => openRunningAgentTile(agent)}
                          onStop={() => stopRunningAgent(agent.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__history"
              >
                {sortedHistoryAgents.length === 0 ? (
                  <div className="acc-v2__history-empty">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                      <path d="M24 14v10l6 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                    </svg>
                    <span>No agent history yet</span>
                    <p>Completed agent runs will appear here</p>
                  </div>
                ) : (
                  <div className="acc-v2__history-list">
                    <AnimatePresence mode="popLayout">
                      {sortedHistoryAgents.map((agent, index) => {
                        const modelData = AI_MODELS.find((m) => m.id === agent.model);
                        return (
                          <motion.div
                            key={agent.id}
                            className={`acc-v2__history-tile acc-v2__history-tile--${agent.status}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            onClick={() => openRunningAgentTile(agent)}
                            style={{ '--tile-color': modelData?.color || '#F5A86C' } as React.CSSProperties}
                          >
                            <div className="acc-v2__history-tile-header">
                              <div className="acc-v2__history-tile-model">
                                {modelData?.icon ? (
                                  <img src={modelData.icon} alt="" className="acc-v2__history-tile-icon" />
                                ) : (
                                  <div className="acc-v2__history-tile-icon-placeholder" style={{ background: modelData?.color }}>
                                    {modelData?.provider === 'kriptik' ? 'K' : 'DS'}
                                  </div>
                                )}
                                <span className="acc-v2__history-tile-name">{agent.name}</span>
                              </div>
                              <div className={`acc-v2__history-tile-status acc-v2__history-tile-status--${agent.status}`}>
                                {agent.status.toUpperCase()}
                              </div>
                            </div>
                            <p className="acc-v2__history-tile-task">{agent.taskPrompt}</p>
                            <div className="acc-v2__history-tile-footer">
                              <span className="acc-v2__history-tile-date">{new Date(agent.startedAt).toLocaleDateString()}</span>
                              <span className="acc-v2__history-tile-progress">{agent.progress}% completed</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'ghost' && (
              <motion.div
                key="ghost"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__ghost-tab"
              >
                <GhostModeConfigPanel onSaveConfig={handleSaveGhostConfig} currentConfig={ghostConfig} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Resize handles for proper window resizing */}
      <div className="acc-v2__resize-handle acc-v2__resize-handle--e" />
      <div className="acc-v2__resize-handle acc-v2__resize-handle--s" />
      <div className="acc-v2__resize-handle acc-v2__resize-handle--se" />
    </div>
  );
}

export default FeatureAgentCommandCenter;

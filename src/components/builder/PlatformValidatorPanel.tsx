/**
 * Platform Validator Panel Component
 *
 * Pre-deployment validation UI that shows platform-specific issues
 * and recommendations before deployment.
 *
 * F047: Pre-Deployment Validation Frontend
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldIcon,
  WarningIcon,
  AlertCircleIcon,
  InfoIcon,
  CheckCircleIcon,
  RefreshIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ZapIcon,
  CodeIcon,
  SettingsIcon,
  ServerIcon,
  LockIcon,
  ActivityIcon,
  GlobeIcon,
  DatabaseIcon,
  CheckIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

type DeploymentPlatform =
  | 'vercel'
  | 'netlify'
  | 'cloudflare'
  | 'aws_amplify'
  | 'railway'
  | 'render'
  | 'fly_io'
  | 'heroku'
  | 'app_store'
  | 'play_store'
  | 'docker'
  | 'kubernetes';

type ValidationSeverity = 'error' | 'warning' | 'info';

type ConstraintCategory =
  | 'file_system'
  | 'runtime'
  | 'dependencies'
  | 'environment'
  | 'build'
  | 'security'
  | 'performance'
  | 'networking'
  | 'storage'
  | 'compliance';

interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ConstraintCategory;
  platform: DeploymentPlatform;
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
  autoFixAvailable: boolean;
  documentationUrl?: string;
}

interface ValidationReport {
  id: string;
  projectId: string;
  platform: DeploymentPlatform;
  timestamp: Date;
  duration: number;
  status: 'passed' | 'failed' | 'warnings';
  summary: {
    errors: number;
    warnings: number;
    info: number;
    passed: number;
  };
  issues: ValidationIssue[];
  recommendations: string[];
}

// =============================================================================
// PLATFORM CONFIGS
// =============================================================================

const PLATFORM_CONFIGS: Record<DeploymentPlatform, {
  name: string;
  icon: string;
  color: string;
  description: string;
}> = {
  vercel: {
    name: 'Vercel',
    icon: '▲',
    color: 'bg-white text-black',
    description: 'Edge-optimized serverless platform'
  },
  netlify: {
    name: 'Netlify',
    icon: '◈',
    color: 'bg-[#00C7B7] text-white',
    description: 'JAMstack platform with edge functions'
  },
  cloudflare: {
    name: 'Cloudflare',
    icon: '☁️',
    color: 'bg-[#F38020] text-white',
    description: 'Edge workers and Pages'
  },
  aws_amplify: {
    name: 'AWS Amplify',
    icon: '🔶',
    color: 'bg-[#FF9900] text-black',
    description: 'Full-stack serverless platform'
  },
  railway: {
    name: 'Railway',
    icon: '🚂',
    color: 'bg-[#0B0D0E] text-white',
    description: 'Simple deployment platform'
  },
  render: {
    name: 'Render',
    icon: '◉',
    color: 'bg-[#46E3B7] text-black',
    description: 'Unified cloud platform'
  },
  fly_io: {
    name: 'Fly.io',
    icon: '🪰',
    color: 'bg-[#7B3FE4] text-white',
    description: 'Run apps close to users'
  },
  heroku: {
    name: 'Heroku',
    icon: '🟣',
    color: 'bg-[#430098] text-white',
    description: 'Platform as a Service'
  },
  app_store: {
    name: 'App Store',
    icon: '🍎',
    color: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    description: 'iOS & macOS applications'
  },
  play_store: {
    name: 'Play Store',
    icon: '🤖',
    color: 'bg-[#34A853] text-white',
    description: 'Android applications'
  },
  docker: {
    name: 'Docker',
    icon: '🐳',
    color: 'bg-[#2496ED] text-white',
    description: 'Containerized deployment'
  },
  kubernetes: {
    name: 'Kubernetes',
    icon: '☸️',
    color: 'bg-[#326CE5] text-white',
    description: 'Container orchestration'
  }
};

const CATEGORY_ICONS: Record<ConstraintCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  file_system: CodeIcon,
  runtime: ServerIcon,
  dependencies: DatabaseIcon,
  environment: SettingsIcon,
  build: ZapIcon,
  security: LockIcon,
  performance: ActivityIcon,
  networking: GlobeIcon,
  storage: DatabaseIcon,
  compliance: CheckIcon
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const SeverityIcon: React.FC<{ severity: ValidationSeverity; className?: string }> = ({
  severity,
  className
}) => {
  const props = { size: 16, className };

  switch (severity) {
    case 'error':
      return <AlertCircleIcon {...props} className={cn(props.className, 'text-red-400')} />;
    case 'warning':
      return <WarningIcon {...props} className={cn(props.className, 'text-amber-400')} />;
    case 'info':
      return <InfoIcon {...props} className={cn(props.className, 'text-blue-400')} />;
  }
};

const IssueCard: React.FC<{
  issue: ValidationIssue;
  onAutoFix?: () => void;
}> = ({ issue, onAutoFix }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[issue.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        issue.severity === 'error' && 'border-red-500/30 bg-red-500/5',
        issue.severity === 'warning' && 'border-amber-500/30 bg-amber-500/5',
        issue.severity === 'info' && 'border-blue-500/30 bg-blue-500/5'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <SeverityIcon severity={issue.severity} className="flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">{issue.title}</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
              issue.severity === 'error' && 'bg-red-500/20 text-red-400',
              issue.severity === 'warning' && 'bg-amber-500/20 text-amber-400',
              issue.severity === 'info' && 'bg-blue-500/20 text-blue-400'
            )}>
              {issue.severity}
            </span>
          </div>
          {issue.file && (
            <p className="text-xs text-slate-400 font-mono truncate">{issue.file}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {issue.autoFixAvailable && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full">
              Auto-fix
            </span>
          )}
          {isExpanded ? (
            <ChevronDownIcon size={16} className="text-slate-500" />
          ) : (
            <ChevronRightIcon size={16} className="text-slate-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/30"
          >
            <div className="p-3 space-y-3">
              <p className="text-sm text-slate-300">{issue.description}</p>

              {issue.suggestion && (
                <div className="p-2 bg-slate-800/50 rounded">
                  <p className="text-xs text-slate-400 mb-1">💡 Suggestion:</p>
                  <p className="text-sm text-emerald-400">{issue.suggestion}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded text-xs text-slate-400">
                  <CategoryIcon size={12} />
                  {issue.category.replace('_', ' ')}
                </span>

                {issue.documentationUrl && (
                  <a
                    href={issue.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <ArrowRightIcon size={12} />
                    Docs
                  </a>
                )}

                {issue.autoFixAvailable && onAutoFix && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAutoFix();
                    }}
                    className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs hover:bg-emerald-500/30 transition-colors"
                  >
                    ⚡ Auto-fix
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PlatformSelector: React.FC<{
  selected: DeploymentPlatform;
  onSelect: (platform: DeploymentPlatform) => void;
}> = ({ selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const platforms = Object.entries(PLATFORM_CONFIGS);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
      >
        <span className={cn(
          'w-6 h-6 rounded flex items-center justify-center text-xs',
          PLATFORM_CONFIGS[selected].color
        )}>
          {PLATFORM_CONFIGS[selected].icon}
        </span>
        <span className="text-sm text-white">{PLATFORM_CONFIGS[selected].name}</span>
        <ChevronDownIcon size={16} className={cn(
          'text-slate-500 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            <div className="max-h-80 overflow-y-auto">
              {platforms.map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => {
                    onSelect(key as DeploymentPlatform);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 transition-colors',
                    selected === key && 'bg-slate-700/30'
                  )}
                >
                  <span className={cn(
                    'w-8 h-8 rounded flex items-center justify-center text-sm',
                    config.color
                  )}>
                    {config.icon}
                  </span>
                  <div className="text-left">
                    <p className="text-sm text-white">{config.name}</p>
                    <p className="text-xs text-slate-500">{config.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface PlatformValidatorPanelProps {
  projectId: string;
  className?: string;
  onValidationComplete?: (report: ValidationReport) => void;
}

export const PlatformValidatorPanel: React.FC<PlatformValidatorPanelProps> = ({
  projectId,
  className,
  onValidationComplete
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<DeploymentPlatform>('vercel');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const runValidation = useCallback(async () => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/validation/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          platform: selectedPlatform
        })
      });

      const data = await response.json();

      if (data.success) {
        setReport(data.report);
        onValidationComplete?.(data.report);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to run validation');
    } finally {
      setIsValidating(false);
    }
  }, [projectId, selectedPlatform, onValidationComplete]);

  // Group issues by category
  const issuesByCategory = report?.issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>) || {};

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldIcon size={20} className="text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Pre-Deploy Validation</h3>
        </div>

        <PlatformSelector
          selected={selectedPlatform}
          onSelect={setSelectedPlatform}
        />
      </div>

      {/* Run Validation Button */}
      <button
        onClick={runValidation}
        disabled={isValidating}
        className={cn(
          'w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all',
          isValidating
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400'
        )}
      >
        {isValidating ? (
          <>
            <RefreshIcon size={16} className="animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <ShieldIcon size={16} />
            Validate for {PLATFORM_CONFIGS[selectedPlatform].name}
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-4"
        >
          {/* Status Banner */}
          <div className={cn(
            'p-4 rounded-lg border',
            report.status === 'passed' && 'bg-emerald-500/10 border-emerald-500/30',
            report.status === 'warnings' && 'bg-amber-500/10 border-amber-500/30',
            report.status === 'failed' && 'bg-red-500/10 border-red-500/30'
          )}>
            <div className="flex items-center gap-3">
              {report.status === 'passed' && (
                <CheckCircleIcon size={24} className="text-emerald-400" />
              )}
              {report.status === 'warnings' && (
                <WarningIcon size={24} className="text-amber-400" />
              )}
              {report.status === 'failed' && (
                <AlertCircleIcon size={24} className="text-red-400" />
              )}

              <div>
                <p className={cn(
                  'font-medium',
                  report.status === 'passed' && 'text-emerald-400',
                  report.status === 'warnings' && 'text-amber-400',
                  report.status === 'failed' && 'text-red-400'
                )}>
                  {report.status === 'passed' && 'Ready to Deploy!'}
                  {report.status === 'warnings' && 'Can Deploy (With Warnings)'}
                  {report.status === 'failed' && 'Fix Issues Before Deploying'}
                </p>
                <p className="text-xs text-slate-400">
                  Validated in {report.duration}ms
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-400">{report.summary.errors}</p>
              <p className="text-xs text-slate-400">Errors</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">{report.summary.warnings}</p>
              <p className="text-xs text-slate-400">Warnings</p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-400">{report.summary.info}</p>
              <p className="text-xs text-slate-400">Info</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-400">{report.summary.passed}</p>
              <p className="text-xs text-slate-400">Passed</p>
            </div>
          </div>

          {/* Issues by Category */}
          {Object.entries(issuesByCategory).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Issues</h4>

              {Object.entries(issuesByCategory).map(([category, issues]) => {
                const CategoryIcon = CATEGORY_ICONS[category as ConstraintCategory];
                const isExpanded = expandedCategories.has(category);
                const errorCount = issues.filter(i => i.severity === 'error').length;
                const warningCount = issues.filter(i => i.severity === 'warning').length;

                return (
                  <div key={category} className="rounded-lg border border-slate-700/50 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                    >
                      <CategoryIcon size={16} className="text-slate-400" />
                      <span className="text-sm text-white capitalize flex-1 text-left">
                        {category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        {errorCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                            {errorCount}
                          </span>
                        )}
                        {warningCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                            {warningCount}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDownIcon size={16} className="text-slate-500" />
                        ) : (
                          <ChevronRightIcon size={16} className="text-slate-500" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="p-2 space-y-2"
                        >
                          {issues.map(issue => (
                            <IssueCard key={issue.id} issue={issue} />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <h4 className="text-sm font-medium text-cyan-400 mb-2">💡 Recommendations</h4>
              <ul className="space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default PlatformValidatorPanel;


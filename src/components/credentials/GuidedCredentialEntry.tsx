/**
 * Guided Credential Entry Component
 *
 * For providers that don't support OAuth (Google Auth, Firebase custom, etc.),
 * this component provides step-by-step instructions with pre-filled values.
 *
 * Features:
 * - Step-by-step guide for each platform
 * - Pre-filled callback URLs and JavaScript origins
 * - Copy-to-clipboard functionality
 * - Opens platform console in new tab
 * - Premium glass styling
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// GUIDED SETUP CONFIGURATIONS
// =============================================================================

interface SetupStep {
  title: string;
  description: string;
  action?: 'copy' | 'link' | 'input';
  value?: string;
  inputName?: string; // For input steps, the env variable name
  inputPlaceholder?: string;
  linkUrl?: string;
  linkText?: string;
}

interface PlatformGuide {
  platformName: string;
  platformUrl: string;
  consoleName: string;
  consoleUrl: string;
  iconColor: string;
  steps: SetupStep[];
  envVars: string[]; // Environment variables this guide helps configure
}

// Generate URLs dynamically based on the current domain
function getCallbackUrl(path: string = '/api/auth/callback/google'): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `https://your-domain.com${path}`;
}

function getJavaScriptOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://your-domain.com';
}

// Platform-specific guides
export const PLATFORM_GUIDES: Record<string, PlatformGuide> = {
  'google': {
    platformName: 'Google OAuth',
    platformUrl: 'https://console.cloud.google.com',
    consoleName: 'Google Cloud Console',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    iconColor: '#4285F4',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    steps: [
      {
        title: 'Open Google Cloud Console',
        description: 'Click to open the Google Cloud Console in a new tab. Create a new project or select an existing one.',
        action: 'link',
        linkUrl: 'https://console.cloud.google.com/apis/credentials',
        linkText: 'Open Google Cloud Console',
      },
      {
        title: 'Create OAuth 2.0 Client ID',
        description: 'Click "Create Credentials" → "OAuth client ID" → Select "Web application"',
      },
      {
        title: 'Add Authorized JavaScript Origin',
        description: 'Copy this URL and add it to "Authorized JavaScript origins"',
        action: 'copy',
        value: getJavaScriptOrigin(),
      },
      {
        title: 'Add Authorized Redirect URI',
        description: 'Copy this URL and add it to "Authorized redirect URIs"',
        action: 'copy',
        value: getCallbackUrl('/api/auth/callback/google'),
      },
      {
        title: 'Enter Client ID',
        description: 'Paste your Google OAuth Client ID here',
        action: 'input',
        inputName: 'GOOGLE_CLIENT_ID',
        inputPlaceholder: 'your-client-id.apps.googleusercontent.com',
      },
      {
        title: 'Enter Client Secret',
        description: 'Paste your Google OAuth Client Secret here',
        action: 'input',
        inputName: 'GOOGLE_CLIENT_SECRET',
        inputPlaceholder: 'GOCSPX-...',
      },
    ],
  },
  'firebase': {
    platformName: 'Firebase',
    platformUrl: 'https://console.firebase.google.com',
    consoleName: 'Firebase Console',
    consoleUrl: 'https://console.firebase.google.com',
    iconColor: '#FFCA28',
    envVars: ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'],
    steps: [
      {
        title: 'Open Firebase Console',
        description: 'Click to open the Firebase Console. Create a new project or select existing.',
        action: 'link',
        linkUrl: 'https://console.firebase.google.com',
        linkText: 'Open Firebase Console',
      },
      {
        title: 'Add Web App',
        description: 'Go to Project Settings → General → Your apps → Add Web App',
      },
      {
        title: 'Copy Configuration',
        description: 'Firebase will show you a configuration object. Copy the values below.',
      },
      {
        title: 'Enter API Key',
        description: 'Paste your Firebase API Key',
        action: 'input',
        inputName: 'FIREBASE_API_KEY',
        inputPlaceholder: 'AIza...',
      },
      {
        title: 'Enter Auth Domain',
        description: 'Paste your Firebase Auth Domain',
        action: 'input',
        inputName: 'FIREBASE_AUTH_DOMAIN',
        inputPlaceholder: 'your-project.firebaseapp.com',
      },
      {
        title: 'Enter Project ID',
        description: 'Paste your Firebase Project ID',
        action: 'input',
        inputName: 'FIREBASE_PROJECT_ID',
        inputPlaceholder: 'your-project-id',
      },
    ],
  },
  'huggingface': {
    platformName: 'HuggingFace',
    platformUrl: 'https://huggingface.co',
    consoleName: 'HuggingFace Settings',
    consoleUrl: 'https://huggingface.co/settings/tokens',
    iconColor: '#FFD21E',
    envVars: ['HUGGINGFACE_TOKEN'],
    steps: [
      {
        title: 'Open HuggingFace Token Settings',
        description: 'Click to open HuggingFace token settings page.',
        action: 'link',
        linkUrl: 'https://huggingface.co/settings/tokens',
        linkText: 'Open HuggingFace Tokens',
      },
      {
        title: 'Create Access Token',
        description: 'Click "New token" and select "Write" permissions if you need to access private models.',
      },
      {
        title: 'Enter Access Token',
        description: 'Paste your HuggingFace access token here',
        action: 'input',
        inputName: 'HUGGINGFACE_TOKEN',
        inputPlaceholder: 'hf_...',
      },
    ],
  },
  'openai': {
    platformName: 'OpenAI',
    platformUrl: 'https://platform.openai.com',
    consoleName: 'OpenAI Dashboard',
    consoleUrl: 'https://platform.openai.com/api-keys',
    iconColor: '#10A37F',
    envVars: ['OPENAI_API_KEY'],
    steps: [
      {
        title: 'Open OpenAI API Keys',
        description: 'Click to open the OpenAI API keys page.',
        action: 'link',
        linkUrl: 'https://platform.openai.com/api-keys',
        linkText: 'Open OpenAI API Keys',
      },
      {
        title: 'Create API Key',
        description: 'Click "Create new secret key" and give it a name.',
      },
      {
        title: 'Enter API Key',
        description: 'Paste your OpenAI API key here',
        action: 'input',
        inputName: 'OPENAI_API_KEY',
        inputPlaceholder: 'sk-...',
      },
    ],
  },
  'anthropic': {
    platformName: 'Anthropic',
    platformUrl: 'https://console.anthropic.com',
    consoleName: 'Anthropic Console',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    iconColor: '#D97757',
    envVars: ['ANTHROPIC_API_KEY'],
    steps: [
      {
        title: 'Open Anthropic Console',
        description: 'Click to open the Anthropic API keys page.',
        action: 'link',
        linkUrl: 'https://console.anthropic.com/settings/keys',
        linkText: 'Open Anthropic Console',
      },
      {
        title: 'Create API Key',
        description: 'Click "Create Key" and copy the key shown.',
      },
      {
        title: 'Enter API Key',
        description: 'Paste your Anthropic API key here',
        action: 'input',
        inputName: 'ANTHROPIC_API_KEY',
        inputPlaceholder: 'sk-ant-...',
      },
    ],
  },
  'resend': {
    platformName: 'Resend',
    platformUrl: 'https://resend.com',
    consoleName: 'Resend Dashboard',
    consoleUrl: 'https://resend.com/api-keys',
    iconColor: '#000000',
    envVars: ['RESEND_API_KEY'],
    steps: [
      {
        title: 'Open Resend Dashboard',
        description: 'Click to open the Resend API keys page.',
        action: 'link',
        linkUrl: 'https://resend.com/api-keys',
        linkText: 'Open Resend Dashboard',
      },
      {
        title: 'Create API Key',
        description: 'Click "Create API Key" and select appropriate permissions.',
      },
      {
        title: 'Enter API Key',
        description: 'Paste your Resend API key here',
        action: 'input',
        inputName: 'RESEND_API_KEY',
        inputPlaceholder: 're_...',
      },
    ],
  },
  'twilio': {
    platformName: 'Twilio',
    platformUrl: 'https://twilio.com',
    consoleName: 'Twilio Console',
    consoleUrl: 'https://console.twilio.com',
    iconColor: '#F22F46',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    steps: [
      {
        title: 'Open Twilio Console',
        description: 'Click to open the Twilio Console.',
        action: 'link',
        linkUrl: 'https://console.twilio.com',
        linkText: 'Open Twilio Console',
      },
      {
        title: 'Find Account SID',
        description: 'Your Account SID is shown on the main dashboard.',
      },
      {
        title: 'Enter Account SID',
        description: 'Paste your Twilio Account SID here',
        action: 'input',
        inputName: 'TWILIO_ACCOUNT_SID',
        inputPlaceholder: 'AC...',
      },
      {
        title: 'Enter Auth Token',
        description: 'Paste your Twilio Auth Token here',
        action: 'input',
        inputName: 'TWILIO_AUTH_TOKEN',
        inputPlaceholder: 'Your auth token',
      },
      {
        title: 'Enter Phone Number',
        description: 'Paste your Twilio phone number (with country code)',
        action: 'input',
        inputName: 'TWILIO_PHONE_NUMBER',
        inputPlaceholder: '+1234567890',
      },
    ],
  },
  'cloudflare': {
    platformName: 'Cloudflare R2',
    platformUrl: 'https://dash.cloudflare.com',
    consoleName: 'Cloudflare Dashboard',
    consoleUrl: 'https://dash.cloudflare.com',
    iconColor: '#F38020',
    envVars: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
    steps: [
      {
        title: 'Open Cloudflare Dashboard',
        description: 'Click to open Cloudflare Dashboard → R2 Object Storage.',
        action: 'link',
        linkUrl: 'https://dash.cloudflare.com/?to=/:account/r2/overview',
        linkText: 'Open Cloudflare R2',
      },
      {
        title: 'Create R2 Bucket',
        description: 'Click "Create bucket" and note the bucket name.',
      },
      {
        title: 'Create API Token',
        description: 'Go to R2 → Manage R2 API Tokens → Create API token.',
      },
      {
        title: 'Enter Account ID',
        description: 'Find Account ID in the URL or dashboard sidebar',
        action: 'input',
        inputName: 'R2_ACCOUNT_ID',
        inputPlaceholder: 'Your account ID',
      },
      {
        title: 'Enter Access Key ID',
        description: 'Paste your R2 Access Key ID',
        action: 'input',
        inputName: 'R2_ACCESS_KEY_ID',
        inputPlaceholder: 'Access key ID',
      },
      {
        title: 'Enter Secret Access Key',
        description: 'Paste your R2 Secret Access Key',
        action: 'input',
        inputName: 'R2_SECRET_ACCESS_KEY',
        inputPlaceholder: 'Secret access key',
      },
      {
        title: 'Enter Bucket Name',
        description: 'Enter the name of your R2 bucket',
        action: 'input',
        inputName: 'R2_BUCKET_NAME',
        inputPlaceholder: 'my-bucket',
      },
    ],
  },
  'turso': {
    platformName: 'Turso',
    platformUrl: 'https://turso.tech',
    consoleName: 'Turso Dashboard',
    consoleUrl: 'https://turso.tech/app',
    iconColor: '#4FF8D2',
    envVars: ['DATABASE_URL', 'DATABASE_AUTH_TOKEN'],
    steps: [
      {
        title: 'Open Turso Dashboard',
        description: 'Click to open the Turso dashboard.',
        action: 'link',
        linkUrl: 'https://turso.tech/app',
        linkText: 'Open Turso Dashboard',
      },
      {
        title: 'Create Database',
        description: 'Click "Create Database" and choose a location near your users.',
      },
      {
        title: 'Get Connection URL',
        description: 'Click on your database → Settings → Copy the libsql URL.',
      },
      {
        title: 'Enter Database URL',
        description: 'Paste your Turso database URL',
        action: 'input',
        inputName: 'DATABASE_URL',
        inputPlaceholder: 'libsql://your-db.turso.io',
      },
      {
        title: 'Enter Auth Token',
        description: 'Create a token: turso db tokens create [db-name]',
        action: 'input',
        inputName: 'DATABASE_AUTH_TOKEN',
        inputPlaceholder: 'Your auth token',
      },
    ],
  },
  'planetscale': {
    platformName: 'PlanetScale',
    platformUrl: 'https://planetscale.com',
    consoleName: 'PlanetScale Dashboard',
    consoleUrl: 'https://app.planetscale.com',
    iconColor: '#000000',
    envVars: ['DATABASE_URL'],
    steps: [
      {
        title: 'Open PlanetScale Dashboard',
        description: 'Click to open PlanetScale.',
        action: 'link',
        linkUrl: 'https://app.planetscale.com',
        linkText: 'Open PlanetScale',
      },
      {
        title: 'Create Database',
        description: 'Click "New database" and configure your database.',
      },
      {
        title: 'Get Connection String',
        description: 'Go to Connect → Create password → Copy the connection string.',
      },
      {
        title: 'Enter Database URL',
        description: 'Paste your PlanetScale connection string',
        action: 'input',
        inputName: 'DATABASE_URL',
        inputPlaceholder: 'mysql://user:pass@host/db?ssl=...',
      },
    ],
  },
  'neon': {
    platformName: 'Neon',
    platformUrl: 'https://neon.tech',
    consoleName: 'Neon Console',
    consoleUrl: 'https://console.neon.tech',
    iconColor: '#00E699',
    envVars: ['DATABASE_URL'],
    steps: [
      {
        title: 'Open Neon Console',
        description: 'Click to open Neon Console.',
        action: 'link',
        linkUrl: 'https://console.neon.tech',
        linkText: 'Open Neon Console',
      },
      {
        title: 'Create Project',
        description: 'Click "New Project" and select your region.',
      },
      {
        title: 'Copy Connection String',
        description: 'Click "Connection string" and copy the PostgreSQL URL.',
      },
      {
        title: 'Enter Database URL',
        description: 'Paste your Neon connection string',
        action: 'input',
        inputName: 'DATABASE_URL',
        inputPlaceholder: 'postgresql://user:pass@host/db?sslmode=require',
      },
    ],
  },
  'better-auth': {
    platformName: 'Better Auth',
    platformUrl: 'https://better-auth.com',
    consoleName: 'Better Auth Docs',
    consoleUrl: 'https://better-auth.com/docs',
    iconColor: '#6366F1',
    envVars: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
    steps: [
      {
        title: 'Generate Secret',
        description: 'Better Auth needs a secret key. Run this command to generate one:',
        action: 'copy',
        value: 'openssl rand -base64 32',
      },
      {
        title: 'Enter Auth Secret',
        description: 'Paste your generated secret (or create your own 32+ char string)',
        action: 'input',
        inputName: 'BETTER_AUTH_SECRET',
        inputPlaceholder: 'your-secret-key-32-chars-minimum',
      },
      {
        title: 'Enter Auth URL',
        description: 'Your app\'s base URL where Better Auth is hosted',
        action: 'input',
        inputName: 'BETTER_AUTH_URL',
        inputPlaceholder: getJavaScriptOrigin(),
      },
    ],
  },
};

// =============================================================================
// ICONS
// =============================================================================

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface GuidedCredentialEntryProps {
  platformName: string;
  requiredEnvVars: string[];
  onCredentialsSubmit: (credentials: Record<string, string>) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GuidedCredentialEntry({
  platformName,
  requiredEnvVars,
  onCredentialsSubmit,
}: GuidedCredentialEntryProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copiedSteps, setCopiedSteps] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  // Get the guide for this platform
  const guide = useMemo(() => {
    const normalized = platformName.toLowerCase().trim().replace(/\s+/g, '-');
    return PLATFORM_GUIDES[normalized] || PLATFORM_GUIDES[platformName.toLowerCase()];
  }, [platformName]);

  // Filter steps to only include inputs for required env vars
  const relevantSteps = useMemo(() => {
    if (!guide) return [];

    return guide.steps.filter(step => {
      // Include non-input steps
      if (step.action !== 'input') return true;
      // Include input steps that match required env vars
      return step.inputName && requiredEnvVars.includes(step.inputName);
    });
  }, [guide, requiredEnvVars]);

  // Check if all required inputs are filled
  const isComplete = useMemo(() => {
    return requiredEnvVars.every(envVar => (values[envVar] || '').trim().length > 0);
  }, [requiredEnvVars, values]);

  const handleCopy = useCallback(async (text: string, stepIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSteps(prev => new Set([...prev, stepIndex]));
      setTimeout(() => {
        setCopiedSteps(prev => {
          const next = new Set(prev);
          next.delete(stepIndex);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const handleInputChange = useCallback((envVar: string, value: string) => {
    setValues(prev => ({ ...prev, [envVar]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (isComplete) {
      onCredentialsSubmit(values);
    }
  }, [isComplete, values, onCredentialsSubmit]);

  // If no guide found, show generic input form
  if (!guide) {
    return (
      <div className="guided-entry guided-entry--generic">
        <div className="guided-entry__header">
          <h4 className="guided-entry__title">Configure {platformName}</h4>
          <p className="guided-entry__subtitle">Enter the required credentials</p>
        </div>

        <div className="guided-entry__inputs">
          {requiredEnvVars.map(envVar => (
            <div key={envVar} className="guided-entry__input-group">
              <label className="guided-entry__label">{envVar}</label>
              <input
                type="password"
                className="guided-entry__input"
                placeholder={`Enter ${envVar}`}
                value={values[envVar] || ''}
                onChange={(e) => handleInputChange(envVar, e.target.value)}
              />
            </div>
          ))}
        </div>

        <button
          className="guided-entry__submit"
          disabled={!isComplete}
          onClick={handleSubmit}
        >
          Save Credentials
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="guided-entry"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        className="guided-entry__header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="guided-entry__header-left">
          <div
            className="guided-entry__icon"
            style={{ background: `${guide.iconColor}20`, borderColor: `${guide.iconColor}40` }}
          >
            <span style={{ color: guide.iconColor }}>
              {guide.platformName.charAt(0)}
            </span>
          </div>
          <div>
            <h4 className="guided-entry__title">{guide.platformName}</h4>
            <p className="guided-entry__subtitle">
              {isComplete ? 'Ready to save' : `${relevantSteps.length} steps to configure`}
            </p>
          </div>
        </div>
        <div className="guided-entry__header-right">
          {isComplete && (
            <span className="guided-entry__complete-badge">
              <CheckIcon />
              Complete
            </span>
          )}
          <ChevronIcon expanded={isExpanded} />
        </div>
      </motion.div>

      {/* Steps */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="guided-entry__steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {relevantSteps.map((step, index) => (
              <motion.div
                key={index}
                className={`guided-entry__step ${index <= currentStep ? 'guided-entry__step--active' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="guided-entry__step-number">
                  {index < currentStep || (step.action === 'input' && values[step.inputName || '']) ? (
                    <CheckIcon />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="guided-entry__step-content">
                  <h5 className="guided-entry__step-title">{step.title}</h5>
                  <p className="guided-entry__step-desc">{step.description}</p>

                  {/* Copy action */}
                  {step.action === 'copy' && step.value && (
                    <div className="guided-entry__copy-block">
                      <code className="guided-entry__code">{step.value}</code>
                      <button
                        className="guided-entry__copy-btn"
                        onClick={() => handleCopy(step.value!, index)}
                      >
                        {copiedSteps.has(index) ? <CheckIcon /> : <CopyIcon />}
                        {copiedSteps.has(index) ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {/* Link action */}
                  {step.action === 'link' && step.linkUrl && (
                    <a
                      href={step.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guided-entry__link-btn"
                      onClick={() => setCurrentStep(Math.max(currentStep, index + 1))}
                    >
                      <ExternalLinkIcon />
                      {step.linkText || 'Open Console'}
                    </a>
                  )}

                  {/* Input action */}
                  {step.action === 'input' && step.inputName && (
                    <input
                      type={step.inputName.includes('SECRET') || step.inputName.includes('TOKEN') || step.inputName.includes('KEY') ? 'password' : 'text'}
                      className="guided-entry__input"
                      placeholder={step.inputPlaceholder}
                      value={values[step.inputName] || ''}
                      onChange={(e) => {
                        handleInputChange(step.inputName!, e.target.value);
                        if (e.target.value) {
                          setCurrentStep(Math.max(currentStep, index + 1));
                        }
                      }}
                    />
                  )}
                </div>
              </motion.div>
            ))}

            {/* Submit button */}
            <motion.button
              className={`guided-entry__submit ${isComplete ? 'guided-entry__submit--ready' : ''}`}
              disabled={!isComplete}
              onClick={handleSubmit}
              whileHover={isComplete ? { scale: 1.02 } : {}}
              whileTap={isComplete ? { scale: 0.98 } : {}}
            >
              {isComplete ? 'Save & Continue' : 'Complete all steps to continue'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Check if a platform has a guided setup available
 */
export function hasGuidedSetup(platformName: string): boolean {
  const normalized = platformName.toLowerCase().trim().replace(/\s+/g, '-');
  return PLATFORM_GUIDES[normalized] !== undefined || PLATFORM_GUIDES[platformName.toLowerCase()] !== undefined;
}

/**
 * Get the platform guide for a given platform name
 */
export function getPlatformGuide(platformName: string): PlatformGuide | undefined {
  const normalized = platformName.toLowerCase().trim().replace(/\s+/g, '-');
  return PLATFORM_GUIDES[normalized] || PLATFORM_GUIDES[platformName.toLowerCase()];
}

/**
 * CredentialTiles
 * 
 * Components for collecting required credentials/env variables for a project.
 * Each tile represents a service (Stripe, OpenAI, Supabase, etc.) and shows
 * input fields for the required keys.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  HelpCircleIcon,
} from '../ui/icons';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api-client';

// Service configurations with their required env variables
export const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI text generation and embeddings',
    platformUrl: 'https://platform.openai.com/api-keys',
    icon: '🤖',
    requiredKeys: [
      { name: 'OPENAI_API_KEY', label: 'API Key', placeholder: 'sk-...', sensitive: true },
    ],
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing',
    platformUrl: 'https://dashboard.stripe.com/apikeys',
    icon: '💳',
    requiredKeys: [
      { name: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_live_...', sensitive: true },
      { name: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_live_...', sensitive: false },
      { name: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', sensitive: true },
    ],
  },
  supabase: {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database and authentication',
    platformUrl: 'https://app.supabase.com/project/_/settings/api',
    icon: '⚡',
    requiredKeys: [
      { name: 'SUPABASE_URL', label: 'Project URL', placeholder: 'https://xxx.supabase.co', sensitive: false },
      { name: 'SUPABASE_ANON_KEY', label: 'Anon Key', placeholder: 'eyJ...', sensitive: true },
      { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', placeholder: 'eyJ...', sensitive: true },
    ],
  },
  resend: {
    id: 'resend',
    name: 'Resend',
    description: 'Email delivery',
    platformUrl: 'https://resend.com/api-keys',
    icon: '📧',
    requiredKeys: [
      { name: 'RESEND_API_KEY', label: 'API Key', placeholder: 're_...', sensitive: true },
    ],
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS and voice',
    platformUrl: 'https://console.twilio.com/us1/account/keys-credentials/api-keys',
    icon: '📱',
    requiredKeys: [
      { name: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'AC...', sensitive: false },
      { name: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', placeholder: '', sensitive: true },
      { name: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', placeholder: '+1...', sensitive: false },
    ],
  },
  clerk: {
    id: 'clerk',
    name: 'Clerk',
    description: 'User authentication',
    platformUrl: 'https://dashboard.clerk.com/apps',
    icon: '🔐',
    requiredKeys: [
      { name: 'CLERK_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_live_...', sensitive: true },
      { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_live_...', sensitive: false },
    ],
  },
  vercel: {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deployment and hosting',
    platformUrl: 'https://vercel.com/account/tokens',
    icon: '▲',
    requiredKeys: [
      { name: 'VERCEL_TOKEN', label: 'API Token', placeholder: '', sensitive: true },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models',
    platformUrl: 'https://console.anthropic.com/settings/keys',
    icon: '🧠',
    requiredKeys: [
      { name: 'ANTHROPIC_API_KEY', label: 'API Key', placeholder: 'sk-ant-...', sensitive: true },
    ],
  },
  google: {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini AI models',
    platformUrl: 'https://aistudio.google.com/app/apikey',
    icon: '🔷',
    requiredKeys: [
      { name: 'GOOGLE_AI_API_KEY', label: 'API Key', placeholder: 'AIza...', sensitive: true },
    ],
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    description: 'ML model hosting',
    platformUrl: 'https://replicate.com/account/api-tokens',
    icon: '🔄',
    requiredKeys: [
      { name: 'REPLICATE_API_TOKEN', label: 'API Token', placeholder: 'r8_...', sensitive: true },
    ],
  },
  runpod: {
    id: 'runpod',
    name: 'RunPod',
    description: 'GPU compute',
    platformUrl: 'https://www.runpod.io/console/user/settings',
    icon: '🚀',
    requiredKeys: [
      { name: 'RUNPOD_API_KEY', label: 'API Key', placeholder: 'rpa_...', sensitive: true },
    ],
  },
};

interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  platformUrl: string;
  icon: string;
  requiredKeys: Array<{
    name: string;
    label: string;
    placeholder: string;
    sensitive: boolean;
  }>;
}

interface CredentialTileProps {
  service: ServiceConfig;
  projectId: string;
  initialValues?: Record<string, string>;
  onSaved?: (serviceName: string, credentials: Record<string, string>) => void;
}

export function CredentialTile({
  service,
  projectId,
  initialValues = {},
  onSaved,
}: CredentialTileProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    // Validate all required fields have values
    const missingFields = service.requiredKeys.filter(key => !values[key.name]);
    if (missingFields.length > 0) {
      toast({
        title: 'Missing required fields',
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      await apiClient.post(`/api/fix-my-app/${projectId}/credentials`, {
        service: service.id,
        credentials: values,
      });

      setIsSaved(true);
      toast({
        title: 'Credentials saved',
        description: `${service.name} credentials have been securely stored.`,
      });

      onSaved?.(service.id, values);
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toast({
        title: 'Failed to save',
        description: 'There was an error saving credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowValue = (keyName: string) => {
    setShowValues(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-6 rounded-2xl border transition-all ${
        isSaved
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {/* Saved badge */}
      {isSaved && (
        <div className="absolute top-4 right-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium"
          >
            <CheckCircle2Icon size={14} />
            Saved
          </motion.div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">
          {service.icon}
        </div>
        <div>
          <h3 className="font-semibold text-white">{service.name}</h3>
          <p className="text-sm text-slate-400">{service.description}</p>
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-4 mb-5">
        {service.requiredKeys.map((key) => (
          <div key={key.name} className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <KeyIcon size={12} className="text-slate-500" />
              {key.label}
            </label>
            <div className="relative">
              <input
                type={key.sensitive && !showValues[key.name] ? 'password' : 'text'}
                value={values[key.name] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [key.name]: e.target.value }))}
                placeholder={key.placeholder}
                disabled={isSaved}
                className="w-full px-4 py-3 pr-20 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {key.sensitive && (
                  <button
                    type="button"
                    onClick={() => toggleShowValue(key.name)}
                    className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
                    title={showValues[key.name] ? 'Hide' : 'Show'}
                  >
                    {showValues[key.name] ? (
                      <EyeOffIcon size={14} className="text-slate-400" />
                    ) : (
                      <EyeIcon size={14} className="text-slate-400" />
                    )}
                  </button>
                )}
                {values[key.name] && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(values[key.name])}
                    className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
                    title="Copy"
                  >
                    <CopyIcon size={14} className="text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">{key.name}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => window.open(service.platformUrl, '_blank')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          Get Credentials
          <ExternalLinkIcon size={14} />
        </button>
        {!isSaved && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2Icon size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Credentials'
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

interface CredentialTileGridProps {
  services: string[];
  projectId: string;
  onAllSaved?: () => void;
}

export function CredentialTileGrid({
  services,
  projectId,
  onAllSaved,
}: CredentialTileGridProps) {
  const [savedServices, setSavedServices] = useState<Set<string>>(new Set());

  const handleServiceSaved = (serviceId: string) => {
    const newSaved = new Set(savedServices);
    newSaved.add(serviceId);
    setSavedServices(newSaved);

    // Check if all services are saved
    if (newSaved.size === services.length) {
      onAllSaved?.();
    }
  };

  const validServices = services
    .filter(s => SERVICE_CONFIGS[s])
    .map(s => SERVICE_CONFIGS[s]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Required Credentials</h2>
          <p className="text-sm text-slate-400 mt-1">
            Enter the API keys and secrets needed for your app to work
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <HelpCircleIcon size={16} />
          <span>{savedServices.size} of {services.length} configured</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(savedServices.size / services.length) * 100}%` }}
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {validServices.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <CredentialTile
                service={service}
                projectId={projectId}
                onSaved={() => handleServiceSaved(service.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Continue button */}
      {savedServices.size === services.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center pt-4"
        >
          <button
            onClick={onAllSaved}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow"
          >
            Continue Building
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default CredentialTile;

/**
 * CredentialAcquisitionModal
 * 
 * Premium 3D liquid glass modal for credential acquisition.
 * Handles both OAuth (via Nango) and manual credential entry flows.
 * 
 * Features:
 * - Dynamic credential fields per integration
 * - "Fetch Credentials" button opens provider dashboard
 * - OAuth "Connect" button for supported providers
 * - Real-time validation
 * - Red accent (#dc2626) per design spec
 * - No emojis, geometric icons only
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/glass/GlassPanel';
import { GlassButton } from '@/components/ui/glass/GlassButton';
import { GlassInput } from '@/components/ui/glass/GlassInput';
import { 
  LockGeometric, 
  KeyGeometric, 
  ExternalLinkGeometric,
  CheckGeometric,
  XGeometric,
  RefreshGeometric,
} from '@/components/ui/icons/GeometricIcons';
import { getBrandIcon } from '@/components/ui/icons';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

interface IntegrationConfig {
  id: string;
  name: string;
  category: string;
  supportsOAuth: boolean;
  nangoId?: string;
  platformUrl?: string;
  fields: CredentialField[];
  instructions?: string;
}

interface CredentialAcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: {
    id: string;
    name: string;
    category?: string;
    supportsOAuth?: boolean;
    platformUrl?: string;
    requiredCredentials?: string[];
  };
  projectId: string;
  buildId?: string;
  onSuccess?: (integrationId: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// CREDENTIAL FIELD CONFIGURATIONS
// ============================================================================

const INTEGRATION_CONFIGS: Record<string, Omit<IntegrationConfig, 'id'>> = {
  stripe: {
    name: 'Stripe',
    category: 'payments',
    supportsOAuth: false,
    platformUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', type: 'text', placeholder: 'pk_live_...', required: true },
      { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...', hint: 'Optional - will be generated automatically' },
    ],
    instructions: 'Get your API keys from the Stripe Dashboard. Use live keys for production.',
  },
  openai: {
    name: 'OpenAI',
    category: 'ai',
    supportsOAuth: false,
    platformUrl: 'https://platform.openai.com/api-keys',
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
    ],
    instructions: 'Create an API key from your OpenAI dashboard.',
  },
  anthropic: {
    name: 'Anthropic',
    category: 'ai',
    supportsOAuth: false,
    platformUrl: 'https://console.anthropic.com/settings/keys',
    fields: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true },
    ],
    instructions: 'Create an API key from the Anthropic Console.',
  },
  supabase: {
    name: 'Supabase',
    category: 'database',
    supportsOAuth: false,
    platformUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    fields: [
      { key: 'SUPABASE_URL', label: 'Project URL', type: 'url', placeholder: 'https://xxx.supabase.co', required: true },
      { key: 'SUPABASE_ANON_KEY', label: 'Anon Key', type: 'password', placeholder: 'eyJ...', required: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', type: 'password', placeholder: 'eyJ...', hint: 'For server-side operations' },
    ],
    instructions: 'Find these in your Supabase project settings under API.',
  },
  vercel: {
    name: 'Vercel',
    category: 'deployment',
    supportsOAuth: true,
    nangoId: 'vercel',
    platformUrl: 'https://vercel.com/account/tokens',
    fields: [
      { key: 'VERCEL_TOKEN', label: 'Access Token', type: 'password', placeholder: 'Token...', required: true },
    ],
  },
  runpod: {
    name: 'RunPod',
    category: 'compute',
    supportsOAuth: false,
    platformUrl: 'https://runpod.io/console/user/settings',
    fields: [
      { key: 'RUNPOD_API_KEY', label: 'API Key', type: 'password', required: true },
    ],
    instructions: 'Get your API key from RunPod Console > Settings.',
  },
  huggingface: {
    name: 'Hugging Face',
    category: 'ai',
    supportsOAuth: false,
    platformUrl: 'https://huggingface.co/settings/tokens',
    fields: [
      { key: 'HUGGINGFACE_TOKEN', label: 'Access Token', type: 'password', placeholder: 'hf_...', required: true, hint: 'Ensure token has write access for model uploads' },
    ],
  },
  resend: {
    name: 'Resend',
    category: 'email',
    supportsOAuth: false,
    platformUrl: 'https://resend.com/api-keys',
    fields: [
      { key: 'RESEND_API_KEY', label: 'API Key', type: 'password', placeholder: 're_...', required: true },
    ],
  },
  twilio: {
    name: 'Twilio',
    category: 'communication',
    supportsOAuth: false,
    platformUrl: 'https://console.twilio.com',
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', type: 'password', required: true },
      { key: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', type: 'text', placeholder: '+1...', hint: 'Your Twilio phone number' },
    ],
  },
  clerk: {
    name: 'Clerk',
    category: 'auth',
    supportsOAuth: false,
    platformUrl: 'https://dashboard.clerk.com',
    fields: [
      { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', type: 'text', placeholder: 'pk_...', required: true },
      { key: 'CLERK_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: 'sk_...', required: true },
    ],
  },
  turso: {
    name: 'Turso',
    category: 'database',
    supportsOAuth: false,
    platformUrl: 'https://turso.tech/app',
    fields: [
      { key: 'TURSO_DATABASE_URL', label: 'Database URL', type: 'url', placeholder: 'libsql://...', required: true },
      { key: 'TURSO_AUTH_TOKEN', label: 'Auth Token', type: 'password', required: true },
    ],
  },
  google_auth: {
    name: 'Google OAuth',
    category: 'auth',
    supportsOAuth: true,
    nangoId: 'google',
    platformUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', type: 'password', required: true },
    ],
    instructions: 'Create OAuth credentials in Google Cloud Console. Add authorized redirect URIs.',
  },
  github_auth: {
    name: 'GitHub OAuth',
    category: 'auth',
    supportsOAuth: true,
    nangoId: 'github',
    platformUrl: 'https://github.com/settings/developers',
    fields: [
      { key: 'GITHUB_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
      { key: 'GITHUB_CLIENT_SECRET', label: 'Client Secret', type: 'password', required: true },
    ],
    instructions: 'Create an OAuth App in GitHub Developer Settings.',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CredentialAcquisitionModal({
  isOpen,
  onClose,
  integration,
  projectId,
  buildId,
  onSuccess,
  onError,
}: CredentialAcquisitionModalProps) {
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

  // Get integration config
  const config = INTEGRATION_CONFIGS[integration.id] || {
    name: integration.name,
    category: integration.category || 'unknown',
    supportsOAuth: integration.supportsOAuth || false,
    platformUrl: integration.platformUrl,
    fields: (integration.requiredCredentials || []).map(key => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      type: 'password' as const,
      required: true,
    })),
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCredentialValues({});
      setError(null);
      setValidationStatus('idle');
      setOauthStatus('idle');
    }
  }, [isOpen]);

  const handleInputChange = useCallback((key: string, value: string) => {
    setCredentialValues(prev => ({ ...prev, [key]: value }));
    setValidationStatus('idle');
    setError(null);
  }, []);

  const handleFetchCredentials = useCallback(() => {
    if (config.platformUrl) {
      window.open(config.platformUrl, '_blank', 'noopener,noreferrer');
    }
  }, [config.platformUrl]);

  const handleOAuthConnect = useCallback(async () => {
    if (!config.supportsOAuth || !config.nangoId) return;

    setOauthStatus('connecting');
    setError(null);

    try {
      // Get OAuth URL from backend
      const { data } = await apiClient.post<{ authUrl: string }>('/api/integrations/nango/auth-url', {
        integrationId: config.nangoId,
        redirectUrl: window.location.href,
      });

      // Open OAuth popup
      const popup = window.open(data.authUrl, 'oauth', 'width=600,height=700');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const { data: status } = await apiClient.get<{ connected: boolean }>(
            `/api/integrations/nango/status/${config.nangoId}`
          );

          if (status.connected) {
            clearInterval(pollInterval);
            popup?.close();
            setOauthStatus('success');
            
            // Notify backend that credentials are available
            await apiClient.post('/api/credentials/oauth-complete', {
              integrationId: integration.id,
              projectId,
              buildId,
            });

            onSuccess?.(integration.id);
            setTimeout(onClose, 1500);
          }
        } catch {
          // Continue polling
        }
      }, 2000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (oauthStatus === 'connecting') {
          setOauthStatus('error');
          setError('OAuth connection timed out. Please try again.');
        }
      }, 120000);

    } catch (err) {
      setOauthStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to start OAuth flow');
    }
  }, [config, integration.id, projectId, buildId, oauthStatus, onSuccess, onClose]);

  const handleSave = useCallback(async () => {
    // Validate required fields
    const missingFields = config.fields
      .filter(f => f.required && !credentialValues[f.key]?.trim())
      .map(f => f.label);

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save credentials via API
      const { data } = await apiClient.post<{ 
        success: boolean; 
        credentialsWritten: number;
        error?: string;
      }>('/api/notifications/submit-credentials', {
        integrationId: integration.id,
        projectId,
        buildId,
        credentials: credentialValues,
      });

      if (data.success) {
        setValidationStatus('valid');
        onSuccess?.(integration.id);
        setTimeout(onClose, 1000);
      } else {
        setError(data.error || 'Failed to save credentials');
        setValidationStatus('invalid');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save credentials';
      setError(message);
      setValidationStatus('invalid');
      onError?.(message);
    } finally {
      setSaving(false);
    }
  }, [config.fields, credentialValues, integration.id, projectId, buildId, onSuccess, onError, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          style={{ width: '100%', maxWidth: 560 }}
        >
          <GlassPanel
            variant="dark"
            padding="lg"
            rounded="2xl"
            style={{
              background: 'linear-gradient(145deg, rgba(15,15,20,0.95) 0%, rgba(8,8,12,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: `
                0 40px 100px rgba(0,0,0,0.6),
                0 20px 50px rgba(0,0,0,0.4),
                inset 0 1px 0 rgba(255,255,255,0.05),
                0 0 0 1px rgba(255,255,255,0.03)
              `,
            }}
          >
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16, 
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(145deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                border: '1px solid rgba(220,38,38,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {getBrandIcon(integration.id, 24) || <LockGeometric size={24} color="#fff" accentColor="#dc2626" />}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: 20, 
                  fontWeight: 700, 
                  color: '#fff',
                  letterSpacing: '-0.02em',
                }}>
                  Connect {config.name}
                </h2>
                <p style={{ 
                  margin: '4px 0 0', 
                  fontSize: 13, 
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  {config.category?.charAt(0).toUpperCase()}{config.category?.slice(1)} Integration
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <XGeometric size={16} color="#fff" accentColor="#dc2626" />
              </button>
            </div>

            {/* Instructions */}
            {config.instructions && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.15)',
                marginBottom: 20,
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: 13, 
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5,
                }}>
                  {config.instructions}
                </p>
              </div>
            )}

            {/* OAuth Connect Button */}
            {config.supportsOAuth && (
              <div style={{ marginBottom: 24 }}>
                <GlassButton
                  variant="accent"
                  size="lg"
                  fullWidth
                  onClick={handleOAuthConnect}
                  disabled={oauthStatus === 'connecting' || oauthStatus === 'success'}
                  loading={oauthStatus === 'connecting'}
                  style={{
                    background: 'linear-gradient(145deg, rgba(220,38,38,0.25), rgba(185,28,28,0.15))',
                    border: '1px solid rgba(220,38,38,0.4)',
                    color: '#fca5a5',
                  }}
                >
                  {oauthStatus === 'success' ? (
                    <>
                      <CheckGeometric size={18} /> Connected
                    </>
                  ) : (
                    <>Connect with {config.name}</>
                  )}
                </GlassButton>

                {config.fields.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    margin: '16px 0',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 12,
                  }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    <span>or enter manually</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                )}
              </div>
            )}

            {/* Credential Fields */}
            {config.fields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {config.fields.map((field) => (
                  <div key={field.key}>
                    <GlassInput
                      variant="dark"
                      label={field.label}
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      hint={field.hint}
                      value={credentialValues[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      icon={<KeyGeometric size={16} color="rgba(255,255,255,0.4)" accentColor="#dc2626" />}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <XGeometric size={16} color="#fca5a5" accentColor="#ef4444" />
                <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
              </motion.div>
            )}

            {/* Footer Actions */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {config.platformUrl && (
                <GlassButton
                  variant="ghost"
                  onClick={handleFetchCredentials}
                  icon={<ExternalLinkGeometric size={16} color="#fff" accentColor="#dc2626" />}
                >
                  Get Credentials
                </GlassButton>
              )}
              
              <div style={{ flex: 1 }} />

              <GlassButton variant="ghost" onClick={onClose}>
                Cancel
              </GlassButton>

              <GlassButton
                variant="danger"
                onClick={handleSave}
                loading={saving}
                disabled={saving || validationStatus === 'valid'}
                style={{
                  background: 'linear-gradient(145deg, #dc2626, #991b1b)',
                  border: '1px solid rgba(220,38,38,0.5)',
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(220,38,38,0.3)',
                }}
              >
                {validationStatus === 'valid' ? (
                  <>
                    <CheckGeometric size={16} /> Saved
                  </>
                ) : saving ? (
                  <>
                    <RefreshGeometric size={16} animate="spin" /> Saving...
                  </>
                ) : (
                  'Save Credentials'
                )}
              </GlassButton>
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CredentialAcquisitionModal;

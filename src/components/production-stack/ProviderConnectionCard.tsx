/**
 * Provider Connection Card
 *
 * A card that combines provider selection with OAuth connection.
 * Shows a "Connect" button for OAuth-enabled providers after selection.
 */

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '@/lib/api-config';
import { useUserStore } from '@/store/useUserStore';

// Types
interface ProviderConnectionCardProps {
  provider: {
    id: string;
    name: string;
    description: string;
    features: string[];
    icon?: React.ReactNode;
    tier: 'free' | 'hobby' | 'pro' | 'enterprise';
    recommended?: boolean;
  };
  isSelected: boolean;
  isConnected: boolean;
  onSelect: () => void;
  onConnected: (credentials: Record<string, string>) => void;
  projectId?: string;
  category: 'auth' | 'database' | 'storage' | 'payments' | 'email' | 'hosting';
}

// Custom icons
const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const accentColor = '#c8ff64';

/**
 * Providers that support OAuth via Nango (450+ supported integrations)
 * This is a subset of the most commonly used providers in production apps
 */
const OAUTH_PROVIDERS = new Set([
  // Payments
  'stripe', 'paypal', 'square', 'braintree', 'mollie', 'paddle',

  // Auth Providers
  'clerk', 'auth0', 'okta', 'onelogin', 'ping-identity',

  // Cloud & Hosting
  'vercel', 'netlify', 'heroku', 'digitalocean', 'linode',
  'azure', 'google-cloud', 'aws',

  // Database & BaaS
  'supabase', 'firebase', 'mongodb', 'airtable', 'notion',

  // Developer Tools
  'github', 'gitlab', 'bitbucket', 'jira', 'linear', 'asana',
  'trello', 'monday', 'clickup',

  // Communication
  'slack', 'discord', 'intercom', 'zendesk', 'freshdesk',
  'hubspot', 'salesforce', 'pipedrive', 'zoho-crm',

  // eCommerce
  'shopify', 'woocommerce', 'bigcommerce', 'magento', 'prestashop',
  'etsy', 'amazon-seller', 'ebay',

  // Marketing & Analytics
  'mailchimp', 'brevo', 'klaviyo', 'convertkit',
  'google-analytics', 'mixpanel', 'amplitude', 'segment',
  'facebook', 'instagram', 'twitter', 'linkedin', 'tiktok',

  // Storage
  'dropbox', 'google-drive', 'onedrive', 'box',

  // Accounting & Finance
  'quickbooks', 'xero', 'wave', 'freshbooks',

  // Calendar & Scheduling
  'google-calendar', 'microsoft-outlook', 'calendly',

  // Video & Media
  'youtube', 'vimeo', 'twitch', 'zoom', 'webex', 'mux',

  // Other Common Integrations
  'typeform', 'surveymonkey', 'docusign', 'adobe-sign',
]);

/**
 * Providers that need manual API key/token entry
 * These don't support OAuth or have unique credential requirements
 */
const MANUAL_ENTRY_PROVIDERS = new Set([
  // Database (connection strings)
  'turso', 'planetscale', 'neon', 'cockroachdb', 'timescale',

  // ORMs (local config)
  'drizzle', 'prisma',

  // Auth Libraries (local secrets)
  'better-auth', 'lucia', 'next-auth',

  // Object Storage (API keys)
  'cloudflare-r2', 'aws-s3', 'backblaze-b2', 'minio', 'uploadthing',

  // Email (API keys)
  'resend', 'sendgrid', 'mailgun', 'postmark', 'ses',

  // Hosting (deploy tokens)
  'railway', 'fly', 'render', 'coolify',

  // AI/ML (API keys)
  'openai', 'anthropic', 'huggingface', 'replicate', 'fal', 'runpod', 'modal',

  // SMS (API keys)
  'twilio', 'vonage', 'plivo', 'messagebird',

  // Search
  'algolia', 'typesense', 'meilisearch', 'elasticsearch',

  // Monitoring
  'sentry', 'datadog', 'newrelic', 'logrocket',
]);

/**
 * Get platform URL for manual signup/API keys
 */
function getPlatformUrl(providerId: string): string {
  const urls: Record<string, string> = {
    // Auth
    'clerk': 'https://dashboard.clerk.com',
    'auth0': 'https://manage.auth0.com',
    'okta': 'https://developer.okta.com',
    'better-auth': 'https://www.better-auth.com/docs',
    'lucia': 'https://lucia-auth.com',
    'next-auth': 'https://next-auth.js.org',

    // Database
    'supabase': 'https://supabase.com/dashboard',
    'turso': 'https://turso.tech/app',
    'planetscale': 'https://app.planetscale.com',
    'neon': 'https://console.neon.tech',
    'firebase': 'https://console.firebase.google.com',
    'mongodb': 'https://cloud.mongodb.com',
    'cockroachdb': 'https://cockroachlabs.cloud',
    'timescale': 'https://console.cloud.timescale.com',

    // Storage
    'cloudflare-r2': 'https://dash.cloudflare.com',
    'aws-s3': 'https://console.aws.amazon.com/s3',
    'backblaze-b2': 'https://secure.backblaze.com/b2_buckets.htm',
    'uploadthing': 'https://uploadthing.com/dashboard',

    // Payments
    'stripe': 'https://dashboard.stripe.com/apikeys',
    'paypal': 'https://developer.paypal.com/dashboard',
    'square': 'https://developer.squareup.com/apps',

    // Email
    'resend': 'https://resend.com/api-keys',
    'sendgrid': 'https://app.sendgrid.com/settings/api_keys',
    'mailgun': 'https://app.mailgun.com/app/account/security/api_keys',
    'postmark': 'https://account.postmarkapp.com/servers',
    'ses': 'https://console.aws.amazon.com/ses',

    // Hosting
    'vercel': 'https://vercel.com/account/tokens',
    'netlify': 'https://app.netlify.com/user/applications',
    'railway': 'https://railway.app/account/tokens',
    'fly': 'https://fly.io/user/personal_access_tokens',
    'render': 'https://dashboard.render.com/u/settings',
    'heroku': 'https://dashboard.heroku.com/account',
    'digitalocean': 'https://cloud.digitalocean.com/account/api/tokens',

    // AI/ML
    'openai': 'https://platform.openai.com/api-keys',
    'anthropic': 'https://console.anthropic.com/settings/keys',
    'huggingface': 'https://huggingface.co/settings/tokens',
    'replicate': 'https://replicate.com/account/api-tokens',
    'fal': 'https://fal.ai/dashboard/keys',
    'runpod': 'https://www.runpod.io/console/user/settings',
    'modal': 'https://modal.com/settings',

    // SMS
    'twilio': 'https://console.twilio.com/us1/account/keys-credentials/api-keys',
    'vonage': 'https://dashboard.nexmo.com/settings',

    // Search
    'algolia': 'https://dashboard.algolia.com/account/api-keys',
    'typesense': 'https://cloud.typesense.org/clusters',
    'meilisearch': 'https://cloud.meilisearch.com',

    // Monitoring
    'sentry': 'https://sentry.io/settings/account/api/auth-tokens',
    'datadog': 'https://app.datadoghq.com/organization-settings/api-keys',
    'logrocket': 'https://app.logrocket.com/settings/setup',

    // DevTools
    'github': 'https://github.com/settings/tokens',
    'gitlab': 'https://gitlab.com/-/profile/personal_access_tokens',
    'linear': 'https://linear.app/settings/api',
  };
  return urls[providerId] || '#';
}

/**
 * Check if provider supports OAuth
 */
function supportsOAuth(providerId: string): boolean {
  return OAUTH_PROVIDERS.has(providerId);
}

/**
 * Auto-configure service-specific settings after OAuth connection
 * This runs in the background after a successful OAuth connection
 */
async function autoConfigureService(
  providerId: string,
  projectId: string | undefined,
  userId: string,
  credentials: Record<string, string>
): Promise<void> {
  if (!projectId) return;

  try {
    switch (providerId) {
      case 'stripe':
        // Auto-configure Stripe webhooks
        await fetch(`${API_URL}/api/stripe/auto-setup-webhook`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ projectId }),
        });
        console.log('[AutoConfig] Stripe webhooks configured');
        break;

      case 'supabase':
      case 'vercel':
      case 'clerk':
      case 'auth0':
        // Generic auto-config for these services
        await fetch(`${API_URL}/api/auto-config/${providerId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ projectId, credentials }),
        });
        console.log(`[AutoConfig] ${providerId} configured`);
        break;

      case 'github':
        // For GitHub, we might want to create a repo or set up webhooks
        console.log('[AutoConfig] GitHub connected - repo access enabled');
        break;

      default:
        // No special configuration needed
        break;
    }
  } catch (error) {
    // Log but don't fail - auto-config is a convenience, not a requirement
    console.warn(`[AutoConfig] Failed to auto-configure ${providerId}:`, error);
  }
}

// Glass styles
const glassStyles = {
  card: {
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.05)',
  },
  cardSelected: {
    background: 'linear-gradient(145deg, rgba(40,45,35,0.98) 0%, rgba(25,30,20,0.99) 100%)',
    boxShadow: `inset 0 0 60px rgba(200,255,100,0.12), 0 25px 60px rgba(0,0,0,0.45), 0 15px 35px rgba(200,255,100,0.15), 0 0 0 2px ${accentColor}`,
  },
};

export const ProviderConnectionCard = memo(function ProviderConnectionCard({
  provider,
  isSelected,
  isConnected,
  onSelect,
  onConnected,
  projectId,
  category,
}: ProviderConnectionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUserStore();

  const userId = user?.id || '';
  const hasOAuth = supportsOAuth(provider.id);
  const needsManualEntry = MANUAL_ENTRY_PROVIDERS.has(provider.id);
  const platformUrl = getPlatformUrl(provider.id);

  const handleOAuthConnect = useCallback(async () => {
    if (!userId || isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        integrationId: provider.id,
        userId,
      });

      if (projectId) {
        params.append('projectId', projectId);
      }

      const redirectUrl = `${window.location.origin}/oauth/callback`;
      params.append('redirectUrl', redirectUrl);

      const response = await fetch(`${API_URL}/api/nango/auth-url?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const data = await response.json();

      if (!data.success || !data.authUrl) {
        throw new Error('Invalid OAuth URL response');
      }

      // Open OAuth popup
      const width = 600, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups.');
      }

      // Poll for completion
      const checkInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkInterval);

          // Verify connection
          const checkResponse = await fetch(
            `${API_URL}/api/nango/connection/${provider.id}`,
            {
              method: 'GET',
              credentials: 'include',
              headers: { 'x-user-id': userId },
            }
          );

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();

            if (checkData.connected) {
              // Fetch and store credentials
              const credResponse = await fetch(
                `${API_URL}/api/nango/credentials/${provider.id}`,
                {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                  },
                  body: JSON.stringify({
                    projectId,
                    writeToEnv: true,
                    category,
                  }),
                }
              );

              if (credResponse.ok) {
                const credData = await credResponse.json();

                // Auto-configure service-specific settings
                await autoConfigureService(provider.id, projectId, userId, credData.credentials);

                onConnected(credData.credentials || {});
              }
            }
          }
          setIsConnecting(false);
        }
      }, 500);

      // Timeout after 5 min
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!popup.closed) popup.close();
        setIsConnecting(false);
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error('OAuth error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  }, [userId, projectId, provider.id, category, onConnected, isConnecting, isConnected]);

  return (
    <motion.div
      className="relative rounded-2xl p-4 cursor-pointer transition-all"
      style={isSelected ? glassStyles.cardSelected : glassStyles.card}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
    >
      {/* Recommended badge */}
      {provider.recommended && (
        <div
          className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: accentColor, color: 'black' }}
        >
          Recommended
        </div>
      )}

      {/* Provider info */}
      <div className="flex items-start gap-3 mb-3">
        {provider.icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
            {provider.icon}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white">{provider.name}</h4>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50 capitalize">
              {provider.tier}
            </span>
          </div>
          <p className="text-sm text-white/50 mt-0.5">{provider.description}</p>
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {provider.features.slice(0, 3).map((feature) => (
          <span key={feature} className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40">
            {feature}
          </span>
        ))}
      </div>

      {/* Connection status & actions - only show when selected */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {isConnected ? (
              // Connected state
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckIcon />
                <span className="text-sm font-medium text-green-400">Connected</span>
              </div>
            ) : hasOAuth ? (
              // OAuth connect button
              <motion.button
                onClick={handleOAuthConnect}
                disabled={isConnecting}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  font-medium text-sm transition-all
                  ${isConnecting
                    ? 'bg-white/5 cursor-wait'
                    : 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30'
                  }
                `}
                whileHover={!isConnecting ? { scale: 1.02 } : {}}
                whileTap={!isConnecting ? { scale: 0.98 } : {}}
              >
                {isConnecting ? (
                  <>
                    <LoadingSpinner />
                    <span className="text-white/60">Connecting...</span>
                  </>
                ) : (
                  <>
                    <LinkIcon />
                    <span className="text-amber-400">Connect with OAuth</span>
                  </>
                )}
              </motion.button>
            ) : needsManualEntry ? (
              // Manual entry - link to platform
              <a
                href={platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  font-medium text-sm transition-all
                  bg-white/5 hover:bg-white/10 border border-white/10
                "
              >
                <ExternalLinkIcon />
                <span className="text-white/70">Get API Key from {provider.name}</span>
              </a>
            ) : null}

            {/* Error message */}
            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}

            {/* Help text */}
            {!isConnected && hasOAuth && (
              <p className="mt-2 text-xs text-white/30 text-center">
                Click to connect your existing {provider.name} account
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          layoutId="selection-ring"
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 20px ${accentColor}40`,
          }}
        />
      )}
    </motion.div>
  );
});

export default ProviderConnectionCard;

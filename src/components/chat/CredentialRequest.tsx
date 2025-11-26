/**
 * Credential Request Component
 * 
 * Displays an inline credential request in the streaming chat when
 * the AI needs credentials to continue building the user's project.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/icons/BrandIcons';
import { ExternalLink, Eye, EyeOff, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface CredentialField {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder: string;
    required: boolean;
    helpText?: string;
}

interface CredentialRequestProps {
    integrationId: string;
    integrationName: string;
    description: string;
    fields: CredentialField[];
    documentationUrl?: string;
    onSubmit: (credentials: Record<string, string>) => Promise<void>;
    onSkip?: () => void;
    className?: string;
}

export function CredentialRequest({
    integrationId,
    integrationName,
    description,
    fields,
    documentationUrl,
    onSubmit,
    onSkip,
    className,
}: CredentialRequestProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleChange = useCallback((key: string, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setError(null);
    }, []);

    const togglePasswordVisibility = useCallback((key: string) => {
        setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required fields
        for (const field of fields) {
            if (field.required && !values[field.key]?.trim()) {
                setError(`${field.label} is required`);
                return;
            }
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(values);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save credentials');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDocumentation = () => {
        if (documentationUrl) {
            window.open(documentationUrl, '_blank', 'noopener,noreferrer,width=800,height=600');
        }
    };

    if (success) {
        return (
            <div className={cn(
                "rounded-xl border border-green-500/30 bg-green-500/10 p-4",
                className
            )}>
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-400 font-medium">
                        {integrationName} credentials saved successfully!
                    </span>
                </div>
                <p className="text-sm text-slate-400 mt-2 ml-8">
                    Your credentials are encrypted and stored securely. Continuing to build...
                </p>
            </div>
        );
    }

    return (
        <div className={cn(
            "rounded-xl border border-amber-500/30 bg-slate-800/50 backdrop-blur overflow-hidden",
            className
        )}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
                <div className="p-2 rounded-lg bg-slate-700/50">
                    <BrandIcon name={integrationId} className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-white">
                        Connect {integrationName}
                    </h4>
                    <p className="text-xs text-slate-400">
                        Credentials required to continue
                    </p>
                </div>
                <Lock className="h-4 w-4 text-amber-500" />
            </div>

            {/* Content */}
            <div className="p-4">
                <p className="text-sm text-slate-300 mb-4">
                    {description}
                </p>

                {/* Documentation Link */}
                {documentationUrl && (
                    <button
                        onClick={openDocumentation}
                        className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mb-4 transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                        <span>Get your {integrationName} credentials</span>
                    </button>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    {fields.map((field) => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                {field.label}
                                {field.required && <span className="text-amber-500 ml-1">*</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                    value={values[field.key] || ''}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={cn(
                                        "w-full px-3 py-2 rounded-lg",
                                        "bg-slate-900/50 border border-slate-600",
                                        "text-white placeholder-slate-500",
                                        "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500",
                                        "font-mono text-sm",
                                        field.type === 'password' && "pr-10"
                                    )}
                                />
                                {field.type === 'password' && (
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility(field.key)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                                    >
                                        {showPasswords[field.key] ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                            {field.helpText && (
                                <p className="text-xs text-slate-500 mt-1">{field.helpText}</p>
                            )}
                        </div>
                    ))}

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-medium"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Save & Continue
                                </>
                            )}
                        </Button>
                        {onSkip && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onSkip}
                                disabled={isSubmitting}
                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                Skip
                            </Button>
                        )}
                    </div>
                </form>

                {/* Security Note */}
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Your credentials are encrypted with AES-256-GCM and never leave your vault
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// PREDEFINED CREDENTIAL CONFIGS
// ============================================================================

export const CREDENTIAL_CONFIGS: Record<string, Omit<CredentialRequestProps, 'onSubmit' | 'onSkip' | 'className'>> = {
    openai: {
        integrationId: 'openai',
        integrationName: 'OpenAI',
        description: 'Connect your OpenAI account to use GPT models for AI features.',
        documentationUrl: 'https://platform.openai.com/api-keys',
        fields: [
            {
                key: 'apiKey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-...',
                required: true,
                helpText: 'Starts with "sk-"',
            },
        ],
    },
    openrouter: {
        integrationId: 'openrouter',
        integrationName: 'OpenRouter',
        description: 'Connect OpenRouter to access multiple AI models through a single API.',
        documentationUrl: 'https://openrouter.ai/keys',
        fields: [
            {
                key: 'apiKey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-or-...',
                required: true,
                helpText: 'Starts with "sk-or-"',
            },
        ],
    },
    runpod: {
        integrationId: 'runpod',
        integrationName: 'RunPod',
        description: 'Connect RunPod to deploy AI models to GPU instances.',
        documentationUrl: 'https://www.runpod.io/console/user/settings',
        fields: [
            {
                key: 'apiKey',
                label: 'API Key',
                type: 'password',
                placeholder: 'Your RunPod API key',
                required: true,
            },
        ],
    },
    huggingface: {
        integrationId: 'huggingface',
        integrationName: 'HuggingFace',
        description: 'Connect HuggingFace to discover and deploy AI models.',
        documentationUrl: 'https://huggingface.co/settings/tokens',
        fields: [
            {
                key: 'token',
                label: 'Access Token',
                type: 'password',
                placeholder: 'hf_...',
                required: true,
                helpText: 'Create a token with read access',
            },
        ],
    },
    vercel: {
        integrationId: 'vercel',
        integrationName: 'Vercel',
        description: 'Connect Vercel to deploy your frontend applications.',
        documentationUrl: 'https://vercel.com/account/tokens',
        fields: [
            {
                key: 'token',
                label: 'API Token',
                type: 'password',
                placeholder: 'Your Vercel API token',
                required: true,
            },
        ],
    },
    netlify: {
        integrationId: 'netlify',
        integrationName: 'Netlify',
        description: 'Connect Netlify to deploy your web applications.',
        documentationUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
        fields: [
            {
                key: 'token',
                label: 'Personal Access Token',
                type: 'password',
                placeholder: 'Your Netlify access token',
                required: true,
            },
        ],
    },
    stripe: {
        integrationId: 'stripe',
        integrationName: 'Stripe',
        description: 'Connect Stripe to add payment processing to your app.',
        documentationUrl: 'https://dashboard.stripe.com/apikeys',
        fields: [
            {
                key: 'secretKey',
                label: 'Secret Key',
                type: 'password',
                placeholder: 'sk_...',
                required: true,
                helpText: 'Use test keys for development',
            },
            {
                key: 'publishableKey',
                label: 'Publishable Key',
                type: 'text',
                placeholder: 'pk_...',
                required: true,
            },
        ],
    },
    supabase: {
        integrationId: 'supabase',
        integrationName: 'Supabase',
        description: 'Connect Supabase for database and authentication.',
        documentationUrl: 'https://supabase.com/dashboard/project/_/settings/api',
        fields: [
            {
                key: 'url',
                label: 'Project URL',
                type: 'text',
                placeholder: 'https://xxx.supabase.co',
                required: true,
            },
            {
                key: 'anonKey',
                label: 'Anon Key',
                type: 'password',
                placeholder: 'eyJ...',
                required: true,
            },
        ],
    },
    turso: {
        integrationId: 'turso',
        integrationName: 'Turso',
        description: 'Connect Turso for edge database hosting.',
        documentationUrl: 'https://turso.tech/app',
        fields: [
            {
                key: 'databaseUrl',
                label: 'Database URL',
                type: 'text',
                placeholder: 'libsql://your-db.turso.io',
                required: true,
            },
            {
                key: 'authToken',
                label: 'Auth Token',
                type: 'password',
                placeholder: 'Your Turso auth token',
                required: true,
            },
        ],
    },
};

export default CredentialRequest;


/**
 * Credential Form
 *
 * Secure credential input with validation and visibility toggle.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, KeyIcon, LockIcon, UserIcon, ShieldIcon, AlertCircleIcon, CheckIcon, GlobeIcon } from '../ui/icons';

const accentColor = '#c8ff64';

interface CredentialFormProps {
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
    provider: string;
    onSubmit: (credentials: Record<string, string>) => void;
    isLoading?: boolean;
}

export function CredentialForm({
    authType,
    provider,
    onSubmit,
    isLoading = false,
}: CredentialFormProps) {
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const getFieldsForAuthType = () => {
        switch (authType) {
            case 'api-key':
            case 'bearer':
                return [
                    {
                        name: 'apiKey',
                        label: 'API Key',
                        placeholder: 'sk-...',
                        icon: KeyIcon,
                        required: true,
                        secret: true,
                    },
                ];
            case 'basic':
                return [
                    {
                        name: 'username',
                        label: 'Username / Account SID',
                        placeholder: 'Enter username or account ID',
                        icon: UserIcon,
                        required: true,
                        secret: false,
                    },
                    {
                        name: 'password',
                        label: 'Password / Auth Token',
                        placeholder: 'Enter password or auth token',
                        icon: LockIcon,
                        required: true,
                        secret: true,
                    },
                ];
            case 'oauth2':
                return [
                    {
                        name: 'clientId',
                        label: 'Client ID',
                        placeholder: 'Your OAuth client ID',
                        icon: UserIcon,
                        required: true,
                        secret: false,
                    },
                    {
                        name: 'clientSecret',
                        label: 'Client Secret',
                        placeholder: 'Your OAuth client secret',
                        icon: LockIcon,
                        required: true,
                        secret: true,
                    },
                ];
            default:
                return [];
        }
    };

    const fields = getFieldsForAuthType();

    const handleChange = (name: string, value: string) => {
        setCredentials(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const toggleShowSecret = (name: string) => {
        setShowSecrets(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        fields.forEach(field => {
            if (field.required && !credentials[field.name]?.trim()) {
                newErrors[field.name] = `${field.label} is required`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(credentials);
        }
    };

    const getProviderDocsUrl = () => {
        const docsUrls: Record<string, string> = {
            stripe: 'https://dashboard.stripe.com/apikeys',
            twilio: 'https://console.twilio.com',
            sendgrid: 'https://app.sendgrid.com/settings/api_keys',
            openai: 'https://platform.openai.com/api-keys',
            supabase: 'https://supabase.com/dashboard/project/_/settings/api',
            github: 'https://github.com/settings/tokens',
            slack: 'https://api.slack.com/apps',
            notion: 'https://www.notion.so/my-integrations',
            resend: 'https://resend.com/api-keys',
        };
        return docsUrls[provider];
    };

    if (authType === 'none') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${accentColor}20` }}
                >
                    <CheckIcon size={32} className="text-[#c8ff64]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Authentication Required</h3>
                <p className="text-sm text-white/50 max-w-md">
                    This API doesn't require authentication credentials.
                    You can proceed directly to code generation.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Security notice */}
            <div
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}
            >
                <ShieldIcon size={20} className="flex-shrink-0 mt-0.5 text-[#c8ff64]" />
                <div className="text-sm">
                    <p className="font-medium text-white">Your credentials are encrypted</p>
                    <p className="text-white/60 mt-0.5">
                        We use AES-256-GCM encryption to securely store your API credentials.
                        They are never logged or exposed.
                    </p>
                </div>
            </div>

            {/* Credential fields */}
            <div className="space-y-4">
                {fields.map(field => {
                    const Icon = field.icon;
                    const hasError = !!errors[field.name];

                    return (
                        <div key={field.name}>
                            <label className="block text-sm font-medium text-white mb-2">
                                {field.label}
                                {field.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <div className="relative">
                                <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type={field.secret && !showSecrets[field.name] ? 'password' : 'text'}
                                    value={credentials[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={`w-full pl-10 pr-12 py-3 bg-black/30 border rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all ${
                                        hasError
                                            ? 'border-red-500/50 focus:ring-red-500/50'
                                            : 'border-white/10 focus:ring-[#c8ff64]/50'
                                    }`}
                                />
                                {field.secret && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowSecret(field.name)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white transition-colors"
                                    >
                                        {showSecrets[field.name] ? (
                                            <EyeOffIcon size={16} />
                                        ) : (
                                            <EyeIcon size={16} />
                                        )}
                                    </button>
                                )}
                            </div>
                            {hasError && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-1 mt-1 text-xs text-red-400"
                                >
                                    <AlertCircleIcon size={12} />
                                    {errors[field.name]}
                                </motion.p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Help link */}
            {getProviderDocsUrl() && (
                <a
                    href={getProviderDocsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                    <GlobeIcon size={16} />
                    Get your {provider.charAt(0).toUpperCase() + provider.slice(1)} API credentials
                </a>
            )}

            {/* Submit button */}
            <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: accentColor, color: 'black' }}
            >
                {isLoading ? (
                    <>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                        />
                        Storing Credentials...
                    </>
                ) : (
                    <>
                        <LockIcon size={16} />
                        Save Credentials
                    </>
                )}
            </motion.button>
        </form>
    );
}


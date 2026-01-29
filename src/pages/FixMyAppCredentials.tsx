/**
 * Fix My App Credentials Page
 * 
 * Project-specific credential entry page. Users are redirected here when
 * the BuildLoopOrchestrator detects missing env variables needed to complete
 * the Fix My App project.
 * 
 * Flow:
 * 1. User clicks notification link with sessionId
 * 2. Page loads and fetches required credentials for THAT specific project
 * 3. User enters credentials for each required service
 * 4. Credentials are saved to that project's credential vault
 * 5. User clicks Continue → redirected to dashboard, build resumes
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeftIcon,
    CheckCircle2Icon,
    ExternalLinkIcon,
    Loader2Icon,
    KeyIcon,
    EyeIcon,
    EyeOffIcon,
    AlertCircleIcon,
    ArrowRightIcon,
    ShieldCheckIcon,
} from '@/components/ui/icons';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api-client';
import { SERVICE_CONFIGS } from '@/components/fix-my-app/CredentialTiles';

interface RequiredCredential {
    serviceId: string;
    serviceName: string;
    reason: string; // Why this credential is needed
    keys: Array<{
        name: string;
        label: string;
        placeholder: string;
        sensitive: boolean;
    }>;
}

interface FixSession {
    sessionId: string;
    projectId: string;
    projectName: string;
    source: string;
    status: string;
    requiredCredentials: RequiredCredential[];
}

export default function FixMyAppCredentials() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<FixSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedServices, setSavedServices] = useState<Set<string>>(new Set());
    const [credentialValues, setCredentialValues] = useState<Record<string, Record<string, string>>>({});
    const [showValues, setShowValues] = useState<Record<string, Record<string, boolean>>>({});
    const [savingService, setSavingService] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load session and required credentials
    useEffect(() => {
        const loadSession = async () => {
            if (!sessionId) {
                setError('No session ID provided');
                setIsLoading(false);
                return;
            }

            try {
                const response = await apiClient.get<FixSession>(
                    `/api/fix-my-app/sessions/${sessionId}/credentials`
                );
                setSession(response.data);

                // Initialize credential values from any existing saved credentials
                const initialValues: Record<string, Record<string, string>> = {};
                response.data.requiredCredentials.forEach(cred => {
                    initialValues[cred.serviceId] = {};
                });
                setCredentialValues(initialValues);
            } catch (err: any) {
                console.error('Failed to load session:', err);
                if (err?.response?.status === 404) {
                    setError('Session not found or expired');
                } else if (err?.response?.status === 401) {
                    setError('Please sign in to access this page');
                    navigate('/');
                } else {
                    setError('Failed to load credential requirements');
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadSession();
    }, [sessionId, navigate]);

    // Handle saving credentials for a single service
    const handleSaveService = async (serviceId: string) => {
        if (!session) return;

        const values = credentialValues[serviceId] || {};
        const service = session.requiredCredentials.find(c => c.serviceId === serviceId);
        if (!service) return;

        // Validate all required fields
        const missingFields = service.keys.filter(key => !values[key.name]?.trim());
        if (missingFields.length > 0) {
            toast({
                title: 'Missing required fields',
                description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
                variant: 'destructive',
            });
            return;
        }

        setSavingService(serviceId);

        try {
            await apiClient.post(`/api/fix-my-app/sessions/${sessionId}/credentials`, {
                serviceId,
                credentials: values,
            });

            setSavedServices(prev => new Set([...prev, serviceId]));
            toast({
                title: 'Credentials saved',
                description: `${service.serviceName} credentials securely stored for this project.`,
            });
        } catch (err) {
            console.error('Failed to save credentials:', err);
            toast({
                title: 'Failed to save',
                description: 'There was an error saving credentials. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSavingService(null);
        }
    };

    // Handle Continue - finalize and resume build
    const handleContinue = async () => {
        if (!session) return;

        // Ensure all credentials are saved
        const unsaved = session.requiredCredentials.filter(c => !savedServices.has(c.serviceId));
        if (unsaved.length > 0) {
            toast({
                title: 'Missing credentials',
                description: `Please save credentials for: ${unsaved.map(u => u.serviceName).join(', ')}`,
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Signal that credentials are ready and build can resume
            await apiClient.post(`/api/fix-my-app/sessions/${sessionId}/resume`);

            toast({
                title: 'Building your app!',
                description: 'Credentials saved. Your app is now being built.',
            });

            // Redirect to dashboard where they can see build progress
            navigate('/dashboard?fixSession=' + sessionId);
        } catch (err) {
            console.error('Failed to resume build:', err);
            toast({
                title: 'Failed to resume',
                description: 'There was an error resuming the build. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update credential value
    const updateValue = (serviceId: string, keyName: string, value: string) => {
        setCredentialValues(prev => ({
            ...prev,
            [serviceId]: {
                ...prev[serviceId],
                [keyName]: value,
            },
        }));
    };

    // Toggle password visibility
    const toggleShowValue = (serviceId: string, keyName: string) => {
        setShowValues(prev => ({
            ...prev,
            [serviceId]: {
                ...prev[serviceId],
                [keyName]: !prev[serviceId]?.[keyName],
            },
        }));
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2Icon size={40} className="animate-spin text-amber-500 mx-auto mb-4" />
                    <p className="text-slate-400">Loading credential requirements...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md text-center">
                    <AlertCircleIcon size={48} className="text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!session) return null;

    const allSaved = session.requiredCredentials.every(c => savedServices.has(c.serviceId));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeftIcon size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-white">
                                Complete Your Project
                            </h1>
                            <p className="text-sm text-slate-400">
                                {session.projectName || 'Fix My App Project'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <ShieldCheckIcon size={16} className="text-emerald-500" />
                        <span>Credentials are encrypted</span>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Progress indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">
                            {savedServices.size} of {session.requiredCredentials.length} credentials configured
                        </span>
                        {allSaved && (
                            <span className="text-sm text-emerald-400 flex items-center gap-1">
                                <CheckCircle2Icon size={14} />
                                All ready!
                            </span>
                        )}
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(savedServices.size / session.requiredCredentials.length) * 100}%` }}
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Info banner */}
                <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <h2 className="font-semibold text-amber-400 mb-1">
                        Credentials Needed for Your App
                    </h2>
                    <p className="text-sm text-slate-300">
                        We analyzed your project and found it needs the following credentials to work properly.
                        These are stored securely and used only for THIS project.
                    </p>
                </div>

                {/* Credential tiles */}
                <div className="space-y-6">
                    <AnimatePresence mode="popLayout">
                        {session.requiredCredentials.map((credential, index) => {
                            const isSaved = savedServices.has(credential.serviceId);
                            const isSaving = savingService === credential.serviceId;
                            const serviceConfig = SERVICE_CONFIGS[credential.serviceId];
                            
                            return (
                                <motion.div
                                    key={credential.serviceId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`p-6 rounded-2xl border transition-all ${
                                        isSaved
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-slate-800/50 border-slate-700/50'
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
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl shrink-0">
                                            {serviceConfig?.icon || '🔑'}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-white">{credential.serviceName}</h3>
                                            <p className="text-sm text-slate-400">{credential.reason}</p>
                                        </div>
                                        {isSaved && (
                                            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                                                <CheckCircle2Icon size={14} />
                                                Saved
                                            </div>
                                        )}
                                    </div>

                                    {/* Input fields */}
                                    <div className="space-y-4 mb-5">
                                        {credential.keys.map((key) => (
                                            <div key={key.name} className="space-y-1.5">
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                                    <KeyIcon size={12} className="text-slate-500" />
                                                    {key.label}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={key.sensitive && !showValues[credential.serviceId]?.[key.name] ? 'password' : 'text'}
                                                        value={credentialValues[credential.serviceId]?.[key.name] || ''}
                                                        onChange={(e) => updateValue(credential.serviceId, key.name, e.target.value)}
                                                        placeholder={key.placeholder}
                                                        disabled={isSaved}
                                                        className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
                                                    />
                                                    {key.sensitive && !isSaved && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleShowValue(credential.serviceId, key.name)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-700 transition-colors"
                                                        >
                                                            {showValues[credential.serviceId]?.[key.name] ? (
                                                                <EyeOffIcon size={16} className="text-slate-400" />
                                                            ) : (
                                                                <EyeIcon size={16} className="text-slate-400" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 font-mono">{key.name}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => window.open(serviceConfig?.platformUrl || '#', '_blank')}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                        >
                                            Get Credentials
                                            <ExternalLinkIcon size={14} />
                                        </button>
                                        {!isSaved && (
                                            <button
                                                onClick={() => handleSaveService(credential.serviceId)}
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
                        })}
                    </AnimatePresence>
                </div>

                {/* Continue button - appears when all credentials are saved */}
                <AnimatePresence>
                    {allSaved && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-amber-500/20 border border-emerald-500/30"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <CheckCircle2Icon size={20} className="text-emerald-400" />
                                        All Credentials Ready!
                                    </h3>
                                    <p className="text-sm text-slate-300 mt-1">
                                        Your credentials are saved. Click Continue to resume building your app.
                                    </p>
                                </div>
                                <button
                                    onClick={handleContinue}
                                    disabled={isSubmitting}
                                    className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2Icon size={18} className="animate-spin" />
                                            Resuming...
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRightIcon size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Security note */}
                <div className="mt-8 text-center text-sm text-slate-500">
                    <ShieldCheckIcon size={16} className="inline mr-1" />
                    Your credentials are encrypted with AES-256-GCM and stored in your project's secure vault.
                    <br />
                    They are never shared with other projects or users.
                </div>
            </main>
        </div>
    );
}

/**
 * Integration Wizard
 *
 * Step-by-step integration setup for APIs.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    LoadingIcon,
    KeyIcon,
    CodeIcon,
    PlayIcon,
    CopyIcon,
    CheckCircle2Icon,
} from '../ui/icons';
import { CredentialForm } from './CredentialForm';
import { CodePreview } from './CodePreview';
import { TestRunner } from './TestRunner';

const accentColor = '#c8ff64';

interface APIProfile {
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
    authConfig?: {
        headerName?: string;
        prefix?: string;
    };
    documentation: string;
    logo?: string;
}

interface GeneratedCode {
    serviceFile: string;
    serviceContent: string;
    typeDefinitions: string;
    envVariables: Array<{
        name: string;
        description: string;
        required: boolean;
        example?: string;
    }>;
    usageExamples: string[];
    dependencies: Array<{ name: string; version: string }>;
}

interface IntegrationWizardProps {
    profile: APIProfile;
    projectId: string;
    onComplete: (integrationId: string) => void;
    onCancel: () => void;
}

type Step = 'credentials' | 'generate' | 'test' | 'complete';

const STEPS: { id: Step; title: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'credentials', title: 'API Credentials', icon: KeyIcon },
    { id: 'generate', title: 'Generate Code', icon: CodeIcon },
    { id: 'test', title: 'Test Connection', icon: PlayIcon },
    { id: 'complete', title: 'Complete', icon: CheckIcon },
];

export function IntegrationWizard({
    profile,
    projectId,
    onComplete,
    onCancel,
}: IntegrationWizardProps) {
    const [currentStep, setCurrentStep] = useState<Step>('credentials');
    const [integrationId, setIntegrationId] = useState<string | null>(null);
    const [_credentials, setCredentials] = useState<Record<string, string>>({});
    const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

    // Create integration
    const createIntegration = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/autopilot/integrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId, profile }),
            });

            const data = await response.json();
            if (data.success) {
                setIntegrationId(data.integration.id);
                return data.integration.id;
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create integration');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [projectId, profile]);

    // Store credentials
    const storeCredentials = useCallback(async (creds: Record<string, string>) => {
        setIsLoading(true);
        setError(null);
        setCredentials(creds);

        try {
            let id = integrationId;
            if (!id) {
                id = await createIntegration();
            }

            const response = await fetch('/api/autopilot/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ integrationId: id, credentials: creds }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }

            setCurrentStep('generate');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to store credentials');
        } finally {
            setIsLoading(false);
        }
    }, [integrationId, createIntegration]);

    // Generate code
    const generateCode = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/autopilot/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ integrationId, profile }),
            });

            const data = await response.json();
            if (data.success) {
                setGeneratedCode(data.generatedCode);
                setCurrentStep('test');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate code');
        } finally {
            setIsLoading(false);
        }
    }, [integrationId, profile]);

    // Test connection
    const testConnection = useCallback(async () => {
        if (!integrationId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/autopilot/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ integrationId }),
            });

            const data = await response.json();
            if (data.success) {
                setTestResult(data.testResult);
                if (data.testResult.success) {
                    setCurrentStep('complete');
                }
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test failed');
        } finally {
            setIsLoading(false);
        }
    }, [integrationId]);

    // Handle complete
    const handleComplete = () => {
        if (integrationId) {
            onComplete(integrationId);
        }
    };

    // Skip credentials (for APIs that don't need auth)
    const skipCredentials = async () => {
        try {
            let id = integrationId;
            if (!id) {
                id = await createIntegration();
            }
            setCurrentStep('generate');
        } catch {
            // Error already handled in createIntegration
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header with API info */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                        {profile.logo ? (
                            <img
                                src={profile.logo}
                                alt={profile.name}
                                className="w-8 h-8 object-contain"
                            />
                        ) : (
                            <span className="text-xl font-bold text-white/30">
                                {profile.name.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{profile.name}</h3>
                        <p className="text-sm text-white/50">Integration Setup</p>
                    </div>
                </div>
            </div>

            {/* Progress steps */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                {STEPS.map((step, index) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = index < currentStepIndex;
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="flex items-center">
                            <div className="flex flex-col items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                        isActive
                                            ? 'ring-2 ring-offset-2 ring-offset-black'
                                            : ''
                                    }`}
                                    style={{
                                        background: isCompleted
                                            ? accentColor
                                            : isActive
                                                ? `${accentColor}30`
                                                : 'rgba(255,255,255,0.1)',
                                        color: isCompleted ? 'black' : isActive ? accentColor : 'rgba(255,255,255,0.4)',
                                        boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
                                    }}
                                >
                                    {isCompleted ? (
                                        <CheckIcon size={20} />
                                    ) : (
                                        <Icon size={20} />
                                    )}
                                </div>
                                <span className={`text-xs mt-2 ${isActive ? 'text-white' : 'text-white/40'}`}>
                                    {step.title}
                                </span>
                            </div>
                            {index < STEPS.length - 1 && (
                                <div
                                    className="w-12 h-0.5 mx-2 mt-[-20px]"
                                    style={{
                                        background: isCompleted ? accentColor : 'rgba(255,255,255,0.1)',
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Error display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto p-4">
                <AnimatePresence mode="wait">
                    {/* Credentials step */}
                    {currentStep === 'credentials' && (
                        <motion.div
                            key="credentials"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <CredentialForm
                                authType={profile.authType}
                                provider={profile.provider}
                                onSubmit={storeCredentials}
                                isLoading={isLoading}
                            />
                            {profile.authType === 'none' && (
                                <button
                                    onClick={skipCredentials}
                                    className="w-full mt-4 py-2 text-white/60 hover:text-white transition-colors"
                                >
                                    Skip - This API doesn't require authentication
                                </button>
                            )}
                        </motion.div>
                    )}

                    {/* Generate step */}
                    {currentStep === 'generate' && (
                        <motion.div
                            key="generate"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col items-center justify-center h-full gap-6"
                        >
                            {!generatedCode ? (
                                <>
                                    <div
                                        className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                        style={{ background: `${accentColor}20` }}
                                    >
                                        <CodeIcon size={40} className="text-[#c8ff64]" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                            Generate Integration Code
                                        </h3>
                                        <p className="text-sm text-white/50 max-w-md">
                                            We'll generate a type-safe TypeScript service with error handling,
                                            rate limiting, and usage examples.
                                        </p>
                                    </div>
                                    <button
                                        onClick={generateCode}
                                        disabled={isLoading}
                                        className="px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                                        style={{ background: accentColor, color: 'black' }}
                                    >
                                        {isLoading ? (
                                            <LoadingIcon size={16} className="animate-spin" />
                                        ) : (
                                            <CodeIcon size={16} />
                                        )}
                                        Generate Code
                                    </button>
                                </>
                            ) : (
                                <CodePreview code={generatedCode} />
                            )}
                        </motion.div>
                    )}

                    {/* Test step */}
                    {currentStep === 'test' && (
                        <motion.div
                            key="test"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <TestRunner
                                onTest={testConnection}
                                testResult={testResult}
                                isLoading={isLoading}
                            />
                        </motion.div>
                    )}

                    {/* Complete step */}
                    {currentStep === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full gap-6 text-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring' }}
                                className="w-20 h-20 rounded-full flex items-center justify-center"
                                style={{ background: accentColor }}
                            >
                                <CheckCircle2Icon size={40} className="text-black" />
                            </motion.div>
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">
                                    Integration Complete!
                                </h3>
                                <p className="text-sm text-white/50 max-w-md">
                                    Your {profile.name} integration is ready to use.
                                    The generated code has been added to your project.
                                </p>
                            </div>
                            {generatedCode && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(generatedCode.serviceContent)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                                    >
                                        <CopyIcon size={16} />
                                        Copy Code
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all"
                                        style={{ background: accentColor, color: 'black' }}
                                    >
                                        <CheckIcon size={16} />
                                        Done
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer navigation */}
            {currentStep !== 'complete' && (
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <button
                        onClick={currentStepIndex === 0 ? onCancel : () => setCurrentStep(STEPS[currentStepIndex - 1].id)}
                        className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon size={16} />
                        {currentStepIndex === 0 ? 'Cancel' : 'Back'}
                    </button>

                    {currentStep === 'generate' && generatedCode && (
                        <button
                            onClick={() => setCurrentStep('test')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
                            style={{ background: accentColor, color: 'black' }}
                        >
                            Continue
                            <ArrowRightIcon size={16} />
                        </button>
                    )}

                    {currentStep === 'test' && testResult && !testResult.success && (
                        <button
                            onClick={() => setCurrentStep('credentials')}
                            className="flex items-center gap-2 px-4 py-2 text-orange-400 hover:text-orange-300 transition-colors"
                        >
                            Update Credentials
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}


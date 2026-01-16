/**
 * Credential Setup Component for Open Source Studio
 *
 * Guides users through setting up necessary credentials for:
 * - RunPod (GPU deployment)
 * - Modal (alternative GPU provider)
 * - HuggingFace (model access)
 * - GitHub (repo integration)
 *
 * Uses GuidedCredentialEntry for step-by-step guidance.
 * 3D Photorealistic Liquid Glass Design System.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GuidedCredentialEntry, hasGuidedSetup, getPlatformGuide } from '../credentials/GuidedCredentialEntry';
import './CredentialSetup.css';

// =============================================================================
// TYPES
// =============================================================================

interface CredentialStatus {
    platform: string;
    isConfigured: boolean;
    isRequired: boolean;
    description: string;
    envVars: string[];
}

interface CredentialSetupProps {
    requiredPlatforms?: string[];
    onComplete?: (credentials: Record<string, Record<string, string>>) => void;
    onSkip?: () => void;
}

// =============================================================================
// ICONS (Custom SVG)
// =============================================================================

const CheckCircleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const AlertCircleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
);

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const GpuIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor" />
        <rect x="13" y="7" width="4" height="4" rx="1" fill="currentColor" />
        <rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor" />
        <rect x="13" y="13" width="4" height="4" rx="1" fill="currentColor" />
        <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="14" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

// =============================================================================
// CREDENTIAL PLATFORMS CONFIG
// =============================================================================

const CREDENTIAL_PLATFORMS: CredentialStatus[] = [
    {
        platform: 'runpod',
        isConfigured: false,
        isRequired: true,
        description: 'Deploy ML models to serverless GPU endpoints',
        envVars: ['RUNPOD_API_KEY'],
    },
    {
        platform: 'huggingface',
        isConfigured: false,
        isRequired: true,
        description: 'Access open-source models and datasets',
        envVars: ['HUGGINGFACE_TOKEN'],
    },
    {
        platform: 'github',
        isConfigured: false,
        isRequired: false,
        description: 'Push trained models and code to repositories',
        envVars: ['GITHUB_TOKEN'],
    },
    {
        platform: 'modal',
        isConfigured: false,
        isRequired: false,
        description: 'Alternative GPU provider for model deployment',
        envVars: ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'],
    },
    {
        platform: 'docker',
        isConfigured: false,
        isRequired: false,
        description: 'Container registry for custom model images',
        envVars: ['DOCKER_USERNAME', 'DOCKER_ACCESS_TOKEN'],
    },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function CredentialSetup({
    requiredPlatforms = ['runpod', 'huggingface'],
    onComplete,
    onSkip,
}: CredentialSetupProps) {
    const [platforms, setPlatforms] = useState<CredentialStatus[]>([]);
    const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
    const [collectedCredentials, setCollectedCredentials] = useState<Record<string, Record<string, string>>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Initialize platforms with status check
    useEffect(() => {
        const initializePlatforms = async () => {
            setIsLoading(true);
            try {
                // Check existing credentials from the vault
                const response = await fetch('/api/credentials/status', {
                    credentials: 'include',
                });

                let configuredPlatforms: string[] = [];
                if (response.ok) {
                    const data = await response.json();
                    configuredPlatforms = data.configured || [];
                }

                // Update platforms with configured status
                const updatedPlatforms = CREDENTIAL_PLATFORMS.map(p => ({
                    ...p,
                    isConfigured: configuredPlatforms.includes(p.platform),
                    isRequired: requiredPlatforms.includes(p.platform),
                }));

                setPlatforms(updatedPlatforms);

                // Auto-expand first unconfigured required platform
                const firstUnconfigured = updatedPlatforms.find(p => p.isRequired && !p.isConfigured);
                if (firstUnconfigured) {
                    setExpandedPlatform(firstUnconfigured.platform);
                }
            } catch (error) {
                console.error('[CredentialSetup] Failed to check credential status:', error);
                // Set defaults
                setPlatforms(CREDENTIAL_PLATFORMS.map(p => ({
                    ...p,
                    isRequired: requiredPlatforms.includes(p.platform),
                })));
            } finally {
                setIsLoading(false);
            }
        };

        initializePlatforms();
    }, [requiredPlatforms]);

    // Handle credential submission
    const handleCredentialsSubmit = useCallback(async (platform: string, credentials: Record<string, string>) => {
        try {
            // Save credentials to the vault
            const response = await fetch('/api/credentials/save', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform,
                    credentials,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save credentials');
            }

            // Update local state
            setCollectedCredentials(prev => ({
                ...prev,
                [platform]: credentials,
            }));

            setPlatforms(prev => prev.map(p =>
                p.platform === platform ? { ...p, isConfigured: true } : p
            ));

            // Collapse this platform and expand next unconfigured
            setExpandedPlatform(null);
            
            // Find next unconfigured required platform
            setTimeout(() => {
                const nextPlatform = platforms.find(p => 
                    p.isRequired && !p.isConfigured && p.platform !== platform
                );
                if (nextPlatform) {
                    setExpandedPlatform(nextPlatform.platform);
                }
            }, 300);
        } catch (error) {
            console.error('[CredentialSetup] Failed to save credentials:', error);
        }
    }, [platforms]);

    // Check if all required platforms are configured
    const isComplete = platforms
        .filter(p => p.isRequired)
        .every(p => p.isConfigured || collectedCredentials[p.platform]);

    const configuredCount = platforms.filter(p => p.isConfigured || collectedCredentials[p.platform]).length;
    const requiredCount = platforms.filter(p => p.isRequired).length;

    // Handle completion
    const handleComplete = useCallback(() => {
        onComplete?.(collectedCredentials);
    }, [collectedCredentials, onComplete]);

    if (isLoading) {
        return (
            <div className="credential-setup credential-setup--loading">
                <div className="credential-setup__spinner" />
                <p>Checking credentials...</p>
            </div>
        );
    }

    return (
        <div className="credential-setup">
            {/* Header */}
            <div className="credential-setup__header">
                <div className="credential-setup__header-icon">
                    <GpuIcon />
                </div>
                <div className="credential-setup__header-content">
                    <h3>Configure GPU & Model Access</h3>
                    <p>
                        Set up credentials to deploy models, access HuggingFace, and more.
                        Required credentials are marked with a star.
                    </p>
                </div>
                {onSkip && (
                    <button className="credential-setup__skip-btn" onClick={onSkip}>
                        <CloseIcon />
                    </button>
                )}
            </div>

            {/* Progress */}
            <div className="credential-setup__progress">
                <div className="credential-setup__progress-bar">
                    <motion.div
                        className="credential-setup__progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${(configuredCount / platforms.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <span className="credential-setup__progress-text">
                    {configuredCount} of {platforms.length} configured
                    {requiredCount > 0 && ` (${requiredCount} required)`}
                </span>
            </div>

            {/* Platform List */}
            <div className="credential-setup__platforms">
                {platforms.map((platform) => {
                    const guide = getPlatformGuide(platform.platform);
                    const isConfiguredOrCollected = platform.isConfigured || collectedCredentials[platform.platform];
                    const isExpanded = expandedPlatform === platform.platform;

                    return (
                        <div
                            key={platform.platform}
                            className={`credential-setup__platform ${isConfiguredOrCollected ? 'credential-setup__platform--configured' : ''} ${isExpanded ? 'credential-setup__platform--expanded' : ''}`}
                        >
                            {/* Platform Header */}
                            <div
                                className="credential-setup__platform-header"
                                onClick={() => setExpandedPlatform(isExpanded ? null : platform.platform)}
                            >
                                <div className="credential-setup__platform-icon" style={{
                                    background: `${guide?.iconColor || '#666'}20`,
                                    borderColor: `${guide?.iconColor || '#666'}40`,
                                }}>
                                    <span style={{ color: guide?.iconColor || '#fff' }}>
                                        {guide?.platformName.charAt(0) || platform.platform.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="credential-setup__platform-info">
                                    <div className="credential-setup__platform-name">
                                        {guide?.platformName || platform.platform}
                                        {platform.isRequired && (
                                            <span className="credential-setup__required-badge">Required</span>
                                        )}
                                    </div>
                                    <div className="credential-setup__platform-desc">
                                        {platform.description}
                                    </div>
                                </div>
                                <div className={`credential-setup__platform-status ${isConfiguredOrCollected ? 'credential-setup__platform-status--success' : ''}`}>
                                    {isConfiguredOrCollected ? (
                                        <CheckCircleIcon />
                                    ) : (
                                        <AlertCircleIcon />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            <AnimatePresence>
                                {isExpanded && hasGuidedSetup(platform.platform) && (
                                    <motion.div
                                        className="credential-setup__platform-content"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <GuidedCredentialEntry
                                            platformName={platform.platform}
                                            requiredEnvVars={platform.envVars}
                                            onCredentialsSubmit={(creds) => handleCredentialsSubmit(platform.platform, creds)}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="credential-setup__footer">
                <p className="credential-setup__footer-note">
                    Credentials are encrypted and stored securely in your credential vault.
                </p>
                <div className="credential-setup__footer-actions">
                    {onSkip && (
                        <button
                            className="credential-setup__btn credential-setup__btn--secondary"
                            onClick={onSkip}
                        >
                            Skip for Now
                        </button>
                    )}
                    <button
                        className={`credential-setup__btn credential-setup__btn--primary ${isComplete ? '' : 'credential-setup__btn--disabled'}`}
                        disabled={!isComplete}
                        onClick={handleComplete}
                    >
                        {isComplete ? 'Continue' : 'Complete Required Setup'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CredentialSetup;

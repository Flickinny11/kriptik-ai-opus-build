/**
 * DependencyConnectionView Component
 *
 * Premium 3D photorealistic liquid glass container view for connecting dependencies.
 * Displays all required integrations as tiles with connection status.
 *
 * Styling Requirements:
 * - 3D photorealistic liquid glass with texture and transparency
 * - Layered shadows with visible edges and depth
 * - Warm amber/copper accent gradients (NO green/black)
 * - High frame rate smooth animations
 * - No Lucide React icons, no emojis
 */

import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DependencyTile, DependencyData, CredentialField } from './DependencyTile';
import { Integration, INTEGRATION_CATALOG } from '../../../lib/integrations/catalog';

// =============================================================================
// Types
// =============================================================================

export interface DependencyConnectionViewProps {
    /** List of integration IDs required for this build */
    requiredIntegrations: string[];
    /** Build ID for credential vault storage */
    buildId: string;
    /** Current connected integrations (from credential vault) */
    connectedIntegrations: Set<string>;
    /** Callback when user saves credentials manually */
    onCredentialsSaved: (integrationId: string, credentials: Record<string, string>) => Promise<void>;
    /** Callback when user connects via Nango OAuth */
    onNangoConnect: (integrationId: string) => Promise<void>;
    /** Callback when all dependencies are connected and user clicks continue */
    onContinue: () => void;
    /** Loading state for continue button */
    continueLoading?: boolean;
    /** Optional header text override */
    headerText?: string;
}

// Map of integrations that support Nango OAuth
const NANGO_SUPPORTED_INTEGRATIONS: Record<string, string> = {
    'github': 'github',
    'stripe': 'stripe',
    'slack': 'slack',
    'notion': 'notion',
    'airtable': 'airtable',
    'hubspot': 'hubspot',
    'salesforce': 'salesforce',
    'google-cloud': 'google',
    'linear': 'linear',
    'figma': 'figma',
    'discord': 'discord-oauth',
    'twilio': 'twilio',
    'sendgrid': 'sendgrid',
    'mailchimp': 'mailchimp',
    'shopify': 'shopify',
    'google-analytics': 'google-analytics',
    'twitter': 'twitter',
    'instagram': 'instagram',
    'facebook': 'facebook',
    'linkedin': 'linkedin',
    'zoom': 'zoom',
    'calendly': 'calendly',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Integration from catalog to DependencyData for tile
 */
function integrationToDependencyData(integration: Integration): DependencyData {
    const credentialsNeeded: CredentialField[] = integration.credentials.map(cred => ({
        key: cred.key,
        label: cred.label,
        type: cred.type === 'secret' ? 'password' : 'text',
        placeholder: cred.placeholder || `Enter ${cred.label}`,
        helpText: cred.helpUrl ? `Get this from ${new URL(cred.helpUrl).hostname}` : undefined,
    }));

    const nangoIntegrationId = NANGO_SUPPORTED_INTEGRATIONS[integration.id];

    return {
        id: integration.id,
        name: integration.name,
        iconId: integration.iconId,
        description: integration.description,
        nangoSupported: !!nangoIntegrationId,
        nangoIntegrationId,
        credentialsNeeded,
        platformUrl: integration.docsUrl,
    };
}

// =============================================================================
// Component
// =============================================================================

export const DependencyConnectionView: React.FC<DependencyConnectionViewProps> = ({
    requiredIntegrations,
    buildId: _buildId,
    connectedIntegrations,
    onCredentialsSaved,
    onNangoConnect,
    onContinue,
    continueLoading = false,
    headerText = 'Connect Your Integrations',
}) => {
    const [connectingIntegration, setConnectingIntegration] = useState<string | null>(null);

    // Get integration data from catalog
    const dependencies = useMemo(() => {
        return requiredIntegrations
            .map(id => {
                const integration = INTEGRATION_CATALOG.find(i => i.id === id);
                if (!integration) {
                    console.warn(`[DependencyConnectionView] Integration not found: ${id}`);
                    return null;
                }
                return integrationToDependencyData(integration);
            })
            .filter((d): d is DependencyData => d !== null);
    }, [requiredIntegrations]);

    // Count connected vs total
    const connectedCount = useMemo(() => {
        return requiredIntegrations.filter(id => connectedIntegrations.has(id)).length;
    }, [requiredIntegrations, connectedIntegrations]);

    const totalCount = requiredIntegrations.length;
    const allConnected = connectedCount === totalCount && totalCount > 0;

    // Handle Nango connection
    const handleNangoConnect = useCallback(async (integrationId: string) => {
        setConnectingIntegration(integrationId);
        try {
            await onNangoConnect(integrationId);
        } finally {
            setConnectingIntegration(null);
        }
    }, [onNangoConnect]);

    // Handle manual credential save
    const handleCredentialsSaved = useCallback(async (
        integrationId: string,
        credentials: Record<string, string>
    ) => {
        setConnectingIntegration(integrationId);
        try {
            await onCredentialsSaved(integrationId, credentials);
        } finally {
            setConnectingIntegration(null);
        }
    }, [onCredentialsSaved]);

    // Progress percentage for visual
    const progressPercent = totalCount > 0 ? (connectedCount / totalCount) * 100 : 0;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                minHeight: '100vh',
                padding: '48px 40px',
                overflow: 'auto',
                // Deep space gradient background
                background: `
                    radial-gradient(ellipse at 20% 0%, rgba(180, 120, 80, 0.08) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 100%, rgba(160, 100, 60, 0.06) 0%, transparent 50%),
                    linear-gradient(180deg,
                        rgba(18, 18, 28, 0.98) 0%,
                        rgba(12, 12, 20, 0.99) 50%,
                        rgba(8, 8, 14, 1) 100%
                    )
                `,
            }}
        >
            {/* Subtle noise texture overlay */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    opacity: 0.015,
                    pointerEvents: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Header Card - Premium 3D Liquid Glass */}
            <motion.div
                initial={{ opacity: 0, y: -30, rotateX: 10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    position: 'relative',
                    marginBottom: '48px',
                    padding: '36px 44px',
                    borderRadius: '28px',
                    // Multi-layer glass effect
                    background: `
                        linear-gradient(135deg,
                            rgba(255, 255, 255, 0.07) 0%,
                            rgba(255, 255, 255, 0.02) 40%,
                            rgba(255, 255, 255, 0.04) 100%
                        )
                    `,
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    // 3D edge highlights
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    // Layered shadow stack for depth
                    boxShadow: `
                        0 1px 0 0 rgba(255, 255, 255, 0.08) inset,
                        0 -1px 0 0 rgba(0, 0, 0, 0.1) inset,
                        0 4px 8px -2px rgba(0, 0, 0, 0.2),
                        0 8px 16px -4px rgba(0, 0, 0, 0.25),
                        0 16px 32px -8px rgba(0, 0, 0, 0.3),
                        0 32px 64px -16px rgba(0, 0, 0, 0.35),
                        0 0 80px -20px rgba(200, 150, 100, 0.1)
                    `,
                    transformStyle: 'preserve-3d',
                    perspective: '1000px',
                }}
            >
                {/* Glass highlight streak */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: '10%',
                        right: '10%',
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                        borderRadius: '1px',
                    }}
                />

                {/* Inner glow */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '28px',
                        background: `radial-gradient(ellipse at 30% 20%, rgba(255, 200, 150, 0.04) 0%, transparent 50%)`,
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: '30px',
                                fontWeight: 700,
                                letterSpacing: '-0.5px',
                                // Warm gradient text
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 220, 180, 0.9) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            }}
                        >
                            {headerText}
                        </h2>
                        <p
                            style={{
                                margin: '10px 0 0',
                                fontSize: '15px',
                                color: 'rgba(255, 255, 255, 0.55)',
                                fontWeight: 400,
                                letterSpacing: '0.1px',
                            }}
                        >
                            {allConnected
                                ? 'All integrations connected. Ready to continue.'
                                : `Connect each integration to proceed with your build.`
                            }
                        </p>
                    </div>

                    {/* Progress Indicator */}
                    <div style={{ textAlign: 'right' }}>
                        <div
                            style={{
                                fontSize: '36px',
                                fontWeight: 800,
                                letterSpacing: '-2px',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                                // Amber gradient for progress numbers
                                background: allConnected
                                    ? 'linear-gradient(135deg, #FFD699 0%, #F5A623 50%, #E88B10 100%)'
                                    : 'linear-gradient(135deg, #FFE4C4 0%, #FFB366 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {connectedCount} / {totalCount}
                        </div>
                        <div
                            style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.4)',
                                marginTop: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '1.5px',
                                fontWeight: 500,
                            }}
                        >
                            connected
                        </div>

                        {/* Progress Bar - 3D glass effect */}
                        <div
                            style={{
                                width: '180px',
                                height: '8px',
                                marginTop: '16px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                overflow: 'hidden',
                                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
                            }}
                        >
                            <motion.div
                                style={{
                                    height: '100%',
                                    borderRadius: '3px',
                                    // Warm amber gradient - NO GREEN
                                    background: allConnected
                                        ? 'linear-gradient(90deg, #F5A623 0%, #FFB84D 50%, #FFD699 100%)'
                                        : 'linear-gradient(90deg, #E88B10 0%, #F5A623 50%, #FFB84D 100%)',
                                    boxShadow: allConnected
                                        ? '0 0 16px rgba(245, 166, 35, 0.5), 0 0 32px rgba(245, 166, 35, 0.25)'
                                        : '0 0 12px rgba(245, 166, 35, 0.4)',
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Dependency Tiles Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                    gap: '28px',
                    marginBottom: '48px',
                }}
            >
                <AnimatePresence mode="popLayout">
                    {dependencies.map((dep, index) => {
                        // Don't render connected tiles (they've exploded away)
                        if (connectedIntegrations.has(dep.id)) {
                            return null;
                        }

                        return (
                            <motion.div
                                key={dep.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                                transition={{
                                    duration: 0.5,
                                    delay: index * 0.08,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                            >
                                <DependencyTile
                                    dependency={dep}
                                    isConnecting={connectingIntegration === dep.id}
                                    onConnected={handleNangoConnect}
                                    onCredentialsSaved={handleCredentialsSaved}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* All Connected Success Message - Amber themed */}
            <AnimatePresence>
                {allConnected && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            textAlign: 'center',
                            padding: '48px',
                            marginBottom: '40px',
                            borderRadius: '24px',
                            // Warm amber glow background
                            background: `
                                linear-gradient(135deg,
                                    rgba(245, 166, 35, 0.08) 0%,
                                    rgba(232, 139, 16, 0.04) 100%
                                )
                            `,
                            border: '1px solid rgba(245, 166, 35, 0.2)',
                            boxShadow: `
                                0 0 60px -20px rgba(245, 166, 35, 0.3),
                                inset 0 1px 0 rgba(255, 255, 255, 0.05)
                            `,
                        }}
                    >
                        {/* Success icon */}
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                            style={{
                                width: '64px',
                                height: '64px',
                                margin: '0 auto 20px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.2) 0%, rgba(232, 139, 16, 0.15) 100%)',
                                border: '2px solid rgba(245, 166, 35, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M20 6L9 17L4 12"
                                    stroke="#F5A623"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </motion.div>
                        <div
                            style={{
                                fontSize: '26px',
                                fontWeight: 700,
                                marginBottom: '10px',
                                background: 'linear-gradient(135deg, #FFD699 0%, #F5A623 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            All Integrations Connected
                        </div>
                        <div
                            style={{
                                fontSize: '15px',
                                color: 'rgba(255, 255, 255, 0.55)',
                            }}
                        >
                            Your credentials have been securely stored in the vault.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Continue Button - Premium 3D liquid glass */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 48px' }}>
                <motion.button
                    style={{
                        position: 'relative',
                        padding: '20px 56px',
                        fontSize: '16px',
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                        borderRadius: '18px',
                        border: 'none',
                        cursor: allConnected ? 'pointer' : 'not-allowed',
                        // Premium button styling
                        background: allConnected
                            ? 'linear-gradient(135deg, #F5A623 0%, #E88B10 50%, #D4790A 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                        color: allConnected ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.35)',
                        boxShadow: allConnected
                            ? `
                                0 4px 12px -2px rgba(245, 166, 35, 0.4),
                                0 8px 24px -4px rgba(232, 139, 16, 0.3),
                                0 16px 48px -8px rgba(200, 120, 10, 0.25),
                                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                            `
                            : `
                                0 2px 8px rgba(0, 0, 0, 0.15),
                                inset 0 1px 0 rgba(255, 255, 255, 0.05)
                            `,
                        opacity: allConnected ? 1 : 0.5,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                    whileHover={allConnected ? {
                        scale: 1.03,
                        y: -2,
                        boxShadow: `
                            0 6px 16px -2px rgba(245, 166, 35, 0.5),
                            0 12px 32px -4px rgba(232, 139, 16, 0.4),
                            0 24px 64px -8px rgba(200, 120, 10, 0.3),
                            inset 0 1px 0 rgba(255, 255, 255, 0.25),
                            inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                        `,
                    } : {}}
                    whileTap={allConnected ? { scale: 0.98, y: 0 } : {}}
                    onClick={onContinue}
                    disabled={!allConnected || continueLoading}
                >
                    {/* Button shine effect */}
                    {allConnected && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '50%',
                                borderRadius: '18px 18px 0 0',
                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%)',
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                    {continueLoading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                style={{ display: 'inline-block', width: '18px', height: '18px' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                                </svg>
                            </motion.span>
                            Installing Dependencies...
                        </span>
                    ) : (
                        'Save and Continue'
                    )}
                </motion.button>
            </div>

            {/* Pending count hint */}
            {!allConnected && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        textAlign: 'center',
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.35)',
                        marginTop: '-24px',
                        fontWeight: 400,
                    }}
                >
                    {totalCount - connectedCount} integration{totalCount - connectedCount !== 1 ? 's' : ''} remaining
                </motion.div>
            )}
        </div>
    );
};

export default DependencyConnectionView;

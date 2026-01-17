/**
 * DependencyConnectionView Component
 *
 * Premium 3D liquid glass container view for connecting dependencies.
 * Displays all required integrations as tiles with connection status.
 *
 * Features:
 * - Responsive grid layout for dependency tiles
 * - Progress tracking (X of Y connected)
 * - "Continue and Install Dependencies" button when all connected
 * - Premium translucent glass styling
 * - Smooth animations via Framer Motion
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
function integrationToDependencyData(
    integration: Integration
): DependencyData {
    const credentialsNeeded: CredentialField[] = integration.credentials.map(cred => ({
        key: cred.key,
        label: cred.label,
        type: cred.type === 'secret' ? 'password' : 'text',
        placeholder: cred.placeholder || `Enter ${cred.label}`,
        required: cred.required,
        helpUrl: cred.helpUrl,
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
// Liquid Glass Styles
// =============================================================================

const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%)',
    padding: '40px',
    overflow: 'auto',
};

const headerCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '32px 40px',
    marginBottom: '40px',
    boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 60px rgba(255, 200, 150, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
};

const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '24px',
    marginBottom: '40px',
};

const continueButtonStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px 0 40px',
};

const buttonBaseStyle: React.CSSProperties = {
    padding: '18px 48px',
    fontSize: '16px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

// =============================================================================
// Component
// =============================================================================

export const DependencyConnectionView: React.FC<DependencyConnectionViewProps> = ({
    requiredIntegrations,
    buildId: _buildId, // Reserved for credential vault operations
    connectedIntegrations,
    onCredentialsSaved,
    onNangoConnect,
    onContinue,
    continueLoading = false,
    headerText = 'Connect Your Dependencies',
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
    }, [requiredIntegrations, connectedIntegrations]);

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
        <div style={containerStyle}>
            {/* Header Card */}
            <motion.div
                style={headerCardStyle}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            margin: 0,
                            fontSize: '28px',
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.95)',
                            letterSpacing: '-0.5px',
                        }}>
                            {headerText}
                        </h2>
                        <p style={{
                            margin: '8px 0 0',
                            fontSize: '15px',
                            color: 'rgba(255, 255, 255, 0.6)',
                        }}>
                            {allConnected
                                ? 'All dependencies connected. Ready to continue.'
                                : `Connect each integration to proceed with your build.`
                            }
                        </p>
                    </div>

                    {/* Progress Indicator */}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: 700,
                            color: allConnected ? 'rgba(120, 255, 150, 0.95)' : 'rgba(255, 200, 150, 0.95)',
                            letterSpacing: '-1px',
                        }}>
                            {connectedCount} / {totalCount}
                        </div>
                        <div style={{
                            fontSize: '13px',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginTop: '4px',
                        }}>
                            connected
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                            width: '160px',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '3px',
                            marginTop: '12px',
                            overflow: 'hidden',
                        }}>
                            <motion.div
                                style={{
                                    height: '100%',
                                    borderRadius: '3px',
                                    background: allConnected
                                        ? 'linear-gradient(90deg, rgba(120, 255, 150, 0.8), rgba(100, 220, 130, 0.9))'
                                        : 'linear-gradient(90deg, rgba(255, 200, 150, 0.8), rgba(255, 150, 100, 0.9))',
                                    boxShadow: allConnected
                                        ? '0 0 12px rgba(120, 255, 150, 0.4)'
                                        : '0 0 12px rgba(255, 180, 120, 0.4)',
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Dependency Tiles Grid */}
            <div style={gridStyle}>
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
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                    duration: 0.4,
                                    delay: index * 0.05,
                                    ease: [0.4, 0, 0.2, 1],
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

            {/* All Connected Message */}
            <AnimatePresence>
                {allConnected && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{
                            textAlign: 'center',
                            padding: '40px',
                            background: 'linear-gradient(135deg, rgba(120, 255, 150, 0.08) 0%, rgba(100, 220, 130, 0.04) 100%)',
                            borderRadius: '20px',
                            border: '1px solid rgba(120, 255, 150, 0.2)',
                            marginBottom: '32px',
                        }}
                    >
                        <div style={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: 'rgba(120, 255, 150, 0.95)',
                            marginBottom: '8px',
                        }}>
                            All Dependencies Connected
                        </div>
                        <div style={{
                            fontSize: '15px',
                            color: 'rgba(255, 255, 255, 0.6)',
                        }}>
                            Your credentials have been securely stored in the vault.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Continue Button */}
            <div style={continueButtonStyle}>
                <motion.button
                    style={{
                        ...buttonBaseStyle,
                        background: allConnected
                            ? 'linear-gradient(135deg, rgba(120, 255, 150, 0.9) 0%, rgba(100, 220, 130, 0.95) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                        color: allConnected ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                        boxShadow: allConnected
                            ? '0 8px 32px rgba(120, 255, 150, 0.3), 0 0 40px rgba(120, 255, 150, 0.15)'
                            : '0 4px 16px rgba(0, 0, 0, 0.2)',
                        opacity: allConnected ? 1 : 0.5,
                        pointerEvents: allConnected ? 'auto' : 'none',
                    }}
                    whileHover={allConnected ? {
                        scale: 1.02,
                        boxShadow: '0 12px 40px rgba(120, 255, 150, 0.4), 0 0 60px rgba(120, 255, 150, 0.2)',
                    } : {}}
                    whileTap={allConnected ? { scale: 0.98 } : {}}
                    onClick={onContinue}
                    disabled={!allConnected || continueLoading}
                >
                    {continueLoading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                style={{ display: 'inline-block' }}
                            >
                                ◌
                            </motion.span>
                            Installing Dependencies...
                        </span>
                    ) : (
                        'Continue and Install Dependencies'
                    )}
                </motion.button>
            </div>

            {/* Pending count hint */}
            {!allConnected && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        textAlign: 'center',
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        marginTop: '-20px',
                    }}
                >
                    {totalCount - connectedCount} integration{totalCount - connectedCount !== 1 ? 's' : ''} remaining
                </motion.div>
            )}
        </div>
    );
};

export default DependencyConnectionView;

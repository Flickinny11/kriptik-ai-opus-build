/**
 * Enhanced Credential Manager Component
 *
 * Comprehensive UI for managing integration credentials including:
 * - HuggingFace token (with write access validation)
 * - RunPod API key (with balance display)
 * - Cost tracking integration
 * - Audit logs
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch } from '../../lib/api-config';
import './CredentialManager.css';

// ============================================================================
// TYPES
// ============================================================================

interface Credential {
    id: string;
    integrationId: string;
    integrationName: string;
    connectionName?: string;
    isActive: boolean;
    validationStatus: 'pending' | 'valid' | 'invalid' | 'expired';
    lastUsedAt?: string;
    lastValidatedAt?: string;
    createdAt: string;
    oauthProvider?: string;
    maskedData?: Record<string, string>;
}

interface CostSummary {
    period: string;
    totalCostCents: number;
    totalFormatted: string;
    breakdown: {
        training: string;
        inference: string;
        storage: string;
        api: string;
    };
}

interface BudgetAlert {
    level: 'warning' | 'critical' | 'exceeded';
    threshold: number;
    currentSpend: number;
    budgetLimit: number;
    message: string;
}

// ============================================================================
// CREDENTIAL ICONS
// ============================================================================

const CredentialIcons: Record<string, React.FC<{ className?: string }>> = {
    huggingface: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
            <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
            <path d="M12 15c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z" fill="currentColor"/>
        </svg>
    ),
    runpod: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M4 4h16v16H4V4z" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 8h8v8H8V8z" fill="currentColor"/>
            <path d="M10 10h4v4h-4v-4z" fill="var(--credential-bg)"/>
        </svg>
    ),
    default: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" stroke="currentColor" strokeWidth="2"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface CredentialManagerProps {
    onClose?: () => void;
    focusedCredential?: 'huggingface' | 'runpod';
}

export const CredentialManager: React.FC<CredentialManagerProps> = ({
    onClose,
    focusedCredential,
}) => {
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
    const [budgetAlert, setBudgetAlert] = useState<BudgetAlert | null>(null);
    const [, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'credentials' | 'costs' | 'audit'>('credentials');
    const [addingCredential, setAddingCredential] = useState<string | null>(focusedCredential || null);
    const [tokenInput, setTokenInput] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Fetch credentials on mount
    useEffect(() => {
        fetchCredentials();
        fetchCostSummary();
        checkBudgetAlerts();
    }, []);

    const fetchCredentials = async () => {
        try {
            const response = await authenticatedFetch('/api/credentials');
            const data = await response.json();
            if (data.credentials) {
                setCredentials(data.credentials);
            }
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to load credentials');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCostSummary = async () => {
        try {
            const response = await authenticatedFetch('/api/gpu-costs/summary?period=month');
            const data = await response.json();
            if (data.success) {
                setCostSummary(data.summary);
            }
        } catch (err) {
            console.error('Error fetching cost summary:', err);
        }
    };

    const checkBudgetAlerts = async () => {
        try {
            const response = await authenticatedFetch('/api/gpu-costs/budget/alerts');
            const data = await response.json();
            if (data.hasAlert) {
                setBudgetAlert(data.alert);
            }
        } catch (err) {
            console.error('Error checking budget alerts:', err);
        }
    };

    const handleAddCredential = async (integrationId: string, token: string) => {
        setIsValidating(true);
        setError(null);

        try {
            // Different validation endpoints for different integrations
            if (integrationId === 'huggingface') {
                const response = await authenticatedFetch('/api/huggingface/validate-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Invalid HuggingFace token');
                }
                
                if (!data.userInfo.hasWriteAccess) {
                    throw new Error('Token requires write access for training. Please generate a token with write permissions.');
                }
            } else if (integrationId === 'runpod') {
                // Store RunPod API key
                const response = await authenticatedFetch(`/api/credentials/${integrationId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        credentials: { RUNPOD_API_KEY: token },
                        connectionName: 'RunPod API',
                    }),
                });
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to store RunPod API key');
                }
            }

            // Refresh credentials list
            await fetchCredentials();
            setAddingCredential(null);
            setTokenInput('');
        } catch (err: any) {
            setError(err.message || 'Failed to add credential');
        } finally {
            setIsValidating(false);
        }
    };

    const handleDeleteCredential = async (integrationId: string) => {
        try {
            if (integrationId === 'huggingface') {
                await authenticatedFetch('/api/huggingface/disconnect', {
                    method: 'POST',
                });
            } else {
                await authenticatedFetch(`/api/credentials/${integrationId}`, {
                    method: 'DELETE',
                });
            }
            await fetchCredentials();
        } catch (err) {
            console.error('Error deleting credential:', err);
            setError('Failed to delete credential');
        }
    };

    const handleTestCredential = async (integrationId: string) => {
        try {
            const response = await authenticatedFetch(`/api/credentials/${integrationId}/test`, {
                method: 'POST',
            });
            const data = await response.json();
            await fetchCredentials();
            
            if (!data.valid) {
                setError(data.error || 'Credential validation failed');
            }
        } catch (err) {
            console.error('Error testing credential:', err);
            setError('Failed to test credential');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'valid': return 'var(--credential-status-valid)';
            case 'invalid': return 'var(--credential-status-invalid)';
            case 'expired': return 'var(--credential-status-expired)';
            default: return 'var(--credential-status-pending)';
        }
    };

    const renderIcon = (integrationId: string) => {
        const Icon = CredentialIcons[integrationId] || CredentialIcons.default;
        return <Icon className="credential-icon" />;
    };

    // GPU-specific credentials for the AI Lab
    const gpuCredentials = ['huggingface', 'runpod'];
    const hasHuggingFace = credentials.some(c => c.integrationId === 'huggingface' && c.isActive);
    const hasRunPod = credentials.some(c => c.integrationId === 'runpod' && c.isActive);

    return (
        <div className="credential-manager">
            {/* Header */}
            <div className="credential-manager-header">
                <div className="credential-manager-title">
                    <svg viewBox="0 0 24 24" fill="none" className="credential-manager-icon">
                        <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 7v4M12 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <h2>Credential Manager</h2>
                </div>
                {onClose && (
                    <button className="credential-manager-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                )}
            </div>

            {/* Budget Alert */}
            <AnimatePresence>
                {budgetAlert && (
                    <motion.div
                        className={`budget-alert budget-alert-${budgetAlert.level}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="alert-icon">
                            <path d="M12 9v4M12 17h.01M4.93 19h14.14c1.14 0 1.86-1.24 1.29-2.22L13.29 4.15a1.5 1.5 0 0 0-2.58 0L3.64 16.78c-.57.98.15 2.22 1.29 2.22z" 
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span>{budgetAlert.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="credential-tabs">
                <button
                    className={`credential-tab ${activeTab === 'credentials' ? 'active' : ''}`}
                    onClick={() => setActiveTab('credentials')}
                >
                    Credentials
                </button>
                <button
                    className={`credential-tab ${activeTab === 'costs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('costs')}
                >
                    Cost Tracking
                </button>
                <button
                    className={`credential-tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    Audit Log
                </button>
            </div>

            {/* Error Display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        className="credential-error"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        {error}
                        <button onClick={() => setError(null)}>Dismiss</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="credential-content">
                {activeTab === 'credentials' && (
                    <div className="credentials-tab">
                        {/* GPU Credentials Section */}
                        <div className="credential-section">
                            <h3 className="section-title">AI Lab Credentials</h3>
                            <p className="section-description">
                                Required for training, fine-tuning, and deploying AI models.
                            </p>

                            {/* HuggingFace */}
                            <div className={`credential-card ${hasHuggingFace ? 'connected' : ''}`}>
                                <div className="credential-card-header">
                                    {renderIcon('huggingface')}
                                    <div className="credential-info">
                                        <h4>HuggingFace</h4>
                                        <p>Required for training and model uploads</p>
                                    </div>
                                    <div className="credential-status">
                                        {hasHuggingFace ? (
                                            <span className="status-badge valid">Connected</span>
                                        ) : (
                                            <span className="status-badge pending">Not Connected</span>
                                        )}
                                    </div>
                                </div>
                                {!hasHuggingFace && addingCredential !== 'huggingface' && (
                                    <button 
                                        className="credential-connect-btn"
                                        onClick={() => setAddingCredential('huggingface')}
                                    >
                                        Connect HuggingFace
                                    </button>
                                )}
                                {addingCredential === 'huggingface' && (
                                    <motion.div 
                                        className="credential-input-area"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                    >
                                        <input
                                            type="password"
                                            placeholder="Enter your HuggingFace token"
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            className="credential-input"
                                        />
                                        <p className="input-hint">
                                            Token must have write access. Get one at{' '}
                                            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">
                                                huggingface.co/settings/tokens
                                            </a>
                                        </p>
                                        <div className="input-actions">
                                            <button 
                                                className="btn-cancel"
                                                onClick={() => {
                                                    setAddingCredential(null);
                                                    setTokenInput('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                className="btn-connect"
                                                onClick={() => handleAddCredential('huggingface', tokenInput)}
                                                disabled={!tokenInput || isValidating}
                                            >
                                                {isValidating ? 'Validating...' : 'Connect'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                                {hasHuggingFace && (
                                    <div className="credential-actions">
                                        <button 
                                            className="btn-test"
                                            onClick={() => handleTestCredential('huggingface')}
                                        >
                                            Test Connection
                                        </button>
                                        <button 
                                            className="btn-disconnect"
                                            onClick={() => handleDeleteCredential('huggingface')}
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* RunPod */}
                            <div className={`credential-card ${hasRunPod ? 'connected' : ''}`}>
                                <div className="credential-card-header">
                                    {renderIcon('runpod')}
                                    <div className="credential-info">
                                        <h4>RunPod</h4>
                                        <p>Required for GPU training and inference</p>
                                    </div>
                                    <div className="credential-status">
                                        {hasRunPod ? (
                                            <span className="status-badge valid">Connected</span>
                                        ) : (
                                            <span className="status-badge pending">Not Connected</span>
                                        )}
                                    </div>
                                </div>
                                {!hasRunPod && addingCredential !== 'runpod' && (
                                    <button 
                                        className="credential-connect-btn"
                                        onClick={() => setAddingCredential('runpod')}
                                    >
                                        Connect RunPod
                                    </button>
                                )}
                                {addingCredential === 'runpod' && (
                                    <motion.div 
                                        className="credential-input-area"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                    >
                                        <input
                                            type="password"
                                            placeholder="Enter your RunPod API key"
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            className="credential-input"
                                        />
                                        <p className="input-hint">
                                            Get your API key at{' '}
                                            <a href="https://runpod.io/console/user/settings" target="_blank" rel="noopener noreferrer">
                                                runpod.io/console/user/settings
                                            </a>
                                        </p>
                                        <div className="input-actions">
                                            <button 
                                                className="btn-cancel"
                                                onClick={() => {
                                                    setAddingCredential(null);
                                                    setTokenInput('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                className="btn-connect"
                                                onClick={() => handleAddCredential('runpod', tokenInput)}
                                                disabled={!tokenInput || isValidating}
                                            >
                                                {isValidating ? 'Validating...' : 'Connect'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                                {hasRunPod && (
                                    <div className="credential-actions">
                                        <button 
                                            className="btn-test"
                                            onClick={() => handleTestCredential('runpod')}
                                        >
                                            Test Connection
                                        </button>
                                        <button 
                                            className="btn-disconnect"
                                            onClick={() => handleDeleteCredential('runpod')}
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Other Credentials */}
                        {credentials.filter(c => !gpuCredentials.includes(c.integrationId)).length > 0 && (
                            <div className="credential-section">
                                <h3 className="section-title">Other Integrations</h3>
                                <div className="credentials-list">
                                    {credentials
                                        .filter(c => !gpuCredentials.includes(c.integrationId))
                                        .map(credential => (
                                            <div key={credential.id} className="credential-item">
                                                {renderIcon(credential.integrationId)}
                                                <div className="credential-item-info">
                                                    <span className="credential-name">{credential.integrationName}</span>
                                                    <span 
                                                        className="credential-item-status"
                                                        style={{ color: getStatusColor(credential.validationStatus) }}
                                                    >
                                                        {credential.validationStatus}
                                                    </span>
                                                </div>
                                                <button 
                                                    className="btn-icon"
                                                    onClick={() => handleDeleteCredential(credential.integrationId)}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none">
                                                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                                                            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'costs' && (
                    <div className="costs-tab">
                        {costSummary ? (
                            <>
                                <div className="cost-overview">
                                    <div className="cost-total">
                                        <span className="cost-label">This Month</span>
                                        <span className="cost-value">{costSummary.totalFormatted}</span>
                                    </div>
                                </div>

                                <div className="cost-breakdown">
                                    <h4>Breakdown</h4>
                                    <div className="cost-breakdown-grid">
                                        <div className="cost-item">
                                            <span className="cost-item-label">Training</span>
                                            <span className="cost-item-value">{costSummary.breakdown.training}</span>
                                        </div>
                                        <div className="cost-item">
                                            <span className="cost-item-label">Inference</span>
                                            <span className="cost-item-value">{costSummary.breakdown.inference}</span>
                                        </div>
                                        <div className="cost-item">
                                            <span className="cost-item-label">Storage</span>
                                            <span className="cost-item-value">{costSummary.breakdown.storage}</span>
                                        </div>
                                        <div className="cost-item">
                                            <span className="cost-item-label">API Calls</span>
                                            <span className="cost-item-value">{costSummary.breakdown.api}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="cost-warnings">
                                    <div className="warning-item">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                        <span>RunPod volume storage charges apply while your model is stored.</span>
                                    </div>
                                    <div className="warning-item">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                        <span>Training costs are estimates. Actual costs depend on training convergence.</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="cost-empty">
                                <p>No cost data available yet. Start training or deploying models to track costs.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div className="audit-tab">
                        <p className="audit-description">
                            View recent credential operations for security monitoring.
                        </p>
                        {/* Audit log would be fetched from /api/credentials/audit */}
                        <div className="audit-placeholder">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            <span>Audit logging tracks all credential access for security compliance.</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CredentialManager;

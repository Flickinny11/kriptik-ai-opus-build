/**
 * Browser Agent Permissions UI
 *
 * Premium configuration panel for autonomous browser agent permissions.
 * Follows liquid glass styling with 3D depth and premium visuals.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './browser-agent-permissions.css';

import { API_URL } from '../../lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

type ApprovalMode = 'auto_approve' | 'confirm_each' | 'confirm_paid' | 'manual_only';
type ServiceCategory = 'database' | 'auth' | 'storage' | 'email' | 'payments' | 'hosting' | 'analytics' | 'ai' | 'other';
type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple' | 'facebook';

interface BrowserPermissions {
    id: string;
    userId: string;
    primaryEmail?: string;
    allowedEmails: string[];
    allow1PasswordAutofill: boolean;
    onePasswordVaultId?: string;
    allowedPaymentMethods: {
        id: string;
        type: 'credit_card' | 'bank_account' | 'paypal';
        lastFour?: string;
        expiryMonth?: number;
        expiryYear?: number;
        isDefault: boolean;
    }[];
    allowedOAuthProviders: OAuthProvider[];
    allowPersonalName: boolean;
    allowAddress: boolean;
    allowPhone: boolean;
    maxSpendPerSession: number;
    maxSpendPerMonth: number;
    spentThisMonth: number;
    allowedServiceCategories: ServiceCategory[];
    blockedServices: string[];
    approvalMode: ApprovalMode;
    recordAllActions: boolean;
    notifyOnAccountCreate: boolean;
    notifyOnPaymentUse: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (permissions: BrowserPermissions) => void;
}

// ============================================================================
// ICONS
// ============================================================================

const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const EmailIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const KeyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const CreditCardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
        <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2"/>
    </svg>
);

const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const DollarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const BellIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="permission-icon">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// ============================================================================
// COMPONENT
// ============================================================================

export const BrowserAgentPermissions: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const [permissions, setPermissions] = useState<BrowserPermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'email' | 'oauth' | 'payment' | 'personal' | 'services' | 'limits'>('email');

    // Form state
    const [primaryEmail, setPrimaryEmail] = useState('');
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
    const [selectedOAuth, setSelectedOAuth] = useState<OAuthProvider[]>([]);
    const [allowPersonalName, setAllowPersonalName] = useState(false);
    const [allowAddress, setAllowAddress] = useState(false);
    const [allowPhone, setAllowPhone] = useState(false);
    const [maxSpendSession, setMaxSpendSession] = useState(500);
    const [maxSpendMonth, setMaxSpendMonth] = useState(5000);
    const [selectedCategories, setSelectedCategories] = useState<ServiceCategory[]>([]);
    const [blockedServices, setBlockedServices] = useState('');
    const [approvalMode, setApprovalMode] = useState<ApprovalMode>('confirm_each');
    const [notifyOnCreate, setNotifyOnCreate] = useState(true);
    const [notifyOnPayment, setNotifyOnPayment] = useState(true);

    // Fetch permissions
    useEffect(() => {
        if (isOpen) {
            fetchPermissions();
        }
    }, [isOpen]);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/provisioning/permissions`, {
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.configured !== false) {
                    setPermissions(data);
                    // Populate form
                    setPrimaryEmail(data.primaryEmail || '');
                    setAdditionalEmails(data.allowedEmails || []);
                    setSelectedOAuth(data.allowedOAuthProviders || []);
                    setAllowPersonalName(data.allowPersonalName || false);
                    setAllowAddress(data.allowAddress || false);
                    setAllowPhone(data.allowPhone || false);
                    setMaxSpendSession(data.maxSpendPerSession || 500);
                    setMaxSpendMonth(data.maxSpendPerMonth || 5000);
                    setSelectedCategories(data.allowedServiceCategories || []);
                    setBlockedServices((data.blockedServices || []).join(', '));
                    setApprovalMode(data.approvalMode || 'confirm_each');
                    setNotifyOnCreate(data.notifyOnAccountCreate ?? true);
                    setNotifyOnPayment(data.notifyOnPaymentUse ?? true);
                }
            }
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const updates = {
                primaryEmail,
                allowedEmails: [primaryEmail, ...additionalEmails].filter(Boolean),
                allowedOAuthProviders: selectedOAuth,
                allowPersonalName,
                allowAddress,
                allowPhone,
                maxSpendPerSession: maxSpendSession,
                maxSpendPerMonth: maxSpendMonth,
                allowedServiceCategories: selectedCategories,
                blockedServices: blockedServices.split(',').map(s => s.trim()).filter(Boolean),
                approvalMode,
                notifyOnAccountCreate: notifyOnCreate,
                notifyOnPaymentUse: notifyOnPayment,
            };

            const response = await fetch(`${API_URL}/api/provisioning/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });

            if (response.ok) {
                const data = await response.json();
                setPermissions(data);
                onSave?.(data);
                onClose();
            }
        } catch (error) {
            console.error('Failed to save permissions:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleOAuth = (provider: OAuthProvider) => {
        setSelectedOAuth(prev =>
            prev.includes(provider)
                ? prev.filter(p => p !== provider)
                : [...prev, provider]
        );
    };

    const toggleCategory = (category: ServiceCategory) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const tabs = [
        { id: 'email' as const, label: 'Email', icon: <EmailIcon /> },
        { id: 'oauth' as const, label: 'OAuth', icon: <KeyIcon /> },
        { id: 'payment' as const, label: 'Payment', icon: <CreditCardIcon /> },
        { id: 'personal' as const, label: 'Personal', icon: <UserIcon /> },
        { id: 'services' as const, label: 'Services', icon: <ShieldIcon /> },
        { id: 'limits' as const, label: 'Limits', icon: <DollarIcon /> },
    ];

    const oauthProviders: { id: OAuthProvider; label: string; color: string }[] = [
        { id: 'google', label: 'Google', color: '#4285F4' },
        { id: 'github', label: 'GitHub', color: '#333' },
        { id: 'microsoft', label: 'Microsoft', color: '#00A4EF' },
        { id: 'apple', label: 'Apple', color: '#000' },
        { id: 'facebook', label: 'Facebook', color: '#1877F2' },
    ];

    const serviceCategories: { id: ServiceCategory; label: string; description: string }[] = [
        { id: 'database', label: 'Database', description: 'Supabase, Neon, PlanetScale, Turso' },
        { id: 'auth', label: 'Authentication', description: 'Clerk, Auth0, Firebase Auth' },
        { id: 'storage', label: 'Storage', description: 'Cloudinary, UploadThing, S3' },
        { id: 'email', label: 'Email', description: 'Resend, SendGrid, Postmark' },
        { id: 'payments', label: 'Payments', description: 'Stripe, Lemon Squeezy' },
        { id: 'hosting', label: 'Hosting', description: 'Vercel, Netlify, Railway' },
        { id: 'analytics', label: 'Analytics', description: 'PostHog, Mixpanel' },
        { id: 'ai', label: 'AI Services', description: 'OpenAI, Anthropic' },
    ];

    const approvalModes: { id: ApprovalMode; label: string; description: string }[] = [
        { id: 'auto_approve', label: 'Auto Approve', description: 'Automatically approve free tier signups' },
        { id: 'confirm_each', label: 'Confirm Each', description: 'Ask before each provisioning session' },
        { id: 'confirm_paid', label: 'Confirm Paid', description: 'Only ask for paid services' },
        { id: 'manual_only', label: 'Manual Only', description: 'No automatic actions, I\'ll do it myself' },
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="permission-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="permission-panel"
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="permission-header">
                        <div className="permission-header__icon">
                            <ShieldIcon />
                        </div>
                        <div className="permission-header__content">
                            <h2 className="permission-header__title">Browser Agent Permissions</h2>
                            <p className="permission-header__subtitle">
                                Configure what autonomous agents can access when provisioning services
                            </p>
                        </div>
                        <button className="permission-close" onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="permission-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`permission-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="permission-content">
                        {loading ? (
                            <div className="permission-loading">
                                <div className="permission-spinner" />
                                <p>Loading permissions...</p>
                            </div>
                        ) : (
                            <>
                                {/* Email Tab */}
                                {activeTab === 'email' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">Email Addresses</h3>
                                        <p className="permission-section__description">
                                            Agents will use these emails when creating accounts on external services.
                                        </p>
                                        <div className="permission-field">
                                            <label>Primary Email</label>
                                            <input
                                                type="email"
                                                value={primaryEmail}
                                                onChange={(e) => setPrimaryEmail(e.target.value)}
                                                placeholder="your@email.com"
                                                className="permission-input"
                                            />
                                        </div>
                                        <div className="permission-field">
                                            <label>Additional Emails (optional)</label>
                                            <input
                                                type="text"
                                                value={additionalEmails.join(', ')}
                                                onChange={(e) => setAdditionalEmails(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                placeholder="work@email.com, alias@email.com"
                                                className="permission-input"
                                            />
                                            <span className="permission-hint">Comma-separated list</span>
                                        </div>
                                    </div>
                                )}

                                {/* OAuth Tab */}
                                {activeTab === 'oauth' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">OAuth Sign-In</h3>
                                        <p className="permission-section__description">
                                            Allow agents to use these OAuth providers for faster account creation.
                                        </p>
                                        <div className="permission-oauth-grid">
                                            {oauthProviders.map((provider) => (
                                                <button
                                                    key={provider.id}
                                                    className={`permission-oauth-btn ${selectedOAuth.includes(provider.id) ? 'selected' : ''}`}
                                                    onClick={() => toggleOAuth(provider.id)}
                                                    style={{ '--provider-color': provider.color } as React.CSSProperties}
                                                >
                                                    <span className="permission-oauth-name">{provider.label}</span>
                                                    <span className="permission-oauth-check">
                                                        {selectedOAuth.includes(provider.id) && '✓'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Payment Tab */}
                                {activeTab === 'payment' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">Payment Methods</h3>
                                        <p className="permission-section__description">
                                            For services that require a payment method (cards are only used for verification, you control spending limits).
                                        </p>
                                        <div className="permission-payment-notice">
                                            <CreditCardIcon />
                                            <div>
                                                <strong>1Password Integration</strong>
                                                <p>Coming soon: Securely autofill payment details using 1Password's agentic autofill API.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Personal Tab */}
                                {activeTab === 'personal' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">Personal Information</h3>
                                        <p className="permission-section__description">
                                            Allow agents to use your personal information when filling forms.
                                        </p>
                                        <div className="permission-toggle-list">
                                            <label className="permission-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={allowPersonalName}
                                                    onChange={(e) => setAllowPersonalName(e.target.checked)}
                                                />
                                                <span className="permission-toggle__label">Use my name</span>
                                            </label>
                                            <label className="permission-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={allowAddress}
                                                    onChange={(e) => setAllowAddress(e.target.checked)}
                                                />
                                                <span className="permission-toggle__label">Use my address</span>
                                            </label>
                                            <label className="permission-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={allowPhone}
                                                    onChange={(e) => setAllowPhone(e.target.checked)}
                                                />
                                                <span className="permission-toggle__label">Use my phone number</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Services Tab */}
                                {activeTab === 'services' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">Allowed Service Categories</h3>
                                        <p className="permission-section__description">
                                            Agents can only provision services in these categories.
                                        </p>
                                        <div className="permission-category-grid">
                                            {serviceCategories.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    className={`permission-category ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
                                                    onClick={() => toggleCategory(cat.id)}
                                                >
                                                    <span className="permission-category__label">{cat.label}</span>
                                                    <span className="permission-category__desc">{cat.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="permission-field" style={{ marginTop: '1.5rem' }}>
                                            <label>Blocked Services</label>
                                            <input
                                                type="text"
                                                value={blockedServices}
                                                onChange={(e) => setBlockedServices(e.target.value)}
                                                placeholder="service1, service2"
                                                className="permission-input"
                                            />
                                            <span className="permission-hint">Comma-separated list of services to never touch</span>
                                        </div>
                                    </div>
                                )}

                                {/* Limits Tab */}
                                {activeTab === 'limits' && (
                                    <div className="permission-section">
                                        <h3 className="permission-section__title">Spending Limits</h3>
                                        <p className="permission-section__description">
                                            Control how much agents can spend on your behalf.
                                        </p>
                                        <div className="permission-field">
                                            <label>Per Session Limit</label>
                                            <div className="permission-input-group">
                                                <span className="permission-input-prefix">$</span>
                                                <input
                                                    type="number"
                                                    value={maxSpendSession / 100}
                                                    onChange={(e) => setMaxSpendSession(parseFloat(e.target.value) * 100)}
                                                    className="permission-input"
                                                    min="0"
                                                    step="1"
                                                />
                                            </div>
                                        </div>
                                        <div className="permission-field">
                                            <label>Monthly Limit</label>
                                            <div className="permission-input-group">
                                                <span className="permission-input-prefix">$</span>
                                                <input
                                                    type="number"
                                                    value={maxSpendMonth / 100}
                                                    onChange={(e) => setMaxSpendMonth(parseFloat(e.target.value) * 100)}
                                                    className="permission-input"
                                                    min="0"
                                                    step="5"
                                                />
                                            </div>
                                            {permissions?.spentThisMonth && (
                                                <span className="permission-hint">
                                                    Spent this month: ${(permissions.spentThisMonth / 100).toFixed(2)}
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="permission-subsection__title">Approval Mode</h4>
                                        <div className="permission-mode-list">
                                            {approvalModes.map((mode) => (
                                                <label key={mode.id} className="permission-mode">
                                                    <input
                                                        type="radio"
                                                        name="approvalMode"
                                                        checked={approvalMode === mode.id}
                                                        onChange={() => setApprovalMode(mode.id)}
                                                    />
                                                    <div className="permission-mode__content">
                                                        <span className="permission-mode__label">{mode.label}</span>
                                                        <span className="permission-mode__desc">{mode.description}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        <h4 className="permission-subsection__title">
                                            <span className="permission-subsection__title-icon" aria-hidden="true">
                                                <BellIcon />
                                            </span>
                                            Notifications
                                        </h4>
                                        <div className="permission-toggle-list">
                                            <label className="permission-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={notifyOnCreate}
                                                    onChange={(e) => setNotifyOnCreate(e.target.checked)}
                                                />
                                                <span className="permission-toggle__label">Notify when accounts are created</span>
                                            </label>
                                            <label className="permission-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={notifyOnPayment}
                                                    onChange={(e) => setNotifyOnPayment(e.target.checked)}
                                                />
                                                <span className="permission-toggle__label">Notify when payment methods are used</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="permission-footer">
                        <button className="permission-btn permission-btn--secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="permission-btn permission-btn--primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Permissions'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BrowserAgentPermissions;

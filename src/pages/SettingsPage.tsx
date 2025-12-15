/**
 * SettingsPage - Comprehensive User Account Management
 *
 * Features:
 * - Profile settings (name, avatar)
 * - Billing & Credits (balance, top-up, spending limits)
 * - Payment methods (add, remove, set default)
 * - Notification preferences
 * - AI preferences (models, streaming)
 * - Privacy settings
 * - Usage history
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import '../styles/realistic-glass.css';
import { StatusIcons } from '../components/ui/icons';
import { cn } from '../lib/utils';
import { apiClient } from '../lib/api-client';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { LearningSettingsSection } from '../components/settings/LearningSettingsSection';
import { DeveloperSettingsSection } from '../components/settings/DeveloperSettingsSection';
import { useUserStore } from '../store/useUserStore';

type TabId = 'profile' | 'billing' | 'payment' | 'notifications' | 'ai' | 'developer' | 'privacy' | 'usage' | 'learning';

interface UserSettings {
    spendingLimit: number | null;
    alertThreshold: number;
    autoTopUp: boolean;
    autoTopUpAmount: number | null;
    autoTopUpThreshold: number | null;
    theme: string;
    editorTheme: string;
    fontSize: number;
    preferredModel: string;
    autoSave: boolean;
    streamingEnabled: boolean;
    emailNotifications: boolean;
    deploymentAlerts: boolean;
    billingAlerts: boolean;
    weeklyDigest: boolean;
    analyticsOptIn: boolean;
    crashReports: boolean;
}

interface UserProfile {
    id: string;
    email: string;
    name: string;
    image: string | null;
    credits: number;
    tier: string;
}

interface PaymentMethod {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
}

// Default settings for graceful fallback when API fails
const defaultSettings: UserSettings = {
    spendingLimit: null,
    alertThreshold: 80,
    autoTopUp: false,
    autoTopUpAmount: null,
    autoTopUpThreshold: null,
    theme: 'system',
    editorTheme: 'vs-dark',
    fontSize: 14,
    preferredModel: 'claude-sonnet-4-5',
    autoSave: true,
    streamingEnabled: true,
    emailNotifications: true,
    deploymentAlerts: true,
    billingAlerts: true,
    weeklyDigest: false,
    analyticsOptIn: true,
    crashReports: true,
};

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: string }> = [
    { id: 'profile', label: 'Profile', icon: StatusIcons.UserIcon },
    { id: 'billing', label: 'Billing & Credits', icon: StatusIcons.WalletIcon },
    { id: 'payment', label: 'Payment Methods', icon: StatusIcons.CreditCardIcon },
    { id: 'notifications', label: 'Notifications', icon: StatusIcons.BellIcon },
    { id: 'ai', label: 'AI Preferences', icon: StatusIcons.BrainIcon },
    { id: 'developer', label: 'Developer Options', icon: StatusIcons.SettingsIcon, badge: 'Advanced' },
    { id: 'learning', label: 'Learning Engine', icon: StatusIcons.BrainIcon },
    { id: 'privacy', label: 'Privacy', icon: StatusIcons.ShieldIcon },
    { id: 'usage', label: 'Usage History', icon: StatusIcons.ActivityIcon },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('profile');
    const [loading, setLoading] = useState(true);
    const [_saving, setSaving] = useState(false);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [creditBalance, setCreditBalance] = useState(0);
    const [topUpAmount, setTopUpAmount] = useState(1000);

    // Get user from store for fallback when API fails
    const storeUser = useUserStore(state => state.user);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            interface SettingsResponse {
                user: UserProfile;
                settings: UserSettings;
            }
            interface CreditsResponse {
                balance: number;
            }
            interface PaymentMethodsResponse {
                paymentMethods: PaymentMethod[];
            }

            // Use Promise.allSettled to handle individual failures gracefully
            const results = await Promise.allSettled([
                apiClient.get<SettingsResponse>('/api/settings'),
                apiClient.get<CreditsResponse>('/api/settings/credits'),
                apiClient.get<PaymentMethodsResponse>('/api/settings/payment-methods'),
            ]);

            // Handle settings response
            if (results[0].status === 'fulfilled') {
                setUser(results[0].value.data.user);
                setSettings(results[0].value.data.settings);
            } else {
                console.warn('Failed to load user settings from API, using fallback');
                // Use store user as fallback (store User type has limited properties)
                if (storeUser) {
                    setUser({
                        id: storeUser.id,
                        email: storeUser.email || '',
                        name: storeUser.name || 'User',
                        image: storeUser.avatar || null,
                        credits: 0,
                        tier: 'free',
                    });
                }
                setSettings(defaultSettings);
            }

            // Handle credits response
            if (results[1].status === 'fulfilled') {
                setCreditBalance(results[1].value.data.balance);
            } else {
                console.warn('Failed to load credits from API');
                setCreditBalance(0);
            }

            // Handle payment methods response
            if (results[2].status === 'fulfilled') {
                setPaymentMethods(results[2].value.data.paymentMethods || []);
            } else {
                console.warn('Failed to load payment methods from API');
                setPaymentMethods([]);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Set defaults on complete failure
            if (storeUser) {
                setUser({
                    id: storeUser.id,
                    email: storeUser.email || '',
                    name: storeUser.name || 'User',
                    image: storeUser.avatar || null,
                    credits: 0,
                    tier: 'free',
                });
            }
            setSettings(defaultSettings);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (updates: Partial<UserSettings>) => {
        setSaving(true);
        try {
            const response = await apiClient.patch<{ settings: UserSettings }>('/api/settings', updates);
            setSettings(response.data.settings);
        } catch (error) {
            console.error('Failed to update settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleTopUp = async () => {
        try {
            const response = await apiClient.post<{ checkoutUrl: string }>('/api/settings/credits/topup', {
                amount: topUpAmount,
            });
            window.location.href = response.data.checkoutUrl;
        } catch (error) {
            console.error('Top-up failed:', error);
        }
    };

    const setDefaultPaymentMethod = async (id: string) => {
        try {
            await apiClient.post(`/api/settings/payment-methods/${id}/default`);
            setPaymentMethods(methods =>
                methods.map(m => ({ ...m, isDefault: m.id === id }))
            );
        } catch (error) {
            console.error('Failed to set default payment method:', error);
        }
    };

    const removePaymentMethod = async (id: string) => {
        try {
            await apiClient.delete(`/api/settings/payment-methods/${id}`);
            setPaymentMethods(methods => methods.filter(m => m.id !== id));
        } catch (error) {
            console.error('Failed to remove payment method:', error);
        }
    };

    if (loading) {
        return (
            <div
                className="flex items-center justify-center min-h-screen"
                style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
            >
                <StatusIcons.LoadingIcon size={32} className="animate-spin" />
            </div>
        );
    }

    return (
        <div
            className="min-h-screen overflow-y-auto"
            style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
        >
            <HoverSidebar />

            {/* Visual trigger for sidebar */}
            <div className="fixed top-4 left-4 z-30">
                <HandDrawnArrow />
            </div>

            <main className="relative z-0 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-20">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>Settings</h1>
                    <p style={{ color: '#666' }}>Manage your account, billing, and preferences</p>
                </div>

                {/* Mobile Tab Selector */}
                <div className="lg:hidden mb-6">
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as TabId)}
                        className="glass-button w-full px-4 py-3 rounded-xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                            border: 'none',
                            color: '#1a1a1a',
                        }}
                    >
                        {tabs.map(tab => (
                            <option key={tab.id} value={tab.id}>{tab.label}</option>
                        ))}
                    </select>
                </div>

                {/* Main Layout Container - responsive flex */}
                <div
                    className="flex flex-col lg:flex-row gap-6 lg:gap-8"
                    style={{
                        alignItems: 'flex-start',
                    }}
                >
                    {/* Desktop Sidebar Tabs - hidden on mobile/tablet */}
                    <aside
                        className="hidden lg:block"
                        style={{
                            width: '256px',
                            flexShrink: 0,
                            position: 'sticky',
                            top: '100px',
                        }}
                    >
                        <nav
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                            }}
                        >
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "glass-button w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all",
                                        activeTab === tab.id && "glass-button--glow"
                                    )}
                                    style={{ justifyContent: 'flex-start' }}
                                >
                                    <tab.icon size={20} />
                                    <span className="font-medium">{tab.label}</span>
                                    {tab.badge && (
                                        <span
                                            className="px-1.5 py-0.5 text-[10px] font-medium rounded-full"
                                            style={{ background: 'rgba(255,180,140,0.3)', color: '#c25a00' }}
                                        >
                                            {tab.badge}
                                        </span>
                                    )}
                                    {activeTab === tab.id && (
                                        <StatusIcons.ChevronRightIcon size={16} className="ml-auto" />
                                    )}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Content Area - full width on mobile, flex-1 on desktop */}
                    <main
                        className="w-full lg:flex-1"
                        style={{ minWidth: 0 }}
                    >
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                                {/* Profile Tab */}
                                {activeTab === 'profile' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>Profile</h2>
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium" style={{ color: '#1a1a1a' }}>{user?.name}</h3>
                                                    <p style={{ color: '#666' }}>{user?.email}</p>
                                                    <span
                                                        className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium"
                                                        style={{
                                                            background: 'rgba(255,180,140,0.2)',
                                                            color: '#c25a00',
                                                        }}
                                                    >
                                                        {user?.tier?.toUpperCase()} Plan
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pt-6 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                                <div>
                                                    <label className="text-sm font-medium mb-2 block" style={{ color: '#404040' }}>
                                                        Display Name
                                                    </label>
                                                    <div className="glass-input">
                                                        <input
                                                            type="text"
                                                            defaultValue={user?.name}
                                                            className="w-full px-4 py-3 bg-transparent border-none outline-none"
                                                            style={{ color: '#1a1a1a' }}
                                                        />
                                                    </div>
                                                </div>
                                                <button className="glass-button glass-button--glow">
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Billing Tab */}
                                {activeTab === 'billing' && (
                                    <div className="space-y-6">
                                        {/* Credit Balance Card */}
                                        <div className="glass-panel p-6 glass-button--glow">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-sm" style={{ color: '#666' }}>Credit Balance</p>
                                                    <p className="text-4xl font-bold" style={{ color: '#1a1a1a' }}>{creditBalance.toLocaleString()}</p>
                                                </div>
                                                <div
                                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                                    style={{ background: 'rgba(255,180,140,0.2)' }}
                                                >
                                                    <StatusIcons.ZapIcon size={32} />
                                                </div>
                                            </div>
                                            <p className="text-xs" style={{ color: '#666' }}>100 credits = $1.00</p>
                                        </div>

                                        {/* Top Up */}
                                        <div className="glass-panel p-6">
                                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Top Up Credits</h3>
                                            <div
                                                className="gap-3 mb-4"
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                                }}
                                            >
                                                {[500, 1000, 2500, 5000].map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setTopUpAmount(amount)}
                                                        className={cn(
                                                            "glass-button py-3 rounded-xl font-medium transition-all flex flex-col items-center justify-center",
                                                            topUpAmount === amount && "glass-button--glow"
                                                        )}
                                                    >
                                                        <span>{amount.toLocaleString()}</span>
                                                        <span className="text-xs opacity-70">${(amount / 100).toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={handleTopUp}
                                                className="glass-button glass-button--glow w-full flex items-center justify-center"
                                            >
                                                <StatusIcons.CreditCardIcon size={16} className="mr-2" />
                                                Add {topUpAmount.toLocaleString()} Credits - ${(topUpAmount / 100).toFixed(2)}
                                            </button>
                                        </div>

                                        {/* Spending Limits */}
                                        <div className="glass-panel p-6">
                                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Spending Limits</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium mb-2 block" style={{ color: '#404040' }}>
                                                        Monthly Spending Limit
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <div className="glass-input flex-1">
                                                            <input
                                                                type="number"
                                                                placeholder="No limit"
                                                                defaultValue={settings?.spendingLimit || ''}
                                                                onChange={(e) => updateSettings({ spendingLimit: parseInt(e.target.value) || null })}
                                                                className="w-full px-4 py-3 bg-transparent border-none outline-none"
                                                                style={{ color: '#1a1a1a' }}
                                                            />
                                                        </div>
                                                        <span style={{ color: '#666' }}>credits/month</span>
                                                    </div>
                                                </div>

                                                <div className="glass-panel flex items-center justify-between p-4">
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>Auto Top-Up</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>Automatically add credits when balance is low</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ autoTopUp: !settings?.autoTopUp })}
                                                        className="w-12 h-6 rounded-full transition-colors relative"
                                                        style={{ background: settings?.autoTopUp ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)' }}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full shadow absolute top-0.5"
                                                            style={{ background: settings?.autoTopUp ? '#c25a00' : '#999' }}
                                                            animate={{ left: settings?.autoTopUp ? 26 : 2 }}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Methods Tab */}
                                {activeTab === 'payment' && (
                                    <div className="glass-panel p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>Payment Methods</h2>
                                            <button className="glass-button">
                                                <StatusIcons.PlusIcon size={16} className="mr-2" />
                                                Add Card
                                            </button>
                                        </div>

                                        {paymentMethods.length === 0 ? (
                                            <div className="text-center py-12">
                                                <StatusIcons.CreditCardIcon size={48} className="mx-auto mb-4" />
                                                <p style={{ color: '#666' }}>No payment methods added</p>
                                                <button className="glass-button glass-button--glow mt-4">
                                                    <StatusIcons.PlusIcon size={16} className="mr-2" />
                                                    Add Payment Method
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {paymentMethods.map(method => (
                                                    <div
                                                        key={method.id}
                                                        className={cn(
                                                            "glass-panel flex items-center justify-between p-4",
                                                            method.isDefault && "glass-button--glow"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                className="w-12 h-8 rounded flex items-center justify-center text-xs font-bold uppercase"
                                                                style={{ background: 'rgba(0,0,0,0.1)', color: '#1a1a1a' }}
                                                            >
                                                                {method.brand}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium" style={{ color: '#1a1a1a' }}>•••• {method.last4}</p>
                                                                <p className="text-sm" style={{ color: '#666' }}>
                                                                    Expires {method.expMonth}/{method.expYear}
                                                                </p>
                                                            </div>
                                                            {method.isDefault && (
                                                                <span
                                                                    className="px-2 py-1 rounded-full text-xs"
                                                                    style={{ background: 'rgba(255,180,140,0.2)', color: '#c25a00' }}
                                                                >
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!method.isDefault && (
                                                                <button
                                                                    className="glass-button glass-button--small"
                                                                    onClick={() => setDefaultPaymentMethod(method.id)}
                                                                >
                                                                    <StatusIcons.CheckIcon size={16} className="mr-1" />
                                                                    Set Default
                                                                </button>
                                                            )}
                                                            <button
                                                                className="glass-button glass-button--small"
                                                                style={{ color: '#dc2626' }}
                                                                onClick={() => removePaymentMethod(method.id)}
                                                            >
                                                                <StatusIcons.TrashIcon size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notifications Tab */}
                                {activeTab === 'notifications' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>Notifications</h2>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                                                { key: 'deploymentAlerts', label: 'Deployment Alerts', desc: 'Get notified about deployment status' },
                                                { key: 'billingAlerts', label: 'Billing Alerts', desc: 'Alerts for low credits and payments' },
                                                { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of your activity' },
                                            ].map(item => (
                                                <div key={item.key} className="glass-panel flex items-center justify-between p-4">
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className="w-12 h-6 rounded-full transition-colors relative"
                                                        style={{ background: settings?.[item.key as keyof UserSettings] ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)' }}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full shadow absolute top-0.5"
                                                            style={{ background: settings?.[item.key as keyof UserSettings] ? '#c25a00' : '#999' }}
                                                            animate={{ left: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
                                                        />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI Preferences Tab */}
                                {activeTab === 'ai' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>AI Preferences</h2>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-sm font-medium mb-2 block" style={{ color: '#404040' }}>
                                                    Preferred Model
                                                </label>
                                                <div className="glass-input">
                                                    <select
                                                        value={settings?.preferredModel || 'claude-sonnet-4-5'}
                                                        onChange={(e) => updateSettings({ preferredModel: e.target.value })}
                                                        className="w-full px-4 py-3 bg-transparent border-none outline-none"
                                                        style={{ color: '#1a1a1a' }}
                                                    >
                                                        <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</option>
                                                        <option value="claude-opus-4">Claude Opus 4 (Most Capable)</option>
                                                        <option value="gpt-4o">GPT-4o</option>
                                                        <option value="deepseek-v3">DeepSeek V3 (Cost Effective)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {[
                                                    { key: 'streamingEnabled', label: 'Streaming Responses', desc: 'See AI responses as they generate' },
                                                    { key: 'autoSave', label: 'Auto-Save', desc: 'Automatically save changes' },
                                                ].map(item => (
                                                    <div key={item.key} className="glass-panel flex items-center justify-between p-4">
                                                        <div>
                                                            <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                            <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                            className={cn(
                                                                "w-12 h-6 rounded-full transition-colors relative",
                                                            )}
                                                            style={{ background: settings?.[item.key as keyof UserSettings] ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)' }}
                                                        >
                                                            <motion.div
                                                                className="w-5 h-5 rounded-full shadow absolute top-0.5"
                                                                style={{ background: settings?.[item.key as keyof UserSettings] ? '#c25a00' : '#999' }}
                                                                animate={{ left: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
                                                            />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium mb-2 block" style={{ color: '#404040' }}>
                                                    Theme
                                                </label>
                                                <div className="flex gap-3">
                                                    {['dark', 'light', 'system'].map(theme => (
                                                        <button
                                                            key={theme}
                                                            onClick={() => updateSettings({ theme })}
                                                            className={cn(
                                                                "glass-button flex-1 flex items-center justify-center gap-2 py-3",
                                                                settings?.theme === theme && "glass-button--glow"
                                                            )}
                                                        >
                                                            {theme === 'dark' && <StatusIcons.MoonIcon size={16} />}
                                                            {theme === 'light' && <StatusIcons.SunIcon size={16} />}
                                                            {theme === 'system' && <StatusIcons.SettingsIcon size={16} />}
                                                            <span className="capitalize">{theme}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Developer Options Tab */}
                                {activeTab === 'developer' && (
                                    <div className="glass-panel p-6">
                                        <DeveloperSettingsSection />
                                    </div>
                                )}

                                {/* Privacy Tab */}
                                {activeTab === 'privacy' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>Privacy</h2>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'analyticsOptIn', label: 'Usage Analytics', desc: 'Help improve KripTik with anonymous usage data' },
                                                { key: 'crashReports', label: 'Crash Reports', desc: 'Send crash reports to help fix bugs' },
                                            ].map(item => (
                                                <div key={item.key} className="glass-panel flex items-center justify-between p-4">
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className="w-12 h-6 rounded-full transition-colors relative"
                                                        style={{ background: settings?.[item.key as keyof UserSettings] ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)' }}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full shadow absolute top-0.5"
                                                            style={{ background: settings?.[item.key as keyof UserSettings] ? '#c25a00' : '#999' }}
                                                            animate={{ left: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
                                                        />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Data Management</h3>
                                            <div className="space-y-3">
                                                <button className="glass-button w-full justify-start">
                                                    <StatusIcons.GlobeIcon size={16} className="mr-2" />
                                                    Export My Data
                                                </button>
                                                <button
                                                    className="glass-button w-full justify-start"
                                                    style={{ color: '#dc2626' }}
                                                >
                                                    <StatusIcons.TrashIcon size={16} className="mr-2" />
                                                    Delete Account
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Usage History Tab */}
                                {activeTab === 'usage' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>Usage History</h2>
                                        <div className="text-center py-12">
                                            <StatusIcons.ActivityIcon size={48} className="mx-auto mb-4" />
                                            <p style={{ color: '#666' }}>Usage history will appear here</p>
                                            <p className="text-sm mt-2" style={{ color: '#999' }}>View your AI generations, token usage, and costs</p>
                                        </div>
                                    </div>
                                )}

                                {/* Learning Engine Tab */}
                                {activeTab === 'learning' && (
                                    <div className="glass-panel p-6">
                                        <LearningSettingsSection />
                                    </div>
                                )}
                        </motion.div>
                    </main>
                </div>
            </main>
        </div>
    );
}



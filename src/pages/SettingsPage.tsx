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
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    User, CreditCard, Bell, Brain, Shield, Activity,
    ChevronRight, Plus, Trash2, Check, Loader2,
    Wallet, Settings2, Moon, Sun,
    Globe, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiClient } from '../lib/api-client';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import '../styles/realistic-glass.css';

type TabId = 'profile' | 'billing' | 'payment' | 'notifications' | 'ai' | 'privacy' | 'usage';

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

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'billing', label: 'Billing & Credits', icon: Wallet },
    { id: 'payment', label: 'Payment Methods', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'ai', label: 'AI Preferences', icon: Brain },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'usage', label: 'Usage History', icon: Activity },
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

            const [settingsRes, creditsRes, paymentRes] = await Promise.all([
                apiClient.get<SettingsResponse>('/api/settings'),
                apiClient.get<CreditsResponse>('/api/settings/credits'),
                apiClient.get<PaymentMethodsResponse>('/api/settings/payment-methods'),
            ]);

            setUser(settingsRes.data.user);
            setSettings(settingsRes.data.settings);
            setCreditBalance(creditsRes.data.balance);
            setPaymentMethods(paymentRes.data.paymentMethods || []);
        } catch (error) {
            console.error('Failed to load settings:', error);
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

    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#404040' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
            <HoverSidebar />

            {/* Header - 3D Glass */}
            <header
                className="sticky top-0 z-40"
                style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.45) 100%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    boxShadow: `
                        0 4px 20px rgba(0, 0, 0, 0.06),
                        0 1px 0 rgba(255, 255, 255, 0.8),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.04),
                        inset 0 1px 1px rgba(255, 255, 255, 0.9)
                    `,
                }}
            >
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HandDrawnArrow className="mr-2" />
                        <div
                            className="flex items-center gap-4 cursor-pointer group"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated />
                            <GlitchText
                                text="KripTik AI"
                                className="text-2xl group-hover:opacity-90 transition-opacity"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>Settings</h1>
                        <p style={{ color: '#404040' }}>Manage your account, billing, and preferences</p>
                    </div>

                    <div className="flex gap-8">
                        {/* Sidebar */}
                        <div className="w-64 shrink-0">
                            <nav className="space-y-2">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 cursor-pointer relative overflow-hidden glass-button",
                                            activeTab === tab.id && "glass-button--glow"
                                        )}
                                        style={{
                                            padding: '12px 18px',
                                            color: activeTab === tab.id ? '#a03810' : '#1a1a1a',
                                        }}
                                    >
                                        <tab.icon className="w-5 h-5" />
                                        <span className="font-medium">{tab.label}</span>
                                        {activeTab === tab.id && (
                                            <ChevronRight className="w-4 h-4 ml-auto" />
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Profile Tab */}
                                {activeTab === 'profile' && (
                                    <div className="glass-panel p-6">
                                        <h2 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>Profile</h2>
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-black text-2xl font-bold">
                                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium" style={{ color: '#1a1a1a' }}>{user?.name}</h3>
                                                    <p style={{ color: '#404040' }}>{user?.email}</p>
                                                    <span className={cn(
                                                        "inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium",
                                                        user?.tier === 'pro' ? "bg-amber-500/20 text-amber-700" :
                                                        user?.tier === 'enterprise' ? "bg-purple-500/20 text-purple-700" :
                                                        "bg-black/5 text-gray-600"
                                                    )}>
                                                        {user?.tier?.toUpperCase()} Plan
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pt-6 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                                <div>
                                                    <label className="text-sm font-medium mb-2 block" style={{ color: '#404040' }}>
                                                        Display Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        defaultValue={user?.name}
                                                        className="glass-input w-full"
                                                        style={{ padding: '12px 16px', borderRadius: '12px' }}
                                                    />
                                                </div>
                                                <button className="glass-button glass-button--glow" style={{ color: '#1a1a1a' }}>
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
                                        <div className="glass-panel p-6" style={{ background: 'linear-gradient(145deg, rgba(255, 210, 180, 0.4) 0%, rgba(255, 190, 160, 0.3) 100%)' }}>
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-sm" style={{ color: '#666' }}>Credit Balance</p>
                                                    <p className="text-4xl font-bold" style={{ color: '#1a1a1a' }}>{creditBalance.toLocaleString()}</p>
                                                </div>
                                                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                                                    <Zap className="w-8 h-8 text-amber-600" />
                                                </div>
                                            </div>
                                            <p className="text-xs" style={{ color: '#666' }}>100 credits = $1.00</p>
                                        </div>

                                        {/* Top Up */}
                                        <div className="glass-panel p-6">
                                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Top Up Credits</h3>
                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                {[500, 1000, 2500, 5000].map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setTopUpAmount(amount)}
                                                        className={cn(
                                                            "py-3 rounded-xl font-medium transition-all glass-button",
                                                            topUpAmount === amount && "glass-button--glow"
                                                        )}
                                                        style={{ color: '#1a1a1a' }}
                                                    >
                                                        {amount.toLocaleString()}
                                                        <span className="text-xs block opacity-70">${(amount / 100).toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={handleTopUp}
                                                className="w-full glass-button glass-button--glow flex items-center justify-center gap-2"
                                                style={{ color: '#1a1a1a' }}
                                            >
                                                <CreditCard className="w-4 h-4" />
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
                                                        <input
                                                            type="number"
                                                            placeholder="No limit"
                                                            defaultValue={settings?.spendingLimit || ''}
                                                            onChange={(e) => updateSettings({ spendingLimit: parseInt(e.target.value) || null })}
                                                            className="glass-input flex-1"
                                                            style={{ padding: '12px 16px', borderRadius: '12px', color: '#1a1a1a' }}
                                                        />
                                                        <span style={{ color: '#666' }}>credits/month</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>Auto Top-Up</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>Automatically add credits when balance is low</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ autoTopUp: !settings?.autoTopUp })}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.autoTopUp ? "bg-amber-500" : "bg-gray-300"
                                                        )}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full bg-white shadow"
                                                            animate={{ x: settings?.autoTopUp ? 26 : 2 }}
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
                                            <button className="glass-button glass-button--small" style={{ color: '#1a1a1a' }}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Card
                                            </button>
                                        </div>

                                        {paymentMethods.length === 0 ? (
                                            <div className="text-center py-12">
                                                <CreditCard className="w-12 h-12 mx-auto mb-4" style={{ color: '#999' }} />
                                                <p style={{ color: '#666' }}>No payment methods added</p>
                                                <button className="glass-button mt-4" style={{ color: '#1a1a1a' }}>
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Payment Method
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {paymentMethods.map(method => (
                                                    <div
                                                        key={method.id}
                                                        className="flex items-center justify-between p-4 rounded-xl"
                                                        style={{
                                                            background: 'rgba(0,0,0,0.03)',
                                                            border: method.isDefault ? '2px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(0,0,0,0.05)'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-8 rounded flex items-center justify-center text-xs font-bold text-white uppercase" style={{ background: 'linear-gradient(145deg, #404040, #1a1a1a)' }}>
                                                                {method.brand}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium" style={{ color: '#1a1a1a' }}>•••• {method.last4}</p>
                                                                <p className="text-sm" style={{ color: '#666' }}>
                                                                    Expires {method.expMonth}/{method.expYear}
                                                                </p>
                                                            </div>
                                                            {method.isDefault && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-700">
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!method.isDefault && (
                                                                <button
                                                                    className="glass-button glass-button--small"
                                                                    style={{ color: '#1a1a1a' }}
                                                                    onClick={() => setDefaultPaymentMethod(method.id)}
                                                                >
                                                                    <Check className="w-4 h-4 mr-1" />
                                                                    Set Default
                                                                </button>
                                                            )}
                                                            <button
                                                                className="glass-button glass-button--small"
                                                                style={{ color: '#c44' }}
                                                                onClick={() => removePaymentMethod(method.id)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
                                                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-gray-300"
                                                        )}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full bg-white shadow"
                                                            animate={{ x: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
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
                                                <select
                                                    value={settings?.preferredModel || 'claude-sonnet-4-5'}
                                                    onChange={(e) => updateSettings({ preferredModel: e.target.value })}
                                                    className="glass-input w-full"
                                                    style={{ padding: '12px 16px', borderRadius: '12px', color: '#1a1a1a' }}
                                                >
                                                    <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</option>
                                                    <option value="claude-opus-4">Claude Opus 4 (Most Capable)</option>
                                                    <option value="gpt-4o">GPT-4o</option>
                                                    <option value="deepseek-v3">DeepSeek V3 (Cost Effective)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-4">
                                                {[
                                                    { key: 'streamingEnabled', label: 'Streaming Responses', desc: 'See AI responses as they generate' },
                                                    { key: 'autoSave', label: 'Auto-Save', desc: 'Automatically save changes' },
                                                ].map(item => (
                                                    <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                                        <div>
                                                            <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                            <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                            className={cn(
                                                                "w-12 h-6 rounded-full transition-colors",
                                                                settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-gray-300"
                                                            )}
                                                        >
                                                            <motion.div
                                                                className="w-5 h-5 rounded-full bg-white shadow"
                                                                animate={{ x: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
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
                                                                "flex-1 flex items-center justify-center gap-2 py-3 glass-button",
                                                                settings?.theme === theme && "glass-button--glow"
                                                            )}
                                                            style={{ color: '#1a1a1a' }}
                                                        >
                                                            {theme === 'dark' && <Moon className="w-4 h-4" />}
                                                            {theme === 'light' && <Sun className="w-4 h-4" />}
                                                            {theme === 'system' && <Settings2 className="w-4 h-4" />}
                                                            <span className="capitalize">{theme}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
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
                                                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                                                    <div>
                                                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{item.label}</p>
                                                        <p className="text-sm" style={{ color: '#666' }}>{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-gray-300"
                                                        )}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full bg-white shadow"
                                                            animate={{ x: settings?.[item.key as keyof UserSettings] ? 26 : 2 }}
                                                        />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Data Management</h3>
                                            <div className="space-y-3">
                                                <button className="w-full glass-button flex items-center justify-start" style={{ color: '#1a1a1a' }}>
                                                    <Globe className="w-4 h-4 mr-2" />
                                                    Export My Data
                                                </button>
                                                <button className="w-full glass-button flex items-center justify-start" style={{ color: '#c44', background: 'rgba(200,50,50,0.08)' }}>
                                                    <Trash2 className="w-4 h-4 mr-2" />
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
                                            <Activity className="w-12 h-12 mx-auto mb-4" style={{ color: '#999' }} />
                                            <p style={{ color: '#666' }}>Usage history will appear here</p>
                                            <p className="text-sm mt-2" style={{ color: '#999' }}>View your AI generations, token usage, and costs</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}


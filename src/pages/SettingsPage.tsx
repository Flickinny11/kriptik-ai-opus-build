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
import {
    User, CreditCard, Bell, Brain, Shield, Activity,
    ChevronRight, Plus, Trash2, Check, Loader2,
    Wallet, Settings2, Moon, Sun,
    Globe, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { cn } from '../lib/utils';
import { apiClient } from '../lib/api-client';

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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                        <p className="text-slate-400">Manage your account, billing, and preferences</p>
                    </div>

                    <div className="flex gap-8">
                        {/* Sidebar */}
                        <div className="w-64 shrink-0">
                            <nav className="space-y-1">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                            activeTab === tab.id
                                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                        )}
                                    >
                                        <tab.icon className={"w-5 h-5"} />
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
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h2 className="text-xl font-semibold text-white mb-6">Profile</h2>
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-black text-2xl font-bold">
                                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium text-white">{user?.name}</h3>
                                                    <p className="text-slate-400">{user?.email}</p>
                                                    <span className={cn(
                                                        "inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium",
                                                        user?.tier === 'pro' ? "bg-amber-500/20 text-amber-400" :
                                                        user?.tier === 'enterprise' ? "bg-purple-500/20 text-purple-400" :
                                                        "bg-slate-700 text-slate-300"
                                                    )}>
                                                        {user?.tier?.toUpperCase()} Plan
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-800 space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                                                        Display Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        defaultValue={user?.name}
                                                        className={cn(
                                                            "w-full px-4 py-3 rounded-xl",
                                                            "bg-slate-800 border border-slate-700",
                                                            "text-white placeholder:text-slate-500",
                                                            "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                                        )}
                                                    />
                                                </div>
                                                <Button
                                                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                                >
                                                    Save Changes
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {/* Billing Tab */}
                                {activeTab === 'billing' && (
                                    <div className="space-y-6">
                                        {/* Credit Balance Card */}
                                        <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-sm text-slate-400">Credit Balance</p>
                                                    <p className="text-4xl font-bold text-white">{creditBalance.toLocaleString()}</p>
                                                </div>
                                                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                                                    <Zap className="w-8 h-8 text-amber-400" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400">100 credits = $1.00</p>
                                        </Card>

                                        {/* Top Up */}
                                        <Card className="p-6 bg-slate-900/50 border-slate-800">
                                            <h3 className="text-lg font-semibold text-white mb-4">Top Up Credits</h3>
                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                {[500, 1000, 2500, 5000].map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setTopUpAmount(amount)}
                                                        className={cn(
                                                            "py-3 rounded-xl font-medium transition-all",
                                                            topUpAmount === amount
                                                                ? "bg-amber-500 text-black"
                                                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                        )}
                                                    >
                                                        {amount.toLocaleString()}
                                                        <span className="text-xs block opacity-70">${(amount / 100).toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <Button
                                                onClick={handleTopUp}
                                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                            >
                                                <CreditCard className="w-4 h-4 mr-2" />
                                                Add {topUpAmount.toLocaleString()} Credits - ${(topUpAmount / 100).toFixed(2)}
                                            </Button>
                                        </Card>

                                        {/* Spending Limits */}
                                        <Card className="p-6 bg-slate-900/50 border-slate-800">
                                            <h3 className="text-lg font-semibold text-white mb-4">Spending Limits</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                                                        Monthly Spending Limit
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            placeholder="No limit"
                                                            defaultValue={settings?.spendingLimit || ''}
                                                            onChange={(e) => updateSettings({ spendingLimit: parseInt(e.target.value) || null })}
                                                            className={cn(
                                                                "flex-1 px-4 py-3 rounded-xl",
                                                                "bg-slate-800 border border-slate-700",
                                                                "text-white placeholder:text-slate-500",
                                                                "focus:border-amber-500 focus:outline-none"
                                                            )}
                                                        />
                                                        <span className="text-slate-400">credits/month</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                                                    <div>
                                                        <p className="font-medium text-white">Auto Top-Up</p>
                                                        <p className="text-sm text-slate-400">Automatically add credits when balance is low</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ autoTopUp: !settings?.autoTopUp })}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.autoTopUp ? "bg-amber-500" : "bg-slate-700"
                                                        )}
                                                    >
                                                        <motion.div
                                                            className="w-5 h-5 rounded-full bg-white shadow"
                                                            animate={{ x: settings?.autoTopUp ? 26 : 2 }}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                )}

                                {/* Payment Methods Tab */}
                                {activeTab === 'payment' && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-semibold text-white">Payment Methods</h2>
                                            <Button variant="outline" className="border-slate-700">
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Card
                                            </Button>
                                        </div>

                                        {paymentMethods.length === 0 ? (
                                            <div className="text-center py-12">
                                                <CreditCard className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                                                <p className="text-slate-400">No payment methods added</p>
                                                <Button className="mt-4" variant="outline">
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Payment Method
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {paymentMethods.map(method => (
                                                    <div
                                                        key={method.id}
                                                        className={cn(
                                                            "flex items-center justify-between p-4 rounded-xl",
                                                            "bg-slate-800/50 border",
                                                            method.isDefault ? "border-amber-500/50" : "border-slate-700"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-8 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                                {method.brand}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-white">•••• {method.last4}</p>
                                                                <p className="text-sm text-slate-400">
                                                                    Expires {method.expMonth}/{method.expYear}
                                                                </p>
                                                            </div>
                                                            {method.isDefault && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!method.isDefault && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setDefaultPaymentMethod(method.id)}
                                                                >
                                                                    <Check className="w-4 h-4 mr-1" />
                                                                    Set Default
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-400 hover:text-red-300"
                                                                onClick={() => removePaymentMethod(method.id)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                )}

                                {/* Notifications Tab */}
                                {activeTab === 'notifications' && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h2 className="text-xl font-semibold text-white mb-6">Notifications</h2>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                                                { key: 'deploymentAlerts', label: 'Deployment Alerts', desc: 'Get notified about deployment status' },
                                                { key: 'billingAlerts', label: 'Billing Alerts', desc: 'Alerts for low credits and payments' },
                                                { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of your activity' },
                                            ].map(item => (
                                                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                                                    <div>
                                                        <p className="font-medium text-white">{item.label}</p>
                                                        <p className="text-sm text-slate-400">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-slate-700"
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
                                    </Card>
                                )}

                                {/* AI Preferences Tab */}
                                {activeTab === 'ai' && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h2 className="text-xl font-semibold text-white mb-6">AI Preferences</h2>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-sm font-medium text-slate-300 mb-2 block">
                                                    Preferred Model
                                                </label>
                                                <select
                                                    value={settings?.preferredModel || 'claude-sonnet-4-5'}
                                                    onChange={(e) => updateSettings({ preferredModel: e.target.value })}
                                                    className={cn(
                                                        "w-full px-4 py-3 rounded-xl",
                                                        "bg-slate-800 border border-slate-700",
                                                        "text-white",
                                                        "focus:border-amber-500 focus:outline-none"
                                                    )}
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
                                                    <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                                                        <div>
                                                            <p className="font-medium text-white">{item.label}</p>
                                                            <p className="text-sm text-slate-400">{item.desc}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                            className={cn(
                                                                "w-12 h-6 rounded-full transition-colors",
                                                                settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-slate-700"
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
                                                <label className="text-sm font-medium text-slate-300 mb-2 block">
                                                    Theme
                                                </label>
                                                <div className="flex gap-3">
                                                    {['dark', 'light', 'system'].map(theme => (
                                                        <button
                                                            key={theme}
                                                            onClick={() => updateSettings({ theme })}
                                                            className={cn(
                                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all",
                                                                settings?.theme === theme
                                                                    ? "bg-amber-500 text-black"
                                                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                            )}
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
                                    </Card>
                                )}

                                {/* Privacy Tab */}
                                {activeTab === 'privacy' && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h2 className="text-xl font-semibold text-white mb-6">Privacy</h2>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'analyticsOptIn', label: 'Usage Analytics', desc: 'Help improve KripTik with anonymous usage data' },
                                                { key: 'crashReports', label: 'Crash Reports', desc: 'Send crash reports to help fix bugs' },
                                            ].map(item => (
                                                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                                                    <div>
                                                        <p className="font-medium text-white">{item.label}</p>
                                                        <p className="text-sm text-slate-400">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ [item.key]: !settings?.[item.key as keyof UserSettings] } as Partial<UserSettings>)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-colors",
                                                            settings?.[item.key as keyof UserSettings] ? "bg-amber-500" : "bg-slate-700"
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

                                        <div className="mt-8 pt-6 border-t border-slate-800">
                                            <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
                                            <div className="space-y-3">
                                                <Button variant="outline" className="w-full justify-start border-slate-700">
                                                    <Globe className="w-4 h-4 mr-2" />
                                                    Export My Data
                                                </Button>
                                                <Button variant="outline" className="w-full justify-start border-red-900/50 text-red-400 hover:bg-red-500/10">
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Account
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {/* Usage History Tab */}
                                {activeTab === 'usage' && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h2 className="text-xl font-semibold text-white mb-6">Usage History</h2>
                                        <div className="text-center py-12">
                                            <Activity className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                                            <p className="text-slate-400">Usage history will appear here</p>
                                            <p className="text-sm text-slate-500 mt-2">View your AI generations, token usage, and costs</p>
                                        </div>
                                    </Card>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
        </div>
    );
}


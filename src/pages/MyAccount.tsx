/**
 * My Account Page
 *
 * Comprehensive account management:
 * - Profile settings
 * - Subscription & billing
 * - Credits & usage
 * - Deployment preferences
 * - Security settings
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, CreditCard, Coins, Cloud, Shield, Bell,
    Plus, Check, Settings, Key, Smartphone, Globe
} from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { useCostStore } from '../store/useCostStore';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';
import '../styles/realistic-glass.css';

// Account sections
const SECTIONS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'credits', label: 'Credits & Usage', icon: Coins },
    { id: 'deployment', label: 'Deployment', icon: Cloud },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

// Subscription plans
const PLANS = [
    { id: 'free', name: 'Free', price: 0, credits: 100, features: ['5 projects', 'Community support'] },
    { id: 'pro', name: 'Pro', price: 29, credits: 1000, features: ['Unlimited projects', 'Priority support', 'Advanced AI models'] },
    { id: 'enterprise', name: 'Enterprise', price: 99, credits: 5000, features: ['Everything in Pro', 'Custom integrations', 'Dedicated support'] },
];

// Deployment options
const DEPLOY_OPTIONS = [
    { id: 'vercel', name: 'Vercel', description: 'Serverless deployment', icon: '▲' },
    { id: 'netlify', name: 'Netlify', description: 'JAMstack hosting', icon: '◆' },
    { id: 'cloudflare', name: 'Cloudflare Pages', description: 'Edge deployment', icon: '☁️' },
    { id: 'aws', name: 'AWS', description: 'Full cloud services', icon: '🔶' },
    { id: 'gcp', name: 'Google Cloud', description: 'GCP deployment', icon: '🌐' },
    { id: 'kriptik', name: 'KripTik Hosting', description: 'Managed hosting', icon: '⚡' },
];

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("glass-panel p-6", className)}>
            {children}
        </div>
    );
}

function ProfileSection() {
    const { user } = useUserStore();

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Profile Information</h3>

            <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl font-bold text-black">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <button className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm" style={{ color: '#404040' }}>
                        <Settings className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="text-xs uppercase tracking-wider" style={{ color: '#666' }}>Name</label>
                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{user?.name || 'User'}</p>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wider" style={{ color: '#666' }}>Email</label>
                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{user?.email || 'user@email.com'}</p>
                    </div>
                </div>
            </div>

            <button className="glass-button mt-6" style={{ color: '#1a1a1a' }}>
                Edit Profile
            </button>
        </SectionCard>
    );
}

function SubscriptionSection() {
    const [currentPlan] = useState('free');

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Subscription</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                    <div
                        key={plan.id}
                        className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            currentPlan === plan.id
                                ? "border-amber-500 bg-amber-500/10"
                                : "border-black/10 hover:border-black/20"
                        )}
                        style={{ background: 'rgba(255,255,255,0.5)' }}
                    >
                        {currentPlan === plan.id && (
                            <span className="text-xs text-amber-600 font-medium mb-2 block">CURRENT PLAN</span>
                        )}
                        <h4 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>{plan.name}</h4>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#1a1a1a' }}>
                            ${plan.price}<span className="text-sm" style={{ color: '#666' }}>/mo</span>
                        </p>
                        <p className="text-sm text-amber-600 mt-1">{plan.credits.toLocaleString()} credits/mo</p>

                        <ul className="mt-4 space-y-2">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2 text-sm" style={{ color: '#404040' }}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        {currentPlan !== plan.id && (
                            <button
                                className={cn(
                                    "w-full mt-4 glass-button",
                                    plan.id === 'pro' && "glass-button--glow"
                                )}
                                style={{ color: '#1a1a1a' }}
                            >
                                {plan.price > 0 ? 'Upgrade' : 'Downgrade'}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

function CreditsSection() {
    const { balance } = useCostStore();

    return (
        <SectionCard>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>Credits & Usage</h3>
                <button className="glass-button glass-button--small glass-button--glow" style={{ color: '#1a1a1a' }}>
                    <Plus className="h-4 w-4" />
                    <span>Top Up</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <p className="text-sm" style={{ color: '#666' }}>Available Credits</p>
                    <p className="text-3xl font-bold text-amber-600">{balance.available.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <p className="text-sm" style={{ color: '#666' }}>Used This Month</p>
                    <p className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>{balance.totalUsedThisMonth.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <p className="text-sm" style={{ color: '#666' }}>Monthly Limit</p>
                    <p className="text-3xl font-bold" style={{ color: '#666' }}>{balance.limit.toLocaleString()}</p>
                </div>
            </div>

            {/* Usage bar */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: '#666' }}>Monthly Usage</span>
                    <span style={{ color: '#666' }}>
                        {Math.round((balance.totalUsedThisMonth / balance.limit) * 100)}%
                    </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                    <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (balance.totalUsedThisMonth / balance.limit) * 100)}%` }}
                    />
                </div>
            </div>

            <p className="text-xs" style={{ color: '#999' }}>
                Resets on {new Date(balance.resetDate).toLocaleDateString()}
            </p>
        </SectionCard>
    );
}

function DeploymentSection() {
    const [defaultDeploy, setDefaultDeploy] = useState('vercel');

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Deployment Preferences</h3>
            <p className="text-sm mb-6" style={{ color: '#666' }}>
                Choose your default deployment target for new projects
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DEPLOY_OPTIONS.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => setDefaultDeploy(option.id)}
                        className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            defaultDeploy === option.id
                                ? "border-amber-500 bg-amber-500/10"
                                : "border-black/10 hover:border-black/20"
                        )}
                        style={{ background: 'rgba(255,255,255,0.5)' }}
                    >
                        <span className="text-2xl block mb-2">{option.icon}</span>
                        <p className="font-medium" style={{ color: '#1a1a1a' }}>{option.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#666' }}>{option.description}</p>
                        {defaultDeploy === option.id && (
                            <div className="mt-2 flex items-center gap-1 text-amber-600">
                                <Check className="h-3.5 w-3.5" />
                                <span className="text-xs">Default</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </SectionCard>
    );
}

function SecuritySection() {
    return (
        <SectionCard>
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Security</h3>

            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <div className="flex items-center gap-3">
                        <Key className="h-5 w-5" style={{ color: '#666' }} />
                        <div>
                            <p className="font-medium" style={{ color: '#1a1a1a' }}>Password</p>
                            <p className="text-sm" style={{ color: '#666' }}>Last changed 30 days ago</p>
                        </div>
                    </div>
                    <button className="glass-button glass-button--small" style={{ color: '#1a1a1a' }}>
                        Change
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5" style={{ color: '#666' }} />
                        <div>
                            <p className="font-medium" style={{ color: '#1a1a1a' }}>Two-Factor Authentication</p>
                            <p className="text-sm" style={{ color: '#666' }}>Not enabled</p>
                        </div>
                    </div>
                    <button className="glass-button glass-button--small glass-button--glow" style={{ color: '#1a1a1a' }}>
                        Enable
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5" style={{ color: '#666' }} />
                        <div>
                            <p className="font-medium" style={{ color: '#1a1a1a' }}>Active Sessions</p>
                            <p className="text-sm" style={{ color: '#666' }}>1 active session</p>
                        </div>
                    </div>
                    <button className="glass-button glass-button--small" style={{ color: '#1a1a1a' }}>
                        Manage
                    </button>
                </div>
            </div>
        </SectionCard>
    );
}

export default function MyAccount() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('profile');

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
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar navigation */}
                    <div className="lg:w-64 shrink-0">
                        <h1 className="text-3xl font-bold mb-6" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                            My Account
                        </h1>

                        <nav className="space-y-2">
                            {SECTIONS.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 glass-button",
                                        activeSection === section.id && "glass-button--glow"
                                    )}
                                    style={{
                                        padding: '12px 18px',
                                        color: activeSection === section.id ? '#a03810' : '#1a1a1a',
                                    }}
                                >
                                    <section.icon className="h-5 w-5" />
                                    {section.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-6">
                        {activeSection === 'profile' && <ProfileSection />}
                        {activeSection === 'subscription' && <SubscriptionSection />}
                        {activeSection === 'credits' && <CreditsSection />}
                        {activeSection === 'deployment' && <DeploymentSection />}
                        {activeSection === 'security' && <SecuritySection />}
                        {activeSection === 'notifications' && (
                            <SectionCard>
                                <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Notification Preferences</h3>
                                <p style={{ color: '#666' }}>Notification settings coming soon...</p>
                            </SectionCard>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}


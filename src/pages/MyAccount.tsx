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
import { motion } from 'framer-motion';
import {
    User, CreditCard, Coins, Cloud, Shield, Bell,
    ChevronRight, Plus, Check, AlertCircle, ExternalLink,
    Settings, Trash2, Download, RefreshCw, Key, Mail,
    Smartphone, Globe, Server, Database
} from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { useCostStore } from '../store/useCostStore';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';

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
        <div className={cn(
            "p-6 rounded-2xl",
            "bg-slate-800/30 border border-slate-700/50",
            className
        )}>
            {children}
        </div>
    );
}

function ProfileSection() {
    const { user } = useUserStore();

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>

            <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl font-bold text-black">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <button className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white">
                        <Settings className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Name</label>
                        <p className="text-white font-medium">{user?.name || 'User'}</p>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Email</label>
                        <p className="text-white font-medium">{user?.email || 'user@email.com'}</p>
                    </div>
                </div>
            </div>

            <Button variant="outline" className="mt-6 border-slate-700">
                Edit Profile
            </Button>
        </SectionCard>
    );
}

function SubscriptionSection() {
    const [currentPlan] = useState('free');

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold text-white mb-4">Subscription</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                    <div
                        key={plan.id}
                        className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            currentPlan === plan.id
                                ? "border-amber-500 bg-amber-500/5"
                                : "border-slate-700 hover:border-slate-600"
                        )}
                    >
                        {currentPlan === plan.id && (
                            <span className="text-xs text-amber-500 font-medium mb-2 block">CURRENT PLAN</span>
                        )}
                        <h4 className="text-lg font-semibold text-white">{plan.name}</h4>
                        <p className="text-2xl font-bold text-white mt-1">
                            ${plan.price}<span className="text-sm text-slate-400">/mo</span>
                        </p>
                        <p className="text-sm text-amber-400 mt-1">{plan.credits.toLocaleString()} credits/mo</p>

                        <ul className="mt-4 space-y-2">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2 text-sm text-slate-400">
                                    <Check className="h-4 w-4 text-emerald-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        {currentPlan !== plan.id && (
                            <Button
                                className={cn(
                                    "w-full mt-4",
                                    plan.id === 'pro' ? "bg-amber-500 hover:bg-amber-400 text-black" : ""
                                )}
                                variant={plan.id === 'pro' ? 'default' : 'outline'}
                            >
                                {plan.price > 0 ? 'Upgrade' : 'Downgrade'}
                            </Button>
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
                <h3 className="text-lg font-semibold text-white">Credits & Usage</h3>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black gap-2">
                    <Plus className="h-4 w-4" />
                    Top Up
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-900/50">
                    <p className="text-sm text-slate-400">Available Credits</p>
                    <p className="text-3xl font-bold text-amber-400">{balance.available.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50">
                    <p className="text-sm text-slate-400">Used This Month</p>
                    <p className="text-3xl font-bold text-white">{balance.totalUsedThisMonth.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50">
                    <p className="text-sm text-slate-400">Monthly Limit</p>
                    <p className="text-3xl font-bold text-slate-400">{balance.limit.toLocaleString()}</p>
                </div>
            </div>

            {/* Usage bar */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Monthly Usage</span>
                    <span className="text-slate-400">
                        {Math.round((balance.totalUsedThisMonth / balance.limit) * 100)}%
                    </span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (balance.totalUsedThisMonth / balance.limit) * 100)}%` }}
                    />
                </div>
            </div>

            <p className="text-xs text-slate-500">
                Resets on {new Date(balance.resetDate).toLocaleDateString()}
            </p>
        </SectionCard>
    );
}

function DeploymentSection() {
    const [defaultDeploy, setDefaultDeploy] = useState('vercel');

    return (
        <SectionCard>
            <h3 className="text-lg font-semibold text-white mb-4">Deployment Preferences</h3>
            <p className="text-sm text-slate-400 mb-6">
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
                                ? "border-amber-500 bg-amber-500/5"
                                : "border-slate-700 hover:border-slate-600"
                        )}
                    >
                        <span className="text-2xl block mb-2">{option.icon}</span>
                        <p className="font-medium text-white">{option.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
                        {defaultDeploy === option.id && (
                            <div className="mt-2 flex items-center gap-1 text-amber-500">
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
            <h3 className="text-lg font-semibold text-white mb-4">Security</h3>

            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <Key className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="font-medium text-white">Password</p>
                            <p className="text-sm text-slate-400">Last changed 30 days ago</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-700">
                        Change
                    </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="font-medium text-white">Two-Factor Authentication</p>
                            <p className="text-sm text-slate-400">Not enabled</p>
                        </div>
                    </div>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black">
                        Enable
                    </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="font-medium text-white">Active Sessions</p>
                            <p className="text-sm text-slate-400">1 active session</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-700">
                        Manage
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}

export default function MyAccount() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('profile');

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <HoverSidebar />

            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-slate-800/50">
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
                        <h1 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                            My Account
                        </h1>

                        <nav className="space-y-1">
                            {SECTIONS.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                        activeSection === section.id
                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    )}
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
                                <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                                <p className="text-slate-400">Notification settings coming soon...</p>
                            </SectionCard>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}


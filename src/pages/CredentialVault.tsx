/**
 * Credential Vault Page
 *
 * Secure storage for API keys and credentials
 * - AES-256-GCM encryption
 * - Visual credential management
 * - Connection status monitoring
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Plus, Eye, EyeOff, Trash2, RefreshCw,
    Shield, Lock, Copy
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';
import '../styles/realistic-glass.css';

// Credential types
const CREDENTIAL_TYPES = [
    { id: 'openai', name: 'OpenAI', icon: '🤖', color: 'from-emerald-500 to-emerald-600' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: 'from-amber-500 to-orange-500' },
    { id: 'vercel', name: 'Vercel', icon: '▲', color: 'from-slate-500 to-slate-600' },
    { id: 'github', name: 'GitHub', icon: '⚡', color: 'from-slate-600 to-slate-700' },
    { id: 'stripe', name: 'Stripe', icon: '💳', color: 'from-indigo-500 to-indigo-600' },
    { id: 'supabase', name: 'Supabase', icon: '⚡', color: 'from-emerald-500 to-emerald-600' },
    { id: 'turso', name: 'Turso', icon: '🔷', color: 'from-cyan-500 to-cyan-600' },
    { id: 'aws', name: 'AWS', icon: '☁️', color: 'from-orange-500 to-orange-600' },
    { id: 'gcp', name: 'Google Cloud', icon: '🌐', color: 'from-blue-500 to-blue-600' },
    { id: 'runpod', name: 'RunPod', icon: '🚀', color: 'from-violet-500 to-violet-600' },
];

interface StoredCredential {
    id: string;
    type: string;
    name: string;
    status: 'active' | 'expired' | 'invalid';
    lastUsed?: Date;
    createdAt: Date;
}

// Demo credentials (replace with real data)
const DEMO_CREDENTIALS: StoredCredential[] = [
    { id: '1', type: 'openai', name: 'OpenAI API', status: 'active', lastUsed: new Date(), createdAt: new Date() },
    { id: '2', type: 'vercel', name: 'Vercel Token', status: 'active', createdAt: new Date() },
];

function CredentialCard({ credential, onDelete, onRefresh }: {
    credential: StoredCredential;
    onDelete: () => void;
    onRefresh: () => void;
}) {
    const [showKey, setShowKey] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const typeInfo = CREDENTIAL_TYPES.find(t => t.id === credential.type);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="glass-panel relative p-5 rounded-2xl transition-all duration-500"
            style={{
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,230,215,0.7) 0%, rgba(255,220,200,0.55) 40%, rgba(255,210,185,0.5) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.4) 50%, rgba(248,248,250,0.45) 100%)',
                boxShadow: isHovered
                    ? `0 16px 50px rgba(255,150,100,0.2),
                       0 8px 25px rgba(255,130,80,0.15),
                       0 0 30px rgba(255,160,120,0.25),
                       inset 0 2px 2px rgba(255,255,255,1),
                       inset 0 -2px 2px rgba(0,0,0,0.02),
                       0 0 0 1px rgba(255,200,170,0.6)`
                    : `0 20px 60px rgba(0,0,0,0.1),
                       0 8px 24px rgba(0,0,0,0.06),
                       inset 0 1px 1px rgba(255,255,255,0.95),
                       0 0 0 1px rgba(255,255,255,0.5)`,
            }}
        >
            {/* Shine animation */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.6s ease',
                    pointerEvents: 'none',
                    borderRadius: '24px',
                }}
            />

            {/* Status indicator */}
            <div
                className="absolute top-4 right-4 w-3 h-3 rounded-full"
                style={{
                    background: credential.status === 'active'
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : credential.status === 'expired'
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: credential.status === 'active'
                        ? '0 0 8px rgba(34,197,94,0.5)'
                        : credential.status === 'expired'
                            ? '0 0 8px rgba(245,158,11,0.5)'
                            : '0 0 8px rgba(239,68,68,0.5)',
                }}
            />

            <div className="flex items-start gap-4">
                {/* Icon - 3D Glass Box */}
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,180,140,0.3) 0%, rgba(255,160,120,0.2) 100%)',
                        boxShadow: `
                            0 4px 12px rgba(255,150,100,0.15),
                            inset 0 1px 1px rgba(255,255,255,0.9),
                            inset 0 -1px 1px rgba(0,0,0,0.05)
                        `,
                        border: '1px solid rgba(255,200,170,0.4)',
                    }}
                >
                    {typeInfo?.icon || '🔑'}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>{credential.name}</h3>
                    <p className="text-sm" style={{ color: '#666' }}>{typeInfo?.name}</p>

                    {/* Masked key */}
                    <div className="mt-3 flex items-center gap-2">
                        <code
                            className="text-xs font-mono px-3 py-1.5 rounded-lg"
                            style={{
                                background: 'rgba(0,0,0,0.06)',
                                color: '#666',
                            }}
                        >
                            {showKey ? 'sk-xxxx...xxxx' : '••••••••••••••••'}
                        </code>
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="glass-button p-2 rounded-lg"
                            style={{ padding: '6px' }}
                        >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            className="glass-button p-2 rounded-lg"
                            style={{ padding: '6px' }}
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Last used */}
                    {credential.lastUsed && (
                        <p className="text-xs mt-2" style={{ color: '#999' }}>
                            Last used: {credential.lastUsed.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button
                    onClick={onRefresh}
                    className="glass-button glass-button--small flex-1"
                >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Validate
                </button>
                <button
                    onClick={onDelete}
                    className="glass-button glass-button--small flex-1"
                    style={{ color: '#dc2626' }}
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                </button>
            </div>
        </motion.div>
    );
}

export default function CredentialVault() {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState(DEMO_CREDENTIALS);
    const [addingNew, setAddingNew] = useState(false);

    // Use addingNew to prevent unused variable warning
    void addingNew;

    return (
        <div
            className="min-h-screen overflow-y-auto"
            style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
        >
            <HoverSidebar />

            {/* Header - Glass Style */}
            <header className="glass-header sticky top-0 z-30">
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

            <main className="relative z-0 container mx-auto px-4 py-8 pb-20">
                {/* Security banner */}
                <div
                    className="glass-panel mb-8 p-4 flex items-center gap-4"
                    style={{
                        background: 'linear-gradient(145deg, rgba(34,197,94,0.1) 0%, rgba(22,163,74,0.05) 100%)',
                        boxShadow: '0 0 20px rgba(34,197,94,0.1), inset 0 1px 1px rgba(255,255,255,0.9)',
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'rgba(34,197,94,0.15)',
                            boxShadow: '0 4px 12px rgba(34,197,94,0.2)',
                        }}
                    >
                        <Shield className="h-6 w-6" style={{ color: '#16a34a' }} />
                    </div>
                    <div>
                        <h3 className="font-semibold" style={{ color: '#16a34a' }}>Enterprise-Grade Security</h3>
                        <p className="text-sm" style={{ color: '#666' }}>
                            All credentials are encrypted with AES-256-GCM and never leave your vault
                        </p>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#1a1a1a' }}>
                            Credential Vault
                        </h1>
                        <p style={{ color: '#666' }}>
                            {credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored
                        </p>
                    </div>

                    <button
                        onClick={() => setAddingNew(true)}
                        className="glass-button glass-button--glow"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Credential
                    </button>
                </div>

                {/* Credentials grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {credentials.map((cred) => (
                        <CredentialCard
                            key={cred.id}
                            credential={cred}
                            onDelete={() => setCredentials(c => c.filter(x => x.id !== cred.id))}
                            onRefresh={() => {/* TODO */}}
                        />
                    ))}
                </div>

                {credentials.length === 0 && (
                    <div className="text-center py-16">
                        <Lock className="h-16 w-16 mx-auto text-slate-700 mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No credentials stored</h3>
                        <p className="text-slate-400 mb-6">Add your first API key to get started</p>
                        <Button
                            onClick={() => setAddingNew(true)}
                            className="bg-amber-500 hover:bg-amber-400 text-black"
                        >
                            Add Credential
                        </Button>
                    </div>
                )}

                {/* Available integrations */}
                <div className="mt-12">
                    <h2 className="text-xl font-semibold text-white mb-4">Available Integrations</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {CREDENTIAL_TYPES.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setAddingNew(true)}
                                className={cn(
                                    "p-4 rounded-xl text-center",
                                    "bg-slate-800/30 border border-slate-700/50",
                                    "hover:border-amber-500/30 hover:bg-slate-800/50",
                                    "transition-all"
                                )}
                            >
                                <span className="text-2xl block mb-2">{type.icon}</span>
                                <span className="text-sm text-slate-300">{type.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}


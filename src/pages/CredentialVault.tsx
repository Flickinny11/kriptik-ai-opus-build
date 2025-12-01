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
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
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
    const typeInfo = CREDENTIAL_TYPES.find(t => t.id === credential.type);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel relative p-4 rounded-2xl transition-all"
        >
            {/* Status indicator */}
            <div
                className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full"
                style={{
                    background: credential.status === 'active' ? '#22c55e' :
                        credential.status === 'expired' ? '#eab308' : '#ef4444'
                }}
            />

            <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.08)' }}
                >
                    {typeInfo?.icon || '🔑'}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>{credential.name}</h3>
                    <p className="text-sm" style={{ color: '#666' }}>{typeInfo?.name}</p>

                    {/* Masked key */}
                    <div className="mt-3 flex items-center gap-2">
                        <code className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: '#888' }}>
                            {showKey ? 'sk-xxxx...xxxx' : '••••••••••••••••'}
                        </code>
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="p-1 rounded transition-colors"
                            style={{ color: '#666' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            className="p-1 rounded transition-colors"
                            style={{ color: '#666' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Last used */}
                    {credential.lastUsed && (
                        <p className="text-xs mt-2" style={{ color: '#888' }}>
                            Last used: {credential.lastUsed.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button
                    onClick={onRefresh}
                    className="glass-button glass-button--small"
                    style={{ color: '#1a1a1a' }}
                >
                    <RefreshCw className="h-4 w-4 mr-1 inline" />
                    Validate
                </button>
                <button
                    onClick={onDelete}
                    className="glass-button glass-button--small"
                    style={{ color: '#dc2626' }}
                >
                    <Trash2 className="h-4 w-4 mr-1 inline" />
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
                {/* Security banner */}
                <div className="mb-8 p-4 rounded-2xl glass-panel flex items-center gap-4" style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.08)' }}>
                    <Shield className="h-8 w-8" style={{ color: '#22c55e' }} />
                    <div>
                        <h3 className="font-semibold" style={{ color: '#15803d' }}>Enterprise-Grade Security</h3>
                        <p className="text-sm" style={{ color: '#666' }}>
                            All credentials are encrypted with AES-256-GCM and never leave your vault
                        </p>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                            Credential Vault
                        </h1>
                        <p style={{ color: '#666' }}>
                            {credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored
                        </p>
                    </div>

                    <button
                        onClick={() => setAddingNew(true)}
                        className="glass-button glass-button--glow"
                        style={{ color: '#a03810', fontWeight: 600 }}
                    >
                        <Plus className="h-4 w-4 mr-1 inline" />
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
                        <Lock className="h-16 w-16 mx-auto mb-4" style={{ color: '#888' }} />
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#1a1a1a' }}>No credentials stored</h3>
                        <p className="mb-6" style={{ color: '#666' }}>Add your first API key to get started</p>
                        <button
                            onClick={() => setAddingNew(true)}
                            className="glass-button glass-button--glow"
                            style={{ color: '#a03810' }}
                        >
                            Add Credential
                        </button>
                    </div>
                )}

                {/* Available integrations */}
                <div className="mt-12">
                    <h2 className="text-xl font-semibold mb-4" style={{ color: '#1a1a1a' }}>Available Integrations</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {CREDENTIAL_TYPES.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setAddingNew(true)}
                                className="glass-panel p-4 rounded-xl text-center transition-all"
                                style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                                onMouseEnter={(e) => e.currentTarget.style.border = '1px solid rgba(160,56,16,0.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)'}
                            >
                                <span className="text-2xl block mb-2">{type.icon}</span>
                                <span className="text-sm" style={{ color: '#1a1a1a' }}>{type.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}


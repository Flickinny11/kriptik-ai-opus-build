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
            className={cn(
                "relative p-4 rounded-2xl",
                "bg-slate-800/50 border border-slate-700/50",
                "hover:border-slate-600 transition-all"
            )}
        >
            {/* Status indicator */}
            <div className={cn(
                "absolute top-4 right-4 w-2.5 h-2.5 rounded-full",
                credential.status === 'active' && "bg-emerald-500",
                credential.status === 'expired' && "bg-amber-500",
                credential.status === 'invalid' && "bg-red-500",
            )} />

            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                    "bg-gradient-to-br",
                    typeInfo?.color || 'from-slate-600 to-slate-700'
                )}>
                    {typeInfo?.icon || '🔑'}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white">{credential.name}</h3>
                    <p className="text-sm text-slate-400">{typeInfo?.name}</p>

                    {/* Masked key */}
                    <div className="mt-3 flex items-center gap-2">
                        <code className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">
                            {showKey ? 'sk-xxxx...xxxx' : '••••••••••••••••'}
                        </code>
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400"
                        >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button className="p-1 rounded hover:bg-slate-700 text-slate-400">
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Last used */}
                    {credential.lastUsed && (
                        <p className="text-xs text-slate-500 mt-2">
                            Last used: {credential.lastUsed.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRefresh}
                    className="text-slate-400 hover:text-white"
                >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Validate
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                </Button>
            </div>
        </motion.div>
    );
}

export default function CredentialVault() {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState(DEMO_CREDENTIALS);

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
                {/* Security banner */}
                <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4">
                    <Shield className="h-8 w-8 text-emerald-500" />
                    <div>
                        <h3 className="font-semibold text-emerald-400">Enterprise-Grade Security</h3>
                        <p className="text-sm text-slate-400">
                            All credentials are encrypted with AES-256-GCM and never leave your vault
                        </p>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                            Credential Vault
                        </h1>
                        <p className="text-slate-400">
                            {credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored
                        </p>
                    </div>

                    <Button
                        onClick={() => setAddingNew(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Credential
                    </Button>
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


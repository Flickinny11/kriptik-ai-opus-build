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
import { motion, AnimatePresence } from 'framer-motion';
import {
    OpenAIIcon,
    AnthropicIcon,
    VercelIcon,
    GitHubIcon,
    StripeIcon,
    SupabaseIcon,
    TursoIcon,
    AWSIcon,
    GoogleIcon,
    RunPodIcon,
    PlusIcon,
    EyeIcon,
    EyeOffIcon,
    TrashIcon,
    RefreshIcon,
    ShieldIcon,
    LockIcon,
    CopyIcon,
    KeyIcon,
    CloseIcon,
    LoadingIcon,
} from '../components/ui/icons';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import '../styles/realistic-glass.css';

// Credential types with custom icons
const CREDENTIAL_TYPES = [
    { id: 'openai', name: 'OpenAI', Icon: OpenAIIcon, color: '#10a37f' },
    { id: 'anthropic', name: 'Anthropic', Icon: AnthropicIcon, color: '#c25a00' },
    { id: 'vercel', name: 'Vercel', Icon: VercelIcon, color: '#1a1a1a' },
    { id: 'github', name: 'GitHub', Icon: GitHubIcon, color: '#333' },
    { id: 'stripe', name: 'Stripe', Icon: StripeIcon, color: '#635bff' },
    { id: 'supabase', name: 'Supabase', Icon: SupabaseIcon, color: '#3ecf8e' },
    { id: 'turso', name: 'Turso', Icon: TursoIcon, color: '#00c4b4' },
    { id: 'aws', name: 'AWS', Icon: AWSIcon, color: '#ff9900' },
    { id: 'gcp', name: 'Google Cloud', Icon: GoogleIcon, color: '#4285f4' },
    { id: 'runpod', name: 'RunPod', Icon: RunPodIcon, color: '#673ab7' },
];

interface StoredCredential {
    id: string;
    type: string;
    name: string;
    status: 'active' | 'expired' | 'invalid' | 'validating';
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
    const IconComponent = typeInfo?.Icon || KeyIcon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="glass-panel p-5 rounded-2xl transition-all duration-500"
            style={{
                position: 'relative',
                height: '100%',
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
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
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
                    <IconComponent size={24} />
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
                            {showKey ? 'sk-xxxx...xxxx' : String.fromCharCode(0x2022).repeat(16)}
                        </code>
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="glass-button p-2 rounded-lg"
                            style={{ padding: '6px' }}
                        >
                            {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </button>
                        <button
                            className="glass-button p-2 rounded-lg"
                            style={{ padding: '6px' }}
                        >
                            <CopyIcon size={14} />
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
                    className="glass-button glass-button--small flex-1 flex items-center justify-center"
                >
                    <RefreshIcon size={16} />
                    <span className="ml-1">Validate</span>
                </button>
                <button
                    onClick={onDelete}
                    className="glass-button glass-button--small flex-1 flex items-center justify-center"
                    style={{ color: '#dc2626' }}
                >
                    <TrashIcon size={16} />
                    <span className="ml-1">Remove</span>
                </button>
            </div>
        </motion.div>
    );
}

export default function CredentialVault() {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState(DEMO_CREDENTIALS);
    const [addingNew, setAddingNew] = useState(false);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [credentialName, setCredentialName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveCredential = async () => {
        if (!selectedType || !apiKey.trim()) return;

        setIsSaving(true);

        // Simulate API call - replace with actual backend integration
        // Backend integration point: POST /api/credentials
        // Payload: { type: selectedType, name: credentialName || typeInfo.name, apiKey: encrypted }
        await new Promise(resolve => setTimeout(resolve, 800));

        const typeInfo = CREDENTIAL_TYPES.find(t => t.id === selectedType);
        const newCredential: StoredCredential = {
            id: Date.now().toString(),
            type: selectedType,
            name: credentialName || `${typeInfo?.name || 'API'} Key`,
            status: 'active',
            createdAt: new Date(),
        };

        setCredentials(prev => [...prev, newCredential]);
        setAddingNew(false);
        setSelectedType(null);
        setApiKey('');
        setCredentialName('');
        setIsSaving(false);
    };

    const handleValidateCredential = async (credentialId: string) => {
        // Update status to validating
        setCredentials(prev => prev.map(c =>
            c.id === credentialId ? { ...c, status: 'validating' as const } : c
        ));

        // Simulate validation API call
        // Backend integration point: POST /api/credentials/:id/validate
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Update with validation result (simulated success)
        setCredentials(prev => prev.map(c =>
            c.id === credentialId ? { ...c, status: 'active', lastUsed: new Date() } : c
        ));
    };

    const handleCloseModal = () => {
        setAddingNew(false);
        setSelectedType(null);
        setApiKey('');
        setCredentialName('');
    };

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
                        <ShieldIcon size={24} />
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
                        className="glass-button glass-button--glow flex items-center"
                    >
                        <PlusIcon size={16} />
                        <span className="ml-2">Add Credential</span>
                    </button>
                </div>

                {/* Credentials grid */}
                <div
                    className="gap-4"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    }}
                >
                    {credentials.map((cred) => (
                        <CredentialCard
                            key={cred.id}
                            credential={cred}
                            onDelete={() => setCredentials(c => c.filter(x => x.id !== cred.id))}
                            onRefresh={() => handleValidateCredential(cred.id)}
                        />
                    ))}
                </div>

                {credentials.length === 0 && (
                    <div className="glass-panel text-center py-16">
                        <div
                            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                            style={{ background: 'rgba(255,180,140,0.2)' }}
                        >
                            <LockIcon size={40} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>No credentials stored</h3>
                        <p className="mb-6" style={{ color: '#666' }}>Add your first API key to get started</p>
                        <button
                            onClick={() => setAddingNew(true)}
                            className="glass-button glass-button--glow flex items-center mx-auto"
                        >
                            <PlusIcon size={16} />
                            <span className="ml-2">Add Credential</span>
                        </button>
                    </div>
                )}

                {/* Available integrations */}
                <div className="mt-12">
                    <h2 className="text-xl font-semibold mb-4" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>Available Integrations</h2>
                    <div
                        className="gap-3"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        }}
                    >
                        {CREDENTIAL_TYPES.map((type) => {
                            const IconComp = type.Icon;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setAddingNew(true)}
                                    className="glass-panel p-4 rounded-xl text-center transition-all hover:scale-105"
                                    style={{
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                                        style={{ background: 'rgba(255,180,140,0.2)' }}
                                    >
                                        <IconComp size={20} />
                                    </div>
                                    <span className="text-sm" style={{ color: '#1a1a1a' }}>{type.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Add Credential Modal */}
            <AnimatePresence>
                {addingNew && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}
                        onClick={handleCloseModal}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 50%, rgba(248,248,250,0.8) 100%)',
                                boxShadow: `
                                    0 25px 80px rgba(0,0,0,0.15),
                                    0 10px 30px rgba(0,0,0,0.1),
                                    inset 0 1px 1px rgba(255,255,255,1),
                                    0 0 0 1px rgba(255,255,255,0.6)
                                `,
                            }}
                        >
                            {/* Modal Header */}
                            <div
                                className="flex items-center justify-between p-5"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,180,140,0.3) 0%, rgba(255,160,120,0.2) 100%)',
                                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9)',
                                        }}
                                    >
                                        <KeyIcon size={20} />
                                    </div>
                                    <h2 className="text-xl font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                                        Add Credential
                                    </h2>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="glass-button p-2 rounded-lg"
                                    style={{ padding: '8px' }}
                                >
                                    <CloseIcon size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 space-y-5">
                                {/* Credential Type Selector */}
                                <div>
                                    <label className="block text-sm font-medium mb-3" style={{ color: '#1a1a1a' }}>
                                        Select Service
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {CREDENTIAL_TYPES.map((type) => {
                                            const IconComp = type.Icon;
                                            const isSelected = selectedType === type.id;
                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setSelectedType(type.id)}
                                                    className="p-3 rounded-xl text-center transition-all"
                                                    style={{
                                                        background: isSelected
                                                            ? 'linear-gradient(145deg, rgba(255,180,140,0.4) 0%, rgba(255,160,120,0.3) 100%)'
                                                            : 'rgba(0,0,0,0.04)',
                                                        boxShadow: isSelected
                                                            ? '0 4px 12px rgba(255,150,100,0.2), inset 0 1px 1px rgba(255,255,255,0.9), 0 0 0 2px rgba(194,90,0,0.3)'
                                                            : 'inset 0 1px 1px rgba(255,255,255,0.5)',
                                                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                                    }}
                                                >
                                                    <div className="mx-auto mb-1 flex justify-center">
                                                        <IconComp size={20} />
                                                    </div>
                                                    <span
                                                        className="text-xs block truncate"
                                                        style={{ color: isSelected ? '#1a1a1a' : '#666' }}
                                                    >
                                                        {type.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Credential Name */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
                                        Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={credentialName}
                                        onChange={(e) => setCredentialName(e.target.value)}
                                        placeholder={selectedType ? `${CREDENTIAL_TYPES.find(t => t.id === selectedType)?.name || ''} Key` : 'My API Key'}
                                        className="glass-input w-full px-4 py-3 rounded-xl"
                                        style={{
                                            background: 'rgba(255,255,255,0.6)',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            color: '#1a1a1a',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* API Key Input */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="sk-xxxx..."
                                        className="glass-input w-full px-4 py-3 rounded-xl font-mono text-sm"
                                        style={{
                                            background: 'rgba(255,255,255,0.6)',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            color: '#1a1a1a',
                                            outline: 'none',
                                        }}
                                    />
                                    <p className="text-xs mt-2" style={{ color: '#999' }}>
                                        Your key will be encrypted with AES-256-GCM before storage
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div
                                className="flex gap-3 p-5"
                                style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
                            >
                                <button
                                    onClick={handleCloseModal}
                                    className="glass-button flex-1 py-3"
                                    style={{ color: '#666' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCredential}
                                    disabled={!selectedType || !apiKey.trim() || isSaving}
                                    className="glass-button glass-button--glow flex-1 py-3"
                                    style={{
                                        opacity: (!selectedType || !apiKey.trim() || isSaving) ? 0.5 : 1,
                                        cursor: (!selectedType || !apiKey.trim() || isSaving) ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {isSaving ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <LoadingIcon size={16} />
                                            Saving...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <ShieldIcon size={16} />
                                            Save Credential
                                        </span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

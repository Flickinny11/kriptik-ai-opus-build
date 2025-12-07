/**
 * API Profile Card
 *
 * Card displaying API details with endpoint list.
 */

import { motion } from 'framer-motion';
import { Key, Shield, Zap, ChevronRight } from 'lucide-react';

const accentColor = '#c8ff64';

interface CatalogEntry {
    name: string;
    provider: string;
    category: string;
    description: string;
    docUrl: string;
    logo?: string;
    popular: boolean;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
}

interface APIProfileCardProps {
    entry: CatalogEntry;
    onSelect: () => void;
    variant?: 'grid' | 'list';
}

export function APIProfileCard({
    entry,
    onSelect,
    variant = 'grid',
}: APIProfileCardProps) {
    const getAuthIcon = (authType: string) => {
        switch (authType) {
            case 'oauth2':
                return <Shield className="w-3 h-3" />;
            case 'api-key':
            case 'bearer':
                return <Key className="w-3 h-3" />;
            default:
                return <Zap className="w-3 h-3" />;
        }
    };

    const getAuthLabel = (authType: string) => {
        switch (authType) {
            case 'oauth2': return 'OAuth 2.0';
            case 'api-key': return 'API Key';
            case 'bearer': return 'Bearer Token';
            case 'basic': return 'Basic Auth';
            default: return 'No Auth';
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            payments: '#8b5cf6',
            communication: '#3b82f6',
            email: '#ec4899',
            ai: '#10b981',
            database: '#f59e0b',
            backend: '#6366f1',
            maps: '#14b8a6',
            search: '#f97316',
            media: '#a855f7',
            developer: '#64748b',
            productivity: '#22c55e',
            deployment: '#0ea5e9',
            fintech: '#84cc16',
        };
        return colors[category] || '#6b7280';
    };

    if (variant === 'list') {
        return (
            <motion.button
                onClick={onSelect}
                whileHover={{ scale: 1.01, x: 4 }}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all group text-left"
            >
                {/* Logo */}
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                    {entry.logo ? (
                        <img
                            src={entry.logo}
                            alt={entry.name}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <span className="text-2xl font-bold text-white/30">
                            {entry.name.charAt(0)}
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{entry.name}</h3>
                        {entry.popular && (
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: `${accentColor}20`, color: accentColor }}
                            >
                                Popular
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-white/50 truncate">{entry.description}</p>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                        className="text-xs px-2 py-1 rounded-full capitalize"
                        style={{ background: `${getCategoryColor(entry.category)}20`, color: getCategoryColor(entry.category) }}
                    >
                        {entry.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-white/40 px-2 py-1 rounded-full bg-white/5">
                        {getAuthIcon(entry.authType)}
                        {getAuthLabel(entry.authType)}
                    </span>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" />
            </motion.button>
        );
    }

    // Grid variant
    return (
        <motion.button
            onClick={onSelect}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all group text-left flex flex-col"
            style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                    {entry.logo ? (
                        <img
                            src={entry.logo}
                            alt={entry.name}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <span className="text-2xl font-bold text-white/30">
                            {entry.name.charAt(0)}
                        </span>
                    )}
                </div>
                {entry.popular && (
                    <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                        Popular
                    </span>
                )}
            </div>

            {/* Name and description */}
            <h3 className="font-semibold text-white mb-1">{entry.name}</h3>
            <p className="text-sm text-white/50 line-clamp-2 flex-1 mb-3">
                {entry.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span
                    className="text-xs px-2 py-1 rounded-full capitalize"
                    style={{ background: `${getCategoryColor(entry.category)}20`, color: getCategoryColor(entry.category) }}
                >
                    {entry.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/40">
                    {getAuthIcon(entry.authType)}
                    {getAuthLabel(entry.authType)}
                </span>
            </div>

            {/* Hover indicator */}
            <motion.div
                className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: accentColor }}
            />
        </motion.button>
    );
}


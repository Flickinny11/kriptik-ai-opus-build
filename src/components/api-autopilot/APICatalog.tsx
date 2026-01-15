/**
 * API Catalog
 *
 * Searchable catalog of popular APIs with category filters.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, LayoutDashboardIcon } from '../ui/icons';
import { APIProfileCard } from './APIProfileCard';

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

interface APICatalogProps {
    catalog: CatalogEntry[];
    categories: string[];
    onSelectAPI: (entry: CatalogEntry) => void;
    isLoading?: boolean;
}

export function APICatalog({
    catalog,
    categories,
    onSelectAPI,
    isLoading = false,
}: APICatalogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredCatalog = useMemo(() => {
        return catalog.filter(api => {
            const matchesSearch = !searchQuery ||
                api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                api.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                api.provider.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = !selectedCategory || api.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [catalog, searchQuery, selectedCategory]);

    const getCategoryIcon = (category: string) => {
        const icons: Record<string, string> = {
            payments: 'PAY',
            communication: 'COM',
            email: 'ML',
            ai: 'AI',
            database: 'DB',
            backend: 'BE',
            maps: 'MAP',
            search: 'SRC',
            media: 'MED',
            developer: 'DEV',
            productivity: 'PRD',
            deployment: 'DPL',
            fintech: 'FIN',
        };
        return icons[category] || 'API';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Search and filters */}
            <div className="p-4 border-b border-white/10 space-y-3">
                {/* Search input */}
                <div className="relative">
                    <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search APIs..."
                        className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': accentColor } as any}
                    />
                </div>

                {/* Category filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            !selectedCategory
                                ? 'text-black'
                                : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
                        }`}
                        style={{
                            background: !selectedCategory ? accentColor : undefined,
                        }}
                    >
                        All
                    </button>
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                                selectedCategory === category
                                    ? 'text-black'
                                    : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
                            }`}
                            style={{
                                background: selectedCategory === category ? accentColor : undefined,
                            }}
                        >
                            <span>{getCategoryIcon(category)}</span>
                            <span className="capitalize">{category}</span>
                        </button>
                    ))}
                </div>

                {/* View toggle */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">
                        {filteredCatalog.length} APIs available
                    </span>
                    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            <LayoutDashboardIcon size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded transition-all ${
                                viewMode === 'list'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            <LayoutDashboardIcon size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Catalog grid/list */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="w-8 h-8 border-2 border-t-transparent rounded-full"
                                style={{ borderColor: `${accentColor}40`, borderTopColor: 'transparent' }}
                            />
                            <span className="text-sm text-white/50">Loading catalog...</span>
                        </div>
                    </div>
                ) : filteredCatalog.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <SearchIcon size={48} className="text-white/20 mx-auto mb-3" />
                            <p className="text-white/60">No APIs found matching your search</p>
                            <p className="text-sm text-white/40 mt-1">Try a different search term or category</p>
                        </div>
                    </div>
                ) : (
                    <div
                        className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                                : 'space-y-3'
                        }
                    >
                        <AnimatePresence>
                            {filteredCatalog.map((api, index) => (
                                <motion.div
                                    key={api.provider}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <APIProfileCard
                                        entry={api}
                                        onSelect={() => onSelectAPI(api)}
                                        variant={viewMode}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}


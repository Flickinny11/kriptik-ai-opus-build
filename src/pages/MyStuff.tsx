/**
 * My Stuff Page - User's Projects
 *
 * Features:
 * - 3D thumbnail previews of projects with photorealistic effects
 * - Three-dot menu with edit, delete, clone, share, import
 * - Import component/element into existing project
 * - Fix My App integration with immersive intro
 * - Premium visual design with microanimations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MoreVertical, Pencil, Trash2, Copy, Share2, Download,
    Plus, Search, Grid3X3, List, Calendar,
    ExternalLink, Wrench
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import type { Project } from '../store/useProjectStore';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { FixMyAppIntro } from '../components/fix-my-app/FixMyAppIntro';
import { cn } from '@/lib/utils';

// Project thumbnail card with 3D effects
function ProjectCard({
    project,
    onOpen,
    onEdit,
    onDelete,
    onClone,
    onShare,
    onImport,
}: {
    project: Project;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onClone: () => void;
    onShare: () => void;
    onImport: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const menuItems = [
        { id: 'edit', icon: Pencil, label: 'Edit', action: onEdit },
        { id: 'clone', icon: Copy, label: 'Clone', action: onClone },
        { id: 'share', icon: Share2, label: 'Share', action: onShare },
        { id: 'import', icon: Download, label: 'Import to...', action: onImport },
        { id: 'delete', icon: Trash2, label: 'Delete', action: onDelete, danger: true },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setMenuOpen(false); }}
            className="relative group"
            style={{ perspective: '1000px' }}
        >
            {/* Card with 3D effect */}
            <motion.div
                animate={{
                    rotateX: isHovered ? 2 : 0,
                    rotateY: isHovered ? -2 : 0,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "relative rounded-2xl overflow-hidden cursor-pointer",
                    "bg-gradient-to-br from-slate-800/80 to-slate-900/80",
                    "border border-slate-700/50",
                    "shadow-xl shadow-black/20",
                    "hover:border-amber-500/30 hover:shadow-amber-500/10",
                    "transition-all duration-300"
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    boxShadow: isHovered
                        ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,191,36,0.1)'
                        : '0 10px 40px -10px rgba(0,0,0,0.3)',
                }}
                onClick={onOpen}
            >
                {/* Thumbnail preview */}
                <div className="aspect-[16/10] relative overflow-hidden">
                    {/* Fake browser chrome */}
                    <div className="absolute top-0 left-0 right-0 h-7 bg-slate-800/90 backdrop-blur flex items-center gap-1.5 px-3 z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                        <div className="flex-1 mx-4 h-4 bg-slate-700/50 rounded-full flex items-center px-2">
                            <span className="text-[8px] text-slate-500 font-mono truncate">
                                {project.name.toLowerCase().replace(/\s+/g, '-')}.kriptik.app
                            </span>
                        </div>
                    </div>

                    {/* Gradient preview placeholder */}
                    <div className="absolute inset-0 pt-7 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                        {/* Simulated content lines */}
                        <div className="p-4 space-y-3">
                            <div className="h-6 w-32 bg-gradient-to-r from-amber-500/30 to-orange-500/20 rounded" />
                            <div className="h-3 w-full bg-slate-700/40 rounded" />
                            <div className="h-3 w-4/5 bg-slate-700/30 rounded" />
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <div className="h-12 bg-slate-700/30 rounded-lg" />
                                <div className="h-12 bg-slate-700/30 rounded-lg" />
                                <div className="h-12 bg-slate-700/30 rounded-lg" />
                            </div>
                        </div>
                    </div>

                    {/* Hover overlay with open button */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-center pb-4"
                    >
                        <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open Project
                        </Button>
                    </motion.div>
                </div>

                {/* Project info */}
                <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-white truncate text-lg">
                                {project.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                <span className="text-xs text-slate-500 font-mono">
                                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Three-dot menu */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(!menuOpen);
                                }}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    "hover:bg-slate-700/50 text-slate-400 hover:text-white",
                                    menuOpen && "bg-slate-700/50 text-white"
                                )}
                            >
                                <MoreVertical className="h-5 w-5" />
                            </button>

                            {/* Dropdown menu */}
                            <AnimatePresence>
                                {menuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className={cn(
                                            "absolute right-0 top-full mt-2 w-48 z-50",
                                            "bg-slate-800 border border-slate-700 rounded-xl",
                                            "shadow-2xl shadow-black/50 overflow-hidden"
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {menuItems.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    item.action();
                                                    setMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-4 py-2.5",
                                                    "text-sm text-left transition-colors",
                                                    item.danger
                                                        ? "text-red-400 hover:bg-red-500/10"
                                                        : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                                                )}
                                            >
                                                <item.icon className="h-4 w-4" />
                                                {item.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex gap-2 mt-3">
                        <span className={cn(
                            "px-2.5 py-1 text-xs rounded-full font-medium",
                            "bg-slate-700/50 text-slate-400"
                        )}>
                            {project.framework || 'React'}
                        </span>
                        <span className={cn(
                            "px-2.5 py-1 text-xs rounded-full font-medium",
                            project.status === 'live'
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-amber-500/20 text-amber-400"
                        )}>
                            {project.status === 'live' ? 'Live' : 'In Progress'}
                        </span>
                    </div>
                </div>

                {/* 3D edge highlight */}
                <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                        opacity: isHovered ? 1 : 0.5,
                        transition: 'opacity 0.3s',
                    }}
                />
            </motion.div>
        </motion.div>
    );
}

// Import to project modal
function ImportModal({
    open,
    onClose,
    projects,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    projects: Project[];
    onSelect: (projectId: string) => void;
}) {
    if (!open) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className={cn(
                    "w-full max-w-md bg-slate-900 rounded-2xl",
                    "border border-slate-700 shadow-2xl shadow-black/50",
                    "overflow-hidden"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-800">
                    <h3 className="text-xl font-bold text-white">Import to Project</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Select a project to import this component into
                    </p>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto space-y-2">
                    {projects.map((project) => (
                        <button
                            key={project.id}
                            onClick={() => onSelect(project.id)}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl",
                                "bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50",
                                "transition-all duration-200 text-left"
                            )}
                        >
                            <div className="w-12 h-8 rounded bg-slate-700 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-white truncate">{project.name}</p>
                                <p className="text-xs text-slate-500">{project.framework}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Main component
export default function MyStuff() {
    const navigate = useNavigate();
    const { projects, addProject, removeProject } = useProjectStore();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [showFixMyAppIntro, setShowFixMyAppIntro] = useState(false);

    // Filter projects by search
    const filteredProjects = projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleImport = (projectId: string) => {
        setSelectedProject(projectId);
        setImportModalOpen(true);
    };

    const handleImportSelect = (targetProjectId: string) => {
        // Navigate to builder with import mode
        navigate(`/builder/${targetProjectId}`, {
            state: {
                importMode: true,
                sourceProjectId: selectedProject,
            },
        });
        setImportModalOpen(false);
    };

    const handleFixMyAppComplete = () => {
        setShowFixMyAppIntro(false);
        navigate('/fix-my-app');
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            {/* Fix My App Immersive Intro */}
            <AnimatePresence>
                {showFixMyAppIntro && (
                    <FixMyAppIntro onComplete={handleFixMyAppComplete} />
                )}
            </AnimatePresence>

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

            {/* Main content */}
            <main className="container mx-auto px-4 py-8">
                {/* Page header with premium 3D styling */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                            My Stuff
                        </h1>
                        <p className="text-slate-400">
                            {projects.length} project{projects.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Fix My App Button - Premium 3D */}
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowFixMyAppIntro(true)}
                            className={cn(
                                "relative px-5 py-3 rounded-xl font-semibold",
                                "bg-gradient-to-br from-red-500 via-orange-500 to-amber-500",
                                "text-white shadow-lg",
                                "overflow-hidden group"
                            )}
                            style={{
                                boxShadow: `
                                    0 4px 0 rgba(0,0,0,0.3),
                                    0 8px 20px rgba(239,68,68,0.3),
                                    inset 0 1px 0 rgba(255,255,255,0.3)
                                `,
                            }}
                        >
                            {/* Glowing edge effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* 3D depth indicator */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20" />

                            <span className="relative flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                Fix My App
                            </span>
                        </motion.button>

                        {/* New Project Button - Premium 3D */}
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/dashboard')}
                            className={cn(
                                "relative px-5 py-3 rounded-xl font-semibold",
                                "bg-gradient-to-br from-amber-400 to-orange-500",
                                "text-black shadow-lg",
                                "overflow-hidden group"
                            )}
                            style={{
                                boxShadow: `
                                    0 4px 0 rgba(0,0,0,0.2),
                                    0 8px 20px rgba(251,191,36,0.3),
                                    inset 0 1px 0 rgba(255,255,255,0.4)
                                `,
                            }}
                        >
                            {/* Glowing edge effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* 3D depth indicator */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10" />

                            <span className="relative flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                New Project
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search projects..."
                            className={cn(
                                "w-full pl-10 pr-4 py-2.5 rounded-xl",
                                "bg-slate-800/50 border border-slate-700/50",
                                "text-white placeholder:text-slate-500",
                                "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                            )}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                viewMode === 'grid'
                                    ? "bg-amber-500 text-black"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                viewMode === 'list'
                                    ? "bg-amber-500 text-black"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Projects grid */}
                {filteredProjects.length > 0 ? (
                    <div className={cn(
                        viewMode === 'grid'
                            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            : "space-y-4"
                    )}>
                        {filteredProjects.map((project, index) => (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <ProjectCard
                                    project={project}
                                    onOpen={() => navigate(`/builder/${project.id}`)}
                                    onEdit={() => navigate(`/builder/${project.id}`)}
                                    onDelete={() => removeProject(project.id)}
                                    onClone={() => {
                                        addProject({
                                            ...project,
                                            id: crypto.randomUUID(),
                                            name: `${project.name} (Copy)`,
                                            createdAt: new Date(),
                                        });
                                    }}
                                    onShare={() => {/* TODO: Share modal */}}
                                    onImport={() => handleImport(project.id)}
                                />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        {/* 3D Icon Container */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative inline-block mb-6"
                        >
                            <div
                                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center"
                                style={{
                                    boxShadow: `
                                        0 4px 0 rgba(0,0,0,0.3),
                                        0 8px 20px rgba(0,0,0,0.4),
                                        inset 0 1px 0 rgba(255,255,255,0.1)
                                    `,
                                }}
                            >
                                <Layers className="h-10 w-10 text-slate-400" />
                            </div>
                            {/* 3D depth */}
                            <div className="absolute -bottom-1 left-2 right-2 h-1 bg-slate-900 rounded-b-lg" />
                        </motion.div>

                        <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
                            {searchQuery ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p className="text-slate-400 max-w-md mx-auto mb-8">
                            {searchQuery
                                ? 'Try a different search term'
                                : 'Create your first project or fix a broken one from another platform'
                            }
                        </p>

                        {!searchQuery && (
                            <div className="flex items-center justify-center gap-4">
                                <motion.button
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowFixMyAppIntro(true)}
                                    className={cn(
                                        "px-6 py-3 rounded-xl font-semibold",
                                        "bg-gradient-to-br from-red-500 via-orange-500 to-amber-500",
                                        "text-white"
                                    )}
                                    style={{
                                        boxShadow: `
                                            0 4px 0 rgba(0,0,0,0.3),
                                            0 8px 20px rgba(239,68,68,0.3),
                                            inset 0 1px 0 rgba(255,255,255,0.3)
                                        `,
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <Wrench className="h-4 w-4" />
                                        Fix Broken App
                                    </span>
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate('/dashboard')}
                                    className={cn(
                                        "px-6 py-3 rounded-xl font-semibold",
                                        "bg-gradient-to-br from-amber-400 to-orange-500",
                                        "text-black"
                                    )}
                                    style={{
                                        boxShadow: `
                                            0 4px 0 rgba(0,0,0,0.2),
                                            0 8px 20px rgba(251,191,36,0.3),
                                            inset 0 1px 0 rgba(255,255,255,0.4)
                                        `,
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Create New
                                    </span>
                                </motion.button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Import modal */}
            <AnimatePresence>
                {importModalOpen && (
                    <ImportModal
                        open={importModalOpen}
                        onClose={() => setImportModalOpen(false)}
                        projects={projects.filter(p => p.id !== selectedProject)}
                        onSelect={handleImportSelect}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Need to import Layers
import { Layers } from 'lucide-react';


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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MoreVertical, Pencil, Trash2, Copy, Share2, Download,
    Plus, Search, Grid3X3, List, Calendar,
    ExternalLink, Wrench, Loader2
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import type { Project } from '../store/useProjectStore';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { FixMyAppIntro } from '../components/fix-my-app/FixMyAppIntro';
import { cn } from '@/lib/utils';
import '../styles/realistic-glass.css';

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
                className="glass-panel relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
                style={{
                    transformStyle: 'preserve-3d',
                    boxShadow: isHovered
                        ? '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(160,56,16,0.2)'
                        : '0 10px 40px -10px rgba(0,0,0,0.1)',
                    border: isHovered ? '1px solid rgba(160,56,16,0.3)' : undefined,
                }}
                onClick={onOpen}
            >
                {/* Thumbnail preview */}
                <div className="aspect-[16/10] relative overflow-hidden">
                    {/* Fake browser chrome */}
                    <div className="absolute top-0 left-0 right-0 h-7 backdrop-blur flex items-center gap-1.5 px-3 z-10" style={{ background: 'rgba(255,255,255,0.6)' }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f56' }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#27ca40' }} />
                        <div className="flex-1 mx-4 h-4 rounded-full flex items-center px-2" style={{ background: 'rgba(0,0,0,0.05)' }}>
                            <span className="text-[8px] font-mono truncate" style={{ color: '#666' }}>
                                {project.name.toLowerCase().replace(/\s+/g, '-')}.kriptik.app
                            </span>
                        </div>
                    </div>

                    {/* Gradient preview placeholder */}
                    <div className="absolute inset-0 pt-7" style={{ background: 'linear-gradient(145deg, #e8e4df, #d8d4cf)' }}>
                        {/* Simulated content lines */}
                        <div className="p-4 space-y-3">
                            <div className="h-6 w-32 rounded" style={{ background: 'linear-gradient(90deg, rgba(160,56,16,0.3), rgba(234,88,12,0.2))' }} />
                            <div className="h-3 w-full rounded" style={{ background: 'rgba(0,0,0,0.08)' }} />
                            <div className="h-3 w-4/5 rounded" style={{ background: 'rgba(0,0,0,0.06)' }} />
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <div className="h-12 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }} />
                                <div className="h-12 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }} />
                                <div className="h-12 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                        </div>
                    </div>

                    {/* Hover overlay with open button */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        className="absolute inset-0 flex items-end justify-center pb-4"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }}
                    >
                        <button className="glass-button glass-button--small" style={{ padding: '8px 16px', color: '#1a1a1a', fontWeight: 600 }}>
                            <ExternalLink className="h-4 w-4 mr-2 inline" />
                            Open Project
                        </button>
                    </motion.div>
                </div>

                {/* Project info */}
                <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate text-lg" style={{ color: '#1a1a1a' }}>
                                {project.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                                <Calendar className="h-3 w-3" style={{ color: '#888' }} />
                                <span className="text-xs font-mono" style={{ color: '#888' }}>
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
                                className="p-2 rounded-lg transition-all"
                                style={{
                                    color: menuOpen ? '#1a1a1a' : '#666',
                                    background: menuOpen ? 'rgba(0,0,0,0.05)' : 'transparent',
                                }}
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
                                        className="absolute right-0 top-full mt-2 w-48 z-50 glass-panel rounded-xl overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {menuItems.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    item.action();
                                                    setMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                                                style={{
                                                    color: item.danger ? '#dc2626' : '#1a1a1a',
                                                    background: 'transparent',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = item.danger ? 'rgba(220,38,38,0.1)' : 'rgba(0,0,0,0.05)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                        <span className="px-2.5 py-1 text-xs rounded-full font-medium" style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>
                            {project.framework || 'React'}
                        </span>
                        <span
                            className="px-2.5 py-1 text-xs rounded-full font-medium"
                            style={{
                                background: project.status === 'live' ? 'rgba(34,197,94,0.15)' : 'rgba(160,56,16,0.15)',
                                color: project.status === 'live' ? '#15803d' : '#a03810',
                            }}
                        >
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
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-md glass-panel rounded-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Import to Project</h3>
                    <p className="text-sm mt-1" style={{ color: '#666' }}>
                        Select a project to import this component into
                    </p>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto space-y-2">
                    {projects.map((project) => (
                        <button
                            key={project.id}
                            onClick={() => onSelect(project.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left"
                            style={{
                                background: 'rgba(255,255,255,0.5)',
                                border: '1px solid rgba(0,0,0,0.08)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                        >
                            <div className="w-12 h-8 rounded flex-shrink-0" style={{ background: 'linear-gradient(145deg, #e8e4df, #d8d4cf)' }} />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium truncate" style={{ color: '#1a1a1a' }}>{project.name}</p>
                                <p className="text-xs" style={{ color: '#888' }}>{project.framework}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-4 flex justify-end" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <button className="glass-button glass-button--small" onClick={onClose} style={{ color: '#1a1a1a' }}>
                        Cancel
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Main component
export default function MyStuff() {
    const navigate = useNavigate();
    const { projects, addProject, removeProject, fetchProjects, isLoading } = useProjectStore();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [showFixMyAppIntro, setShowFixMyAppIntro] = useState(false);

    // Fetch projects from backend on mount
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

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
        <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
            {/* Fix My App Immersive Intro */}
            <AnimatePresence>
                {showFixMyAppIntro && (
                    <FixMyAppIntro onComplete={handleFixMyAppComplete} />
                )}
            </AnimatePresence>

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

            {/* Main content */}
            <main className="container mx-auto px-4 py-8">
                {/* Page header with premium 3D styling */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                            My Stuff
                        </h1>
                        <p style={{ color: '#666' }}>
                            {projects.length} project{projects.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Fix My App Button - Modern 3D Glass */}
                        <motion.button
                            whileHover={{ y: 2 }}
                            whileTap={{ y: 4 }}
                            onClick={() => setShowFixMyAppIntro(true)}
                            style={{
                                position: 'relative',
                                padding: '14px 26px',
                                borderRadius: '16px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                letterSpacing: '0.025em',
                                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                                background: 'linear-gradient(135deg, rgba(239,68,68,0.85) 0%, rgba(249,115,22,0.9) 50%, rgba(251,191,36,0.85) 100%)',
                                color: 'white',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                boxShadow: '0 5px 0 rgba(180,50,30,0.5), 0 10px 28px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.1)',
                                transform: 'translateY(-3px)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease-out',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                Fix My App
                            </span>
                        </motion.button>

                        {/* New Project Button - Modern 3D Glass */}
                        <motion.button
                            whileHover={{ y: 2 }}
                            whileTap={{ y: 4 }}
                            onClick={() => navigate('/dashboard')}
                            style={{
                                position: 'relative',
                                padding: '14px 26px',
                                borderRadius: '16px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                letterSpacing: '0.025em',
                                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.9) 0%, rgba(249,115,22,0.95) 60%, rgba(234,88,12,0.9) 100%)',
                                color: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.35)',
                                boxShadow: '0 5px 0 rgba(180,100,20,0.4), 0 10px 28px rgba(251,191,36,0.35), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)',
                                transform: 'translateY(-3px)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease-out',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                New Project
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#888' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search projects..."
                            className="glass-input w-full"
                            style={{ paddingLeft: '40px', color: '#1a1a1a' }}
                        />
                    </div>

                    <div className="flex items-center gap-2 glass-panel rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className="p-2 rounded-lg transition-colors"
                            style={{
                                background: viewMode === 'grid' ? 'rgba(160,56,16,0.9)' : 'transparent',
                                color: viewMode === 'grid' ? 'white' : '#666',
                            }}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className="p-2 rounded-lg transition-colors"
                            style={{
                                background: viewMode === 'list' ? 'rgba(160,56,16,0.9)' : 'transparent',
                                color: viewMode === 'list' ? 'white' : '#666',
                            }}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Projects grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: '#a03810' }} />
                        <p style={{ color: '#666' }}>Loading your projects...</p>
                    </div>
                ) : filteredProjects.length > 0 ? (
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
                                className="w-20 h-20 rounded-2xl glass-panel flex items-center justify-center"
                                style={{
                                    boxShadow: `
                                        0 4px 0 rgba(0,0,0,0.08),
                                        0 8px 20px rgba(0,0,0,0.1),
                                        inset 0 1px 0 rgba(255,255,255,0.8)
                                    `,
                                }}
                            >
                                <Layers className="h-10 w-10" style={{ color: '#a03810' }} />
                            </div>
                            {/* 3D depth */}
                            <div className="absolute -bottom-1 left-2 right-2 h-1 rounded-b-lg" style={{ background: 'rgba(0,0,0,0.1)' }} />
                        </motion.div>

                        <h3 className="text-2xl font-bold mb-3" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
                            {searchQuery ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p className="max-w-md mx-auto mb-8" style={{ color: '#666' }}>
                            {searchQuery
                                ? 'Try a different search term'
                                : 'Create your first project or fix a broken one from another platform'
                            }
                        </p>

                        {!searchQuery && (
                            <div className="flex items-center justify-center gap-5">
                                {/* Fix Broken App Button - Modern 3D Glass */}
                                <motion.button
                                    whileHover={{ y: 2 }}
                                    whileTap={{ y: 4 }}
                                    onClick={() => setShowFixMyAppIntro(true)}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 32px',
                                        borderRadius: '18px',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        letterSpacing: '0.03em',
                                        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                                        background: 'linear-gradient(135deg, rgba(239,68,68,0.85) 0%, rgba(249,115,22,0.9) 50%, rgba(251,191,36,0.85) 100%)',
                                        color: 'white',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        boxShadow: '0 5px 0 rgba(180,50,30,0.5), 0 10px 30px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.1)',
                                        transform: 'translateY(-3px)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease-out',
                                    }}
                                >
                                    <span className="flex items-center gap-3">
                                        <Wrench className="h-5 w-5" />
                                        Fix Broken App
                                    </span>
                                </motion.button>

                                {/* Create New Button - Modern 3D Glass */}
                                <motion.button
                                    whileHover={{ y: 2 }}
                                    whileTap={{ y: 4 }}
                                    onClick={() => navigate('/dashboard')}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 32px',
                                        borderRadius: '18px',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        letterSpacing: '0.03em',
                                        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                                        background: 'linear-gradient(135deg, rgba(251,191,36,0.9) 0%, rgba(249,115,22,0.95) 60%, rgba(234,88,12,0.9) 100%)',
                                        color: 'rgba(0,0,0,0.85)',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        border: '1px solid rgba(255,255,255,0.35)',
                                        boxShadow: '0 5px 0 rgba(180,100,20,0.4), 0 10px 30px rgba(251,191,36,0.35), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)',
                                        transform: 'translateY(-3px)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease-out',
                                    }}
                                >
                                    <span className="flex items-center gap-3">
                                        <Plus className="h-5 w-5" />
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


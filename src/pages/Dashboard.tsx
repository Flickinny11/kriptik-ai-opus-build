import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUserStore } from '../store/useUserStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import ProjectCard from '../components/dashboard/ProjectCard';
import NewProjectModal from '../components/dashboard/NewProjectModal';
import UsageStats from '../components/dashboard/UsageStats';
import TemplateGallery from '../components/templates/TemplateGallery';
import TemplateCustomizationModal from '../components/templates/TemplateCustomizationModal';
import WelcomeModal from '../components/onboarding/WelcomeModal';
import KeyboardShortcutsPanel from '../components/onboarding/KeyboardShortcutsPanel';
import InteractiveTutorial from '../components/onboarding/InteractiveTutorial';
import EmptyState from '../components/ui/EmptyState';
import { Search, Filter, LayoutTemplate, FolderOpen } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Dashboard() {
    const { user } = useUserStore();
    const { projects } = useProjectStore();
    const { setGalleryOpen } = useTemplateStore();
    const { hasCompletedOnboarding, setWelcomeModalOpen } = useOnboardingStore();

    // Show welcome modal for first-time users
    useEffect(() => {
        if (!hasCompletedOnboarding) {
            setTimeout(() => setWelcomeModalOpen(true), 500);
        }
    }, [hasCompletedOnboarding, setWelcomeModalOpen]);

    return (
        <div className="container mx-auto p-6 space-y-8">
            <WelcomeModal />
            <InteractiveTutorial />
            <KeyboardShortcutsPanel />
            <TemplateGallery />
            <TemplateCustomizationModal />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {user?.name || 'Builder'}. Here's what's happening with your projects.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setGalleryOpen(true)} className="gap-2">
                        <LayoutTemplate className="h-4 w-4" />
                        Browse Templates
                    </Button>
                    <NewProjectModal />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search projects..."
                                className="pl-8"
                            />
                        </div>
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {projects.length > 0 ? (
                            projects.map((project) => (
                                <ProjectCard key={project.id} project={project} />
                            ))
                        ) : (
                            <div className="col-span-full">
                                <EmptyState
                                    icon={FolderOpen}
                                    title="No projects yet"
                                    description="Start by creating your first app or choose from our templates."
                                    action={{
                                        label: 'New Project',
                                        onClick: () => { } // Opens NewProjectModal
                                    }}
                                    secondaryAction={{
                                        label: 'Browse Templates',
                                        onClick: () => setGalleryOpen(true)
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <UsageStats />

                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <h3 className="font-semibold mb-2 text-primary">Pro Tip</h3>
                        <p className="text-sm text-muted-foreground">
                            Press <kbd className="px-1 py-0.5 text-xs font-semibold bg-background border border-border rounded">?</kbd> to see all keyboard shortcuts.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { create } from 'zustand';
import { apiClient, type Project as ApiProject } from '../lib/api-client';

export interface Project {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
    lastEdited: string;
    framework: string;
    status: 'live' | 'development';
    thumbnailUrl?: string;
}

export interface ProjectState {
    projects: Project[];
    currentProject: Project | null;
    isLoading: boolean;
    addProject: (project: Project) => void;
    setCurrentProject: (project: Project) => void;
    removeProject: (id: string) => Promise<void>;
    updateProject: (id: string, updates: Partial<Project>) => void;
    fetchProjects: () => Promise<void>;
    setProjects: (projects: Project[]) => void;
}

// Convert API project to local project format
const mapApiProject = (apiProject: ApiProject): Project => ({
    id: apiProject.id,
    name: apiProject.name,
    description: apiProject.description || '',
    createdAt: new Date(apiProject.createdAt),
    lastEdited: formatLastEdited(apiProject.updatedAt),
    framework: apiProject.framework,
    status: apiProject.isPublic ? 'live' : 'development',
});

// Format "last edited" as relative time
function formatLastEdited(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    currentProject: null,
    isLoading: false,

    addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
    })),

    setCurrentProject: (project) => set({ currentProject: project }),

    removeProject: async (id) => {
        try {
            // Delete from backend
            await apiClient.deleteProject(id);

            // Remove from local state
            set((state) => ({
                projects: state.projects.filter(p => p.id !== id),
                currentProject: state.currentProject?.id === id ? null : state.currentProject
            }));
        } catch (error) {
            console.error('[ProjectStore] Failed to delete project:', error);
            throw error;
        }
    },

    updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id
            ? { ...state.currentProject, ...updates }
            : state.currentProject
    })),

    fetchProjects: async () => {
        // Don't fetch if already loading
        if (get().isLoading) return;

        set({ isLoading: true });

        try {
            console.log('[ProjectStore] Fetching projects from backend...');
            const result = await apiClient.getProjects();

            const projects = result.projects.map(mapApiProject);
            console.log(`[ProjectStore] Loaded ${projects.length} projects`);

            set({ projects, isLoading: false });
        } catch (error) {
            console.error('[ProjectStore] Failed to fetch projects:', error);
            set({ isLoading: false });
        }
    },

    setProjects: (projects) => set({ projects }),
}));

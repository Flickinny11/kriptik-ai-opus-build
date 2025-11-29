import { create } from 'zustand';

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
    addProject: (project: Project) => void;
    setCurrentProject: (project: Project) => void;
    removeProject: (id: string) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    projects: [],
    currentProject: null,
    addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
    setCurrentProject: (project) => set({ currentProject: project }),
    removeProject: (id) => set((state) => ({ 
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
    })),
    updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...updates } : state.currentProject
    })),
}));

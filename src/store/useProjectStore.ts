import { create } from 'zustand';

interface Project {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
    lastEdited: string;
    framework: string;
    status: 'live' | 'development';
}

interface ProjectState {
    projects: Project[];
    currentProject: Project | null;
    addProject: (project: Project) => void;
    setCurrentProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    projects: [],
    currentProject: null,
    addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
    setCurrentProject: (project) => set({ currentProject: project }),
}));

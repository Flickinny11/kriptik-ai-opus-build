import { create } from 'zustand';
import { api } from '../lib/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  framework: string;
  status: string;
  files?: Array<{ path: string; content: string }>;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  createProject: (data: { name: string; description?: string; framework: string }) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getProjects();
      
      if (response.success && response.data) {
        set({ projects: response.data.projects, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to fetch projects', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  fetchProjectById: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // Check cache first
      const { projects } = get();
      const cached = projects.find(p => p.id === id);
      if (cached) {
        set({ currentProject: cached });
      }

      const response = await api.getProject(id);
      
      if (response.success && response.data) {
        const project = response.data.project;
        set({ 
          currentProject: project, 
          isLoading: false,
          projects: projects.map(p => p.id === id ? project : p),
        });
      } else {
        set({ error: response.error || 'Failed to fetch project', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project });
  },

  createProject: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.createProject(data);
      
      if (response.success && response.data) {
        const newProject: Project = {
          id: response.data.project.id,
          name: response.data.project.name,
          description: data.description,
          framework: data.framework,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set((state) => ({ 
          projects: [newProject, ...state.projects],
          currentProject: newProject,
          isLoading: false,
        }));
        
        return newProject;
      } else {
        set({ error: response.error || 'Failed to create project', isLoading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return null;
    }
  },

  deleteProject: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.deleteProject(id);
      
      if (response.success) {
        set((state) => ({ 
          projects: state.projects.filter(p => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
          isLoading: false,
        }));
        return true;
      } else {
        set({ error: response.error || 'Failed to delete project', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

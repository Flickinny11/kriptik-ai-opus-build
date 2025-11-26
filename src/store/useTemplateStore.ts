import { create } from 'zustand';
import { Template, TEMPLATES } from '../data/templates';

interface TemplateState {
    templates: Template[];
    selectedTemplate: Template | null;
    isGalleryOpen: boolean;
    isCustomizing: boolean;
    searchQuery: string;
    selectedCategory: string;

    // Actions
    setGalleryOpen: (isOpen: boolean) => void;
    setSelectedTemplate: (template: Template | null) => void;
    setCustomizing: (isCustomizing: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSelectedCategory: (category: string) => void;
    getFilteredTemplates: () => Template[];
    useTemplate: (templateId: string, customization: Record<string, any>) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
    templates: TEMPLATES,
    selectedTemplate: null,
    isGalleryOpen: false,
    isCustomizing: false,
    searchQuery: '',
    selectedCategory: 'all',

    setGalleryOpen: (isOpen) => set({ isGalleryOpen: isOpen }),

    setSelectedTemplate: (template) => set({ selectedTemplate: template }),

    setCustomizing: (isCustomizing) => set({ isCustomizing }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setSelectedCategory: (category) => set({ selectedCategory: category }),

    getFilteredTemplates: () => {
        const { templates, searchQuery, selectedCategory } = get();

        let filtered = templates;

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        return filtered;
    },

    useTemplate: (templateId, customization) => {
        const template = get().templates.find(t => t.id === templateId);
        if (template) {
            // Increment use count
            set(state => ({
                templates: state.templates.map(t =>
                    t.id === templateId ? { ...t, useCount: t.useCount + 1 } : t
                )
            }));

            // In a real app, this would create a new project
            console.log('Creating project from template:', template.name, customization);
        }
    }
}));

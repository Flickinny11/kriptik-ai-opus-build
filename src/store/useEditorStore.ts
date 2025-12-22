import { create } from 'zustand';

export interface ProjectFile {
    id: string;
    projectId: string;
    name: string;
    path: string;
    content: string;
    language?: string;
}

interface EditorState {
    activeFile: string | null;
    files: ProjectFile[];
    cursorPosition: { lineNumber: number; column: number } | null;
    isSelectionMode: boolean;
    splitView: boolean;
    selectedElement: {
        file: string;
        line: number;
        componentName: string;
    } | null;

    // Build state for AI overlay
    isBuilding: boolean;
    buildPhase: 'idle' | 'coding' | 'building' | 'testing' | 'verifying' | 'complete' | 'error';
    currentBuildFile: string | null;

    // Actions
    setActiveFile: (file: string | null) => void;
    setCursorPosition: (position: { lineNumber: number; column: number } | null) => void;
    toggleSelectionMode: () => void;
    setSelectionMode: (active: boolean) => void;
    toggleSplitView: () => void;
    setSelectedElement: (element: { file: string; line: number; componentName: string } | null) => void;

    // Build actions
    startBuild: () => void;
    endBuild: (success?: boolean) => void;
    setBuildPhase: (phase: EditorState['buildPhase']) => void;
    setCurrentBuildFile: (file: string | null) => void;

    // File operations
    addFile: (file: ProjectFile) => void;
    updateFile: (id: string, content: string) => void;
    deleteFile: (id: string) => void;
    setFiles: (files: ProjectFile[]) => void;
    getFileByPath: (path: string) => ProjectFile | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    activeFile: null,
    files: [],
    cursorPosition: null,
    isSelectionMode: false,
    splitView: false,
    selectedElement: null,

    // Build state
    isBuilding: false,
    buildPhase: 'idle',
    currentBuildFile: null,

    setActiveFile: (file) => set({ activeFile: file }),
    setCursorPosition: (position) => set({ cursorPosition: position }),
    toggleSelectionMode: () => set((state) => ({ isSelectionMode: !state.isSelectionMode })),
    setSelectionMode: (active) => set({ isSelectionMode: active }),
    toggleSplitView: () => set((state) => ({ splitView: !state.splitView })),
    setSelectedElement: (element) => set({ selectedElement: element }),

    // Build actions
    startBuild: () => set({ isBuilding: true, buildPhase: 'building' }),
    endBuild: (success = true) => set({
        isBuilding: false,
        buildPhase: success ? 'complete' : 'error',
        currentBuildFile: null,
    }),
    setBuildPhase: (phase) => set({ buildPhase: phase }),
    setCurrentBuildFile: (file) => set({ currentBuildFile: file }),
    
    addFile: (file) => set((state) => {
        // Check if file already exists at path
        const existingIndex = state.files.findIndex(f => f.path === file.path);
        if (existingIndex >= 0) {
            // Update existing file
            const newFiles = [...state.files];
            newFiles[existingIndex] = file;
            return { files: newFiles };
        }
        return { files: [...state.files, file] };
    }),
    updateFile: (id, content) => set((state) => ({
        files: state.files.map(f => f.id === id ? { ...f, content } : f)
    })),
    deleteFile: (id) => set((state) => ({
        files: state.files.filter(f => f.id !== id),
        activeFile: state.activeFile === id ? null : state.activeFile
    })),
    setFiles: (files) => set({ files }),
    getFileByPath: (path) => get().files.find(f => f.path === path),
}));

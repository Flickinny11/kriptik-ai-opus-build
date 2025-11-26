import { create } from 'zustand';

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface Collaborator {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: UserRole;
    color: string;
    status: 'online' | 'offline' | 'idle';
    currentFile?: string;
}

export interface Comment {
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
    resolved: boolean;
    replies: Comment[];
    position?: { x: number; y: number }; // For preview comments
    fileLocation?: { file: string; line: number }; // For code comments
}

export interface ActivityItem {
    id: string;
    userId: string;
    userName: string;
    action: string;
    target: string;
    timestamp: number;
}

interface CollaborationState {
    currentUser: Collaborator;
    collaborators: Collaborator[];
    comments: Comment[];
    activityFeed: ActivityItem[];
    isShareModalOpen: boolean;

    // Actions
    setShareModalOpen: (isOpen: boolean) => void;
    addCollaborator: (email: string, role: UserRole) => void;
    removeCollaborator: (id: string) => void;
    addComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved' | 'replies'>) => void;
    resolveComment: (id: string) => void;
    addActivity: (action: string, target: string) => void;
}

const MOCK_USER: Collaborator = {
    id: 'me',
    name: 'You',
    email: 'you@example.com',
    avatar: 'https://github.com/shadcn.png',
    role: 'owner',
    color: '#10b981',
    status: 'online'
};

const MOCK_COLLABORATORS: Collaborator[] = [
    {
        id: 'sarah',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
        role: 'editor',
        color: '#f59e0b',
        status: 'online',
        currentFile: 'Button.tsx'
    },
    {
        id: 'mike',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
        role: 'viewer',
        color: '#3b82f6',
        status: 'idle'
    }
];

export const useCollaborationStore = create<CollaborationState>((set) => ({
    currentUser: MOCK_USER,
    collaborators: MOCK_COLLABORATORS,
    comments: [],
    activityFeed: [
        { id: '1', userId: 'sarah', userName: 'Sarah Chen', action: 'edited', target: 'Button.tsx', timestamp: Date.now() - 1000 * 60 * 5 },
        { id: '2', userId: 'me', userName: 'You', action: 'deployed', target: 'Staging', timestamp: Date.now() - 1000 * 60 * 30 }
    ],
    isShareModalOpen: false,

    setShareModalOpen: (isOpen) => set({ isShareModalOpen: isOpen }),

    addCollaborator: (email, role) => set((state) => ({
        collaborators: [...state.collaborators, {
            id: Math.random().toString(),
            name: email.split('@')[0],
            email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            role,
            color: '#8b5cf6',
            status: 'offline'
        }]
    })),

    removeCollaborator: (id) => set((state) => ({
        collaborators: state.collaborators.filter(c => c.id !== id)
    })),

    addComment: (comment) => set((state) => ({
        comments: [...state.comments, {
            ...comment,
            id: Math.random().toString(),
            timestamp: Date.now(),
            resolved: false,
            replies: []
        }]
    })),

    resolveComment: (id) => set((state) => ({
        comments: state.comments.map(c => c.id === id ? { ...c, resolved: true } : c)
    })),

    addActivity: (action, target) => set((state) => ({
        activityFeed: [{
            id: Math.random().toString(),
            userId: state.currentUser.id,
            userName: state.currentUser.name,
            action,
            target,
            timestamp: Date.now()
        }, ...state.activityFeed]
    }))
}));

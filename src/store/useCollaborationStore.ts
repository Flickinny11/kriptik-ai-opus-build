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
    setCurrentUser: (user: { id: string; name: string; email: string; avatar?: string }) => void;
    setCollaborators: (collaborators: Collaborator[]) => void;
    setActivityFeed: (activity: ActivityItem[]) => void;
    setShareModalOpen: (isOpen: boolean) => void;
    addCollaborator: (email: string, role: UserRole) => void;
    removeCollaborator: (id: string) => void;
    addComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved' | 'replies'>) => void;
    resolveComment: (id: string) => void;
    addActivity: (action: string, target: string) => void;
}

// Generate a color based on user ID for consistent avatar colors
function generateUserColor(id: string): string {
    const colors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Create a default user that will be updated when auth data loads
function createDefaultUser(): Collaborator {
    return {
        id: '',
        name: '',
        email: '',
        avatar: '',
        role: 'owner',
        color: '#10b981',
        status: 'online'
    };
}

export const useCollaborationStore = create<CollaborationState>((set) => ({
    currentUser: createDefaultUser(),
    collaborators: [], // Collaborators are fetched per-project from the backend
    comments: [],
    activityFeed: [], // Activity is loaded from the backend per-project
    isShareModalOpen: false,

    setCurrentUser: (user) => set({
        currentUser: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar || '',
            role: 'owner',
            color: generateUserColor(user.id),
            status: 'online'
        }
    }),

    setCollaborators: (collaborators) => set({ collaborators }),

    setActivityFeed: (activity) => set({ activityFeed: activity }),

    setShareModalOpen: (isOpen) => set({ isShareModalOpen: isOpen }),

    addCollaborator: (email, role) => set((state) => {
        const id = crypto.randomUUID();
        return {
            collaborators: [...state.collaborators, {
                id,
                name: email.split('@')[0],
                email,
                avatar: '', // Avatar managed by user profile, not hardcoded
                role,
                color: generateUserColor(id),
                status: 'offline'
            }]
        };
    }),

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

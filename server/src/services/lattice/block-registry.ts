/**
 * Building Block Registry
 *
 * Stores STRUCTURAL patterns only - no visual styling.
 * Blocks accelerate logic/structure while visual uniqueness
 * comes from Intent Lock's visualIdentity.
 *
 * This is a key component of LATTICE that provides pre-built
 * structural patterns that can be customized with variables.
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildingBlock {
    id: string;
    name: string;
    description: string;
    category: 'auth' | 'crud' | 'api' | 'state' | 'integration' | 'structure';

    // What this block provides (no visual code)
    provides: {
        files: Array<{
            pathTemplate: string; // e.g., "src/services/${name}.ts"
            contentTemplate: string; // Code with {{placeholders}}
        }>;
        interfaces: string[]; // TypeScript interfaces it exports
    };

    // Variables that must be filled in
    variables: Array<{
        name: string;
        description: string;
        type: 'string' | 'array' | 'object';
        required?: boolean;
        defaultValue?: string;
    }>;

    // Quality metrics from Component 28
    usageCount: number;
    successRate: number;
    averageQualityScore: number;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    source: 'core' | 'learned' | 'custom';
}

export interface BlockRenderResult {
    files: Array<{
        path: string;
        content: string;
    }>;
    interfaces: string[];
    blockId: string;
}

export interface BlockMatchScore {
    blockId: string;
    score: number;
    matchedKeywords: string[];
}

// =============================================================================
// CORE BLOCKS (Structural Only - NO Visual Styling)
// =============================================================================

const AUTH_FLOW_BLOCK: BuildingBlock = {
    id: 'block_auth_flow',
    name: 'Authentication Flow',
    description: 'Complete auth with login, register, forgot password - NO UI styling',
    category: 'auth',
    provides: {
        files: [
            {
                pathTemplate: 'src/services/auth-service.ts',
                contentTemplate: `import { create } from 'zustand';

interface AuthState {
    user: {{UserType}} | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (data: {{RegisterData}}) => Promise<void>;
    logout: () => void;
    forgotPassword: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            set({ user: data.user, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            set({ user: result.user, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    logout: () => {
        fetch('/api/auth/logout', { method: 'POST' });
        set({ user: null });
    },

    forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to send reset email');
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },
}));
`,
            },
            {
                pathTemplate: 'server/src/routes/auth.ts',
                contentTemplate: `import { Router } from 'express';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
        id: crypto.randomUUID(),
        email,
        passwordHash,
        name,
        createdAt: new Date(),
    }).returning();

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/logout', (_req, res) => {
    res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    // Send password reset email (implement with your email service)
    console.log(\`[Auth] Password reset requested for: \${email}\`);
    res.json({ success: true });
});

export default router;
`,
            },
        ],
        interfaces: ['AuthState', 'UserType', 'RegisterData'],
    },
    variables: [
        { name: 'UserType', description: 'TypeScript type for user object', type: 'string', required: true, defaultValue: '{ id: string; email: string; name: string }' },
        { name: 'RegisterData', description: 'TypeScript type for registration data', type: 'string', required: true, defaultValue: '{ email: string; password: string; name: string }' },
    ],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const CRUD_API_BLOCK: BuildingBlock = {
    id: 'block_crud_api',
    name: 'CRUD API Pattern',
    description: 'Standard REST CRUD endpoints - NO UI',
    category: 'crud',
    provides: {
        files: [
            {
                pathTemplate: 'server/src/routes/{{resourcePlural}}.ts',
                contentTemplate: `import { Router } from 'express';
import { db } from '../db.js';
import { {{tableName}} } from '../schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List all
router.get('/', requireAuth, async (_req, res) => {
    const items = await db.select().from({{tableName}});
    res.json({ items });
});

// Get one
router.get('/:id', requireAuth, async (req, res) => {
    const [item] = await db.select().from({{tableName}}).where(eq({{tableName}}.id, req.params.id)).limit(1);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
});

// Create
router.post('/', requireAuth, async (req, res) => {
    const [item] = await db.insert({{tableName}}).values({
        id: crypto.randomUUID(),
        ...req.body,
        createdAt: new Date(),
    }).returning();
    res.status(201).json({ item });
});

// Update
router.put('/:id', requireAuth, async (req, res) => {
    const [item] = await db.update({{tableName}})
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq({{tableName}}.id, req.params.id))
        .returning();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
});

// Delete
router.delete('/:id', requireAuth, async (req, res) => {
    await db.delete({{tableName}}).where(eq({{tableName}}.id, req.params.id));
    res.json({ success: true });
});

export default router;
`,
            },
        ],
        interfaces: [],
    },
    variables: [
        { name: 'tableName', description: 'Drizzle table name', type: 'string', required: true },
        { name: 'resourcePlural', description: 'Plural resource name for route', type: 'string', required: true },
    ],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const STRIPE_INTEGRATION_BLOCK: BuildingBlock = {
    id: 'block_stripe_integration',
    name: 'Stripe Payment Integration',
    description: 'Stripe checkout and webhook handling - NO UI',
    category: 'integration',
    provides: {
        files: [
            {
                pathTemplate: 'server/src/services/stripe-service.ts',
                contentTemplate: `import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
});

export async function createCheckoutSession(params: {
    customerId?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
}): Promise<string> {
    const session = await stripe.checkout.sessions.create({
        customer: params.customerId,
        line_items: [{ price: params.priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
    });
    return session.url!;
}

export async function handleWebhook(
    body: Buffer,
    signature: string
): Promise<Stripe.Event> {
    return stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
    );
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
    await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
}
`,
            },
            {
                pathTemplate: 'server/src/routes/stripe-webhooks.ts',
                contentTemplate: `import { Router } from 'express';
import { handleWebhook } from '../services/stripe-service.js';
import { db } from '../db.js';
import { subscriptions } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    try {
        const event = await handleWebhook(req.body, sig);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await db.insert(subscriptions).values({
                    id: crypto.randomUUID(),
                    userId: session.metadata?.userId,
                    stripeSubscriptionId: session.subscription as string,
                    status: 'active',
                    createdAt: new Date(),
                });
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await db.update(subscriptions)
                    .set({ status: 'cancelled', cancelledAt: new Date() })
                    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
                break;
            }
        }

        res.json({ received: true });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
`,
            },
        ],
        interfaces: [],
    },
    variables: [],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const ZUSTAND_STORE_BLOCK: BuildingBlock = {
    id: 'block_zustand_store',
    name: 'Zustand State Store',
    description: 'Standard Zustand store pattern with async actions - NO UI',
    category: 'state',
    provides: {
        files: [
            {
                pathTemplate: 'src/store/use{{StoreName}}Store.ts',
                contentTemplate: `import { create } from 'zustand';

interface {{EntityType}} {
    id: string;
    // Add your entity fields here
}

interface {{StoreName}}State {
    items: {{EntityType}}[];
    selectedItem: {{EntityType}} | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchItems: () => Promise<void>;
    selectItem: (id: string) => void;
    createItem: (data: Omit<{{EntityType}}, 'id'>) => Promise<void>;
    updateItem: (id: string, data: Partial<{{EntityType}}>) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    clearError: () => void;
}

export const use{{StoreName}}Store = create<{{StoreName}}State>((set, get) => ({
    items: [],
    selectedItem: null,
    isLoading: false,
    error: null,

    fetchItems: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/{{apiPath}}');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            set({ items: data.items, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    selectItem: (id) => {
        const item = get().items.find(i => i.id === id) || null;
        set({ selectedItem: item });
    },

    createItem: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/{{apiPath}}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            set(state => ({
                items: [...state.items, result.item],
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    updateItem: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(\`/api/{{apiPath}}/\${id}\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            set(state => ({
                items: state.items.map(i => i.id === id ? result.item : i),
                selectedItem: state.selectedItem?.id === id ? result.item : state.selectedItem,
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    deleteItem: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(\`/api/{{apiPath}}/\${id}\`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }
            set(state => ({
                items: state.items.filter(i => i.id !== id),
                selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    clearError: () => set({ error: null }),
}));
`,
            },
        ],
        interfaces: ['{{EntityType}}', '{{StoreName}}State'],
    },
    variables: [
        { name: 'StoreName', description: 'Store name (PascalCase)', type: 'string', required: true },
        { name: 'EntityType', description: 'Entity type name (PascalCase)', type: 'string', required: true },
        { name: 'apiPath', description: 'API path for the resource', type: 'string', required: true },
    ],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const API_CLIENT_BLOCK: BuildingBlock = {
    id: 'block_api_client',
    name: 'API Client Service',
    description: 'Type-safe API client with error handling - NO UI',
    category: 'api',
    provides: {
        files: [
            {
                pathTemplate: 'src/services/api-client.ts',
                contentTemplate: `const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiError {
    message: string;
    code?: string;
    status?: number;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = \`\${this.baseUrl}\${endpoint}\`;

        const config: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include',
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                const error: ApiError = {
                    message: data.error || data.message || 'Request failed',
                    code: data.code,
                    status: response.status,
                };
                throw error;
            }

            return data as T;
        } catch (error: any) {
            if (error.status) throw error;
            throw { message: error.message || 'Network error', status: 0 } as ApiError;
        }
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    async post<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    async put<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }

    async patch<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export const apiClient = new ApiClient();
export type { ApiError };
`,
            },
        ],
        interfaces: ['ApiError'],
    },
    variables: [],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const WEBSOCKET_SERVICE_BLOCK: BuildingBlock = {
    id: 'block_websocket_service',
    name: 'WebSocket Service',
    description: 'Real-time WebSocket connection with reconnection - NO UI',
    category: 'integration',
    provides: {
        files: [
            {
                pathTemplate: 'src/services/websocket-service.ts',
                contentTemplate: `type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketServiceOptions {
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectInterval: number;
    private maxReconnectAttempts: number;
    private reconnectAttempts = 0;
    private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
    private connectionHandlers: Set<ConnectionHandler> = new Set();
    private disconnectionHandlers: Set<ConnectionHandler> = new Set();

    constructor(options: WebSocketServiceOptions) {
        this.url = options.url;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('[WebSocket] Connected');
            this.reconnectAttempts = 0;
            this.connectionHandlers.forEach(handler => handler());
        };

        this.ws.onclose = () => {
            console.log('[WebSocket] Disconnected');
            this.disconnectionHandlers.forEach(handler => handler());
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                const { type, data } = message;
                const handlers = this.messageHandlers.get(type);
                handlers?.forEach(handler => handler(data));
            } catch (error) {
                console.error('[WebSocket] Failed to parse message:', error);
            }
        };
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(\`[WebSocket] Reconnecting in \${this.reconnectInterval}ms (attempt \${this.reconnectAttempts})\`);

        setTimeout(() => this.connect(), this.reconnectInterval);
    }

    disconnect(): void {
        this.ws?.close();
        this.ws = null;
    }

    send(type: string, data: any): void {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] Cannot send - not connected');
            return;
        }
        this.ws.send(JSON.stringify({ type, data }));
    }

    on(type: string, handler: MessageHandler): () => void {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, new Set());
        }
        this.messageHandlers.get(type)!.add(handler);

        return () => {
            this.messageHandlers.get(type)?.delete(handler);
        };
    }

    onConnect(handler: ConnectionHandler): () => void {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    onDisconnect(handler: ConnectionHandler): () => void {
        this.disconnectionHandlers.add(handler);
        return () => this.disconnectionHandlers.delete(handler);
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export const createWebSocketService = (options: WebSocketServiceOptions) =>
    new WebSocketService(options);

export type { WebSocketServiceOptions, MessageHandler, ConnectionHandler };
`,
            },
        ],
        interfaces: ['WebSocketServiceOptions', 'MessageHandler', 'ConnectionHandler'],
    },
    variables: [],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

const DATABASE_TABLE_BLOCK: BuildingBlock = {
    id: 'block_database_table',
    name: 'Drizzle Database Table',
    description: 'SQLite table definition with common fields - NO UI',
    category: 'structure',
    provides: {
        files: [
            {
                pathTemplate: 'server/src/schema/{{tableName}}.ts',
                contentTemplate: `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const {{tableName}} = sqliteTable('{{sqlTableName}}', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    {{#fields}}
    {{fieldName}}: {{fieldType}}('{{fieldColumn}}'){{fieldModifiers}},
    {{/fields}}
    createdAt: text('created_at').default(sql\`(datetime('now'))\`).notNull(),
    updatedAt: text('updated_at').default(sql\`(datetime('now'))\`).notNull(),
});

export type {{TypeName}} = typeof {{tableName}}.$inferSelect;
export type New{{TypeName}} = typeof {{tableName}}.$inferInsert;
`,
            },
        ],
        interfaces: ['{{TypeName}}', 'New{{TypeName}}'],
    },
    variables: [
        { name: 'tableName', description: 'Drizzle table variable name (camelCase)', type: 'string', required: true },
        { name: 'sqlTableName', description: 'SQL table name (snake_case)', type: 'string', required: true },
        { name: 'TypeName', description: 'TypeScript type name (PascalCase)', type: 'string', required: true },
        { name: 'fields', description: 'Array of field definitions', type: 'array', required: true },
    ],
    usageCount: 0,
    successRate: 0,
    averageQualityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'core',
};

// =============================================================================
// BLOCK REGISTRY
// =============================================================================

export const CORE_BLOCKS: BuildingBlock[] = [
    AUTH_FLOW_BLOCK,
    CRUD_API_BLOCK,
    STRIPE_INTEGRATION_BLOCK,
    ZUSTAND_STORE_BLOCK,
    API_CLIENT_BLOCK,
    WEBSOCKET_SERVICE_BLOCK,
    DATABASE_TABLE_BLOCK,
];

// =============================================================================
// BLOCK REGISTRY CLASS
// =============================================================================

export class BlockRegistry extends EventEmitter {
    private blocks: Map<string, BuildingBlock> = new Map();
    private categoryIndex: Map<string, Set<string>> = new Map();
    private keywordIndex: Map<string, Set<string>> = new Map();

    constructor() {
        super();
        this.initializeCoreBlocks();
    }

    private initializeCoreBlocks(): void {
        for (const block of CORE_BLOCKS) {
            this.registerBlock(block);
        }
        console.log(`[BlockRegistry] Initialized with ${this.blocks.size} core blocks`);
    }

    /**
     * Register a new building block
     */
    registerBlock(block: BuildingBlock): void {
        this.blocks.set(block.id, block);

        // Index by category
        if (!this.categoryIndex.has(block.category)) {
            this.categoryIndex.set(block.category, new Set());
        }
        this.categoryIndex.get(block.category)!.add(block.id);

        // Index by keywords (from name and description)
        const keywords = this.extractKeywords(block);
        for (const keyword of keywords) {
            if (!this.keywordIndex.has(keyword)) {
                this.keywordIndex.set(keyword, new Set());
            }
            this.keywordIndex.get(keyword)!.add(block.id);
        }

        this.emit('block_registered', { blockId: block.id, source: block.source });
    }

    private extractKeywords(block: BuildingBlock): string[] {
        const text = `${block.name} ${block.description}`.toLowerCase();
        const words = text.split(/\s+/);
        // Filter out common words
        const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'no', 'with', 'for', '-']);
        return words.filter(w => w.length > 2 && !stopWords.has(w));
    }

    /**
     * Get a block by ID
     */
    getBlock(id: string): BuildingBlock | undefined {
        return this.blocks.get(id);
    }

    /**
     * Get all blocks in a category
     */
    getBlocksByCategory(category: BuildingBlock['category']): BuildingBlock[] {
        const ids = this.categoryIndex.get(category) || new Set();
        return Array.from(ids).map(id => this.blocks.get(id)!).filter(Boolean);
    }

    /**
     * Find blocks matching a query (for Intent Crystallizer to use)
     */
    findMatchingBlocks(query: string, limit = 5): BlockMatchScore[] {
        const queryKeywords = query.toLowerCase().split(/\s+/);
        const scores: Map<string, { score: number; matchedKeywords: string[] }> = new Map();

        for (const keyword of queryKeywords) {
            const matchingBlockIds = this.keywordIndex.get(keyword);
            if (matchingBlockIds) {
                for (const blockId of matchingBlockIds) {
                    const current = scores.get(blockId) || { score: 0, matchedKeywords: [] };
                    current.score += 1;
                    current.matchedKeywords.push(keyword);
                    scores.set(blockId, current);
                }
            }
        }

        // Also do partial matching
        for (const [indexedKeyword, blockIds] of this.keywordIndex) {
            for (const queryKeyword of queryKeywords) {
                if (indexedKeyword.includes(queryKeyword) || queryKeyword.includes(indexedKeyword)) {
                    for (const blockId of blockIds) {
                        const current = scores.get(blockId) || { score: 0, matchedKeywords: [] };
                        if (!current.matchedKeywords.includes(indexedKeyword)) {
                            current.score += 0.5;
                            current.matchedKeywords.push(indexedKeyword);
                            scores.set(blockId, current);
                        }
                    }
                }
            }
        }

        return Array.from(scores.entries())
            .map(([blockId, data]) => ({
                blockId,
                score: data.score,
                matchedKeywords: data.matchedKeywords,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Render a block with variables
     */
    renderBlock(blockId: string, variables: Record<string, string>): BlockRenderResult | null {
        const block = this.blocks.get(blockId);
        if (!block) {
            console.error(`[BlockRegistry] Block not found: ${blockId}`);
            return null;
        }

        // Validate required variables
        for (const variable of block.variables) {
            if (variable.required && !variables[variable.name] && !variable.defaultValue) {
                console.error(`[BlockRegistry] Missing required variable: ${variable.name}`);
                return null;
            }
        }

        // Merge with defaults
        const finalVariables: Record<string, string> = {};
        for (const variable of block.variables) {
            finalVariables[variable.name] = variables[variable.name] || variable.defaultValue || '';
        }

        // Render files
        const files: BlockRenderResult['files'] = [];
        for (const fileSpec of block.provides.files) {
            const path = this.replaceVariables(fileSpec.pathTemplate, finalVariables);
            const content = this.replaceVariables(fileSpec.contentTemplate, finalVariables);
            files.push({ path, content });
        }

        // Update usage metrics
        block.usageCount++;
        block.updatedAt = new Date();

        this.emit('block_rendered', { blockId, variableCount: Object.keys(variables).length });

        return {
            files,
            interfaces: block.provides.interfaces.map(i => this.replaceVariables(i, finalVariables)),
            blockId,
        };
    }

    private replaceVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            // Support both {{var}} and ${var} syntax
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    /**
     * Update block metrics from Component 28 feedback
     */
    updateBlockMetrics(
        blockId: string,
        success: boolean,
        qualityScore: number
    ): void {
        const block = this.blocks.get(blockId);
        if (!block) return;

        const totalUses = block.usageCount;
        const successCount = block.successRate * (totalUses - 1) + (success ? 1 : 0);
        block.successRate = successCount / totalUses;

        block.averageQualityScore =
            (block.averageQualityScore * (totalUses - 1) + qualityScore) / totalUses;

        block.updatedAt = new Date();

        this.emit('block_metrics_updated', {
            blockId,
            successRate: block.successRate,
            averageQualityScore: block.averageQualityScore,
        });
    }

    /**
     * Add a learned block from Component 28
     */
    addLearnedBlock(block: Omit<BuildingBlock, 'source' | 'usageCount' | 'successRate' | 'averageQualityScore' | 'createdAt' | 'updatedAt'>): void {
        const fullBlock: BuildingBlock = {
            ...block,
            source: 'learned',
            usageCount: 0,
            successRate: 0,
            averageQualityScore: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.registerBlock(fullBlock);
        console.log(`[BlockRegistry] Added learned block: ${block.id}`);
    }

    /**
     * Get all blocks
     */
    getAllBlocks(): BuildingBlock[] {
        return Array.from(this.blocks.values());
    }

    /**
     * Get block statistics
     */
    getStats(): {
        totalBlocks: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
        averageSuccessRate: number;
        averageQualityScore: number;
    } {
        const blocks = this.getAllBlocks();
        const byCategory: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        let totalSuccessRate = 0;
        let totalQualityScore = 0;
        let usedBlockCount = 0;

        for (const block of blocks) {
            byCategory[block.category] = (byCategory[block.category] || 0) + 1;
            bySource[block.source] = (bySource[block.source] || 0) + 1;

            if (block.usageCount > 0) {
                totalSuccessRate += block.successRate;
                totalQualityScore += block.averageQualityScore;
                usedBlockCount++;
            }
        }

        return {
            totalBlocks: blocks.length,
            byCategory,
            bySource,
            averageSuccessRate: usedBlockCount > 0 ? totalSuccessRate / usedBlockCount : 0,
            averageQualityScore: usedBlockCount > 0 ? totalQualityScore / usedBlockCount : 0,
        };
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let blockRegistryInstance: BlockRegistry | null = null;

export function getBlockRegistry(): BlockRegistry {
    if (!blockRegistryInstance) {
        blockRegistryInstance = new BlockRegistry();
    }
    return blockRegistryInstance;
}

export function resetBlockRegistry(): void {
    blockRegistryInstance = null;
}

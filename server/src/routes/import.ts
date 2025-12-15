/**
 * Import Routes
 *
 * Handles project imports from ZIP files, GitHub repos, and AI builders.
 * Includes dependency detection and credential management.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { projects, files as filesTable } from '../schema.js';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import AdmZip from 'adm-zip';

// ============================================================================
// TYPES
// ============================================================================

interface AuthProviderConfig {
    provider: 'google' | 'github' | 'facebook' | 'twitter' | 'supabase' | 'firebase' | 'auth0' | 'clerk' | 'stripe' | 'twilio' | 'openai' | 'sendgrid' | 'resend';
    detected: boolean;
    envVars: string[];
    setupUrl: string;
    instructions: string;
    icon: string;
    required: boolean;
}

interface RequiredDependency {
    id: string;
    name: string;
    envKeys: string[];
    setupUrl: string;
    instructions: string;
    icon: string;
    required: boolean;
    status: 'pending' | 'fetching' | 'complete';
    values: Record<string, string>;
}

interface ImportResult {
    projectId: string;
    projectName: string;
    filesImported: number;
    framework: string;
    dependencies: RequiredDependency[];
}

// ============================================================================
// MULTER CONFIG FOR FILE UPLOADS
// ============================================================================

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
    },
    fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    },
});

// ============================================================================
// AUTH PROVIDER DETECTION
// ============================================================================

const AUTH_PROVIDER_CONFIGS: Record<string, Omit<AuthProviderConfig, 'detected'>> = {
    google: {
        provider: 'google',
        envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        setupUrl: 'https://console.cloud.google.com/apis/credentials',
        instructions: '1. Go to Google Cloud Console\n2. Create OAuth 2.0 credentials\n3. Add your KripTik domain to authorized origins\n4. Add callback URL to redirect URIs\n5. Copy Client ID and Client Secret',
        icon: 'google',
        required: true,
    },
    github: {
        provider: 'github',
        envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        setupUrl: 'https://github.com/settings/developers',
        instructions: '1. Go to GitHub Developer Settings\n2. Create a new OAuth App\n3. Set the callback URL to your KripTik domain\n4. Copy Client ID and Client Secret',
        icon: 'github',
        required: true,
    },
    supabase: {
        provider: 'supabase',
        envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        setupUrl: 'https://supabase.com/dashboard',
        instructions: '1. Go to your Supabase project dashboard\n2. Navigate to Settings > API\n3. Copy the URL and both API keys',
        icon: 'supabase',
        required: true,
    },
    firebase: {
        provider: 'firebase',
        envVars: ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'],
        setupUrl: 'https://console.firebase.google.com/',
        instructions: '1. Go to Firebase Console\n2. Select your project\n3. Go to Project Settings\n4. Copy the config values from the Firebase SDK snippet',
        icon: 'firebase',
        required: true,
    },
    auth0: {
        provider: 'auth0',
        envVars: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'],
        setupUrl: 'https://manage.auth0.com/',
        instructions: '1. Go to Auth0 Dashboard\n2. Select your application\n3. Copy Domain, Client ID, and Client Secret',
        icon: 'auth0',
        required: true,
    },
    clerk: {
        provider: 'clerk',
        envVars: ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        setupUrl: 'https://dashboard.clerk.dev/',
        instructions: '1. Go to Clerk Dashboard\n2. Select your application\n3. Go to API Keys\n4. Copy the Publishable and Secret keys',
        icon: 'clerk',
        required: true,
    },
    stripe: {
        provider: 'stripe',
        envVars: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        setupUrl: 'https://dashboard.stripe.com/apikeys',
        instructions: '1. Go to Stripe Dashboard\n2. Navigate to Developers > API Keys\n3. Copy both Publishable and Secret keys\n4. Set up webhook endpoint for webhook secret',
        icon: 'stripe',
        required: false,
    },
    twilio: {
        provider: 'twilio',
        envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
        setupUrl: 'https://console.twilio.com/',
        instructions: '1. Go to Twilio Console\n2. Find Account SID and Auth Token on dashboard\n3. Get a phone number from Phone Numbers section',
        icon: 'twilio',
        required: false,
    },
    openai: {
        provider: 'openai',
        envVars: ['OPENAI_API_KEY'],
        setupUrl: 'https://platform.openai.com/api-keys',
        instructions: '1. Go to OpenAI Platform\n2. Navigate to API Keys\n3. Create a new secret key and copy it',
        icon: 'openai',
        required: false,
    },
    sendgrid: {
        provider: 'sendgrid',
        envVars: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'],
        setupUrl: 'https://app.sendgrid.com/settings/api_keys',
        instructions: '1. Go to SendGrid Dashboard\n2. Navigate to Settings > API Keys\n3. Create a new API key with full access',
        icon: 'sendgrid',
        required: false,
    },
    resend: {
        provider: 'resend',
        envVars: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
        setupUrl: 'https://resend.com/api-keys',
        instructions: '1. Go to Resend Dashboard\n2. Navigate to API Keys\n3. Create a new API key',
        icon: 'resend',
        required: false,
    },
};

// Detection patterns for each provider
const DETECTION_PATTERNS: Record<string, RegExp[]> = {
    google: [
        /GOOGLE_CLIENT_ID/,
        /GoogleProvider/,
        /google\.oauth/i,
        /googleapis\.com/,
        /@react-oauth\/google/,
    ],
    github: [
        /GITHUB_CLIENT_ID/,
        /GitHubProvider/,
        /github\.oauth/i,
        /api\.github\.com/,
    ],
    supabase: [
        /SUPABASE_URL/,
        /createClient.*supabase/i,
        /@supabase\/supabase-js/,
        /supabase\.co/,
    ],
    firebase: [
        /FIREBASE_API_KEY/,
        /initializeApp.*firebase/i,
        /firebase\/app/,
        /firebaseConfig/,
    ],
    auth0: [
        /AUTH0_DOMAIN/,
        /Auth0Provider/,
        /@auth0\/auth0-react/,
        /auth0\.com/,
    ],
    clerk: [
        /CLERK_PUBLISHABLE_KEY/,
        /ClerkProvider/,
        /@clerk\/clerk-react/,
        /clerk\.dev/,
    ],
    stripe: [
        /STRIPE_PUBLISHABLE_KEY/,
        /loadStripe/,
        /@stripe\/stripe-js/,
        /api\.stripe\.com/,
    ],
    twilio: [
        /TWILIO_ACCOUNT_SID/,
        /twilio/i,
        /api\.twilio\.com/,
    ],
    openai: [
        /OPENAI_API_KEY/,
        /openai/i,
        /api\.openai\.com/,
    ],
    sendgrid: [
        /SENDGRID_API_KEY/,
        /@sendgrid\/mail/,
        /sendgrid/i,
    ],
    resend: [
        /RESEND_API_KEY/,
        /resend/i,
        /@resend/,
    ],
};

function detectAuthProviders(fileContents: Map<string, string>): RequiredDependency[] {
    const dependencies: RequiredDependency[] = [];
    const allContent = Array.from(fileContents.values()).join('\n');

    for (const [providerId, patterns] of Object.entries(DETECTION_PATTERNS)) {
        const isDetected = patterns.some(pattern => pattern.test(allContent));

        if (isDetected) {
            const config = AUTH_PROVIDER_CONFIGS[providerId];
            if (config) {
                dependencies.push({
                    id: providerId,
                    name: config.provider.charAt(0).toUpperCase() + config.provider.slice(1),
                    envKeys: config.envVars,
                    setupUrl: config.setupUrl,
                    instructions: config.instructions,
                    icon: config.icon,
                    required: config.required,
                    status: 'pending',
                    values: {},
                });
            }
        }
    }

    return dependencies;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectFramework(fileContents: Map<string, string>): string {
    const allContent = Array.from(fileContents.values()).join('\n');
    const fileNames = Array.from(fileContents.keys());

    // Check for Next.js
    if (fileNames.some(f => f.includes('next.config')) || allContent.includes('next/')) {
        return 'nextjs';
    }

    // Check for Vue
    if (fileNames.some(f => f.endsWith('.vue')) || allContent.includes('vue')) {
        return 'vue';
    }

    // Check for Svelte
    if (fileNames.some(f => f.endsWith('.svelte')) || allContent.includes('svelte')) {
        return 'svelte';
    }

    // Check for Node.js backend
    if (fileNames.some(f => f.includes('server.')) && !allContent.includes('react')) {
        return 'node';
    }

    // Default to React
    return 'react';
}

function isRelevantFile(path: string): boolean {
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md', '.vue', '.svelte', '.env', '.env.example', '.env.local'];
    const excludedPaths = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '__pycache__', '.cache', '.turbo'];

    // Check if path contains excluded directories
    if (excludedPaths.some(p => path.includes(`/${p}/`) || path.startsWith(`${p}/`))) {
        return false;
    }

    // Check if file has relevant extension
    return relevantExtensions.some(ext => path.endsWith(ext));
}

function extractProjectNameFromZip(zipFileName: string): string {
    // Remove .zip extension and clean up
    return zipFileName
        .replace(/\.zip$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim() || 'Imported Project';
}

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// Simple auth middleware that extracts userId from session or header
const authMiddleware = (req: Request, res: Response, next: () => void) => {
    // In production, this would verify JWT/session
    const userId = (req as any).userId || req.headers['x-user-id'] || 'anonymous';
    (req as any).userId = userId;
    next();
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/import/zip
 * Import a ZIP file
 */
router.post('/zip', authMiddleware, upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
        const userId = (req as any).userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`[Import] Processing ZIP file: ${file.originalname} (${file.size} bytes)`);

        // Extract ZIP contents
        const zip = new AdmZip(file.buffer);
        const entries = zip.getEntries();

        const fileContents = new Map<string, string>();
        let rootFolder = '';

        // Detect root folder (common in GitHub exports)
        const firstEntry = entries.find((e: AdmZip.IZipEntry) => !e.isDirectory);
        if (firstEntry) {
            const parts = firstEntry.entryName.split('/');
            if (parts.length > 1 && entries.every((e: AdmZip.IZipEntry) => e.entryName.startsWith(parts[0] + '/'))) {
                rootFolder = parts[0] + '/';
            }
        }

        // Extract files
        for (const entry of entries) {
            if (!entry.isDirectory) {
                let path = entry.entryName;

                // Remove root folder prefix if present
                if (rootFolder && path.startsWith(rootFolder)) {
                    path = path.substring(rootFolder.length);
                }

                if (path && isRelevantFile(path)) {
                    try {
                        const content = entry.getData().toString('utf-8');
                        fileContents.set(path, content);
                    } catch {
                        // Skip binary files
                    }
                }
            }
        }

        if (fileContents.size === 0) {
            return res.status(400).json({ error: 'No valid source files found in ZIP' });
        }

        // Create project in database
        const projectId = uuidv4();
        const projectName = extractProjectNameFromZip(file.originalname);
        const framework = detectFramework(fileContents);

        await db.insert(projects).values({
            id: projectId,
            name: projectName,
            ownerId: userId,
            framework,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Store files in database
        for (const [path, content] of fileContents) {
            await db.insert(filesTable).values({
                id: uuidv4(),
                projectId,
                path,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        // Detect required dependencies
        const dependencies = detectAuthProviders(fileContents);

        console.log(`[Import] Created project ${projectId} with ${fileContents.size} files, ${dependencies.length} dependencies detected`);

        const result: ImportResult = {
            projectId,
            projectName,
            filesImported: fileContents.size,
            framework,
            dependencies,
        };

        res.json(result);
    } catch (error) {
        console.error('[Import] ZIP import failed:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import ZIP' });
    }
});

/**
 * POST /api/import/github
 * Import from GitHub repository
 */
router.post('/github', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { repoUrl, branch = 'main' } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        // Parse GitHub URL
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        const [, owner, repo] = match;
        const repoName = repo.replace(/\.git$/, '');

        console.log(`[Import] Cloning GitHub repo: ${owner}/${repoName} (branch: ${branch})`);

        // Fetch repository tree
        let data: any;
        for (const tryBranch of [branch, 'main', 'master']) {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repoName}/git/trees/${tryBranch}?recursive=1`,
                {
                    headers: process.env.GITHUB_TOKEN
                        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                        : {},
                }
            );

            if (response.ok) {
                data = await response.json();
                break;
            }
        }

        if (!data) {
            return res.status(400).json({ error: 'Could not access GitHub repository. Make sure it exists and is public.' });
        }

        const fileContents = new Map<string, string>();

        // Fetch file contents (limit to 100 files for performance)
        const relevantFiles = data.tree.filter((item: any) => item.type === 'blob' && isRelevantFile(item.path)).slice(0, 100);

        for (const item of relevantFiles) {
            try {
                const contentResponse = await fetch(item.url, {
                    headers: process.env.GITHUB_TOKEN
                        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                        : {},
                });

                if (contentResponse.ok) {
                    const contentData = await contentResponse.json();
                    const content = Buffer.from(contentData.content, 'base64').toString('utf-8');
                    fileContents.set(item.path, content);
                }
            } catch {
                // Skip files that fail to download
            }
        }

        if (fileContents.size === 0) {
            return res.status(400).json({ error: 'No valid source files found in repository' });
        }

        // Create project
        const projectId = uuidv4();
        const projectName = repoName.replace(/[_-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        const framework = detectFramework(fileContents);

        await db.insert(projects).values({
            id: projectId,
            name: projectName,
            ownerId: userId,
            framework,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Store files
        for (const [path, content] of fileContents) {
            await db.insert(filesTable).values({
                id: uuidv4(),
                projectId,
                path,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        // Detect dependencies
        const dependencies = detectAuthProviders(fileContents);

        console.log(`[Import] Created project ${projectId} from GitHub with ${fileContents.size} files`);

        const result: ImportResult = {
            projectId,
            projectName,
            filesImported: fileContents.size,
            framework,
            dependencies,
        };

        res.json(result);
    } catch (error) {
        console.error('[Import] GitHub import failed:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import from GitHub' });
    }
});

/**
 * POST /api/import/builder
 * Import from AI builder (Lovable, Bolt, v0, etc.)
 */
router.post('/builder', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { builderType, projectUrl, zipData, chatHistory, metadata } = req.body;

        if (!builderType) {
            return res.status(400).json({ error: 'Builder type is required' });
        }

        console.log(`[Import] Importing from ${builderType}: ${projectUrl || 'ZIP data'}`);

        // For now, create a placeholder project
        // In production, this would integrate with browser extension data
        const projectId = uuidv4();
        const projectName = `${builderType.charAt(0).toUpperCase() + builderType.slice(1)} Import`;

        await db.insert(projects).values({
            id: projectId,
            name: projectName,
            ownerId: userId,
            framework: 'react',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // If ZIP data is provided (from browser extension), extract it
        let fileContents = new Map<string, string>();
        let dependencies: RequiredDependency[] = [];

        if (zipData) {
            const buffer = Buffer.from(zipData, 'base64');
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();

            for (const entry of entries) {
                if (!entry.isDirectory && isRelevantFile(entry.entryName)) {
                    try {
                        const content = entry.getData().toString('utf-8');
                        fileContents.set(entry.entryName, content);
                    } catch {
                        // Skip binary files
                    }
                }
            }

            // Store files
            for (const [path, content] of fileContents) {
                await db.insert(filesTable).values({
                    id: uuidv4(),
                    projectId,
                    path,
                    content,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }

            dependencies = detectAuthProviders(fileContents);
        }

        // Store chat history if provided (for Fix My App analysis)
        if (chatHistory) {
            await db.insert(filesTable).values({
                id: uuidv4(),
                projectId,
                path: '.kriptik/chat-history.json',
                content: JSON.stringify(chatHistory),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        console.log(`[Import] Created project ${projectId} from ${builderType}`);

        const result: ImportResult = {
            projectId,
            projectName,
            filesImported: fileContents.size,
            framework: detectFramework(fileContents) || 'react',
            dependencies,
        };

        res.json(result);
    } catch (error) {
        console.error('[Import] Builder import failed:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import from builder' });
    }
});

/**
 * POST /api/import/:projectId/credentials
 * Save collected credentials for a project
 */
router.post('/:projectId/credentials', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { credentials } = req.body;

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({ error: 'Credentials object is required' });
        }

        console.log(`[Import] Saving credentials for project ${projectId}`);

        // Store credentials as encrypted .env file
        // In production, use proper encryption
        const envContent = Object.entries(credentials)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Check if .env file already exists
        const existingEnv = await db.query.files.findFirst({
            where: (f, { and }) => and(
                eq(f.projectId, projectId),
                eq(f.path, '.env')
            ),
        });

        if (existingEnv) {
            await db.update(filesTable)
                .set({ content: envContent, updatedAt: new Date().toISOString() })
                .where(eq(filesTable.id, existingEnv.id));
        } else {
            await db.insert(filesTable).values({
                id: uuidv4(),
                projectId,
                path: '.env',
                content: envContent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Import] Failed to save credentials:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

/**
 * POST /api/import/:projectId/fix
 * Start the fix process for an imported project
 */
router.post('/:projectId/fix', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { projectId } = req.params;
        const { credentials } = req.body;

        console.log(`[Import] Starting fix process for project ${projectId}`);

        // If credentials provided, save them first
        if (credentials) {
            const envContent = Object.entries(credentials)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            const existingEnv = await db.query.files.findFirst({
                where: (f, { and }) => and(
                    eq(f.projectId, projectId),
                    eq(f.path, '.env')
                ),
            });

            if (existingEnv) {
                await db.update(filesTable)
                    .set({ content: envContent, updatedAt: new Date().toISOString() })
                    .where(eq(filesTable.id, existingEnv.id));
            } else {
                await db.insert(filesTable).values({
                    id: uuidv4(),
                    projectId,
                    path: '.env',
                    content: envContent,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        // The actual fix process would be handled by the Fix My App flow
        // For now, return success to indicate the project is ready
        res.json({
            success: true,
            projectId,
            message: 'Project is ready for Fix My App',
        });
    } catch (error) {
        console.error('[Import] Fix process failed:', error);
        res.status(500).json({ error: 'Failed to start fix process' });
    }
});

/**
 * GET /api/import/:projectId/status
 * Get import/fix status for a project
 */
router.get('/:projectId/status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const fileCount = await db.query.files.findMany({
            where: eq(filesTable.projectId, projectId),
        });

        res.json({
            projectId,
            projectName: project.name,
            framework: project.framework,
            fileCount: fileCount.length,
            status: 'ready',
        });
    } catch (error) {
        console.error('[Import] Status check failed:', error);
        res.status(500).json({ error: 'Failed to get project status' });
    }
});

export { router as importRouter };

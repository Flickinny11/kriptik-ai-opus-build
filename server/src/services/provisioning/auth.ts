/**
 * Authentication Provisioning Service
 *
 * One-click auth setup for projects:
 * - Clerk (Full-featured auth with UI components)
 * - Supabase Auth (PostgreSQL-native auth)
 * - Auth0 (Enterprise auth)
 * - Better-Auth (Self-hosted, open source)
 *
 * Generates all necessary code, environment variables, and configurations.
 */

import { getModelRouter } from '../ai/model-router';

// ============================================================================
// TYPES
// ============================================================================

export type AuthProvider = 'clerk' | 'supabase' | 'auth0' | 'better-auth';

export interface AuthConfig {
    provider: AuthProvider;
    projectName: string;
    features?: {
        emailPassword?: boolean;
        socialLogins?: ('google' | 'github' | 'discord' | 'twitter')[];
        magicLinks?: boolean;
        mfa?: boolean;
        organizations?: boolean;
    };
    framework?: 'react' | 'nextjs' | 'vue';
}

export interface AuthProvisionResult {
    success: boolean;
    provider: AuthProvider;
    applicationId?: string;
    dashboardUrl?: string;
    envVariables: Record<string, string>;
    generatedCode: Array<{
        path: string;
        content: string;
        description: string;
    }>;
    setupInstructions: string[];
    error?: string;
}

// ============================================================================
// CLERK PROVISIONING
// ============================================================================

async function provisionClerk(config: AuthConfig): Promise<AuthProvisionResult> {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
        // Return setup instructions for manual configuration
        return {
            success: true,
            provider: 'clerk',
            envVariables: {
                VITE_CLERK_PUBLISHABLE_KEY: '<your-publishable-key>',
                CLERK_SECRET_KEY: '<your-secret-key>',
            },
            generatedCode: generateClerkCode(config),
            setupInstructions: [
                '1. Go to https://dashboard.clerk.com and create an application',
                '2. Copy your Publishable Key and Secret Key',
                '3. Add them to your .env file',
                '4. Enable desired social login providers in the Clerk dashboard',
            ],
        };
    }

    try {
        // Create Clerk application via API
        const response = await fetch('https://api.clerk.com/v1/applications', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: config.projectName,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                provider: 'clerk',
                envVariables: {},
                generatedCode: [],
                setupInstructions: [],
                error: error.message || 'Failed to create Clerk application',
            };
        }

        const app = await response.json();

        return {
            success: true,
            provider: 'clerk',
            applicationId: app.id,
            dashboardUrl: `https://dashboard.clerk.com/apps/${app.id}`,
            envVariables: {
                VITE_CLERK_PUBLISHABLE_KEY: app.publishable_key,
                CLERK_SECRET_KEY: app.secret_key,
            },
            generatedCode: generateClerkCode(config),
            setupInstructions: [
                `Application "${config.projectName}" created successfully`,
                'Environment variables have been configured',
                'Install the Clerk SDK: npm install @clerk/clerk-react',
            ],
        };
    } catch (error) {
        return {
            success: false,
            provider: 'clerk',
            envVariables: {},
            generatedCode: [],
            setupInstructions: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

function generateClerkCode(config: AuthConfig): AuthProvisionResult['generatedCode'] {
    const isNextJs = config.framework === 'nextjs';

    return [
        {
            path: isNextJs ? 'src/app/providers.tsx' : 'src/providers/AuthProvider.tsx',
            description: 'Clerk provider wrapper',
            content: `import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error('Missing Clerk Publishable Key');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            {children}
        </ClerkProvider>
    );
}`,
        },
        {
            path: 'src/components/auth/SignInButton.tsx',
            description: 'Sign in button component',
            content: `import { SignInButton as ClerkSignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';

export function SignInButton() {
    return (
        <>
            <SignedOut>
                <ClerkSignInButton mode="modal">
                    <Button>Sign In</Button>
                </ClerkSignInButton>
            </SignedOut>
            <SignedIn>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
        </>
    );
}`,
        },
        {
            path: 'src/hooks/useAuth.ts',
            description: 'Auth hook for accessing user data',
            content: `import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

export function useAuth() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut, getToken } = useClerkAuth();

    return {
        user: user ? {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName,
            imageUrl: user.imageUrl,
        } : null,
        isLoaded,
        isSignedIn: !!isSignedIn,
        signOut,
        getToken,
    };
}`,
        },
    ];
}

// ============================================================================
// SUPABASE AUTH PROVISIONING
// ============================================================================

async function provisionSupabaseAuth(config: AuthConfig): Promise<AuthProvisionResult> {
    // Supabase Auth is included with Supabase project
    // Just generate the integration code

    return {
        success: true,
        provider: 'supabase',
        envVariables: {
            VITE_SUPABASE_URL: '<your-supabase-url>',
            VITE_SUPABASE_ANON_KEY: '<your-anon-key>',
        },
        generatedCode: generateSupabaseAuthCode(config),
        setupInstructions: [
            '1. Create a Supabase project at https://supabase.com',
            '2. Copy your project URL and anon key from Settings > API',
            '3. Add them to your .env file',
            '4. Enable desired auth providers in Authentication > Providers',
        ],
    };
}

function generateSupabaseAuthCode(config: AuthConfig): AuthProvisionResult['generatedCode'] {
    return [
        {
            path: 'src/lib/supabase.ts',
            description: 'Supabase client configuration',
            content: `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);`,
        },
        {
            path: 'src/providers/AuthProvider.tsx',
            description: 'Supabase auth provider',
            content: `import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithGithub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
    };

    const signInWithGithub = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
        if (error) throw error;
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isLoading,
            signIn,
            signUp,
            signOut,
            signInWithGoogle,
            signInWithGithub,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}`,
        },
        {
            path: 'src/components/auth/LoginForm.tsx',
            description: 'Login form component',
            content: `import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
    const { signIn, signInWithGoogle, signInWithGithub } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await signIn(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4 w-full max-w-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={signInWithGoogle}>
                    Google
                </Button>
                <Button variant="outline" onClick={signInWithGithub}>
                    GitHub
                </Button>
            </div>
        </div>
    );
}`,
        },
    ];
}

// ============================================================================
// BETTER-AUTH PROVISIONING (Self-hosted)
// ============================================================================

async function provisionBetterAuth(config: AuthConfig): Promise<AuthProvisionResult> {
    return {
        success: true,
        provider: 'better-auth',
        envVariables: {
            AUTH_SECRET: generateSecureSecret(),
            AUTH_URL: 'http://localhost:3001/api/auth',
        },
        generatedCode: generateBetterAuthCode(config),
        setupInstructions: [
            '1. Install better-auth: npm install better-auth',
            '2. Configure your database connection in server/src/db.ts',
            '3. Run migrations: npx drizzle-kit push:pg',
            '4. Auth is self-hosted - no external service needed!',
        ],
    };
}

function generateBetterAuthCode(config: AuthConfig): AuthProvisionResult['generatedCode'] {
    return [
        {
            path: 'server/src/auth.ts',
            description: 'Better-Auth server configuration',
            content: `import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        ${config.features?.socialLogins?.includes('google') ? `google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },` : ''}
        ${config.features?.socialLogins?.includes('github') ? `github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },` : ''}
    },
});`,
        },
        {
            path: 'src/lib/auth-client.ts',
            description: 'Better-Auth client configuration',
            content: `import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
} = authClient;`,
        },
    ];
}

// ============================================================================
// AUTH0 PROVISIONING
// ============================================================================

async function provisionAuth0(config: AuthConfig): Promise<AuthProvisionResult> {
    const managementToken = process.env.AUTH0_MANAGEMENT_TOKEN;
    const domain = process.env.AUTH0_DOMAIN;

    if (!managementToken || !domain) {
        return {
            success: true,
            provider: 'auth0',
            envVariables: {
                VITE_AUTH0_DOMAIN: '<your-auth0-domain>',
                VITE_AUTH0_CLIENT_ID: '<your-client-id>',
                AUTH0_CLIENT_SECRET: '<your-client-secret>',
            },
            generatedCode: generateAuth0Code(config),
            setupInstructions: [
                '1. Create an Auth0 account at https://auth0.com',
                '2. Create a new application (Single Page Application)',
                '3. Copy your Domain and Client ID',
                '4. Add http://localhost:5173 to Allowed Callback URLs',
                '5. Add your environment variables',
            ],
        };
    }

    // Could implement Auth0 Management API here for auto-provisioning
    return {
        success: true,
        provider: 'auth0',
        envVariables: {
            VITE_AUTH0_DOMAIN: domain,
            VITE_AUTH0_CLIENT_ID: '<configure-in-dashboard>',
        },
        generatedCode: generateAuth0Code(config),
        setupInstructions: [
            'Auth0 domain configured',
            'Create an application in the Auth0 dashboard',
            'Copy the Client ID to your .env file',
        ],
    };
}

function generateAuth0Code(config: AuthConfig): AuthProvisionResult['generatedCode'] {
    return [
        {
            path: 'src/providers/AuthProvider.tsx',
            description: 'Auth0 provider wrapper',
            content: `import { Auth0Provider } from '@auth0/auth0-react';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

if (!domain || !clientId) {
    throw new Error('Missing Auth0 environment variables');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
            }}
        >
            {children}
        </Auth0Provider>
    );
}`,
        },
        {
            path: 'src/hooks/useAuth.ts',
            description: 'Auth hook wrapper',
            content: `import { useAuth0 } from '@auth0/auth0-react';

export function useAuth() {
    const {
        user,
        isAuthenticated,
        isLoading,
        loginWithRedirect,
        logout,
        getAccessTokenSilently,
    } = useAuth0();

    return {
        user: user ? {
            id: user.sub,
            email: user.email,
            name: user.name,
            imageUrl: user.picture,
        } : null,
        isSignedIn: isAuthenticated,
        isLoading,
        signIn: loginWithRedirect,
        signOut: () => logout({ logoutParams: { returnTo: window.location.origin } }),
        getToken: getAccessTokenSilently,
    };
}`,
        },
    ];
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class AuthProvisioningService {
    /**
     * Provision authentication for a project
     */
    async provision(config: AuthConfig): Promise<AuthProvisionResult> {
        switch (config.provider) {
            case 'clerk':
                return provisionClerk(config);
            case 'supabase':
                return provisionSupabaseAuth(config);
            case 'better-auth':
                return provisionBetterAuth(config);
            case 'auth0':
                return provisionAuth0(config);
            default:
                return {
                    success: false,
                    provider: config.provider,
                    envVariables: {},
                    generatedCode: [],
                    setupInstructions: [],
                    error: `Unknown provider: ${config.provider}`,
                };
        }
    }

    /**
     * Get available providers and recommendations
     */
    getRecommendation(requirements: {
        selfHosted?: boolean;
        enterprise?: boolean;
        includesDatabase?: boolean;
        budget?: 'free' | 'paid';
    }): {
        recommended: AuthProvider;
        reason: string;
        alternatives: AuthProvider[];
    } {
        if (requirements.selfHosted) {
            return {
                recommended: 'better-auth',
                reason: 'Self-hosted, open source, full control over data',
                alternatives: ['supabase'],
            };
        }

        if (requirements.enterprise) {
            return {
                recommended: 'auth0',
                reason: 'Enterprise features, SSO, compliance certifications',
                alternatives: ['clerk'],
            };
        }

        if (requirements.includesDatabase) {
            return {
                recommended: 'supabase',
                reason: 'Auth + Database + Storage in one platform',
                alternatives: ['better-auth'],
            };
        }

        if (requirements.budget === 'free') {
            return {
                recommended: 'supabase',
                reason: 'Generous free tier, includes auth + database',
                alternatives: ['better-auth', 'clerk'],
            };
        }

        return {
            recommended: 'clerk',
            reason: 'Best developer experience, beautiful UI components',
            alternatives: ['supabase', 'auth0'],
        };
    }

    /**
     * Get available providers
     */
    getAvailableProviders(): Array<{
        provider: AuthProvider;
        name: string;
        features: string[];
        pricing: string;
    }> {
        return [
            {
                provider: 'clerk',
                name: 'Clerk',
                features: ['Pre-built UI', 'Social logins', 'MFA', 'Organizations', 'Webhooks'],
                pricing: 'Free up to 10k MAU',
            },
            {
                provider: 'supabase',
                name: 'Supabase Auth',
                features: ['Email/password', 'Social logins', 'Magic links', 'Row Level Security'],
                pricing: 'Free up to 50k MAU',
            },
            {
                provider: 'auth0',
                name: 'Auth0',
                features: ['Enterprise SSO', 'MFA', 'Anomaly detection', 'Compliance'],
                pricing: 'Free up to 7k MAU',
            },
            {
                provider: 'better-auth',
                name: 'Better-Auth',
                features: ['Self-hosted', 'Open source', 'Full control', 'No vendor lock-in'],
                pricing: 'Free (self-hosted)',
            },
        ];
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSecureSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: AuthProvisioningService | null = null;

export function getAuthProvisioningService(): AuthProvisioningService {
    if (!instance) {
        instance = new AuthProvisioningService();
    }
    return instance;
}


/**
 * Template System Types
 * 
 * Defines the structure for prebuilt templates that accelerate
 * application generation.
 */

// ============================================================================
// TEMPLATE CATEGORIES
// ============================================================================

export type TemplateCategory = 
    | 'frontend'
    | 'backend'
    | 'fullstack'
    | 'ai-ml'
    | 'api'
    | 'mobile'
    | 'dashboard'
    | 'ecommerce'
    | 'saas'
    | 'landing'
    | 'blog'
    | 'portfolio'
    | 'admin'
    | 'auth'
    | 'database'
    | 'realtime'
    | 'cli'
    | 'library'
    | 'component';

export type FrameworkType =
    | 'react'
    | 'nextjs'
    | 'vue'
    | 'nuxt'
    | 'svelte'
    | 'sveltekit'
    | 'solid'
    | 'angular'
    | 'astro'
    | 'express'
    | 'fastify'
    | 'hono'
    | 'elysia'
    | 'flask'
    | 'fastapi'
    | 'django'
    | 'rails'
    | 'phoenix'
    | 'vanilla';

export type UILibrary =
    | 'tailwind'
    | 'shadcn'
    | 'radix'
    | 'chakra'
    | 'mantine'
    | 'mui'
    | 'antd'
    | 'bootstrap'
    | 'bulma'
    | 'styled-components'
    | 'emotion'
    | 'vanilla-extract'
    | 'none';

export type DatabaseType =
    | 'postgresql'
    | 'mysql'
    | 'sqlite'
    | 'mongodb'
    | 'redis'
    | 'supabase'
    | 'planetscale'
    | 'neon'
    | 'turso'
    | 'firebase'
    | 'none';

export type AuthType =
    | 'better-auth'
    | 'nextauth'
    | 'clerk'
    | 'auth0'
    | 'supabase-auth'
    | 'firebase-auth'
    | 'lucia'
    | 'custom'
    | 'none';

// ============================================================================
// TEMPLATE INTERFACE
// ============================================================================

export interface Template {
    id: string;
    name: string;
    description: string;
    shortDescription: string;
    
    // Categorization
    categories: TemplateCategory[];
    tags: string[];
    
    // Tech stack
    framework: FrameworkType;
    uiLibrary: UILibrary;
    database?: DatabaseType;
    auth?: AuthType;
    
    // Files structure
    files: TemplateFile[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    
    // Customization points
    variables: TemplateVariable[];
    
    // Metadata
    version: string;
    author: string;
    source?: string; // GitHub URL, HuggingFace Space, etc.
    license: string;
    popularity: number;
    lastUpdated: Date;
    
    // AI metadata for matching
    keywords: string[];
    useCases: string[];
    complexity: 'beginner' | 'intermediate' | 'advanced';
    estimatedSetupTime: number; // minutes
    
    // Preview
    previewImage?: string;
    demoUrl?: string;
}

export interface TemplateFile {
    path: string;
    content: string;
    isTemplate: boolean; // Contains {{variable}} placeholders
    language: string;
    size: number;
}

export interface TemplateVariable {
    name: string;
    description: string;
    type: 'string' | 'boolean' | 'number' | 'select' | 'multiselect';
    default?: string | boolean | number | string[];
    options?: string[]; // For select/multiselect
    required: boolean;
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
    };
}

// ============================================================================
// TEMPLATE MATCHING
// ============================================================================

export interface TemplateMatchResult {
    template: Template;
    score: number;
    matchReasons: string[];
    suggestedVariables: Record<string, string | boolean | number | string[]>;
}

export interface TemplateSearchQuery {
    prompt: string;
    categories?: TemplateCategory[];
    frameworks?: FrameworkType[];
    uiLibraries?: UILibrary[];
    databases?: DatabaseType[];
    complexity?: Template['complexity'];
    tags?: string[];
}

export interface TemplateInstantiationRequest {
    templateId: string;
    projectName: string;
    variables: Record<string, string | boolean | number | string[]>;
    customizations?: {
        additionalDependencies?: Record<string, string>;
        excludeFiles?: string[];
        additionalFiles?: TemplateFile[];
    };
}

export interface TemplateInstantiationResult {
    success: boolean;
    files: TemplateFile[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    setupInstructions: string[];
    warnings?: string[];
}

// ============================================================================
// TEMPLATE LIBRARY
// ============================================================================

export interface TemplateLibrary {
    templates: Template[];
    categories: CategoryInfo[];
    frameworks: FrameworkInfo[];
    totalCount: number;
    lastSynced: Date;
}

export interface CategoryInfo {
    id: TemplateCategory;
    name: string;
    description: string;
    icon: string;
    templateCount: number;
}

export interface FrameworkInfo {
    id: FrameworkType;
    name: string;
    description: string;
    icon: string;
    templateCount: number;
    popularity: number;
}

// ============================================================================
// TEMPLATE CLONING (from external sources)
// ============================================================================

export interface CloneSource {
    type: 'github' | 'gitlab' | 'huggingface' | 'vercel' | 'url';
    url: string;
    branch?: string;
    subdirectory?: string;
}

export interface CloneResult {
    success: boolean;
    template?: Template;
    error?: string;
    warnings?: string[];
}


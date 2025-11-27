/**
 * Template Matching Engine
 * 
 * Uses AI and keyword analysis to find the best matching templates
 * for a user's project description.
 */

import {
    Template,
    TemplateSearchQuery,
    TemplateMatchResult,
    TemplateCategory,
    FrameworkType,
    UILibrary,
} from './types.js';
import { getTemplateLibrary } from './template-library.js';

// ============================================================================
// KEYWORD MAPPINGS
// ============================================================================

const CATEGORY_KEYWORDS: Record<TemplateCategory, string[]> = {
    'frontend': ['frontend', 'ui', 'user interface', 'client', 'web app', 'spa', 'single page'],
    'backend': ['backend', 'server', 'api', 'service', 'microservice', 'rest', 'graphql'],
    'fullstack': ['fullstack', 'full-stack', 'complete', 'end-to-end', 'entire app'],
    'ai-ml': ['ai', 'artificial intelligence', 'ml', 'machine learning', 'llm', 'gpt', 'agent', 'chatbot', 'model'],
    'api': ['api', 'rest', 'graphql', 'endpoint', 'webhook', 'integration'],
    'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter', 'app'],
    'dashboard': ['dashboard', 'admin', 'analytics', 'metrics', 'charts', 'graphs', 'management'],
    'ecommerce': ['ecommerce', 'e-commerce', 'shop', 'store', 'cart', 'checkout', 'products', 'payment'],
    'saas': ['saas', 'software as a service', 'subscription', 'multi-tenant', 'platform'],
    'landing': ['landing', 'marketing', 'homepage', 'hero', 'conversion', 'launch'],
    'blog': ['blog', 'posts', 'articles', 'cms', 'content', 'markdown'],
    'portfolio': ['portfolio', 'showcase', 'projects', 'personal', 'resume'],
    'admin': ['admin', 'administration', 'management', 'control panel', 'back office'],
    'auth': ['auth', 'authentication', 'login', 'signup', 'register', 'oauth', 'sso'],
    'database': ['database', 'db', 'orm', 'schema', 'migration', 'postgres', 'mysql'],
    'realtime': ['realtime', 'real-time', 'websocket', 'socket', 'live', 'streaming', 'chat'],
    'cli': ['cli', 'command line', 'terminal', 'shell', 'script'],
    'library': ['library', 'package', 'module', 'npm', 'utility'],
    'component': ['component', 'widget', 'ui component', 'element'],
};

const FRAMEWORK_KEYWORDS: Record<FrameworkType, string[]> = {
    'react': ['react', 'reactjs', 'jsx', 'hooks', 'redux', 'zustand'],
    'nextjs': ['next', 'nextjs', 'next.js', 'vercel', 'ssr', 'ssg', 'app router'],
    'vue': ['vue', 'vuejs', 'vue.js', 'vuex', 'pinia', 'nuxt'],
    'nuxt': ['nuxt', 'nuxtjs', 'nuxt.js'],
    'svelte': ['svelte', 'sveltejs', 'sveltekit'],
    'sveltekit': ['sveltekit', 'svelte kit'],
    'solid': ['solid', 'solidjs', 'solid.js'],
    'angular': ['angular', 'ng', 'angular.js', 'rxjs'],
    'astro': ['astro', 'astro.build', 'island'],
    'express': ['express', 'expressjs', 'express.js', 'node api'],
    'fastify': ['fastify', 'fastify.js'],
    'hono': ['hono', 'hono.js', 'edge'],
    'elysia': ['elysia', 'bun'],
    'flask': ['flask', 'python web'],
    'fastapi': ['fastapi', 'fast api', 'python api', 'starlette'],
    'django': ['django', 'python full'],
    'rails': ['rails', 'ruby on rails', 'ror'],
    'phoenix': ['phoenix', 'elixir'],
    'vanilla': ['vanilla', 'plain', 'no framework', 'pure'],
};

const UI_KEYWORDS: Record<UILibrary, string[]> = {
    'tailwind': ['tailwind', 'tailwindcss', 'utility-first'],
    'shadcn': ['shadcn', 'shadcn/ui', 'radix-ui'],
    'radix': ['radix', 'radix-ui'],
    'chakra': ['chakra', 'chakra-ui'],
    'mantine': ['mantine'],
    'mui': ['mui', 'material-ui', 'material ui', 'material design'],
    'antd': ['antd', 'ant design', 'ant-design'],
    'bootstrap': ['bootstrap', 'react-bootstrap'],
    'bulma': ['bulma'],
    'styled-components': ['styled-components', 'styled components', 'css-in-js'],
    'emotion': ['emotion', '@emotion'],
    'vanilla-extract': ['vanilla-extract', 'vanilla extract'],
    'none': [],
};

const TASK_KEYWORDS: Record<string, string[]> = {
    'authentication': ['login', 'signup', 'auth', 'authentication', 'register', 'password', 'oauth', 'social login'],
    'database': ['database', 'db', 'store', 'save', 'persist', 'crud', 'orm'],
    'api': ['api', 'endpoint', 'route', 'rest', 'graphql', 'fetch'],
    'deployment': ['deploy', 'hosting', 'vercel', 'netlify', 'production'],
    'testing': ['test', 'testing', 'unit test', 'e2e', 'integration test'],
    'styling': ['style', 'css', 'design', 'beautiful', 'modern', 'ui'],
    'animation': ['animation', 'animate', 'motion', 'framer', 'transition'],
    'state': ['state', 'state management', 'global state', 'redux', 'zustand'],
    'forms': ['form', 'input', 'validation', 'submit'],
    'charts': ['chart', 'graph', 'visualization', 'data viz', 'analytics'],
};

// ============================================================================
// TEMPLATE MATCHER CLASS
// ============================================================================

export class TemplateMatcher {
    private library = getTemplateLibrary();

    /**
     * Find best matching templates for a user prompt
     */
    async findMatches(query: TemplateSearchQuery): Promise<TemplateMatchResult[]> {
        const templates = this.library.getAllTemplates();
        const results: TemplateMatchResult[] = [];

        const promptLower = query.prompt.toLowerCase();
        const promptWords = this.tokenize(promptLower);

        for (const template of templates) {
            const { score, reasons } = this.calculateMatchScore(template, promptWords, query);

            if (score > 0) {
                results.push({
                    template,
                    score,
                    matchReasons: reasons,
                    suggestedVariables: this.suggestVariables(template, query.prompt),
                });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Return top 5 matches
        return results.slice(0, 5);
    }

    /**
     * Find best single match
     */
    async findBestMatch(prompt: string): Promise<TemplateMatchResult | null> {
        const matches = await this.findMatches({ prompt });
        return matches.length > 0 ? matches[0] : null;
    }

    /**
     * Calculate match score for a template
     */
    private calculateMatchScore(
        template: Template,
        promptWords: string[],
        query: TemplateSearchQuery
    ): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];

        // 1. Category matching (high weight)
        const matchedCategories = this.detectCategories(promptWords);
        for (const category of matchedCategories) {
            if (template.categories.includes(category)) {
                score += 25;
                reasons.push(`Matches category: ${category}`);
            }
        }

        // 2. Framework matching (high weight)
        const detectedFramework = this.detectFramework(promptWords);
        if (detectedFramework && template.framework === detectedFramework) {
            score += 30;
            reasons.push(`Uses requested framework: ${detectedFramework}`);
        }

        // 3. UI Library matching
        const detectedUI = this.detectUILibrary(promptWords);
        if (detectedUI && template.uiLibrary === detectedUI) {
            score += 15;
            reasons.push(`Uses requested UI library: ${detectedUI}`);
        }

        // 4. Keyword matching against template keywords
        const templateKeywords = [...template.keywords, ...template.tags].map(k => k.toLowerCase());
        for (const word of promptWords) {
            if (templateKeywords.some(tk => tk.includes(word) || word.includes(tk))) {
                score += 5;
            }
        }

        // 5. Use case matching
        const promptJoined = promptWords.join(' ');
        for (const useCase of template.useCases) {
            if (promptJoined.includes(useCase.toLowerCase()) || 
                useCase.toLowerCase().includes(promptJoined)) {
                score += 15;
                reasons.push(`Matches use case: ${useCase}`);
                break;
            }
        }

        // 6. Name/description matching
        const templateName = template.name.toLowerCase();
        const templateDesc = template.shortDescription.toLowerCase();
        for (const word of promptWords) {
            if (templateName.includes(word)) score += 10;
            if (templateDesc.includes(word)) score += 5;
        }

        // 7. Filter constraints from query
        if (query.categories?.length) {
            const hasMatchingCategory = query.categories.some(c => template.categories.includes(c));
            if (!hasMatchingCategory) score = 0; // Exclude if doesn't match filter
        }

        if (query.frameworks?.length) {
            if (!query.frameworks.includes(template.framework)) score = 0;
        }

        if (query.complexity && template.complexity !== query.complexity) {
            score *= 0.8; // Reduce score but don't exclude
        }

        // 8. Popularity bonus
        score += template.popularity * 0.1;

        return { score, reasons };
    }

    /**
     * Detect categories from prompt
     */
    private detectCategories(words: string[]): TemplateCategory[] {
        const detected: TemplateCategory[] = [];
        const joined = words.join(' ');

        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (joined.includes(keyword)) {
                    detected.push(category as TemplateCategory);
                    break;
                }
            }
        }

        return detected;
    }

    /**
     * Detect framework from prompt
     */
    private detectFramework(words: string[]): FrameworkType | null {
        const joined = words.join(' ');

        for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
            for (const keyword of keywords) {
                if (joined.includes(keyword)) {
                    return framework as FrameworkType;
                }
            }
        }

        return null;
    }

    /**
     * Detect UI library from prompt
     */
    private detectUILibrary(words: string[]): UILibrary | null {
        const joined = words.join(' ');

        for (const [library, keywords] of Object.entries(UI_KEYWORDS)) {
            for (const keyword of keywords) {
                if (joined.includes(keyword)) {
                    return library as UILibrary;
                }
            }
        }

        return null;
    }

    /**
     * Suggest variable values based on prompt
     */
    private suggestVariables(
        template: Template,
        prompt: string
    ): Record<string, string | boolean | number | string[]> {
        const suggested: Record<string, string | boolean | number | string[]> = {};

        for (const variable of template.variables) {
            if (variable.name === 'projectName') {
                // Try to extract project name from prompt
                const nameMatch = prompt.match(/(?:called|named|create)\s+["']?([a-z][a-z0-9-_]+)["']?/i);
                if (nameMatch) {
                    suggested.projectName = nameMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
                } else {
                    suggested.projectName = variable.default as string;
                }
            } else {
                suggested[variable.name] = variable.default as string | boolean | number | string[];
            }
        }

        return suggested;
    }

    /**
     * Tokenize prompt into words
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
    }

    /**
     * Get AI-enhanced match using OpenRouter
     */
    async getAIEnhancedMatch(
        prompt: string,
        apiKey?: string
    ): Promise<TemplateMatchResult | null> {
        // First get keyword-based matches
        const keywordMatches = await this.findMatches({ prompt });

        if (!apiKey || keywordMatches.length === 0) {
            return keywordMatches[0] || null;
        }

        // Use AI to refine the selection
        try {
            const templates = keywordMatches.slice(0, 3).map(m => ({
                id: m.template.id,
                name: m.template.name,
                description: m.template.shortDescription,
                categories: m.template.categories,
                framework: m.template.framework,
            }));

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3-haiku',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a template selection assistant. Given a user's project description and a list of templates, select the best matching template ID. Respond with ONLY the template ID, nothing else.`,
                        },
                        {
                            role: 'user',
                            content: `User wants to build: "${prompt}"\n\nAvailable templates:\n${JSON.stringify(templates, null, 2)}\n\nBest template ID:`,
                        },
                    ],
                    max_tokens: 50,
                }),
            });

            const data = await response.json();
            const selectedId = data.choices?.[0]?.message?.content?.trim();

            // Find the selected template
            const selectedMatch = keywordMatches.find(m => m.template.id === selectedId);
            if (selectedMatch) {
                selectedMatch.matchReasons.unshift('AI-recommended best match');
                return selectedMatch;
            }
        } catch (error) {
            console.warn('AI enhancement failed, using keyword match:', error);
        }

        return keywordMatches[0] || null;
    }
}

// Singleton instance
let instance: TemplateMatcher | null = null;

export function getTemplateMatcher(): TemplateMatcher {
    if (!instance) {
        instance = new TemplateMatcher();
    }
    return instance;
}


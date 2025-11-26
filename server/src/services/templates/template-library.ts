/**
 * Template Library
 * 
 * Manages a collection of prebuilt templates for rapid application generation.
 * Includes both built-in templates and the ability to clone from external sources.
 */

import {
    Template,
    TemplateCategory,
    FrameworkType,
    UILibrary,
    DatabaseType,
    AuthType,
    TemplateFile,
    TemplateVariable,
    TemplateLibrary,
    CategoryInfo,
    FrameworkInfo,
} from './types';

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const createReactTemplate = (): Template => ({
    id: 'react-vite-tailwind',
    name: 'React + Vite + Tailwind',
    description: 'A modern React application with Vite for fast builds and Tailwind CSS for styling. Includes TypeScript, ESLint, and Prettier configuration.',
    shortDescription: 'Modern React starter with Vite and Tailwind',
    categories: ['frontend'],
    tags: ['react', 'vite', 'tailwind', 'typescript', 'spa'],
    framework: 'react',
    uiLibrary: 'tailwind',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                private: true,
                version: '0.0.0',
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'tsc -b && vite build',
                    lint: 'eslint .',
                    preview: 'vite preview',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 300,
        },
        {
            path: 'src/App.tsx',
            content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">{{projectName}}</h1>
        <div className="bg-slate-700/50 rounded-xl p-8 backdrop-blur">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
          >
            Count: {count}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App`,
            isTemplate: true,
            language: 'typescript',
            size: 600,
        },
        {
            path: 'src/main.tsx',
            content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
            isTemplate: false,
            language: 'typescript',
            size: 250,
        },
        {
            path: 'src/index.css',
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
            isTemplate: false,
            language: 'css',
            size: 60,
        },
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
            isTemplate: true,
            language: 'html',
            size: 350,
        },
        {
            path: 'tailwind.config.js',
            content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
            isTemplate: false,
            language: 'javascript',
            size: 200,
        },
        {
            path: 'vite.config.ts',
            content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
            isTemplate: false,
            language: 'typescript',
            size: 140,
        },
        {
            path: 'tsconfig.json',
            content: JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    useDefineForClassFields: true,
                    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                    module: 'ESNext',
                    skipLibCheck: true,
                    moduleResolution: 'bundler',
                    allowImportingTsExtensions: true,
                    resolveJsonModule: true,
                    isolatedModules: true,
                    noEmit: true,
                    jsx: 'react-jsx',
                    strict: true,
                    noUnusedLocals: true,
                    noUnusedParameters: true,
                    noFallthroughCasesInSwitch: true,
                },
                include: ['src'],
                references: [{ path: './tsconfig.node.json' }],
            }, null, 2),
            isTemplate: false,
            language: 'json',
            size: 500,
        },
    ],
    dependencies: {
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
    },
    devDependencies: {
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
        'autoprefixer': '^10.4.19',
        'postcss': '^8.4.38',
        'tailwindcss': '^3.4.4',
        'typescript': '^5.5.3',
        'vite': '^5.4.0',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your project',
            type: 'string',
            default: 'my-app',
            required: true,
            validation: {
                pattern: '^[a-z][a-z0-9-]*$',
                minLength: 2,
                maxLength: 50,
            },
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 100,
    lastUpdated: new Date(),
    keywords: ['react', 'vite', 'tailwind', 'typescript', 'frontend', 'spa', 'modern'],
    useCases: ['Single page application', 'Web app', 'Frontend project', 'React starter'],
    complexity: 'beginner',
    estimatedSetupTime: 2,
});

const createNextJsShadcnTemplate = (): Template => ({
    id: 'nextjs-shadcn-auth',
    name: 'Next.js + shadcn/ui + Auth',
    description: 'A complete Next.js 14 application with shadcn/ui components, better-auth authentication, and Drizzle ORM database setup.',
    shortDescription: 'Full-stack Next.js with shadcn/ui and auth',
    categories: ['fullstack', 'auth', 'saas'],
    tags: ['nextjs', 'shadcn', 'auth', 'drizzle', 'postgresql', 'typescript'],
    framework: 'nextjs',
    uiLibrary: 'shadcn',
    database: 'postgresql',
    auth: 'better-auth',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                version: '0.1.0',
                private: true,
                scripts: {
                    dev: 'next dev',
                    build: 'next build',
                    start: 'next start',
                    lint: 'next lint',
                    'db:push': 'drizzle-kit push',
                    'db:studio': 'drizzle-kit studio',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 400,
        },
        {
            path: 'app/page.tsx',
            content: `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
            {{projectName}}
          </h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Your next-generation application built with Next.js, shadcn/ui, and modern authentication.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-amber-400">Fast & Modern</CardTitle>
              <CardDescription>Built with Next.js 14 and React Server Components</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm">
                Leverage the latest Next.js features for optimal performance.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-amber-400">Beautiful UI</CardTitle>
              <CardDescription>Powered by shadcn/ui components</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm">
                Accessible, customizable components out of the box.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-amber-400">Secure Auth</CardTitle>
              <CardDescription>Authentication with better-auth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm">
                Email, social, and passwordless authentication ready.
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center mt-12">
          <Link href="/auth/signin">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}`,
            isTemplate: true,
            language: 'typescript',
            size: 2200,
        },
        {
            path: 'app/layout.tsx',
            content: `import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "{{projectName}}",
  description: "Built with Next.js and KripTik AI",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`,
            isTemplate: true,
            language: 'typescript',
            size: 450,
        },
        {
            path: 'app/globals.css',
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`,
            isTemplate: false,
            language: 'css',
            size: 1800,
        },
        {
            path: 'lib/db.ts',
            content: `import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })`,
            isTemplate: false,
            language: 'typescript',
            size: 250,
        },
        {
            path: 'lib/schema.ts',
            content: `import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})`,
            isTemplate: false,
            language: 'typescript',
            size: 1200,
        },
        {
            path: '.env.example',
            content: `DATABASE_URL=postgresql://user:password@localhost:5432/{{projectName}}
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000`,
            isTemplate: true,
            language: 'plaintext',
            size: 150,
        },
    ],
    dependencies: {
        'next': '14.2.5',
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
        'better-auth': '^0.4.0',
        'drizzle-orm': '^0.33.0',
        'pg': '^8.12.0',
        'class-variance-authority': '^0.7.0',
        'clsx': '^2.1.1',
        'tailwind-merge': '^2.4.0',
        'lucide-react': '^0.417.0',
    },
    devDependencies: {
        '@types/node': '^20.14.12',
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        'drizzle-kit': '^0.24.0',
        'typescript': '^5.5.4',
        'tailwindcss': '^3.4.7',
        'postcss': '^8.4.40',
        'autoprefixer': '^10.4.19',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your project',
            type: 'string',
            default: 'my-nextjs-app',
            required: true,
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 95,
    lastUpdated: new Date(),
    keywords: ['nextjs', 'shadcn', 'auth', 'drizzle', 'postgresql', 'fullstack', 'saas', 'dashboard'],
    useCases: ['SaaS application', 'Admin dashboard', 'Full-stack app', 'Authenticated app'],
    complexity: 'intermediate',
    estimatedSetupTime: 5,
});

const createAPITemplate = (): Template => ({
    id: 'express-api-typescript',
    name: 'Express API + TypeScript',
    description: 'A production-ready Express.js API with TypeScript, validation, error handling, and OpenAPI documentation.',
    shortDescription: 'REST API with Express and TypeScript',
    categories: ['backend', 'api'],
    tags: ['express', 'api', 'typescript', 'rest', 'openapi'],
    framework: 'express',
    uiLibrary: 'none',
    database: 'postgresql',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                version: '1.0.0',
                scripts: {
                    dev: 'tsx watch src/index.ts',
                    build: 'tsc',
                    start: 'node dist/index.js',
                    lint: 'eslint src/',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 300,
        },
        {
            path: 'src/index.ts',
            content: `import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/error'
import { logger } from './middleware/logger'
import routes from './routes'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(logger)

// Routes
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(\`🚀 {{projectName}} API running on port \${PORT}\`)
})`,
            isTemplate: true,
            language: 'typescript',
            size: 700,
        },
        {
            path: 'src/routes/index.ts',
            content: `import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    name: '{{projectName}}',
    version: '1.0.0',
    docs: '/api/docs',
  })
})

export default router`,
            isTemplate: true,
            language: 'typescript',
            size: 250,
        },
        {
            path: 'src/middleware/error.ts',
            content: `import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    })
  }

  console.error('Unexpected error:', err)
  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  })
}`,
            isTemplate: false,
            language: 'typescript',
            size: 700,
        },
        {
            path: 'src/middleware/logger.ts',
            content: `import { Request, Response, NextFunction } from 'express'

export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(\`\${req.method} \${req.path} \${res.statusCode} \${duration}ms\`)
  })
  
  next()
}`,
            isTemplate: false,
            language: 'typescript',
            size: 350,
        },
    ],
    dependencies: {
        'express': '^4.19.2',
        'cors': '^2.8.5',
        'helmet': '^7.1.0',
        'zod': '^3.23.8',
    },
    devDependencies: {
        '@types/express': '^4.17.21',
        '@types/cors': '^2.8.17',
        '@types/node': '^20.14.12',
        'typescript': '^5.5.4',
        'tsx': '^4.16.2',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your API',
            type: 'string',
            default: 'my-api',
            required: true,
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 90,
    lastUpdated: new Date(),
    keywords: ['express', 'api', 'typescript', 'rest', 'backend', 'server'],
    useCases: ['REST API', 'Backend service', 'Microservice', 'API server'],
    complexity: 'beginner',
    estimatedSetupTime: 3,
});

const createAIAgentTemplate = (): Template => ({
    id: 'ai-agent-langchain',
    name: 'AI Agent with LangChain',
    description: 'An AI agent application using LangChain for complex reasoning, tool use, and RAG capabilities.',
    shortDescription: 'AI Agent with LangChain and tools',
    categories: ['ai-ml', 'backend'],
    tags: ['ai', 'langchain', 'agent', 'llm', 'rag', 'openai'],
    framework: 'express',
    uiLibrary: 'none',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                version: '1.0.0',
                type: 'module',
                scripts: {
                    dev: 'tsx watch src/index.ts',
                    build: 'tsc',
                    start: 'node dist/index.js',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 250,
        },
        {
            path: 'src/index.ts',
            content: `import { createAgent } from './agent'
import express from 'express'

const app = express()
app.use(express.json())

const agent = await createAgent()

app.post('/chat', async (req, res) => {
  const { message } = req.body
  
  try {
    const response = await agent.invoke({
      input: message,
    })
    
    res.json({
      response: response.output,
      intermediateSteps: response.intermediateSteps,
    })
  } catch (error) {
    res.status(500).json({ error: 'Agent error' })
  }
})

app.listen(3000, () => {
  console.log('🤖 {{projectName}} Agent running on port 3000')
})`,
            isTemplate: true,
            language: 'typescript',
            size: 600,
        },
        {
            path: 'src/agent.ts',
            content: `import { ChatOpenAI } from '@langchain/openai'
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export async function createAgent() {
  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0,
  })

  const tools = [
    new DynamicStructuredTool({
      name: 'calculator',
      description: 'Performs mathematical calculations',
      schema: z.object({
        expression: z.string().describe('The math expression to evaluate'),
      }),
      func: async ({ expression }) => {
        try {
          // Safe math evaluation
          const result = Function(\`"use strict"; return (\${expression})\`)()
          return String(result)
        } catch {
          return 'Invalid expression'
        }
      },
    }),
    new DynamicStructuredTool({
      name: 'get_current_time',
      description: 'Gets the current date and time',
      schema: z.object({}),
      func: async () => {
        return new Date().toISOString()
      },
    }),
  ]

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful AI assistant. Use the available tools when needed.'],
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ])

  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools,
    prompt,
  })

  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    verbose: true,
  })
}`,
            isTemplate: false,
            language: 'typescript',
            size: 1400,
        },
        {
            path: '.env.example',
            content: `OPENAI_API_KEY=sk-your-key-here`,
            isTemplate: false,
            language: 'plaintext',
            size: 40,
        },
    ],
    dependencies: {
        '@langchain/core': '^0.2.18',
        '@langchain/openai': '^0.2.5',
        'langchain': '^0.2.11',
        'express': '^4.19.2',
        'zod': '^3.23.8',
    },
    devDependencies: {
        '@types/express': '^4.17.21',
        '@types/node': '^20.14.12',
        'typescript': '^5.5.4',
        'tsx': '^4.16.2',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your AI agent',
            type: 'string',
            default: 'my-ai-agent',
            required: true,
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 85,
    lastUpdated: new Date(),
    keywords: ['ai', 'agent', 'langchain', 'llm', 'openai', 'chatbot', 'rag'],
    useCases: ['AI chatbot', 'AI assistant', 'Autonomous agent', 'RAG system'],
    complexity: 'intermediate',
    estimatedSetupTime: 5,
});

const createDashboardTemplate = (): Template => ({
    id: 'admin-dashboard-react',
    name: 'Admin Dashboard',
    description: 'A comprehensive admin dashboard with data tables, charts, user management, and dark mode support.',
    shortDescription: 'Full-featured admin dashboard',
    categories: ['dashboard', 'admin', 'frontend'],
    tags: ['dashboard', 'admin', 'charts', 'tables', 'react', 'shadcn'],
    framework: 'react',
    uiLibrary: 'shadcn',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                version: '0.1.0',
                private: true,
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'tsc -b && vite build',
                    preview: 'vite preview',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 300,
        },
        {
            path: 'src/App.tsx',
            content: `import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { ThemeProvider } from './components/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Dashboard />
        </main>
      </div>
    </ThemeProvider>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 400,
        },
        {
            path: 'src/pages/Dashboard.tsx',
            content: `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 500 },
  { name: 'Jun', value: 900 },
]

export function Dashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2,350</div>
            <p className="text-xs text-muted-foreground">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12,234</div>
            <p className="text-xs text-muted-foreground">+19% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">+201 since last hour</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 2500,
        },
        {
            path: 'src/components/Sidebar.tsx',
            content: `import { cn } from '@/lib/utils'
import { Home, Users, Settings, BarChart3, FileText, LogOut } from 'lucide-react'

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: Users, label: 'Users', href: '/users' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: FileText, label: 'Reports', href: '/reports' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6">
        <h2 className="text-xl font-bold text-amber-500">{{projectName}}</h2>
      </div>
      
      <nav className="flex-1 px-4">
        {menuItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              item.href === '/' && "bg-accent text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </a>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  )
}`,
            isTemplate: true,
            language: 'typescript',
            size: 1400,
        },
    ],
    dependencies: {
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
        'recharts': '^2.12.7',
        'lucide-react': '^0.417.0',
        'class-variance-authority': '^0.7.0',
        'clsx': '^2.1.1',
        'tailwind-merge': '^2.4.0',
    },
    devDependencies: {
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
        'autoprefixer': '^10.4.19',
        'postcss': '^8.4.38',
        'tailwindcss': '^3.4.4',
        'typescript': '^5.5.3',
        'vite': '^5.4.0',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your dashboard',
            type: 'string',
            default: 'admin-dashboard',
            required: true,
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 88,
    lastUpdated: new Date(),
    keywords: ['dashboard', 'admin', 'charts', 'analytics', 'react', 'shadcn', 'management'],
    useCases: ['Admin panel', 'Analytics dashboard', 'Management system', 'Control panel'],
    complexity: 'intermediate',
    estimatedSetupTime: 4,
});

const createLandingPageTemplate = (): Template => ({
    id: 'landing-page-modern',
    name: 'Modern Landing Page',
    description: 'A beautiful, conversion-optimized landing page with hero section, features, testimonials, pricing, and CTA sections.',
    shortDescription: 'Conversion-optimized landing page',
    categories: ['landing', 'frontend'],
    tags: ['landing', 'marketing', 'tailwind', 'animations', 'conversion'],
    framework: 'react',
    uiLibrary: 'tailwind',
    files: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: '{{projectName}}',
                version: '0.1.0',
                private: true,
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'tsc -b && vite build',
                    preview: 'vite preview',
                },
            }, null, 2),
            isTemplate: true,
            language: 'json',
            size: 280,
        },
        {
            path: 'src/App.tsx',
            content: `import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Testimonials } from './components/Testimonials'
import { Pricing } from './components/Pricing'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Hero />
      <Features />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 500,
        },
        {
            path: 'src/components/Hero.tsx',
            content: `export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>
      
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          {{projectName}}
        </h1>
        <p className="mt-6 text-xl leading-8 text-slate-300">
          Transform your workflow with our cutting-edge platform. 
          Built for teams who want to move faster and achieve more.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#"
            className="rounded-full bg-amber-500 px-8 py-4 text-lg font-semibold text-black shadow-lg hover:bg-amber-400 transition-all hover:scale-105"
          >
            Get Started Free
          </a>
          <a href="#" className="text-lg font-semibold text-slate-300 hover:text-white">
            Learn more <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}`,
            isTemplate: true,
            language: 'typescript',
            size: 1400,
        },
        {
            path: 'src/components/Features.tsx',
            content: `const features = [
  {
    title: 'Lightning Fast',
    description: 'Experience blazing fast performance with our optimized infrastructure.',
    icon: '⚡',
  },
  {
    title: 'Secure by Default',
    description: 'Enterprise-grade security with end-to-end encryption.',
    icon: '🔒',
  },
  {
    title: 'Scale Infinitely',
    description: 'From startup to enterprise, grow without limits.',
    icon: '📈',
  },
]

export function Features() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold text-center mb-16">Why Choose Us</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 transition-colors">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 1100,
        },
        {
            path: 'src/components/Testimonials.tsx',
            content: `const testimonials = [
  {
    quote: "This product has completely transformed how our team works. Highly recommended!",
    author: "Sarah Chen",
    role: "CTO, TechCorp",
  },
  {
    quote: "The best investment we've made this year. ROI was visible within weeks.",
    author: "Michael Park",
    role: "CEO, StartupX",
  },
]

export function Testimonials() {
  return (
    <section className="py-24 px-6 bg-slate-900/50">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold text-center mb-16">What Our Customers Say</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map((t) => (
            <div key={t.author} className="p-8 rounded-2xl bg-slate-950 border border-slate-800">
              <p className="text-lg text-slate-300 mb-6">"{t.quote}"</p>
              <div>
                <div className="font-semibold">{t.author}</div>
                <div className="text-sm text-slate-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 1000,
        },
        {
            path: 'src/components/Pricing.tsx',
            content: `const plans = [
  {
    name: 'Starter',
    price: '$19',
    features: ['5 team members', '10GB storage', 'Basic analytics', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$49',
    features: ['Unlimited members', '100GB storage', 'Advanced analytics', 'Priority support', 'API access'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: ['Everything in Pro', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
  },
]

export function Pricing() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold text-center mb-16">Simple, Transparent Pricing</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={\`p-8 rounded-2xl border \${
                plan.popular 
                  ? 'bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/50' 
                  : 'bg-slate-900/50 border-slate-800'
              }\`}
            >
              {plan.popular && (
                <div className="text-amber-500 text-sm font-semibold mb-2">Most Popular</div>
              )}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <div className="text-4xl font-bold my-4">{plan.price}<span className="text-lg text-slate-500">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="text-slate-300 flex items-center gap-2">
                    <span className="text-amber-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button className={\`w-full py-3 rounded-lg font-semibold transition \${
                plan.popular 
                  ? 'bg-amber-500 text-black hover:bg-amber-400' 
                  : 'bg-slate-800 hover:bg-slate-700'
              }\`}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 1800,
        },
        {
            path: 'src/components/CTA.tsx',
            content: `export function CTA() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-4xl text-center bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-12">
        <h2 className="text-3xl font-bold text-black mb-4">Ready to Get Started?</h2>
        <p className="text-black/80 mb-8">Join thousands of teams already using our platform.</p>
        <button className="bg-black text-white px-8 py-4 rounded-full font-semibold hover:bg-slate-800 transition">
          Start Free Trial
        </button>
      </div>
    </section>
  )
}`,
            isTemplate: false,
            language: 'typescript',
            size: 600,
        },
        {
            path: 'src/components/Footer.tsx',
            content: `export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-slate-800">
      <div className="mx-auto max-w-7xl text-center text-slate-500">
        <p>© 2024 {{projectName}}. All rights reserved.</p>
      </div>
    </footer>
  )
}`,
            isTemplate: true,
            language: 'typescript',
            size: 300,
        },
    ],
    dependencies: {
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
    },
    devDependencies: {
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
        'autoprefixer': '^10.4.19',
        'postcss': '^8.4.38',
        'tailwindcss': '^3.4.4',
        'typescript': '^5.5.3',
        'vite': '^5.4.0',
    },
    variables: [
        {
            name: 'projectName',
            description: 'Name of your product/company',
            type: 'string',
            default: 'MyProduct',
            required: true,
        },
    ],
    version: '1.0.0',
    author: 'KripTik AI',
    license: 'MIT',
    popularity: 92,
    lastUpdated: new Date(),
    keywords: ['landing', 'marketing', 'conversion', 'saas', 'startup', 'hero', 'pricing'],
    useCases: ['Product landing page', 'SaaS marketing', 'Startup website', 'Product launch'],
    complexity: 'beginner',
    estimatedSetupTime: 2,
});

// ============================================================================
// TEMPLATE LIBRARY CLASS
// ============================================================================

export class TemplateLibraryService {
    private templates: Map<string, Template> = new Map();

    constructor() {
        this.initializeBuiltInTemplates();
    }

    private initializeBuiltInTemplates(): void {
        const builtInTemplates = [
            createReactTemplate(),
            createNextJsShadcnTemplate(),
            createAPITemplate(),
            createAIAgentTemplate(),
            createDashboardTemplate(),
            createLandingPageTemplate(),
        ];

        for (const template of builtInTemplates) {
            this.templates.set(template.id, template);
        }
    }

    /**
     * Get all templates
     */
    getAllTemplates(): Template[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get template by ID
     */
    getTemplate(id: string): Template | undefined {
        return this.templates.get(id);
    }

    /**
     * Get templates by category
     */
    getTemplatesByCategory(category: TemplateCategory): Template[] {
        return this.getAllTemplates().filter(t => t.categories.includes(category));
    }

    /**
     * Get templates by framework
     */
    getTemplatesByFramework(framework: FrameworkType): Template[] {
        return this.getAllTemplates().filter(t => t.framework === framework);
    }

    /**
     * Get library info
     */
    getLibraryInfo(): TemplateLibrary {
        const templates = this.getAllTemplates();

        const categories: CategoryInfo[] = [
            { id: 'frontend', name: 'Frontend', description: 'Client-side applications', icon: '🖥️', templateCount: 0 },
            { id: 'backend', name: 'Backend', description: 'Server-side applications', icon: '⚙️', templateCount: 0 },
            { id: 'fullstack', name: 'Full Stack', description: 'Complete applications', icon: '🔄', templateCount: 0 },
            { id: 'ai-ml', name: 'AI/ML', description: 'AI and machine learning', icon: '🤖', templateCount: 0 },
            { id: 'dashboard', name: 'Dashboard', description: 'Admin and analytics', icon: '📊', templateCount: 0 },
            { id: 'landing', name: 'Landing Page', description: 'Marketing pages', icon: '🚀', templateCount: 0 },
            { id: 'api', name: 'API', description: 'REST/GraphQL APIs', icon: '🔌', templateCount: 0 },
            { id: 'ecommerce', name: 'E-Commerce', description: 'Online stores', icon: '🛒', templateCount: 0 },
        ];

        // Count templates per category
        for (const template of templates) {
            for (const category of template.categories) {
                const catInfo = categories.find(c => c.id === category);
                if (catInfo) catInfo.templateCount++;
            }
        }

        const frameworks: FrameworkInfo[] = [
            { id: 'react', name: 'React', description: 'React.js applications', icon: '⚛️', templateCount: 0, popularity: 100 },
            { id: 'nextjs', name: 'Next.js', description: 'Next.js framework', icon: '▲', templateCount: 0, popularity: 95 },
            { id: 'vue', name: 'Vue', description: 'Vue.js applications', icon: '💚', templateCount: 0, popularity: 80 },
            { id: 'svelte', name: 'Svelte', description: 'Svelte applications', icon: '🔥', templateCount: 0, popularity: 70 },
            { id: 'express', name: 'Express', description: 'Express.js servers', icon: '🚂', templateCount: 0, popularity: 90 },
            { id: 'fastapi', name: 'FastAPI', description: 'Python FastAPI', icon: '⚡', templateCount: 0, popularity: 85 },
        ];

        // Count templates per framework
        for (const template of templates) {
            const fwInfo = frameworks.find(f => f.id === template.framework);
            if (fwInfo) fwInfo.templateCount++;
        }

        return {
            templates,
            categories: categories.filter(c => c.templateCount > 0),
            frameworks: frameworks.filter(f => f.templateCount > 0),
            totalCount: templates.length,
            lastSynced: new Date(),
        };
    }

    /**
     * Add a custom template
     */
    addTemplate(template: Template): void {
        this.templates.set(template.id, template);
    }

    /**
     * Remove a template
     */
    removeTemplate(id: string): boolean {
        return this.templates.delete(id);
    }
}

// Singleton instance
let instance: TemplateLibraryService | null = null;

export function getTemplateLibrary(): TemplateLibraryService {
    if (!instance) {
        instance = new TemplateLibraryService();
    }
    return instance;
}


import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const isProd = mode === 'production'

    return {
        plugins: [react()] as PluginOption[],

        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },

        // Production build optimizations
        build: {
            // Target modern browsers for smaller bundles
            target: 'es2022',

            // Enable minification
            minify: isProd ? 'esbuild' : false,

            // Increase chunk warning limit for 3D libraries
            chunkSizeWarningLimit: 600,

            // Enable source maps for production debugging
            sourcemap: isProd ? 'hidden' : true,

            // Rollup options for code splitting
            rollupOptions: {
                output: {
                    // Manual chunks for optimal loading
                    manualChunks: (id: string) => {
                        // React ecosystem - loaded first
                        if (id.includes('node_modules/react') ||
                            id.includes('node_modules/react-dom') ||
                            id.includes('node_modules/scheduler')) {
                            return 'react-vendor'
                        }

                        // React Router - core navigation
                        if (id.includes('node_modules/react-router') ||
                            id.includes('node_modules/@remix-run')) {
                            return 'router'
                        }

                        // State management
                        if (id.includes('node_modules/zustand') ||
                            id.includes('node_modules/immer')) {
                            return 'state'
                        }

                        // 3D libraries - large, lazy loaded
                        if (id.includes('node_modules/three') ||
                            id.includes('node_modules/@react-three') ||
                            id.includes('node_modules/@splinetool') ||
                            id.includes('node_modules/react-spline') ||
                            id.includes('node_modules/postprocessing') ||
                            id.includes('node_modules/maath')) {
                            return 'three-vendor'
                        }

                        // Physics engine - very large
                        if (id.includes('node_modules/@dimforge') ||
                            id.includes('node_modules/@react-three/rapier')) {
                            return 'physics'
                        }

                        // UI libraries
                        if (id.includes('node_modules/@radix-ui') ||
                            id.includes('node_modules/@floating-ui') ||
                            id.includes('node_modules/class-variance-authority') ||
                            id.includes('node_modules/clsx') ||
                            id.includes('node_modules/tailwind-merge')) {
                            return 'ui-vendor'
                        }

                        // Animation libraries
                        if (id.includes('node_modules/framer-motion') ||
                            id.includes('node_modules/motion')) {
                            return 'animation'
                        }

                        // Code editor
                        if (id.includes('node_modules/@monaco-editor') ||
                            id.includes('node_modules/monaco-editor')) {
                            return 'monaco'
                        }

                        // Icons
                        if (id.includes('node_modules/lucide-react')) {
                            return 'icons'
                        }

                        // Form handling
                        if (id.includes('node_modules/react-hook-form') ||
                            id.includes('node_modules/@hookform') ||
                            id.includes('node_modules/zod')) {
                            return 'forms'
                        }

                        // Auth
                        if (id.includes('node_modules/better-auth')) {
                            return 'auth'
                        }

                        // Utilities
                        if (id.includes('node_modules/date-fns') ||
                            id.includes('node_modules/lodash')) {
                            return 'utils'
                        }

                        // Other vendor libraries
                        if (id.includes('node_modules/')) {
                            return 'vendor'
                        }
                    },

                    // Consistent chunk naming
                    chunkFileNames: (chunkInfo) => {
                        const name = chunkInfo.name || 'chunk'
                        return `assets/${name}-[hash].js`
                    },

                    // Asset file naming
                    assetFileNames: (assetInfo) => {
                        const name = assetInfo.name || ''
                        // Group assets by type
                        if (/\.(gif|jpe?g|png|svg|webp|avif)$/i.test(name)) {
                            return 'assets/images/[name]-[hash][extname]'
                        }
                        if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
                            return 'assets/fonts/[name]-[hash][extname]'
                        }
                        if (/\.css$/i.test(name)) {
                            return 'assets/css/[name]-[hash][extname]'
                        }
                        return 'assets/[name]-[hash][extname]'
                    },

                    // Entry file naming
                    entryFileNames: 'assets/[name]-[hash].js',
                },

                // Tree shaking
                treeshake: {
                    moduleSideEffects: 'no-external',
                    propertyReadSideEffects: false,
                    tryCatchDeoptimization: false,
                },
            },

            // CSS optimizations
            cssCodeSplit: true,
            cssMinify: isProd ? 'esbuild' : false,

            // Asset inlining threshold (4kb)
            assetsInlineLimit: 4096,

            // Report compressed size
            reportCompressedSize: true,
        },

        // Dependency optimization
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                'react-router-dom',
                'zustand',
                'framer-motion',
            ],
            exclude: [
                // Exclude large 3D libraries from pre-bundling
                '@splinetool/react-spline',
                '@splinetool/runtime',
            ],
        },

        // Server config for development
        server: {
            port: 5173,
            strictPort: false,
            host: true,
        },

        // Preview server config
        preview: {
            port: 4173,
            strictPort: false,
        },

        // Esbuild options
        esbuild: {
            // Drop console and debugger in production
            drop: isProd ? ['console', 'debugger'] : [],
            // Minify identifiers in production
            minifyIdentifiers: isProd,
            minifySyntax: isProd,
            minifyWhitespace: isProd,
        },
    }
})

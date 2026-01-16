import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/integration/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        testTimeout: 120000, // 2 minute timeout for integration tests
        hookTimeout: 60000,
        teardownTimeout: 30000,
        // Integration tests run sequentially to avoid resource conflicts
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/**',
                'dist/**',
                'src/__tests__/**',
                '**/*.d.ts',
            ],
        },
        alias: {
            '@': '/src',
        },
    },
});

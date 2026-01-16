import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        testTimeout: 30000,
        hookTimeout: 30000,
        teardownTimeout: 10000,
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
        // Ensure ESM modules work correctly
        alias: {
            '@': '/src',
        },
    },
});

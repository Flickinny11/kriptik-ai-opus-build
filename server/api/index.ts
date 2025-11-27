import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple test first
export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.url === '/test' || req.url?.startsWith('/test')) {
        return res.status(200).json({ status: 'ok', message: 'Vercel serverless function working!' });
    }
    
    // Import Express app - use .js extension for ESM compatibility
    return import('../src/index.js').then(({ default: app }) => {
        return app(req, res);
    }).catch((error) => {
        return res.status(500).json({ 
            error: 'Failed to load Express app',
            message: error.message,
            stack: error.stack
        });
    });
}


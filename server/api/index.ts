import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import the Express app - Vercel handles TypeScript compilation
import app from '../src/index';

// Export as Vercel serverless function handler
export default function handler(req: VercelRequest, res: VercelResponse) {
    return app(req, res);
}


// Re-export the Express app for Vercel serverless
// Vercel's @vercel/node builder compiles TypeScript and bundles dependencies
export { default } from '../src/index.js';


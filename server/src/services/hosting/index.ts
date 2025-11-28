/**
 * Hosting Services - Managed deployment to Cloudflare/Vercel
 */

export { cloudflarePages, getCloudflarePages, CloudflarePagesService } from './cloudflare-pages.js';
export { vercelManaged, getVercelManaged, VercelManagedService } from './vercel-managed.js';
export { hostingOrchestrator, getHostingOrchestrator, HostingOrchestrator } from './hosting-orchestrator.js';
export type { AppType, HostingProvider } from './hosting-orchestrator.js';


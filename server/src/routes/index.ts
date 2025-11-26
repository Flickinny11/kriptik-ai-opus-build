/**
 * Routes Module
 *
 * Exports all API route handlers
 */

// Core functionality
export { default as projectsRouter } from './projects';
export { default as filesRouter } from './files';
export { default as generateRouter } from './generate';
export { default as orchestrateRouter } from './orchestrate';

// AI services
export { default as aiRouter } from './ai';

// Export & Deployment
export { default as exportRouter } from './export';
export { default as deployRouter } from './deploy';
export { default as cloudRouter } from './cloud';

// MCP (Model Context Protocol)
export { default as mcpRouter } from './mcp';

// Billing
export { default as billingRouter } from './billing';

// Credentials & OAuth
export { default as credentialsRouter } from './credentials';
export { default as oauthRouter } from './oauth';

// Smart Deployment
export { default as smartDeployRouter } from './smart-deploy';

// Multi-Agent Orchestration
export { default as agentsRouter } from './agents';

// Workflows & Model Discovery
export { default as workflowsRouter } from './workflows';

// Migration & Export
export { default as migrationRouter } from './migration';

// Code Quality
export { default as qualityRouter } from './quality';

// Templates
export { default as templatesRouter } from './templates';

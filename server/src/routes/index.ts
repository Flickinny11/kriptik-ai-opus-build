/**
 * Routes Module
 *
 * Exports all API route handlers
 */

// Core functionality
export { default as projectsRouter } from './projects.js';
export { default as filesRouter } from './files.js';
export { default as generateRouter } from './generate.js';
export { default as orchestrateRouter } from './orchestrate.js';

// AI services
export { default as aiRouter } from './ai.js';

// Export & Deployment
export { default as exportRouter } from './export.js';
export { default as deployRouter } from './deploy.js';
export { default as cloudRouter } from './cloud.js';

// MCP (Model Context Protocol)
export { default as mcpRouter } from './mcp.js';

// Billing
export { default as billingRouter } from './billing.js';

// Credentials & OAuth
export { default as credentialsRouter } from './credentials.js';
export { default as oauthRouter } from './oauth.js';

// Smart Deployment
export { default as smartDeployRouter } from './smart-deploy.js';

// Multi-Agent Orchestration
export { default as agentsRouter } from './agents.js';

// Workflows & Model Discovery
export { default as workflowsRouter } from './workflows.js';

// Migration & Export
export { default as migrationRouter } from './migration.js';

// Code Quality
export { default as qualityRouter } from './quality.js';

// Templates
export { default as templatesRouter } from './templates.js';

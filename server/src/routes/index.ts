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

// Builder activity stream (SSE)
export { default as agentRouter } from './agent.js';

// Workflows & Model Discovery
export { default as workflowsRouter } from './workflows.js';

// Migration & Export
export { default as migrationRouter } from './migration.js';

// Code Quality
export { default as qualityRouter } from './quality.js';

// Templates
export { default as templatesRouter } from './templates.js';

// Autonomous Learning Engine
export { default as learningRouter } from './learning.js';

// Krip-Toe-Nite - Intelligent Model Orchestration
export { default as kripToeNiteRouter } from './krip-toe-nite.js';

// Headless Browser Preview
export { default as previewRouter } from './preview.js';

// Project Import
export { importRouter } from './import.js';

// Browser Extension API
export { extensionRouter } from './extension.js';

// Production Stack Configuration
export { default as productionStackRouter } from './production-stack.js';

// GitHub Integration
export { default as githubRouter } from './github.js';

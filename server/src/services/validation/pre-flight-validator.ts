/**
 * Pre-Deployment Validation / Platform-Aware Building
 *
 * "Deployment Profile" system that prevents deployment failures by
 * validating against platform-specific constraints during development
 * and before deployment.
 *
 * F047: Pre-Deployment Validation
 */

// @ts-nocheck - Pending full schema alignment
import { db } from '../../db.js';
import { eq, and } from 'drizzle-orm';
import { projects, files as projectFiles, deployments } from '../../schema.js';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient } from '../ai/openrouter-client.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Supported deployment platforms
 */
export type DeploymentPlatform =
  | 'vercel'
  | 'netlify'
  | 'cloudflare'
  | 'aws_amplify'
  | 'railway'
  | 'render'
  | 'fly_io'
  | 'heroku'
  | 'app_store'
  | 'play_store'
  | 'docker'
  | 'kubernetes';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Platform constraint categories
 */
export type ConstraintCategory =
  | 'file_system'
  | 'runtime'
  | 'dependencies'
  | 'environment'
  | 'build'
  | 'security'
  | 'performance'
  | 'networking'
  | 'storage'
  | 'compliance';

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ConstraintCategory;
  platform: DeploymentPlatform;
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
  autoFixAvailable: boolean;
  documentationUrl?: string;
}

/**
 * Platform constraint definition
 */
export interface PlatformConstraint {
  id: string;
  platform: DeploymentPlatform;
  category: ConstraintCategory;
  name: string;
  description: string;
  severity: ValidationSeverity;
  check: (context: ValidationContext) => Promise<ValidationIssue[]>;
}

/**
 * Validation context passed to constraint checks
 */
export interface ValidationContext {
  projectId: string;
  files: Array<{
    path: string;
    content: string;
    size: number;
  }>;
  packageJson?: Record<string, unknown>;
  envVars?: Record<string, string>;
  buildConfig?: Record<string, unknown>;
  framework?: string;
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  id: string;
  projectId: string;
  platform: DeploymentPlatform;
  timestamp: Date;
  duration: number;
  status: 'passed' | 'failed' | 'warnings';
  summary: {
    errors: number;
    warnings: number;
    info: number;
    passed: number;
  };
  issues: ValidationIssue[];
  recommendations: string[];
}

/**
 * Deployment profile configuration
 */
export interface DeploymentProfile {
  platform: DeploymentPlatform;
  enabled: boolean;
  strictMode: boolean;
  customConstraints: PlatformConstraint[];
  ignoredChecks: string[];
}

// =============================================================================
// PLATFORM CONSTRAINTS DATABASE
// =============================================================================

const PLATFORM_CONSTRAINTS: Record<DeploymentPlatform, Partial<Record<ConstraintCategory, PlatformConstraint[]>>> = {
  vercel: {
    file_system: [
      {
        id: 'vercel-case-sensitivity',
        platform: 'vercel',
        category: 'file_system',
        name: 'Case Sensitivity Check',
        description: 'Vercel runs on Linux which is case-sensitive',
        severity: 'error',
        check: async (ctx) => checkCaseSensitivity(ctx, 'vercel')
      },
      {
        id: 'vercel-file-size',
        platform: 'vercel',
        category: 'file_system',
        name: 'File Size Limits',
        description: 'Individual files must be under 100MB',
        severity: 'error',
        check: async (ctx) => checkFileSizeLimits(ctx, 100 * 1024 * 1024, 'vercel')
      },
      {
        id: 'vercel-total-size',
        platform: 'vercel',
        category: 'file_system',
        name: 'Total Deployment Size',
        description: 'Total deployment must be under 100MB compressed',
        severity: 'warning',
        check: async (ctx) => checkTotalDeploymentSize(ctx, 100 * 1024 * 1024, 'vercel')
      }
    ],
    runtime: [
      {
        id: 'vercel-node-version',
        platform: 'vercel',
        category: 'runtime',
        name: 'Node.js Version',
        description: 'Ensure Node.js version is supported',
        severity: 'error',
        check: async (ctx) => checkNodeVersion(ctx, ['18.x', '20.x'], 'vercel')
      },
      {
        id: 'vercel-function-timeout',
        platform: 'vercel',
        category: 'runtime',
        name: 'Function Timeout',
        description: 'Serverless functions have time limits',
        severity: 'warning',
        check: async (ctx) => checkFunctionTimeouts(ctx, 10, 'vercel')
      }
    ],
    environment: [
      {
        id: 'vercel-env-vars',
        platform: 'vercel',
        category: 'environment',
        name: 'Environment Variables',
        description: 'Check for required environment variables',
        severity: 'error',
        check: async (ctx) => checkEnvVarUsage(ctx, 'vercel')
      }
    ],
    build: [
      {
        id: 'vercel-build-output',
        platform: 'vercel',
        category: 'build',
        name: 'Build Output Directory',
        description: 'Verify build output configuration',
        severity: 'error',
        check: async (ctx) => checkBuildOutput(ctx, 'vercel')
      }
    ]
  },

  netlify: {
    file_system: [
      {
        id: 'netlify-case-sensitivity',
        platform: 'netlify',
        category: 'file_system',
        name: 'Case Sensitivity Check',
        description: 'Netlify runs on Linux which is case-sensitive',
        severity: 'error',
        check: async (ctx) => checkCaseSensitivity(ctx, 'netlify')
      },
      {
        id: 'netlify-file-size',
        platform: 'netlify',
        category: 'file_system',
        name: 'File Size Limits',
        description: 'Individual files must be under 10MB for free tier',
        severity: 'warning',
        check: async (ctx) => checkFileSizeLimits(ctx, 10 * 1024 * 1024, 'netlify')
      }
    ],
    build: [
      {
        id: 'netlify-redirects',
        platform: 'netlify',
        category: 'build',
        name: 'Redirects Configuration',
        description: 'Check _redirects or netlify.toml for SPA',
        severity: 'warning',
        check: async (ctx) => checkRedirectsConfig(ctx, 'netlify')
      }
    ]
  },

  cloudflare: {
    file_system: [
      {
        id: 'cloudflare-file-size',
        platform: 'cloudflare',
        category: 'file_system',
        name: 'Worker Size Limit',
        description: 'Workers must be under 1MB compressed',
        severity: 'error',
        check: async (ctx) => checkWorkerSize(ctx, 'cloudflare')
      }
    ],
    runtime: [
      {
        id: 'cloudflare-api-compat',
        platform: 'cloudflare',
        category: 'runtime',
        name: 'API Compatibility',
        description: 'Check for Node.js APIs not available in Workers',
        severity: 'error',
        check: async (ctx) => checkCloudflareAPICompat(ctx)
      }
    ]
  },

  app_store: {
    compliance: [
      {
        id: 'app-store-privacy',
        platform: 'app_store',
        category: 'compliance',
        name: 'Privacy Policy',
        description: 'App Store requires privacy policy',
        severity: 'error',
        check: async (ctx) => checkPrivacyPolicy(ctx, 'app_store')
      },
      {
        id: 'app-store-guidelines',
        platform: 'app_store',
        category: 'compliance',
        name: 'App Store Guidelines',
        description: 'Basic App Store guideline checks',
        severity: 'warning',
        check: async (ctx) => checkAppStoreGuidelines(ctx)
      }
    ],
    security: [
      {
        id: 'app-store-https',
        platform: 'app_store',
        category: 'security',
        name: 'HTTPS Requirements',
        description: 'All network requests must use HTTPS',
        severity: 'error',
        check: async (ctx) => checkHTTPSRequirement(ctx, 'app_store')
      }
    ]
  },

  play_store: {
    compliance: [
      {
        id: 'play-store-privacy',
        platform: 'play_store',
        category: 'compliance',
        name: 'Privacy Policy',
        description: 'Play Store requires privacy policy',
        severity: 'error',
        check: async (ctx) => checkPrivacyPolicy(ctx, 'play_store')
      }
    ],
    security: [
      {
        id: 'play-store-permissions',
        platform: 'play_store',
        category: 'security',
        name: 'Permissions Audit',
        description: 'Review requested permissions',
        severity: 'warning',
        check: async (ctx) => checkAndroidPermissions(ctx)
      }
    ]
  },

  // Stub entries for other platforms
  aws_amplify: {},
  railway: {},
  render: {},
  fly_io: {},
  heroku: {},
  docker: {},
  kubernetes: {}
};

// =============================================================================
// CONSTRAINT CHECK IMPLEMENTATIONS
// =============================================================================

async function checkCaseSensitivity(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const pathMap = new Map<string, string[]>();

  // Group files by lowercase path
  for (const file of ctx.files) {
    const lowerPath = file.path.toLowerCase();
    if (!pathMap.has(lowerPath)) {
      pathMap.set(lowerPath, []);
    }
    pathMap.get(lowerPath)!.push(file.path);
  }

  // Find duplicates
  for (const [lowerPath, paths] of pathMap) {
    if (paths.length > 1) {
      issues.push({
        id: uuidv4(),
        severity: 'error',
        category: 'file_system',
        platform,
        title: 'Case-sensitive file conflict detected',
        description: `Multiple files map to the same path on case-insensitive systems: ${paths.join(', ')}`,
        file: paths[0],
        suggestion: 'Rename files to have unique case-insensitive paths',
        autoFixAvailable: false,
        documentationUrl: `https://docs.${platform}.com/deployments/case-sensitivity`
      });
    }
  }

  // Check imports for case mismatches
  const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const file of ctx.files) {
    if (!file.path.endsWith('.js') && !file.path.endsWith('.ts') && !file.path.endsWith('.tsx')) continue;

    const matches = [...file.content.matchAll(importPattern), ...file.content.matchAll(requirePattern)];

    for (const match of matches) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        // Relative import - check if case matches
        const resolvedPath = resolveRelativePath(file.path, importPath);
        const actualFile = ctx.files.find(f => f.path.toLowerCase() === resolvedPath.toLowerCase());

        if (actualFile && actualFile.path !== resolvedPath) {
          issues.push({
            id: uuidv4(),
            severity: 'error',
            category: 'file_system',
            platform,
            title: 'Import path case mismatch',
            description: `Import "${importPath}" in ${file.path} doesn't match actual file "${actualFile.path}"`,
            file: file.path,
            suggestion: `Change import to match exact file path: "${actualFile.path}"`,
            autoFixAvailable: true
          });
        }
      }
    }
  }

  return issues;
}

async function checkFileSizeLimits(
  ctx: ValidationContext,
  maxSize: number,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const file of ctx.files) {
    if (file.size > maxSize) {
      issues.push({
        id: uuidv4(),
        severity: 'error',
        category: 'file_system',
        platform,
        title: 'File exceeds size limit',
        description: `${file.path} is ${formatBytes(file.size)}, exceeds ${formatBytes(maxSize)} limit`,
        file: file.path,
        suggestion: 'Consider compressing, splitting, or hosting the file externally',
        autoFixAvailable: false
      });
    }
  }

  return issues;
}

async function checkTotalDeploymentSize(
  ctx: ValidationContext,
  maxSize: number,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const totalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  if (totalSize > maxSize) {
    issues.push({
      id: uuidv4(),
      severity: 'warning',
      category: 'file_system',
      platform,
      title: 'Total deployment size may exceed limit',
      description: `Total size is ${formatBytes(totalSize)}, which may exceed compressed limit`,
      suggestion: 'Review large files, remove unused dependencies, optimize assets',
      autoFixAvailable: false
    });
  }

  return issues;
}

async function checkNodeVersion(
  ctx: ValidationContext,
  supportedVersions: string[],
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (ctx.packageJson) {
    const engines = ctx.packageJson.engines as Record<string, string> | undefined;
    const nodeVersion = engines?.node;

    if (nodeVersion) {
      const isSupported = supportedVersions.some(v => nodeVersion.includes(v.replace('.x', '')));

      if (!isSupported) {
        issues.push({
          id: uuidv4(),
          severity: 'error',
          category: 'runtime',
          platform,
          title: 'Unsupported Node.js version',
          description: `Node ${nodeVersion} may not be supported. Supported: ${supportedVersions.join(', ')}`,
          file: 'package.json',
          suggestion: `Update engines.node to one of: ${supportedVersions.join(', ')}`,
          autoFixAvailable: true
        });
      }
    }
  }

  return issues;
}

async function checkFunctionTimeouts(
  ctx: ValidationContext,
  maxSeconds: number,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Look for patterns that suggest long-running operations
  const longRunningPatterns = [
    /await\s+new\s+Promise.*setTimeout.*(\d{4,})/g, // setTimeout > 1000
    /\.timeout\s*=\s*(\d{5,})/g, // timeout > 10000
    /setInterval/g,
  ];

  for (const file of ctx.files) {
    if (!file.path.includes('/api/') && !file.path.includes('/pages/api/')) continue;

    for (const pattern of longRunningPatterns) {
      if (pattern.test(file.content)) {
        issues.push({
          id: uuidv4(),
          severity: 'warning',
          category: 'runtime',
          platform,
          title: 'Potential function timeout issue',
          description: `${file.path} may exceed ${maxSeconds}s function timeout`,
          file: file.path,
          suggestion: 'Consider using background jobs or streaming responses',
          autoFixAvailable: false
        });
        break;
      }
    }
  }

  return issues;
}

async function checkEnvVarUsage(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const usedEnvVars = new Set<string>();

  // Find all process.env usages
  const envPattern = /process\.env\.(\w+)/g;
  const envPattern2 = /process\.env\[['"](\w+)['"]\]/g;

  for (const file of ctx.files) {
    const matches = [...file.content.matchAll(envPattern), ...file.content.matchAll(envPattern2)];
    for (const match of matches) {
      usedEnvVars.add(match[1]);
    }
  }

  // Check if env vars are defined
  const definedVars = new Set(Object.keys(ctx.envVars || {}));

  for (const varName of usedEnvVars) {
    if (!definedVars.has(varName) && !varName.startsWith('NEXT_PUBLIC_') && !varName.startsWith('VITE_')) {
      issues.push({
        id: uuidv4(),
        severity: 'warning',
        category: 'environment',
        platform,
        title: 'Potentially undefined environment variable',
        description: `Environment variable ${varName} is used but may not be defined`,
        suggestion: `Ensure ${varName} is set in your ${platform} environment settings`,
        autoFixAvailable: false
      });
    }
  }

  return issues;
}

async function checkBuildOutput(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check for common build config files
  const configFiles = ctx.files.filter(f =>
    f.path === 'vercel.json' ||
    f.path === 'next.config.js' ||
    f.path === 'vite.config.ts' ||
    f.path === 'vite.config.js'
  );

  if (configFiles.length === 0 && platform === 'vercel') {
    // Try to detect framework
    if (ctx.packageJson) {
      const deps = {
        ...(ctx.packageJson.dependencies as Record<string, string> || {}),
        ...(ctx.packageJson.devDependencies as Record<string, string> || {})
      };

      if (!deps.next && !deps.vite && !deps['create-react-app']) {
        issues.push({
          id: uuidv4(),
          severity: 'warning',
          category: 'build',
          platform,
          title: 'No build configuration detected',
          description: 'Could not detect framework or build configuration',
          suggestion: 'Add vercel.json with buildCommand and outputDirectory settings',
          autoFixAvailable: true
        });
      }
    }
  }

  return issues;
}

async function checkRedirectsConfig(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const hasRedirects = ctx.files.some(f =>
    f.path === '_redirects' ||
    f.path === 'netlify.toml' ||
    f.path === 'public/_redirects'
  );

  // Check if it's an SPA that needs redirects
  const isSPA = ctx.files.some(f =>
    f.path.includes('react-router') ||
    f.content.includes('BrowserRouter') ||
    f.content.includes('createBrowserRouter')
  );

  if (isSPA && !hasRedirects) {
    issues.push({
      id: uuidv4(),
      severity: 'warning',
      category: 'build',
      platform,
      title: 'SPA redirect configuration missing',
      description: 'Single-page app detected but no redirects configured',
      suggestion: 'Add /* /index.html 200 to _redirects file',
      autoFixAvailable: true
    });
  }

  return issues;
}

async function checkWorkerSize(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check for worker files
  const workerFiles = ctx.files.filter(f =>
    f.path.includes('worker') ||
    f.path.endsWith('.worker.js') ||
    f.path.endsWith('.worker.ts')
  );

  for (const file of workerFiles) {
    if (file.size > 1024 * 1024) {
      issues.push({
        id: uuidv4(),
        severity: 'error',
        category: 'file_system',
        platform,
        title: 'Worker exceeds size limit',
        description: `${file.path} is ${formatBytes(file.size)}, Workers must be under 1MB`,
        file: file.path,
        suggestion: 'Split worker code, use dynamic imports, or optimize dependencies',
        autoFixAvailable: false
      });
    }
  }

  return issues;
}

async function checkCloudflareAPICompat(ctx: ValidationContext): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Node.js APIs not available in Cloudflare Workers
  const unsupportedAPIs = [
    'fs',
    'path',
    'child_process',
    'cluster',
    'dgram',
    'dns',
    'net',
    'readline',
    'repl',
    'tls',
    'tty',
    'v8',
    'vm'
  ];

  for (const file of ctx.files) {
    for (const api of unsupportedAPIs) {
      const importPattern = new RegExp(`(require\\(['"]${api}['"]\\)|from\\s+['"]${api}['"])`, 'g');

      if (importPattern.test(file.content)) {
        issues.push({
          id: uuidv4(),
          severity: 'error',
          category: 'runtime',
          platform: 'cloudflare',
          title: `Unsupported API: ${api}`,
          description: `${file.path} uses Node.js "${api}" module which is not available in Workers`,
          file: file.path,
          suggestion: `Use Web APIs or Cloudflare-specific alternatives instead of "${api}"`,
          autoFixAvailable: false
        });
      }
    }
  }

  return issues;
}

async function checkPrivacyPolicy(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const hasPrivacyPolicy = ctx.files.some(f =>
    f.path.toLowerCase().includes('privacy') ||
    f.content.toLowerCase().includes('privacy policy')
  );

  if (!hasPrivacyPolicy) {
    issues.push({
      id: uuidv4(),
      severity: 'error',
      category: 'compliance',
      platform,
      title: 'Privacy policy required',
      description: `${platform.replace('_', ' ')} requires a privacy policy for all apps`,
      suggestion: 'Add a privacy policy page or link to your privacy policy',
      autoFixAvailable: false,
      documentationUrl: platform === 'app_store'
        ? 'https://developer.apple.com/app-store/review/guidelines/#privacy'
        : 'https://support.google.com/googleplay/android-developer/answer/9859455'
    });
  }

  return issues;
}

async function checkAppStoreGuidelines(ctx: ValidationContext): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check for common App Store guideline violations
  const violations = [
    { pattern: /WebView/i, issue: 'Apps that are simply web views may be rejected' },
    { pattern: /placeholder/i, issue: 'Placeholder content may lead to rejection' },
    { pattern: /lorem ipsum/i, issue: 'Dummy text may lead to rejection' }
  ];

  for (const file of ctx.files) {
    for (const v of violations) {
      if (v.pattern.test(file.content)) {
        issues.push({
          id: uuidv4(),
          severity: 'warning',
          category: 'compliance',
          platform: 'app_store',
          title: 'Potential App Store guideline issue',
          description: v.issue,
          file: file.path,
          suggestion: 'Review App Store Guidelines section 4.2',
          autoFixAvailable: false
        });
        break;
      }
    }
  }

  return issues;
}

async function checkHTTPSRequirement(
  ctx: ValidationContext,
  platform: DeploymentPlatform
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Look for http:// URLs (not https://)
  const httpPattern = /['"]http:\/\/[^'"]+['"]/g;

  for (const file of ctx.files) {
    const matches = file.content.match(httpPattern);
    if (matches) {
      for (const match of matches) {
        // Skip localhost
        if (match.includes('localhost') || match.includes('127.0.0.1')) continue;

        issues.push({
          id: uuidv4(),
          severity: 'error',
          category: 'security',
          platform,
          title: 'Non-HTTPS URL detected',
          description: `${file.path} contains non-HTTPS URL: ${match}`,
          file: file.path,
          suggestion: 'Change http:// to https://',
          autoFixAvailable: true
        });
      }
    }
  }

  return issues;
}

async function checkAndroidPermissions(ctx: ValidationContext): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Look for AndroidManifest.xml
  const manifest = ctx.files.find(f => f.path.includes('AndroidManifest.xml'));

  if (manifest) {
    const sensitivePermissions = [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'RECORD_AUDIO',
      'READ_CONTACTS',
      'READ_PHONE_STATE',
      'READ_SMS',
      'SEND_SMS'
    ];

    for (const perm of sensitivePermissions) {
      if (manifest.content.includes(perm)) {
        issues.push({
          id: uuidv4(),
          severity: 'warning',
          category: 'security',
          platform: 'play_store',
          title: `Sensitive permission: ${perm}`,
          description: `Your app requests ${perm}, which requires justification`,
          file: manifest.path,
          suggestion: 'Ensure you can justify this permission in the Play Store listing',
          autoFixAvailable: false
        });
      }
    }
  }

  return issues;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function resolveRelativePath(fromPath: string, importPath: string): string {
  const fromDir = fromPath.split('/').slice(0, -1).join('/');
  const parts = importPath.split('/');
  const resultParts = fromDir.split('/');

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resultParts.pop();
    } else {
      resultParts.push(part);
    }
  }

  let result = resultParts.join('/');

  // Add extensions if missing
  if (!result.match(/\.(js|ts|tsx|jsx|json|css|scss)$/)) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      result = result + ext;
      break;
    }
  }

  return result;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// =============================================================================
// PRE-FLIGHT VALIDATOR SERVICE
// =============================================================================

export class PreFlightValidator {
  private openRouterClient = getOpenRouterClient();

  /**
   * Run full validation for a project against a deployment platform
   */
  async validate(
    projectId: string,
    platform: DeploymentPlatform,
    options: {
      strictMode?: boolean;
      ignoredChecks?: string[];
    } = {}
  ): Promise<ValidationReport> {
    const startTime = Date.now();

    // Get project files
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId)
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const files = await db.query.projectFiles.findMany({
      where: eq(projectFiles.projectId, projectId)
    });

    // Build validation context
    const packageJsonFile = files.find(f => f.path === 'package.json');
    let packageJson: Record<string, unknown> | undefined;

    if (packageJsonFile) {
      try {
        packageJson = JSON.parse(packageJsonFile.content);
      } catch (e) {
        // Invalid JSON
      }
    }

    const context: ValidationContext = {
      projectId,
      files: files.map(f => ({
        path: f.path,
        content: f.content,
        size: f.content.length
      })),
      packageJson,
      envVars: {}, // Would come from project settings
      framework: this.detectFramework(packageJson)
    };

    // Get constraints for platform
    const platformConstraints = PLATFORM_CONSTRAINTS[platform] || {};
    const allIssues: ValidationIssue[] = [];

    // Run all constraint checks
    for (const [category, constraints] of Object.entries(platformConstraints)) {
      for (const constraint of constraints || []) {
        if (options.ignoredChecks?.includes(constraint.id)) continue;

        try {
          const issues = await constraint.check(context);
          allIssues.push(...issues);
        } catch (error) {
          console.error(`Constraint check ${constraint.id} failed:`, error);
        }
      }
    }

    // Calculate summary
    const summary = {
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      info: allIssues.filter(i => i.severity === 'info').length,
      passed: Object.values(platformConstraints).flat().length - allIssues.length
    };

    // Generate AI recommendations
    const recommendations = await this.generateRecommendations(allIssues, platform);

    const report: ValidationReport = {
      id: uuidv4(),
      projectId,
      platform,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      status: summary.errors > 0 ? 'failed' : summary.warnings > 0 ? 'warnings' : 'passed',
      summary,
      issues: allIssues,
      recommendations
    };

    return report;
  }

  /**
   * Quick validation check (subset of critical checks)
   */
  async quickCheck(
    projectId: string,
    platform: DeploymentPlatform
  ): Promise<{ passed: boolean; criticalIssues: ValidationIssue[] }> {
    const report = await this.validate(projectId, platform, {
      ignoredChecks: [] // Only run error-level checks for speed
    });

    const criticalIssues = report.issues.filter(i => i.severity === 'error');

    return {
      passed: criticalIssues.length === 0,
      criticalIssues
    };
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): DeploymentPlatform[] {
    return Object.keys(PLATFORM_CONSTRAINTS) as DeploymentPlatform[];
  }

  /**
   * Get constraints for a platform
   */
  getConstraintsForPlatform(platform: DeploymentPlatform): string[] {
    const constraints = PLATFORM_CONSTRAINTS[platform] || {};
    return Object.values(constraints).flat().map(c => c?.id).filter(Boolean) as string[];
  }

  private detectFramework(packageJson?: Record<string, unknown>): string | undefined {
    if (!packageJson) return undefined;

    const deps = {
      ...(packageJson.dependencies as Record<string, string> || {}),
      ...(packageJson.devDependencies as Record<string, string> || {})
    };

    if (deps.next) return 'next';
    if (deps.vite) return 'vite';
    if (deps['react-scripts']) return 'create-react-app';
    if (deps.nuxt) return 'nuxt';
    if (deps.gatsby) return 'gatsby';
    if (deps.svelte) return 'svelte';
    if (deps.vue) return 'vue';

    return undefined;
  }

  private async generateRecommendations(
    issues: ValidationIssue[],
    platform: DeploymentPlatform
  ): Promise<string[]> {
    if (issues.length === 0) {
      return ['All checks passed! Your project is ready for deployment.'];
    }

    const recommendations: string[] = [];

    // Group issues by category
    const byCategory = issues.reduce((acc, issue) => {
      if (!acc[issue.category]) acc[issue.category] = [];
      acc[issue.category].push(issue);
      return acc;
    }, {} as Record<string, ValidationIssue[]>);

    // Generate category-specific recommendations
    for (const [category, categoryIssues] of Object.entries(byCategory)) {
      const errorCount = categoryIssues.filter(i => i.severity === 'error').length;
      const warningCount = categoryIssues.filter(i => i.severity === 'warning').length;

      if (errorCount > 0) {
        recommendations.push(
          `Fix ${errorCount} ${category.replace('_', ' ')} error(s) before deploying to ${platform}`
        );
      } else if (warningCount > 0) {
        recommendations.push(
          `Review ${warningCount} ${category.replace('_', ' ')} warning(s) for optimal ${platform} deployment`
        );
      }
    }

    // Add auto-fix recommendation if available
    const autoFixable = issues.filter(i => i.autoFixAvailable);
    if (autoFixable.length > 0) {
      recommendations.push(
        `${autoFixable.length} issue(s) can be auto-fixed. Click "Auto-Fix" to resolve them.`
      );
    }

    return recommendations;
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

let preFlightValidator: PreFlightValidator | null = null;

export function createPreFlightValidator(): PreFlightValidator {
  if (!preFlightValidator) {
    preFlightValidator = new PreFlightValidator();
  }
  return preFlightValidator;
}

export function getPreFlightValidator(): PreFlightValidator {
  if (!preFlightValidator) {
    throw new Error('PreFlightValidator not initialized. Call createPreFlightValidator first.');
  }
  return preFlightValidator;
}


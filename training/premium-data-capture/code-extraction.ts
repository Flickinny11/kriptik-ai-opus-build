/**
 * Premium Code Extraction Service
 *
 * GitHub API-based extraction of premium code patterns from elite developer
 * repositories and tutorial platforms for UICoder training.
 *
 * Sources:
 * - Codrops GitHub repos (WebGL, GSAP, Three.js tutorials)
 * - Bruno Simon portfolio/threejs-journey code
 * - Samsy WebGPU portfolios
 * - pmndrs (Drei, R3F examples)
 * - GSAP official examples
 * - shadcn/ui and Radix UI primitives
 *
 * Run with: npx tsx training/premium-data-capture/code-extraction.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface GitHubSource {
  name: string;
  type: 'org' | 'user' | 'repo';
  identifier: string;
  repos?: string[];
  filter?: {
    topics?: string[];
    languages?: string[];
    minStars?: number;
  };
  extractPatterns?: string[];
  tier: 1 | 2 | 3 | 4 | 5;
  category: string;
}

interface ExtractedCode {
  id: string;
  source: string;
  tier: number;
  category: string;
  repoName: string;
  repoUrl: string;
  filePath: string;
  language: string;
  content: string;
  techniques: string[];
  extractedAt: Date;
  metadata: {
    stars?: number;
    description?: string;
    topics?: string[];
  };
}

interface ExtractionConfig {
  outputDir: string;
  githubToken: string;
  maxFilesPerRepo: number;
  maxFileSize: number;
  rateLimitDelay: number;
  retryAttempts: number;
}

// Premium GitHub sources (elite developers and libraries)
const GITHUB_SOURCES: GitHubSource[] = [
  // ==================== TIER 2: Elite Developer Portfolios ====================
  {
    name: 'bruno-simon-portfolio',
    type: 'user',
    identifier: 'brunosimon',
    repos: ['folio-2019', 'threejs-journey'],
    tier: 2,
    category: 'portfolio',
    extractPatterns: ['**/*.js', '**/*.ts', '**/*.glsl', '**/*.frag', '**/*.vert'],
  },
  {
    name: 'samsy-webgpu',
    type: 'user',
    identifier: 'Samsy',
    filter: { topics: ['webgl', 'webgpu', 'threejs'] },
    tier: 2,
    category: 'portfolio',
    extractPatterns: ['**/*.js', '**/*.ts', '**/*.glsl'],
  },

  // ==================== TIER 3: Tutorial Platforms ====================
  {
    name: 'codrops-demos',
    type: 'org',
    identifier: 'codrops',
    filter: { topics: ['webgl', 'threejs', 'gsap', 'animation'] },
    tier: 3,
    category: 'tutorial',
    extractPatterns: ['**/*.js', '**/*.ts', '**/*.glsl', '**/*.css'],
  },
  {
    name: 'tympanus-demos',
    type: 'org',
    identifier: 'tympanus',
    tier: 3,
    category: 'tutorial',
    extractPatterns: ['**/*.js', '**/*.ts', '**/*.glsl', '**/*.css'],
  },

  // ==================== TIER 5: Core Libraries ====================
  {
    name: 'pmndrs-r3f',
    type: 'org',
    identifier: 'pmndrs',
    repos: ['react-three-fiber', 'drei', 'react-spring', 'zustand', 'leva'],
    tier: 5,
    category: 'library',
    extractPatterns: ['**/*.tsx', '**/*.ts', '**/examples/**/*'],
  },
  {
    name: 'mrdoob-threejs',
    type: 'repo',
    identifier: 'mrdoob/three.js',
    tier: 5,
    category: 'library',
    extractPatterns: ['examples/**/*.js', 'examples/**/*.html', 'src/**/*.js'],
  },
  {
    name: 'gsap-official',
    type: 'org',
    identifier: 'greensock',
    repos: ['GSAP'],
    tier: 5,
    category: 'library',
    extractPatterns: ['**/*.js', '**/examples/**/*'],
  },
  {
    name: 'shadcn-ui',
    type: 'repo',
    identifier: 'shadcn-ui/ui',
    tier: 5,
    category: 'design-system',
    extractPatterns: ['**/*.tsx', '**/*.ts', '**/*.css'],
  },
  {
    name: 'radix-ui',
    type: 'org',
    identifier: 'radix-ui',
    repos: ['primitives', 'themes'],
    tier: 5,
    category: 'design-system',
    extractPatterns: ['**/*.tsx', '**/*.ts'],
  },
  {
    name: 'framer-motion',
    type: 'repo',
    identifier: 'framer/motion',
    tier: 5,
    category: 'animation',
    extractPatterns: ['**/*.tsx', '**/*.ts', '**/examples/**/*'],
  },
  {
    name: 'studio-freight-lenis',
    type: 'repo',
    identifier: 'studio-freight/lenis',
    tier: 5,
    category: 'animation',
    extractPatterns: ['**/*.ts', '**/*.js'],
  },
  {
    name: 'locomotive-scroll',
    type: 'repo',
    identifier: 'locomotivemtl/locomotive-scroll',
    tier: 5,
    category: 'animation',
    extractPatterns: ['**/*.ts', '**/*.js'],
  },
  {
    name: 'rive-app',
    type: 'org',
    identifier: 'rive-app',
    repos: ['rive-react', 'rive-wasm'],
    tier: 5,
    category: 'animation',
    extractPatterns: ['**/*.tsx', '**/*.ts', '**/examples/**/*'],
  },
];

// File extensions to extract
const CODE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript-react',
  '.js': 'javascript',
  '.jsx': 'javascript-react',
  '.glsl': 'glsl',
  '.frag': 'glsl-fragment',
  '.vert': 'glsl-vertex',
  '.wgsl': 'wgsl',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
};

// Technique detection patterns
const TECHNIQUE_PATTERNS: Record<string, RegExp[]> = {
  'webgl-shader': [/gl_FragColor|gl_Position|uniform|varying|attribute/i, /THREE\.ShaderMaterial/i],
  'webgpu-compute': [/GPUComputePipeline|createComputePipeline|dispatchWorkgroups/i],
  'scroll-trigger': [/ScrollTrigger|gsap\.registerPlugin|trigger:|scrub:|pin:/i],
  'gsap-timeline': [/gsap\.timeline|\.to\(|\.from\(|\.fromTo\(/i],
  'spring-physics': [/useSpring|animated\.|config:\s*\{|stiffness|damping|tension|friction/i],
  'framer-motion': [/motion\.|animate:|variants:|transition:|whileHover/i],
  'r3f-scene': [/<Canvas|useFrame|useThree|@react-three\/fiber/i],
  'drei-helpers': [/@react-three\/drei|OrbitControls|Environment|useGLTF/i],
  'lenis-scroll': [/new Lenis|lenis\.raf|smoothWheel|touchMultiplier/i],
  'parallax-effect': [/data-speed|parallax|translateZ|perspective/i],
  'glassmorphism': [/backdrop-filter|blur\(|bg-opacity|bg-white\/|rgba.*0\.[0-9]/i],
  'bento-grid': [/grid-cols|grid-template|auto-fit|minmax|grid-area/i],
  'kinetic-typography': [/SplitText|splitType|char|word|line.*animation/i],
  'magnetic-cursor': [/mousemove|clientX|clientY|lerp.*cursor/i],
  'webgl-particles': [/Points|PointsMaterial|BufferGeometry.*position/i],
  'post-processing': [/EffectComposer|RenderPass|UnrealBloomPass|ChromaticAberration/i],
  'reduced-motion': [/prefers-reduced-motion|matchMedia.*reduce/i],
  'mobile-optimization': [/touchMultiplier|ignoreMobileResize|matchMedia.*max-width/i],
};

const DEFAULT_CONFIG: ExtractionConfig = {
  outputDir: path.join(__dirname, '../../premium-designs/code'),
  githubToken: process.env.GITHUB_TOKEN || '',
  maxFilesPerRepo: 200,
  maxFileSize: 100 * 1024, // 100KB
  rateLimitDelay: 1000,
  retryAttempts: 3,
};

// ============================================================================
// Code Extraction Service
// ============================================================================

export class CodeExtractionService {
  private config: ExtractionConfig;
  private extractedCode: ExtractedCode[] = [];
  private extractionLog: string[] = [];

  constructor(config: Partial<ExtractionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract code from all premium sources
   */
  async extractAllSources(
    sources: GitHubSource[] = GITHUB_SOURCES,
    options: { tierFilter?: number[]; categoryFilter?: string[] } = {}
  ): Promise<ExtractedCode[]> {
    // Filter sources
    let filteredSources = sources;
    if (options.tierFilter?.length) {
      filteredSources = filteredSources.filter(s => options.tierFilter!.includes(s.tier));
    }
    if (options.categoryFilter?.length) {
      filteredSources = filteredSources.filter(s => options.categoryFilter!.includes(s.category));
    }

    console.log(`[CodeExtract] Starting extraction from ${filteredSources.length} sources...`);

    for (const source of filteredSources) {
      try {
        await this.extractSource(source);
        await this.delay(this.config.rateLimitDelay);
      } catch (error) {
        this.log(`ERROR extracting ${source.name}: ${error}`);
      }
    }

    // Save extraction manifest
    await this.saveManifest();

    console.log(`[CodeExtract] Extraction complete. Total files: ${this.extractedCode.length}`);
    return this.extractedCode;
  }

  /**
   * Extract code from a single source
   */
  async extractSource(source: GitHubSource): Promise<void> {
    console.log(`[CodeExtract] Extracting: ${source.name} (Tier ${source.tier})`);

    const repos = await this.getReposForSource(source);

    for (const repo of repos) {
      try {
        await this.extractRepo(repo, source);
        await this.delay(this.config.rateLimitDelay);
      } catch (error) {
        this.log(`ERROR extracting repo ${repo.full_name}: ${error}`);
      }
    }
  }

  /**
   * Get repositories for a source
   */
  private async getReposForSource(
    source: GitHubSource
  ): Promise<Array<{ full_name: string; html_url: string; stargazers_count: number; description: string; topics: string[] }>> {
    const headers = this.getHeaders();

    if (source.type === 'repo') {
      // Single repo
      const response = await this.fetchWithRetry(
        `https://api.github.com/repos/${source.identifier}`,
        headers
      );
      const data = await response.json();
      return [data];
    }

    // Org or user repos
    const endpoint =
      source.type === 'org'
        ? `https://api.github.com/orgs/${source.identifier}/repos`
        : `https://api.github.com/users/${source.identifier}/repos`;

    const response = await this.fetchWithRetry(`${endpoint}?per_page=100`, headers);
    let repos = await response.json();

    // Filter by specific repos if provided
    if (source.repos?.length) {
      repos = repos.filter((r: { name: string }) => source.repos!.includes(r.name));
    }

    // Filter by topics, languages, stars
    if (source.filter) {
      repos = repos.filter((r: { topics: string[]; language: string; stargazers_count: number }) => {
        if (source.filter!.topics?.length) {
          const hasMatchingTopic = source.filter!.topics.some(t =>
            r.topics?.includes(t.toLowerCase())
          );
          if (!hasMatchingTopic) return false;
        }
        if (source.filter!.languages?.length) {
          if (!source.filter!.languages.includes(r.language)) return false;
        }
        if (source.filter!.minStars && r.stargazers_count < source.filter!.minStars) {
          return false;
        }
        return true;
      });
    }

    return repos;
  }

  /**
   * Extract code from a single repository
   */
  private async extractRepo(
    repo: { full_name: string; html_url: string; stargazers_count: number; description: string; topics: string[] },
    source: GitHubSource
  ): Promise<void> {
    this.log(`Extracting repo: ${repo.full_name}`);

    const headers = this.getHeaders();
    const patterns = source.extractPatterns || ['**/*.ts', '**/*.tsx', '**/*.js'];

    // Get repository tree
    const treeResponse = await this.fetchWithRetry(
      `https://api.github.com/repos/${repo.full_name}/git/trees/main?recursive=1`,
      headers
    );

    if (!treeResponse.ok) {
      // Try master branch
      const masterResponse = await this.fetchWithRetry(
        `https://api.github.com/repos/${repo.full_name}/git/trees/master?recursive=1`,
        headers
      );
      if (!masterResponse.ok) {
        this.log(`Failed to get tree for ${repo.full_name}`);
        return;
      }
    }

    const treeData = await treeResponse.json();
    const files = (treeData.tree || []).filter(
      (item: { type: string; path: string; size: number }) =>
        item.type === 'blob' &&
        this.matchesPattern(item.path, patterns) &&
        item.size < this.config.maxFileSize
    );

    // Limit files per repo
    const filesToExtract = files.slice(0, this.config.maxFilesPerRepo);

    // Ensure output directory
    const repoDir = path.join(this.config.outputDir, source.name, repo.full_name.replace('/', '_'));
    await fs.promises.mkdir(repoDir, { recursive: true });

    for (const file of filesToExtract) {
      try {
        await this.extractFile(file, repo, source, repoDir);
        await this.delay(100); // Small delay between file fetches
      } catch (error) {
        this.log(`ERROR extracting file ${file.path}: ${error}`);
      }
    }
  }

  /**
   * Extract a single file
   */
  private async extractFile(
    file: { path: string; sha: string },
    repo: { full_name: string; html_url: string; stargazers_count: number; description: string; topics: string[] },
    source: GitHubSource,
    outputDir: string
  ): Promise<void> {
    const headers = this.getHeaders();

    // Get file content
    const contentResponse = await this.fetchWithRetry(
      `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
      headers
    );

    if (!contentResponse.ok) return;

    const contentData = await contentResponse.json();
    const content = Buffer.from(contentData.content, 'base64').toString('utf-8');

    // Detect language
    const ext = path.extname(file.path);
    const language = CODE_EXTENSIONS[ext] || 'unknown';

    // Detect techniques
    const techniques = this.detectTechniques(content);

    // Generate ID
    const id = `${source.name}_${repo.full_name.replace('/', '_')}_${file.sha.slice(0, 8)}`;

    // Save file locally
    const localPath = path.join(outputDir, file.path);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, content);

    // Record extraction
    const extracted: ExtractedCode = {
      id,
      source: source.name,
      tier: source.tier,
      category: source.category,
      repoName: repo.full_name,
      repoUrl: repo.html_url,
      filePath: file.path,
      language,
      content,
      techniques,
      extractedAt: new Date(),
      metadata: {
        stars: repo.stargazers_count,
        description: repo.description,
        topics: repo.topics,
      },
    };

    this.extractedCode.push(extracted);
    this.log(`Extracted: ${repo.full_name}/${file.path} (${techniques.length} techniques)`);
  }

  /**
   * Detect techniques used in code
   */
  private detectTechniques(content: string): string[] {
    const detected: string[] = [];

    for (const [technique, patterns] of Object.entries(TECHNIQUE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          detected.push(technique);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Check if file path matches extraction patterns
   */
  private matchesPattern(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      const regex = this.globToRegex(pattern);
      if (regex.test(filePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Get GitHub API headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.config.githubToken) {
      headers.Authorization = `Bearer ${this.config.githubToken}`;
    }

    return headers;
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, { headers, credentials: 'include' as RequestCredentials });

        // Handle rate limiting
        if (response.status === 403) {
          const resetTime = response.headers.get('x-ratelimit-reset');
          if (resetTime) {
            const waitTime = parseInt(resetTime) * 1000 - Date.now();
            if (waitTime > 0 && waitTime < 60000) {
              this.log(`Rate limited, waiting ${waitTime / 1000}s...`);
              await this.delay(waitTime);
              continue;
            }
          }
        }

        if (response.ok || response.status === 404) {
          return response;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.retryAttempts) {
          await this.delay(1000 * attempt);
        }
      }
    }

    throw lastError || new Error('Fetch failed');
  }

  /**
   * Save extraction manifest
   */
  private async saveManifest(): Promise<void> {
    const manifestPath = path.join(this.config.outputDir, 'extraction-manifest.json');

    // Group by technique for training organization
    const techniqueIndex: Record<string, string[]> = {};
    for (const code of this.extractedCode) {
      for (const technique of code.techniques) {
        if (!techniqueIndex[technique]) {
          techniqueIndex[technique] = [];
        }
        techniqueIndex[technique].push(code.id);
      }
    }

    const manifest = {
      extractedAt: new Date().toISOString(),
      totalFiles: this.extractedCode.length,
      byTier: {
        tier1: this.extractedCode.filter(c => c.tier === 1).length,
        tier2: this.extractedCode.filter(c => c.tier === 2).length,
        tier3: this.extractedCode.filter(c => c.tier === 3).length,
        tier4: this.extractedCode.filter(c => c.tier === 4).length,
        tier5: this.extractedCode.filter(c => c.tier === 5).length,
      },
      byCategory: Object.fromEntries(
        [...new Set(this.extractedCode.map(c => c.category))].map(cat => [
          cat,
          this.extractedCode.filter(c => c.category === cat).length,
        ])
      ),
      byLanguage: Object.fromEntries(
        [...new Set(this.extractedCode.map(c => c.language))].map(lang => [
          lang,
          this.extractedCode.filter(c => c.language === lang).length,
        ])
      ),
      techniqueIndex,
      files: this.extractedCode.map(c => ({
        id: c.id,
        source: c.source,
        tier: c.tier,
        category: c.category,
        repo: c.repoName,
        path: c.filePath,
        language: c.language,
        techniques: c.techniques,
      })),
    };

    await fs.promises.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Save extraction log
    const logPath = path.join(this.config.outputDir, 'extraction-log.txt');
    await fs.promises.writeFile(logPath, this.extractionLog.join('\n'));

    // Save technique training index
    const techniqueIndexPath = path.join(this.config.outputDir, 'technique-index.json');
    await fs.promises.writeFile(techniqueIndexPath, JSON.stringify(techniqueIndex, null, 2));
  }

  /**
   * Log message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.extractionLog.push(logMessage);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get extraction statistics
   */
  getStats(): {
    total: number;
    byTier: Record<number, number>;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    byTechnique: Record<string, number>;
  } {
    const byTechnique: Record<string, number> = {};
    for (const code of this.extractedCode) {
      for (const technique of code.techniques) {
        byTechnique[technique] = (byTechnique[technique] || 0) + 1;
      }
    }

    return {
      total: this.extractedCode.length,
      byTier: {
        1: this.extractedCode.filter(c => c.tier === 1).length,
        2: this.extractedCode.filter(c => c.tier === 2).length,
        3: this.extractedCode.filter(c => c.tier === 3).length,
        4: this.extractedCode.filter(c => c.tier === 4).length,
        5: this.extractedCode.filter(c => c.tier === 5).length,
      },
      byCategory: Object.fromEntries(
        [...new Set(this.extractedCode.map(c => c.category))].map(cat => [
          cat,
          this.extractedCode.filter(c => c.category === cat).length,
        ])
      ),
      byLanguage: Object.fromEntries(
        [...new Set(this.extractedCode.map(c => c.language))].map(lang => [
          lang,
          this.extractedCode.filter(c => c.language === lang).length,
        ])
      ),
      byTechnique,
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const tierFilter = args
    .find(a => a.startsWith('--tier='))
    ?.replace('--tier=', '')
    .split(',')
    .map(Number);
  const categoryFilter = args
    .find(a => a.startsWith('--category='))
    ?.replace('--category=', '')
    .split(',');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium Code Extraction                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN not set. API rate limits will be very restrictive.');
    console.warn('   Set GITHUB_TOKEN environment variable for better extraction.');
    console.warn('');
  }

  const service = new CodeExtractionService();

  try {
    const code = await service.extractAllSources(GITHUB_SOURCES, {
      tierFilter,
      categoryFilter,
    });

    const stats = service.getStats();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    EXTRACTION SUMMARY                          ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Files: ${stats.total}`);
    console.log('');
    console.log('By Tier:');
    Object.entries(stats.byTier).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count}`);
    });
    console.log('');
    console.log('By Category:');
    Object.entries(stats.byCategory).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    console.log('');
    console.log('By Technique (Top 10):');
    Object.entries(stats.byTechnique)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([technique, count]) => {
        console.log(`  ${technique}: ${count}`);
      });
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GITHUB_SOURCES, DEFAULT_CONFIG, TECHNIQUE_PATTERNS };
export type { GitHubSource, ExtractionConfig, ExtractedCode };

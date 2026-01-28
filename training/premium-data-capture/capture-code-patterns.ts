/**
 * Premium Code Pattern Capturer
 *
 * Captures code patterns from premium sources for symbiotic training:
 * - Screenshot + Code pairs (for image → code training)
 * - Animation patterns (GSAP timelines, spring configs, scroll effects)
 * - WebGL/Three.js shader code
 * - Premium component implementations
 *
 * This enables the code model to generate the SAME premium quality as the image model.
 *
 * Sources:
 * - Codrops GitHub repos
 * - Elite developer portfolios (Bruno Simon, Samsy)
 * - R3F/Drei examples
 * - GSAP official examples
 *
 * Usage:
 *   npx tsx capture-code-patterns.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../uicoder/code-patterns');
const PAIRED_DIR = path.join(__dirname, '../uicoder/paired-data');

// GitHub repositories to clone/analyze
const CODE_SOURCES = {
  // Codrops tutorials - Gold standard for WebGL/animation
  codrops: [
    'https://github.com/codrops/WebGLBlobs',
    'https://github.com/codrops/ScrollBasedLayoutAnimations',
    'https://github.com/codrops/ImageDistortionEffects',
    'https://github.com/codrops/HoverEffectIdeas',
    'https://github.com/codrops/LineHoverStyles',
    'https://github.com/codrops/ParticleEffectsButtons',
    'https://github.com/codrops/PageLoadingEffects',
    'https://github.com/codrops/TextInputEffects',
    'https://github.com/codrops/DialogEffects',
    'https://github.com/codrops/SlideshowAnimations',
    'https://github.com/codrops/GridLoadingAnimations',
    'https://github.com/codrops/BookBlock',
    'https://github.com/codrops/ThumbnailGridAnimations',
    'https://github.com/codrops/ElasticProgress',
    'https://github.com/codrops/AnimatedButtons',
    'https://github.com/codrops/IsometricGsapGrid',
    'https://github.com/codrops/Morpheus',
    'https://github.com/codrops/NotificationStyles',
    'https://github.com/codrops/SmoothScrollAnimations',
    'https://github.com/codrops/OnScrollPathAnimations',
  ],

  // Elite developer portfolios
  elite_portfolios: [
    'https://github.com/brunosimon/folio-2019',
    'https://github.com/brunosimon/my-room-in-3d',
    // Note: threejs-journey is paid, we extract patterns from public previews
  ],

  // React Three Fiber ecosystem
  r3f: [
    'https://github.com/pmndrs/drei',
    'https://github.com/pmndrs/react-three-fiber',
    'https://github.com/pmndrs/react-spring',
    'https://github.com/pmndrs/zustand',
    'https://github.com/pmndrs/leva',
    'https://github.com/pmndrs/jotai',
  ],

  // GSAP examples and resources
  gsap: [
    'https://github.com/greensock/GSAP',
  ],

  // Animation libraries
  animation: [
    'https://github.com/framer/motion',
    'https://github.com/darkroomengineering/lenis',
    'https://github.com/locomotivemtl/locomotive-scroll',
  ],

  // Premium UI component libraries
  ui_libraries: [
    'https://github.com/shadcn-ui/ui',
    'https://github.com/radix-ui/primitives',
    'https://github.com/chakra-ui/chakra-ui',
    'https://github.com/mantinedev/mantine',
  ],
};

// Pattern extraction configs
interface PatternConfig {
  fileExtensions: string[];
  patterns: RegExp[];
  captionPrefix: string;
}

const PATTERN_CONFIGS: Record<string, PatternConfig> = {
  // GSAP animation patterns
  gsap_animations: {
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
    patterns: [
      /gsap\.(to|from|fromTo|timeline|set)\(/g,
      /ScrollTrigger\.(create|batch|refresh)/g,
      /timeline\(\)\.to\(/g,
      /stagger:\s*\{/g,
      /scrub:\s*(true|\d)/g,
      /pin:\s*true/g,
    ],
    captionPrefix: 'premium GSAP animation pattern',
  },

  // Framer Motion / React Spring patterns
  spring_animations: {
    fileExtensions: ['.jsx', '.tsx'],
    patterns: [
      /useSpring\(/g,
      /useTransition\(/g,
      /motion\.[a-z]+/g,
      /animate=\{\{/g,
      /transition:\s*\{\s*type:\s*['"](spring|tween)/g,
      /stiffness:\s*\d+/g,
      /damping:\s*\d+/g,
    ],
    captionPrefix: 'premium spring physics animation',
  },

  // Three.js / R3F patterns
  threejs: {
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.glsl', '.vert', '.frag'],
    patterns: [
      /new THREE\./g,
      /useFrame\(/g,
      /useThree\(/g,
      /<Canvas/g,
      /MeshStandardMaterial/g,
      /ShaderMaterial/g,
      /uniforms:/g,
      /gl_Position/g,
      /gl_FragColor/g,
    ],
    captionPrefix: 'premium Three.js/WebGL pattern',
  },

  // Shader code patterns
  shaders: {
    fileExtensions: ['.glsl', '.vert', '.frag', '.shader'],
    patterns: [
      /uniform\s+/g,
      /varying\s+/g,
      /attribute\s+/g,
      /precision\s+(highp|mediump|lowp)/g,
      /vec[234]/g,
      /mat[234]/g,
      /texture2D/g,
      /smoothstep/g,
      /mix\(/g,
      /noise\(/g,
    ],
    captionPrefix: 'premium GLSL shader',
  },

  // React component patterns
  components: {
    fileExtensions: ['.jsx', '.tsx'],
    patterns: [
      /export\s+(default\s+)?function\s+[A-Z]/g,
      /const\s+[A-Z][a-zA-Z]+\s*=\s*\(\)/g,
      /forwardRef</g,
      /React\.memo\(/g,
      /useCallback\(/g,
      /useMemo\(/g,
    ],
    captionPrefix: 'premium React component',
  },

  // CSS/Tailwind patterns
  styling: {
    fileExtensions: ['.css', '.scss', '.sass', '.module.css'],
    patterns: [
      /@keyframes/g,
      /animation:/g,
      /transform:/g,
      /transition:/g,
      /backdrop-filter:/g,
      /clip-path:/g,
      /--[a-z-]+:/g, // CSS variables
    ],
    captionPrefix: 'premium CSS animation/styling',
  },

  // Scroll effects patterns
  scroll_effects: {
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
    patterns: [
      /IntersectionObserver/g,
      /scrollY|scrollTop/g,
      /scroll-snap/g,
      /Lenis/g,
      /locomotive/g,
      /parallax/g,
    ],
    captionPrefix: 'premium scroll effect pattern',
  },
};

interface CodePattern {
  source: string;
  file: string;
  pattern: string;
  code: string;
  context: string; // Surrounding code for context
  caption: string;
}

// =============================================================================
// GitHub Repo Cloning
// =============================================================================

async function cloneOrUpdateRepo(repoUrl: string, targetDir: string): Promise<boolean> {
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
  const localPath = path.join(targetDir, repoName);

  if (fs.existsSync(localPath)) {
    console.log(`   📁 ${repoName} exists, pulling updates...`);
    try {
      execSync(`cd "${localPath}" && git pull --quiet`, { stdio: 'pipe' });
      return true;
    } catch {
      console.log(`   ⚠️  Pull failed for ${repoName}, using existing`);
      return true;
    }
  }

  console.log(`   📥 Cloning ${repoName}...`);
  try {
    execSync(`git clone --depth 1 "${repoUrl}" "${localPath}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.log(`   ❌ Failed to clone ${repoName}`);
    return false;
  }
}

// =============================================================================
// Pattern Extraction
// =============================================================================

function extractCodeContext(content: string, match: RegExpExecArray, contextLines: number = 10): string {
  const lines = content.split('\n');
  const lineIndex = content.slice(0, match.index).split('\n').length - 1;
  const start = Math.max(0, lineIndex - contextLines);
  const end = Math.min(lines.length, lineIndex + contextLines + 1);
  return lines.slice(start, end).join('\n');
}

async function extractPatternsFromFile(
  filePath: string,
  source: string,
  category: string
): Promise<CodePattern[]> {
  const patterns: CodePattern[] = [];
  const config = PATTERN_CONFIGS[category];

  if (!config) return patterns;

  const ext = path.extname(filePath).toLowerCase();
  if (!config.fileExtensions.includes(ext)) return patterns;

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    for (const pattern of config.patterns) {
      pattern.lastIndex = 0; // Reset regex state
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const context = extractCodeContext(content, match, 15);

        // Generate descriptive caption
        const technique = pattern.source.replace(/[\\()[\]{}|^$*+?.]/g, '').slice(0, 30);
        const caption = [
          'kriptik_ui',
          config.captionPrefix,
          `${technique} implementation`,
          'production-ready code',
          'modern 2026 patterns',
        ].join(', ');

        patterns.push({
          source,
          file: filePath,
          pattern: pattern.source,
          code: match[0],
          context,
          caption,
        });

        // Limit matches per pattern per file
        if (patterns.filter(p => p.pattern === pattern.source).length > 5) {
          break;
        }
      }
    }
  } catch {
    // File read error, skip
  }

  return patterns;
}

async function extractPatternsFromDirectory(
  dirPath: string,
  source: string,
  categories: string[]
): Promise<CodePattern[]> {
  const allPatterns: CodePattern[] = [];

  async function walkDir(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .git, dist, build
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'].includes(entry.name)) {
          continue;
        }
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        for (const category of categories) {
          const patterns = await extractPatternsFromFile(fullPath, source, category);
          allPatterns.push(...patterns);
        }
      }
    }
  }

  await walkDir(dirPath);
  return allPatterns;
}

// =============================================================================
// Code Pattern Export
// =============================================================================

async function savePatterns(patterns: CodePattern[], category: string): Promise<void> {
  const categoryDir = path.join(OUTPUT_DIR, category);
  await fs.promises.mkdir(categoryDir, { recursive: true });

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const filename = `${category}_${i.toString().padStart(5, '0')}`;

    // Save code snippet
    const codePath = path.join(categoryDir, `${filename}.txt`);
    await fs.promises.writeFile(codePath, pattern.context);

    // Save caption
    const captionPath = path.join(categoryDir, `${filename}_caption.txt`);
    await fs.promises.writeFile(captionPath, pattern.caption);

    // Save metadata
    const metaPath = path.join(categoryDir, `${filename}_meta.json`);
    await fs.promises.writeFile(metaPath, JSON.stringify({
      source: pattern.source,
      file: pattern.file,
      pattern: pattern.pattern,
      capturedAt: new Date().toISOString(),
    }, null, 2));
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  💻 Premium Code Pattern Capturer');
  console.log('  Capturing code patterns for symbiotic training');
  console.log('  (Image → Code translation)');
  console.log('═══════════════════════════════════════════════════════════════');

  const reposDir = path.join(__dirname, 'repos');
  await fs.promises.mkdir(reposDir, { recursive: true });
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(PAIRED_DIR, { recursive: true });

  const allPatterns: Record<string, CodePattern[]> = {};

  // Process each source category
  for (const [category, repos] of Object.entries(CODE_SOURCES)) {
    console.log(`\n━━━ ${category.toUpperCase()} ━━━`);

    for (const repoUrl of repos) {
      const success = await cloneOrUpdateRepo(repoUrl, reposDir);
      if (!success) continue;

      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
      const repoPath = path.join(reposDir, repoName);

      // Determine which pattern categories to extract
      const patternCategories = Object.keys(PATTERN_CONFIGS);

      const patterns = await extractPatternsFromDirectory(repoPath, repoUrl, patternCategories);

      for (const pattern of patterns) {
        // Group by pattern category based on caption prefix
        for (const [cat, config] of Object.entries(PATTERN_CONFIGS)) {
          if (pattern.caption.includes(config.captionPrefix)) {
            if (!allPatterns[cat]) allPatterns[cat] = [];
            allPatterns[cat].push(pattern);
            break;
          }
        }
      }

      console.log(`   ✅ ${repoName}: ${patterns.length} patterns extracted`);
    }
  }

  // Save patterns by category
  console.log('\n━━━ SAVING PATTERNS ━━━');

  for (const [category, patterns] of Object.entries(allPatterns)) {
    await savePatterns(patterns, category);
    console.log(`   📁 ${category}: ${patterns.length} patterns saved`);
  }

  // Summary
  const totalPatterns = Object.values(allPatterns).reduce((sum, arr) => sum + arr.length, 0);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 CAPTURE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Patterns:  ${totalPatterns}`);
  console.log(`  Categories:      ${Object.keys(allPatterns).length}`);
  console.log(`  Output:          ${OUTPUT_DIR}`);
  console.log('');
  console.log('  Pattern Breakdown:');
  for (const [cat, patterns] of Object.entries(allPatterns)) {
    console.log(`     ${cat}: ${patterns.length}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

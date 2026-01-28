#!/usr/bin/env npx ts-node
/**
 * UICoder Paired Dataset Creator
 *
 * Creates screenshot + code pairs for code generation training.
 * This script:
 * 1. Takes screenshots from the ui-lora training dataset
 * 2. Matches them with source code from the code examples
 * 3. Creates instruction-tuning format for LLM fine-tuning
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '..');
const CODE_DIR = path.join(BASE_DIR, 'code');
const PAIRED_DIR = path.join(BASE_DIR, 'paired');
const OUTPUT_FILE = path.join(BASE_DIR, 'training-data.jsonl');

// Instruction template for code generation training
const INSTRUCTION_TEMPLATE = `You are an expert UI developer. Given a description of a UI design, generate production-ready React/TypeScript code that implements it.

Requirements:
- Use React with TypeScript
- Follow best practices for performance (60fps animations)
- Use appropriate animation libraries (Framer Motion, GSAP, React Spring)
- Implement responsive design
- Include proper accessibility attributes
- Use Tailwind CSS for styling when appropriate`;

interface PairedData {
  id: string;
  screenshot_path: string;
  code_files: string[];
  description: string;
  techniques: string[];
  libraries: string[];
}

interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
  metadata: {
    source: string;
    techniques: string[];
    libraries: string[];
  };
}

// Technique patterns to detect in code
const TECHNIQUE_PATTERNS: Record<string, RegExp[]> = {
  'gsap-animation': [/gsap\./i, /scrolltrigger/i, /timeline/i],
  'framer-motion': [/motion\./i, /useAnimation/i, /AnimatePresence/i],
  'react-spring': [/useSpring/i, /useSprings/i, /animated\./i],
  'three-js': [/THREE\./i, /useFrame/i, /useThree/i, /Canvas/i],
  'webgl-shader': [/gl_Position/i, /gl_FragColor/i, /uniform\s/i, /varying\s/i],
  'scroll-trigger': [/ScrollTrigger/i, /scrub:/i, /pin:/i],
  'parallax': [/parallax/i, /translateZ/i, /perspective/i],
  'glassmorphism': [/backdrop-blur/i, /bg-white\/\d+/i, /glass/i],
  'spring-physics': [/stiffness/i, /damping/i, /mass/i],
};

// Library detection patterns
const LIBRARY_PATTERNS: Record<string, RegExp[]> = {
  'react': [/from ['"]react['"]/i],
  'three': [/from ['"]three['"]/i, /from ['"]@react-three/i],
  'gsap': [/from ['"]gsap['"]/i],
  'framer-motion': [/from ['"]framer-motion['"]/i],
  'tailwind': [/className.*(?:bg-|text-|flex|grid|p-|m-)/i],
  'react-spring': [/from ['"]@react-spring/i],
  'lenis': [/from ['"]@studio-freight\/lenis['"]/i, /from ['"]lenis['"]/i],
};

function detectTechniques(code: string): string[] {
  const techniques: string[] = [];

  for (const [technique, patterns] of Object.entries(TECHNIQUE_PATTERNS)) {
    if (patterns.some(p => p.test(code))) {
      techniques.push(technique);
    }
  }

  return techniques;
}

function detectLibraries(code: string): string[] {
  const libraries: string[] = [];

  for (const [lib, patterns] of Object.entries(LIBRARY_PATTERNS)) {
    if (patterns.some(p => p.test(code))) {
      libraries.push(lib);
    }
  }

  return libraries;
}

function readCodeFiles(dir: string, extensions: string[] = ['.tsx', '.ts', '.jsx', '.js']): string[] {
  const files: string[] = [];

  function scanDir(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(itemPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  scanDir(dir);
  return files;
}

function createPairedDataset(): void {
  console.log('=== Creating UICoder Paired Dataset ===\n');

  const trainingExamples: TrainingExample[] = [];
  let pairId = 0;

  // Process each code source category (all downloaded categories)
  for (const category of ['codrops', 'r3f', 'gsap', 'premium', 'animation', 'ui']) {
    const categoryDir = path.join(CODE_DIR, category);

    if (!fs.existsSync(categoryDir)) {
      console.log(`[SKIP] ${category} - directory not found`);
      continue;
    }

    console.log(`\n[Processing ${category}]`);
    const projects = fs.readdirSync(categoryDir);

    for (const project of projects) {
      const projectDir = path.join(categoryDir, project);

      if (!fs.statSync(projectDir).isDirectory()) continue;

      const codeFiles = readCodeFiles(projectDir);

      if (codeFiles.length === 0) continue;

      // Combine all code files into a single training example
      const allCode = codeFiles
        .map(f => {
          try {
            return `// File: ${path.relative(projectDir, f)}\n${fs.readFileSync(f, 'utf-8')}`;
          } catch {
            return '';
          }
        })
        .filter(c => c.length > 0)
        .join('\n\n');

      const techniques = detectTechniques(allCode);
      const libraries = detectLibraries(allCode);

      // Create training example
      const description = generateDescription(project, techniques, libraries);

      const example: TrainingExample = {
        instruction: INSTRUCTION_TEMPLATE,
        input: description,
        output: formatCodeOutput(codeFiles, projectDir),
        metadata: {
          source: `${category}/${project}`,
          techniques,
          libraries,
        },
      };

      trainingExamples.push(example);
      pairId++;

      console.log(`  [${pairId}] ${project}: ${codeFiles.length} files, ${techniques.length} techniques`);
    }
  }

  // Write JSONL training file
  const jsonlContent = trainingExamples.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(OUTPUT_FILE, jsonlContent);

  console.log(`\n=== Dataset Created ===`);
  console.log(`Total examples: ${trainingExamples.length}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
}

function generateDescription(project: string, techniques: string[], libraries: string[]): string {
  const techniquesStr = techniques.length > 0 ? techniques.join(', ') : 'modern UI patterns';
  const librariesStr = libraries.length > 0 ? libraries.join(', ') : 'React';

  // Convert project name to human-readable description
  const name = project
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return `Create a ${name} component using ${librariesStr}.
Implement the following techniques: ${techniquesStr}.
The component should be production-ready with proper TypeScript types, accessibility, and performance optimizations.`;
}

function formatCodeOutput(codeFiles: string[], projectDir: string): string {
  // For training, we'll include the main entry file(s) first
  const entryFiles = codeFiles.filter(f =>
    f.includes('index.') || f.includes('App.') || f.includes('main.')
  );

  const otherFiles = codeFiles.filter(f => !entryFiles.includes(f));

  const sortedFiles = [...entryFiles, ...otherFiles].slice(0, 10); // Limit to 10 files

  return sortedFiles
    .map(f => {
      try {
        const relativePath = path.relative(projectDir, f);
        const content = fs.readFileSync(f, 'utf-8');
        return `// ${relativePath}\n${content}`;
      } catch {
        return '';
      }
    })
    .filter(c => c.length > 0)
    .join('\n\n');
}

// Run
createPairedDataset();

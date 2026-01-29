/**
 * Semantic Page Analyzer
 *
 * Analyzes existing pages/components to extract:
 * - Visual elements via VL-JEPA
 * - Function bindings (onClick, onSubmit, etc.)
 * - API integrations
 * - State management usage
 * - Import dependencies
 *
 * Used for Enhanced I2C to replace UI while preserving functionality.
 */

import { getVisualUnderstandingService } from '../embeddings/visual-understanding-service.js';
import { getUnifiedClient, ANTHROPIC_MODELS } from './unified-client.js';
import type { SemanticElement } from './ui-mockup-generator.js';
import * as parser from '@babel/parser';
import type { NodePath, Visitor } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle ESM/CJS interop - @babel/traverse has complex exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverseDefault = (traverseModule as any).default ?? traverseModule;
const traverse = traverseDefault as (
  ast: t.Node,
  visitor: Visitor
) => void;

// ============================================================================
// Types
// ============================================================================

export interface FunctionBinding {
  /** Function name */
  name: string;
  /** Binding type */
  type: 'onClick' | 'onSubmit' | 'onChange' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp' | 'effect' | 'callback' | 'handler';
  /** UI element it's bound to */
  boundToElement?: string;
  /** Function body (source code) */
  body: string;
  /** Function dependencies (variables, imports) */
  dependencies: string[];
  /** Is async */
  isAsync: boolean;
  /** Line number in source */
  lineNumber: number;
}

export interface APICall {
  /** API endpoint */
  endpoint: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Handler function name */
  handler: string;
  /** Request body structure */
  requestBody?: string;
  /** Response handling */
  responseHandler?: string;
  /** Line number */
  lineNumber: number;
}

export interface StateUsage {
  /** Store/context name */
  store: string;
  /** Actions used */
  actions: string[];
  /** Selectors used */
  selectors: string[];
  /** Hook name (useState, useStore, etc.) */
  hookName: string;
  /** Line number */
  lineNumber: number;
}

export interface ImportDependency {
  /** Module path */
  module: string;
  /** Imported items */
  items: string[];
  /** Is default import */
  isDefault: boolean;
  /** Line number */
  lineNumber: number;
}

export interface PageAnalysis {
  /** Component/page name */
  componentName: string;
  /** Source file path */
  filePath: string;
  /** Visual elements (from VL-JEPA) */
  elements: SemanticElement[];
  /** Function bindings */
  functions: FunctionBinding[];
  /** API integrations */
  apiCalls: APICall[];
  /** State management usage */
  stateUsage: StateUsage[];
  /** Import dependencies */
  imports: ImportDependency[];
  /** Element → Function mapping */
  elementFunctionMap: Map<string, string[]>;
  /** Raw JSX structure */
  jsxStructure?: string;
  /** Analysis confidence */
  confidence: number;
}

export interface DesignComparison {
  /** Elements in new design */
  newElements: SemanticElement[];
  /** Mapping to existing elements */
  mappings: Array<{
    newElement: string;
    existingElement: string | null;
    similarity: number;
    preservedFunctions: string[];
  }>;
  /** New elements not in existing page */
  unmappedNewElements: string[];
  /** Existing elements not in new design */
  unmappedExistingElements: string[];
  /** Overall match score */
  overallMatchScore: number;
}

export interface ReplacementCode {
  /** Generated component code */
  code: string;
  /** Preserved functions */
  preservedFunctions: FunctionBinding[];
  /** Preserved API calls */
  preservedAPICalls: APICall[];
  /** Preserved state usage */
  preservedStateUsage: StateUsage[];
  /** Required imports */
  requiredImports: ImportDependency[];
  /** User decisions needed */
  userDecisions: Array<{
    element: string;
    question: string;
    options: string[];
  }>;
}

// ============================================================================
// Semantic Page Analyzer Implementation
// ============================================================================

export class SemanticPageAnalyzer {
  private visualUnderstanding = getVisualUnderstandingService();
  private aiClient = getUnifiedClient();

  /**
   * Analyze an existing page/component
   */
  async analyzePage(request: {
    code: string;
    filePath: string;
    screenshotBase64?: string;
  }): Promise<PageAnalysis> {
    const { code, filePath, screenshotBase64 } = request;

    console.log(`[Semantic-Analyzer] Analyzing: ${filePath}`);

    // Extract component name from file path
    const componentName = this.extractComponentName(filePath);

    // Parse code for functions, API calls, state, imports
    const { functions, apiCalls, stateUsage, imports, jsxStructure } = this.parseCode(code);

    // Analyze visual elements if screenshot provided
    let elements: SemanticElement[] = [];
    if (screenshotBase64) {
      try {
        const visualResult = await this.visualUnderstanding.analyzeUIElements(screenshotBase64);
        elements = (visualResult || []).map((el, index: number) => ({
          id: `visual-${index}`,
          type: this.mapElementType(el.type || el.label),
          boundingBox: el.boundingBox || { x: 0, y: 0, width: 100, height: 100 },
          label: el.label || 'Unknown',
          embedding: [],
          confidence: el.confidence || 0.8,
        }));
      } catch (error) {
        console.warn('[Semantic-Analyzer] Visual analysis failed:', error);
      }
    }

    // Build element → function mapping
    const elementFunctionMap = this.buildElementFunctionMap(code, functions);

    return {
      componentName,
      filePath,
      elements,
      functions,
      apiCalls,
      stateUsage,
      imports,
      elementFunctionMap,
      jsxStructure,
      confidence: elements.length > 0 ? 0.9 : 0.7,
    };
  }

  /**
   * Compare existing page with new design
   */
  async compareWithDesign(
    analysis: PageAnalysis,
    newDesignImage: string
  ): Promise<DesignComparison> {
    console.log('[Semantic-Analyzer] Comparing with new design...');

    // Analyze new design image
    const visualResult = await this.visualUnderstanding.analyzeUIElements(newDesignImage);
    const newElements: SemanticElement[] = (visualResult || []).map((el, index: number) => ({
      id: `new-${index}`,
      type: this.mapElementType(el.type || el.label),
      boundingBox: el.boundingBox || { x: 0, y: 0, width: 100, height: 100 },
      label: el.label || 'Unknown',
      embedding: [],
      confidence: el.confidence || 0.8,
    }));

    // Map new elements to existing elements by similarity
    const mappings: DesignComparison['mappings'] = [];
    const usedExisting = new Set<string>();

    for (const newEl of newElements) {
      let bestMatch: { element: SemanticElement | null; similarity: number } = { element: null, similarity: 0 };

      for (const existingEl of analysis.elements) {
        if (usedExisting.has(existingEl.id)) continue;

        const similarity = this.calculateElementSimilarity(newEl, existingEl);
        if (similarity > bestMatch.similarity && similarity > 0.6) {
          bestMatch = { element: existingEl, similarity };
        }
      }

      const preservedFunctions = bestMatch.element
        ? analysis.elementFunctionMap.get(bestMatch.element.id) || []
        : [];

      mappings.push({
        newElement: newEl.id,
        existingElement: bestMatch.element?.id || null,
        similarity: bestMatch.similarity,
        preservedFunctions,
      });

      if (bestMatch.element) {
        usedExisting.add(bestMatch.element.id);
      }
    }

    // Find unmapped elements
    const unmappedNewElements = mappings
      .filter(m => !m.existingElement)
      .map(m => m.newElement);

    const unmappedExistingElements = analysis.elements
      .filter(el => !usedExisting.has(el.id))
      .map(el => el.id);

    // Calculate overall match score
    const matchedCount = mappings.filter(m => m.existingElement).length;
    const overallMatchScore = mappings.length > 0 ? matchedCount / mappings.length : 0;

    return {
      newElements,
      mappings,
      unmappedNewElements,
      unmappedExistingElements,
      overallMatchScore,
    };
  }

  /**
   * Generate replacement code preserving functionality
   */
  async generateReplacement(
    analysis: PageAnalysis,
    comparison: DesignComparison,
    options: { preserveFunctions: boolean; preserveState: boolean }
  ): Promise<ReplacementCode> {
    console.log('[Semantic-Analyzer] Generating replacement code...');

    // Collect preserved elements
    const preservedFunctions: FunctionBinding[] = [];
    const preservedAPICalls: APICall[] = [];
    const preservedStateUsage: StateUsage[] = [];

    if (options.preserveFunctions) {
      // Find functions bound to mapped elements
      for (const mapping of comparison.mappings) {
        if (mapping.existingElement) {
          for (const funcName of mapping.preservedFunctions) {
            const func = analysis.functions.find(f => f.name === funcName);
            if (func) {
              preservedFunctions.push(func);
            }
          }
        }
      }

      // Include all API calls
      preservedAPICalls.push(...analysis.apiCalls);
    }

    if (options.preserveState) {
      preservedStateUsage.push(...analysis.stateUsage);
    }

    // Generate user decisions for unmapped elements
    const userDecisions: ReplacementCode['userDecisions'] = [];

    for (const elementId of comparison.unmappedNewElements) {
      const element = comparison.newElements.find(e => e.id === elementId);
      if (element) {
        userDecisions.push({
          element: element.label,
          question: `Your new design has a "${element.label}" (${element.type}) that doesn't exist in the current page. What would you like to do?`,
          options: ['Add this as a new feature', 'Remove from design', 'Map to existing element'],
        });
      }
    }

    for (const elementId of comparison.unmappedExistingElements) {
      const element = analysis.elements.find(e => e.id === elementId);
      if (element) {
        const boundFunctions = analysis.elementFunctionMap.get(elementId) || [];
        if (boundFunctions.length > 0) {
          userDecisions.push({
            element: element.label,
            question: `The "${element.label}" (${element.type}) in your current page has bound functions (${boundFunctions.join(', ')}) but isn't in the new design. What should happen to these functions?`,
            options: ['Keep the functions (attach to similar element)', 'Remove completely', 'Add element back to design'],
          });
        }
      }
    }

    // Generate replacement code using Opus 4.5
    const code = await this.generateComponentCode(
      analysis,
      comparison,
      preservedFunctions,
      preservedAPICalls,
      preservedStateUsage
    );

    // Determine required imports
    const requiredImports = this.determineRequiredImports(
      analysis.imports,
      preservedFunctions,
      preservedAPICalls,
      preservedStateUsage
    );

    return {
      code,
      preservedFunctions,
      preservedAPICalls,
      preservedStateUsage,
      requiredImports,
      userDecisions,
    };
  }

  /**
   * Parse code to extract functions, API calls, state, imports
   */
  private parseCode(code: string): {
    functions: FunctionBinding[];
    apiCalls: APICall[];
    stateUsage: StateUsage[];
    imports: ImportDependency[];
    jsxStructure?: string;
  } {
    const functions: FunctionBinding[] = [];
    const apiCalls: APICall[] = [];
    const stateUsage: StateUsage[] = [];
    const imports: ImportDependency[] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      traverse(ast, {
        // Extract imports
        ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
          const module = path.node.source.value;
          const items: string[] = [];
          let isDefault = false;

          for (const specifier of path.node.specifiers) {
            if (t.isImportDefaultSpecifier(specifier)) {
              items.push(specifier.local.name);
              isDefault = true;
            } else if (t.isImportSpecifier(specifier)) {
              items.push(
                t.isIdentifier(specifier.imported)
                  ? specifier.imported.name
                  : (specifier.imported as t.StringLiteral).value
              );
            }
          }

          imports.push({
            module,
            items,
            isDefault,
            lineNumber: path.node.loc?.start.line || 0,
          });
        },

        // Extract function declarations
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          if (path.node.id) {
            functions.push({
              name: path.node.id.name,
              type: 'handler',
              body: code.slice(path.node.start!, path.node.end!),
              dependencies: [],
              isAsync: path.node.async,
              lineNumber: path.node.loc?.start.line || 0,
            });
          }
        },

        // Extract arrow functions assigned to variables
        VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
          if (t.isArrowFunctionExpression(path.node.init) && t.isIdentifier(path.node.id)) {
            const funcName = path.node.id.name;
            const funcBody = code.slice(path.node.init.start!, path.node.init.end!);

            // Determine function type from name
            let funcType: FunctionBinding['type'] = 'handler';
            if (funcName.startsWith('handle') || funcName.startsWith('on')) {
              if (funcName.toLowerCase().includes('click')) funcType = 'onClick';
              else if (funcName.toLowerCase().includes('submit')) funcType = 'onSubmit';
              else if (funcName.toLowerCase().includes('change')) funcType = 'onChange';
            }

            functions.push({
              name: funcName,
              type: funcType,
              body: funcBody,
              dependencies: [],
              isAsync: path.node.init.async,
              lineNumber: path.node.loc?.start.line || 0,
            });
          }
        },

        // Extract API calls (fetch, axios, apiClient)
        CallExpression(path: NodePath<t.CallExpression>) {
          const callee = path.node.callee;

          // Check for fetch calls
          if (t.isIdentifier(callee) && callee.name === 'fetch') {
            const args = path.node.arguments;
            if (args[0] && t.isStringLiteral(args[0])) {
              let method: APICall['method'] = 'GET';
              if (args[1] && t.isObjectExpression(args[1])) {
                const methodProp = args[1].properties.find(
                  (p: t.ObjectMethod | t.ObjectProperty | t.SpreadElement): p is t.ObjectProperty =>
                    t.isObjectProperty(p) &&
                    t.isIdentifier(p.key) &&
                    p.key.name === 'method'
                );
                if (methodProp && t.isStringLiteral(methodProp.value)) {
                  method = methodProp.value.value.toUpperCase() as APICall['method'];
                }
              }

              apiCalls.push({
                endpoint: args[0].value,
                method,
                handler: 'fetch',
                lineNumber: path.node.loc?.start.line || 0,
              });
            }
          }

          // Check for useStore, useState, etc.
          if (t.isIdentifier(callee) && callee.name.startsWith('use')) {
            if (callee.name === 'useState' || callee.name === 'useReducer') {
              stateUsage.push({
                store: 'local',
                actions: [],
                selectors: [],
                hookName: callee.name,
                lineNumber: path.node.loc?.start.line || 0,
              });
            } else if (callee.name.includes('Store') || callee.name.includes('Context')) {
              stateUsage.push({
                store: callee.name,
                actions: [],
                selectors: [],
                hookName: callee.name,
                lineNumber: path.node.loc?.start.line || 0,
              });
            }
          }
        },
      });
    } catch (error) {
      console.warn('[Semantic-Analyzer] Code parsing failed:', error);
    }

    return { functions, apiCalls, stateUsage, imports };
  }

  /**
   * Build mapping from UI elements to bound functions
   */
  private buildElementFunctionMap(
    code: string,
    functions: FunctionBinding[]
  ): Map<string, string[]> {
    const map = new Map<string, string[]>();

    // Look for onClick={handleX} patterns in code
    const eventPatterns = [
      /onClick\s*=\s*\{?\s*(\w+)\s*\}?/g,
      /onSubmit\s*=\s*\{?\s*(\w+)\s*\}?/g,
      /onChange\s*=\s*\{?\s*(\w+)\s*\}?/g,
      /onFocus\s*=\s*\{?\s*(\w+)\s*\}?/g,
      /onBlur\s*=\s*\{?\s*(\w+)\s*\}?/g,
    ];

    let elementIndex = 0;
    for (const pattern of eventPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const funcName = match[1];
        const elementId = `element-${elementIndex++}`;

        const existing = map.get(elementId) || [];
        existing.push(funcName);
        map.set(elementId, existing);

        // Update function binding
        const func = functions.find(f => f.name === funcName);
        if (func) {
          func.boundToElement = elementId;
        }
      }
    }

    return map;
  }

  /**
   * Calculate similarity between two semantic elements
   */
  private calculateElementSimilarity(el1: SemanticElement, el2: SemanticElement): number {
    // Type match (40% weight)
    const typeScore = el1.type === el2.type ? 0.4 : 0;

    // Label similarity (30% weight)
    const labelScore = this.stringSimilarity(el1.label, el2.label) * 0.3;

    // Position similarity (30% weight)
    const posScore = this.positionSimilarity(el1.boundingBox, el2.boundingBox) * 0.3;

    return typeScore + labelScore + posScore;
  }

  /**
   * Simple string similarity (Jaccard)
   */
  private stringSimilarity(s1: string, s2: string): number {
    const set1 = new Set(s1.toLowerCase().split(/\s+/));
    const set2 = new Set(s2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Position similarity
   */
  private positionSimilarity(
    box1: SemanticElement['boundingBox'],
    box2: SemanticElement['boundingBox']
  ): number {
    const xDiff = Math.abs(box1.x - box2.x);
    const yDiff = Math.abs(box1.y - box2.y);
    const wDiff = Math.abs(box1.width - box2.width);
    const hDiff = Math.abs(box1.height - box2.height);

    // Normalize differences (assume max difference of 100%)
    const xScore = Math.max(0, 1 - xDiff / 100);
    const yScore = Math.max(0, 1 - yDiff / 100);
    const wScore = Math.max(0, 1 - wDiff / 100);
    const hScore = Math.max(0, 1 - hDiff / 100);

    return (xScore + yScore + wScore + hScore) / 4;
  }

  /**
   * Generate component code with Opus 4.5
   */
  private async generateComponentCode(
    analysis: PageAnalysis,
    comparison: DesignComparison,
    preservedFunctions: FunctionBinding[],
    preservedAPICalls: APICall[],
    preservedStateUsage: StateUsage[]
  ): Promise<string> {
    const prompt = `Generate a React TypeScript component that:
1. Implements the new visual design with these elements: ${comparison.newElements.map(e => `${e.type}: "${e.label}"`).join(', ')}
2. Preserves these function bindings:
${preservedFunctions.map(f => `   - ${f.name} (${f.type}): ${f.body.slice(0, 100)}...`).join('\n')}
3. Maintains these API integrations:
${preservedAPICalls.map(a => `   - ${a.method} ${a.endpoint}`).join('\n')}
4. Uses these state hooks:
${preservedStateUsage.map(s => `   - ${s.hookName}`).join('\n')}

Original component name: ${analysis.componentName}

Output ONLY the complete TypeScript React component code with proper typing.`;

    try {
      const response = await this.aiClient.generate({
        model: ANTHROPIC_MODELS.SONNET_4_5,
        systemPrompt: 'You are a React/TypeScript expert. Generate clean, production-ready code.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 8000,
        temperature: 0.3,
      });

      return response.content;
    } catch (error) {
      console.error('[Semantic-Analyzer] Code generation failed:', error);
      throw error;
    }
  }

  /**
   * Determine required imports for replacement code
   */
  private determineRequiredImports(
    originalImports: ImportDependency[],
    preservedFunctions: FunctionBinding[],
    preservedAPICalls: APICall[],
    preservedStateUsage: StateUsage[]
  ): ImportDependency[] {
    const required: ImportDependency[] = [];

    // Always need React
    required.push({
      module: 'react',
      items: ['useState', 'useEffect', 'useCallback'],
      isDefault: false,
      lineNumber: 1,
    });

    // Keep imports used by preserved functions
    for (const imp of originalImports) {
      const isUsed = preservedFunctions.some(f =>
        imp.items.some(item => f.body.includes(item))
      ) || preservedAPICalls.some(a =>
        imp.items.some(item => a.handler.includes(item))
      ) || preservedStateUsage.some(s =>
        imp.items.includes(s.hookName)
      );

      if (isUsed) {
        required.push(imp);
      }
    }

    return required;
  }

  /**
   * Map element type string to SemanticElement type
   */
  private mapElementType(typeStr: string): SemanticElement['type'] {
    const typeMap: Record<string, SemanticElement['type']> = {
      button: 'button',
      btn: 'button',
      input: 'input',
      textfield: 'input',
      navigation: 'nav',
      navbar: 'nav',
      card: 'card',
      form: 'form',
      image: 'image',
      text: 'text',
      list: 'list',
      modal: 'modal',
      header: 'header',
      footer: 'footer',
      icon: 'icon',
      avatar: 'avatar',
      badge: 'badge',
    };

    const normalized = typeStr.toLowerCase().replace(/[^a-z]/g, '');
    return typeMap[normalized] || 'container';
  }

  /**
   * Extract component name from file path
   */
  private extractComponentName(filePath: string): string {
    const fileName = filePath.split('/').pop() || 'Component';
    return fileName.replace(/\.(tsx?|jsx?)$/, '');
  }
}

// ============================================================================
// Singleton
// ============================================================================

let analyzerInstance: SemanticPageAnalyzer | null = null;

export function getSemanticPageAnalyzer(): SemanticPageAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SemanticPageAnalyzer();
  }
  return analyzerInstance;
}

export default SemanticPageAnalyzer;

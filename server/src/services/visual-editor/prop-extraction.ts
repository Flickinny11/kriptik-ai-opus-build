/**
 * Prop Extraction Service
 *
 * Extracts React component prop definitions from source code.
 * Uses regex-based parsing for TypeScript interfaces and prop usage.
 *
 * Features:
 * - TypeScript interface/type parsing
 * - PropTypes parsing
 * - Default value detection
 * - Documentation comment extraction
 * - Component prop usage analysis
 */

// =============================================================================
// TYPES
// =============================================================================

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'function'
  | 'node'
  | 'element'
  | 'enum'
  | 'union'
  | 'any'
  | 'unknown';

export interface ExtractedProp {
  name: string;
  type: PropType;
  isRequired: boolean;
  isOptional: boolean;
  defaultValue?: string;
  description?: string;
  enumValues?: string[];
  unionTypes?: string[];
  rawType?: string;
}

export interface PropExtractionResult {
  componentName: string;
  filePath: string;
  props: ExtractedProp[];
  propsInterfaceName?: string;
  extendsInterfaces?: string[];
  isClassComponent: boolean;
  hasDefaultProps: boolean;
}

// =============================================================================
// TYPE MAPPING
// =============================================================================

const TYPE_MAPPINGS: Record<string, PropType> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
  function: 'function',
  Function: 'function',
  '() => void': 'function',
  '() => any': 'function',
  ReactNode: 'node',
  'React.ReactNode': 'node',
  ReactElement: 'element',
  'React.ReactElement': 'element',
  JSX: 'element',
  'JSX.Element': 'element',
  any: 'any',
  unknown: 'unknown',
  null: 'unknown',
  undefined: 'unknown',
  void: 'unknown',
  never: 'unknown',
};

// =============================================================================
// PROP EXTRACTION SERVICE
// =============================================================================

export class PropExtractionService {
  /**
   * Extract props from a React component source code
   */
  extractProps(sourceCode: string, filePath: string): PropExtractionResult {
    const componentName = this.extractComponentName(sourceCode, filePath);
    const isClassComponent = this.isClassComponent(sourceCode);
    const hasDefaultProps = sourceCode.includes('.defaultProps') || sourceCode.includes('defaultProps =');

    // Try to extract from TypeScript interface/type first
    let props = this.extractFromTypeScript(sourceCode);

    // Fallback to PropTypes if no TypeScript props found
    if (props.length === 0) {
      props = this.extractFromPropTypes(sourceCode);
    }

    // Extract default values
    const defaultValues = this.extractDefaultValues(sourceCode);
    props = props.map((prop) => ({
      ...prop,
      defaultValue: defaultValues[prop.name] ?? prop.defaultValue,
    }));

    // Extract prop interface name
    const propsInterfaceName = this.extractPropsInterfaceName(sourceCode);
    const extendsInterfaces = this.extractExtendsInterfaces(sourceCode, propsInterfaceName);

    return {
      componentName,
      filePath,
      props,
      propsInterfaceName,
      extendsInterfaces,
      isClassComponent,
      hasDefaultProps,
    };
  }

  /**
   * Extract component name from source
   */
  private extractComponentName(sourceCode: string, filePath: string): string {
    // Try to extract from function/class declaration
    const funcMatch = sourceCode.match(/(?:export\s+(?:default\s+)?)?(?:function|const|class)\s+(\w+)/);
    if (funcMatch) {
      return funcMatch[1];
    }

    // Try to extract from export default
    const exportMatch = sourceCode.match(/export\s+default\s+(\w+)/);
    if (exportMatch) {
      return exportMatch[1];
    }

    // Fallback to filename
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.(tsx?|jsx?)$/, '');
  }

  /**
   * Check if component is a class component
   */
  private isClassComponent(sourceCode: string): boolean {
    return /class\s+\w+\s+extends\s+(?:React\.)?(?:Component|PureComponent)/.test(sourceCode);
  }

  /**
   * Extract props from TypeScript interface/type
   */
  private extractFromTypeScript(sourceCode: string): ExtractedProp[] {
    const props: ExtractedProp[] = [];

    // Find interface or type for Props
    const interfaceMatch = sourceCode.match(
      /(?:interface|type)\s+(\w*Props\w*)\s*(?:extends\s+[^{]+)?{\s*([\s\S]*?)}/
    );

    if (!interfaceMatch) {
      // Try to find inline props type in function signature
      const inlineMatch = sourceCode.match(
        /(?:function|const)\s+\w+\s*[=:]\s*(?:\(\s*\{[\s\S]*?\}\s*:\s*{\s*([\s\S]*?)\s*}\s*\)|\([\s\S]*?{\s*([\s\S]*?)\s*}\))/
      );

      if (inlineMatch) {
        const propsContent = inlineMatch[1] || inlineMatch[2];
        if (propsContent) {
          return this.parsePropsContent(propsContent);
        }
      }
      return [];
    }

    const propsContent = interfaceMatch[2];
    return this.parsePropsContent(propsContent);
  }

  /**
   * Parse props content from interface body
   */
  private parsePropsContent(propsContent: string): ExtractedProp[] {
    const props: ExtractedProp[] = [];

    // Match each prop definition
    // Handles: name?: type; or name: type; with optional JSDoc
    const propRegex = /(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?(\w+)(\?)?:\s*([^;]+);/g;
    let match;

    while ((match = propRegex.exec(propsContent)) !== null) {
      const [, docComment, name, optional, rawType] = match;

      // Parse the type
      const { type, enumValues, unionTypes } = this.parseType(rawType.trim());

      // Extract description from JSDoc
      const description = docComment
        ? docComment.replace(/\s*\*\s*/g, ' ').trim()
        : undefined;

      props.push({
        name,
        type,
        isRequired: !optional,
        isOptional: !!optional,
        description,
        enumValues,
        unionTypes,
        rawType: rawType.trim(),
      });
    }

    return props;
  }

  /**
   * Parse a TypeScript type string
   */
  private parseType(typeStr: string): {
    type: PropType;
    enumValues?: string[];
    unionTypes?: string[];
  } {
    const cleanType = typeStr.trim();

    // Check for direct mapping first
    if (TYPE_MAPPINGS[cleanType]) {
      return { type: TYPE_MAPPINGS[cleanType] };
    }

    // Check for array types
    if (cleanType.endsWith('[]') || cleanType.startsWith('Array<')) {
      return { type: 'array' };
    }

    // Check for function types
    if (cleanType.includes('=>') || cleanType.startsWith('(')) {
      return { type: 'function' };
    }

    // Check for union of string literals (enum-like)
    if (cleanType.includes('|') && cleanType.includes("'")) {
      const literals = cleanType
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.startsWith("'") || s.startsWith('"'));

      if (literals.length > 0) {
        const enumValues = literals.map((s) => s.replace(/['"]/g, ''));
        return { type: 'enum', enumValues };
      }
    }

    // Check for union types
    if (cleanType.includes('|')) {
      const unionTypes = cleanType.split('|').map((s) => s.trim());
      return { type: 'union', unionTypes };
    }

    // Check for object types
    if (cleanType.startsWith('{') || cleanType.includes('Record<')) {
      return { type: 'object' };
    }

    // Check for React types
    if (cleanType.includes('React.') || cleanType.includes('JSX')) {
      if (cleanType.includes('Node')) return { type: 'node' };
      if (cleanType.includes('Element')) return { type: 'element' };
    }

    // Default to unknown
    return { type: 'unknown' };
  }

  /**
   * Extract props from PropTypes definition
   */
  private extractFromPropTypes(sourceCode: string): ExtractedProp[] {
    const props: ExtractedProp[] = [];

    // Find PropTypes definition
    const propTypesMatch = sourceCode.match(/\.propTypes\s*=\s*{\s*([\s\S]*?)};/);
    if (!propTypesMatch) return [];

    const propTypesContent = propTypesMatch[1];

    // Match each PropType definition
    const propRegex = /(\w+):\s*PropTypes\.(\w+)(?:\.isRequired)?/g;
    let match;

    while ((match = propRegex.exec(propTypesContent)) !== null) {
      const [fullMatch, name, propType] = match;
      const isRequired = fullMatch.includes('.isRequired');

      const type = this.mapPropTypeToType(propType);

      props.push({
        name,
        type,
        isRequired,
        isOptional: !isRequired,
      });
    }

    return props;
  }

  /**
   * Map PropTypes type to our PropType
   */
  private mapPropTypeToType(propType: string): PropType {
    const mapping: Record<string, PropType> = {
      string: 'string',
      number: 'number',
      bool: 'boolean',
      object: 'object',
      array: 'array',
      func: 'function',
      node: 'node',
      element: 'element',
      any: 'any',
      oneOf: 'enum',
      oneOfType: 'union',
      arrayOf: 'array',
      objectOf: 'object',
      shape: 'object',
      exact: 'object',
    };

    return mapping[propType] || 'unknown';
  }

  /**
   * Extract default values from defaultProps or destructuring defaults
   */
  private extractDefaultValues(sourceCode: string): Record<string, string> {
    const defaults: Record<string, string> = {};

    // Extract from defaultProps
    const defaultPropsMatch = sourceCode.match(/\.defaultProps\s*=\s*{\s*([\s\S]*?)};/);
    if (defaultPropsMatch) {
      const defaultsContent = defaultPropsMatch[1];
      const defaultRegex = /(\w+):\s*([^,}\n]+)/g;
      let match;

      while ((match = defaultRegex.exec(defaultsContent)) !== null) {
        defaults[match[1]] = match[2].trim();
      }
    }

    // Extract from destructuring with defaults in function params
    const destructMatch = sourceCode.match(
      /(?:function|const)\s+\w+\s*[=:]\s*\(\s*{\s*([\s\S]*?)}\s*\)/
    );
    if (destructMatch) {
      const params = destructMatch[1];
      const defaultRegex = /(\w+)\s*=\s*([^,}\n]+)/g;
      let match;

      while ((match = defaultRegex.exec(params)) !== null) {
        defaults[match[1]] = match[2].trim();
      }
    }

    return defaults;
  }

  /**
   * Extract props interface name
   */
  private extractPropsInterfaceName(sourceCode: string): string | undefined {
    const match = sourceCode.match(/(?:interface|type)\s+(\w*Props\w*)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract interfaces that the props interface extends
   */
  private extractExtendsInterfaces(
    sourceCode: string,
    propsInterfaceName?: string
  ): string[] | undefined {
    if (!propsInterfaceName) return undefined;

    const regex = new RegExp(
      `interface\\s+${propsInterfaceName}\\s+extends\\s+([^{]+)\\s*{`
    );
    const match = sourceCode.match(regex);

    if (match) {
      return match[1].split(',').map((s) => s.trim());
    }

    return undefined;
  }

  /**
   * Get standard HTML element props
   */
  getStandardElementProps(tagName: string): ExtractedProp[] {
    const commonProps: ExtractedProp[] = [
      {
        name: 'className',
        type: 'string',
        isRequired: false,
        isOptional: true,
        description: 'CSS class names',
      },
      {
        name: 'style',
        type: 'object',
        isRequired: false,
        isOptional: true,
        description: 'Inline styles',
      },
      {
        name: 'id',
        type: 'string',
        isRequired: false,
        isOptional: true,
        description: 'Element ID',
      },
    ];

    // Add element-specific props
    const elementProps: Record<string, ExtractedProp[]> = {
      button: [
        {
          name: 'disabled',
          type: 'boolean',
          isRequired: false,
          isOptional: true,
          description: 'Whether the button is disabled',
        },
        {
          name: 'type',
          type: 'enum',
          isRequired: false,
          isOptional: true,
          enumValues: ['button', 'submit', 'reset'],
          description: 'Button type',
        },
        {
          name: 'onClick',
          type: 'function',
          isRequired: false,
          isOptional: true,
          description: 'Click handler',
        },
      ],
      input: [
        {
          name: 'type',
          type: 'enum',
          isRequired: false,
          isOptional: true,
          enumValues: ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'date', 'checkbox', 'radio'],
          description: 'Input type',
        },
        {
          name: 'value',
          type: 'string',
          isRequired: false,
          isOptional: true,
          description: 'Input value',
        },
        {
          name: 'placeholder',
          type: 'string',
          isRequired: false,
          isOptional: true,
          description: 'Placeholder text',
        },
        {
          name: 'disabled',
          type: 'boolean',
          isRequired: false,
          isOptional: true,
          description: 'Whether the input is disabled',
        },
        {
          name: 'onChange',
          type: 'function',
          isRequired: false,
          isOptional: true,
          description: 'Change handler',
        },
      ],
      a: [
        {
          name: 'href',
          type: 'string',
          isRequired: false,
          isOptional: true,
          description: 'Link URL',
        },
        {
          name: 'target',
          type: 'enum',
          isRequired: false,
          isOptional: true,
          enumValues: ['_blank', '_self', '_parent', '_top'],
          description: 'Link target',
        },
        {
          name: 'rel',
          type: 'string',
          isRequired: false,
          isOptional: true,
          description: 'Link relationship',
        },
      ],
      img: [
        {
          name: 'src',
          type: 'string',
          isRequired: true,
          isOptional: false,
          description: 'Image source URL',
        },
        {
          name: 'alt',
          type: 'string',
          isRequired: true,
          isOptional: false,
          description: 'Alternative text',
        },
        {
          name: 'width',
          type: 'union',
          isRequired: false,
          isOptional: true,
          unionTypes: ['number', 'string'],
          description: 'Image width',
        },
        {
          name: 'height',
          type: 'union',
          isRequired: false,
          isOptional: true,
          unionTypes: ['number', 'string'],
          description: 'Image height',
        },
      ],
    };

    return [...commonProps, ...(elementProps[tagName.toLowerCase()] || [])];
  }
}

// Singleton instance
let propExtractionService: PropExtractionService | null = null;

export function getPropExtractionService(): PropExtractionService {
  if (!propExtractionService) {
    propExtractionService = new PropExtractionService();
  }
  return propExtractionService;
}

export default getPropExtractionService;

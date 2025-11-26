/**
 * Template Instantiator
 * 
 * Instantiates templates by replacing variables and generating final project files.
 */

import {
    Template,
    TemplateFile,
    TemplateInstantiationRequest,
    TemplateInstantiationResult,
} from './types';
import { getTemplateLibrary } from './template-library';

export class TemplateInstantiator {
    private library = getTemplateLibrary();

    /**
     * Instantiate a template with the given variables
     */
    async instantiate(request: TemplateInstantiationRequest): Promise<TemplateInstantiationResult> {
        const template = this.library.getTemplate(request.templateId);

        if (!template) {
            return {
                success: false,
                files: [],
                dependencies: {},
                devDependencies: {},
                setupInstructions: [],
                warnings: [`Template not found: ${request.templateId}`],
            };
        }

        // Validate required variables
        const validationErrors = this.validateVariables(template, request.variables);
        if (validationErrors.length > 0) {
            return {
                success: false,
                files: [],
                dependencies: {},
                devDependencies: {},
                setupInstructions: [],
                warnings: validationErrors,
            };
        }

        // Merge defaults with provided variables
        const variables = this.mergeWithDefaults(template, request.variables);

        // Process files
        const processedFiles: TemplateFile[] = [];
        const excludeSet = new Set(request.customizations?.excludeFiles || []);

        for (const file of template.files) {
            if (excludeSet.has(file.path)) continue;

            const processedFile = this.processFile(file, variables);
            processedFiles.push(processedFile);
        }

        // Add additional files
        if (request.customizations?.additionalFiles) {
            for (const file of request.customizations.additionalFiles) {
                const processedFile = this.processFile(file, variables);
                processedFiles.push(processedFile);
            }
        }

        // Merge dependencies
        const dependencies = {
            ...template.dependencies,
            ...request.customizations?.additionalDependencies,
        };

        // Generate setup instructions
        const setupInstructions = this.generateSetupInstructions(template, request);

        return {
            success: true,
            files: processedFiles,
            dependencies,
            devDependencies: template.devDependencies,
            setupInstructions,
        };
    }

    /**
     * Validate that all required variables are provided
     */
    private validateVariables(
        template: Template,
        provided: Record<string, string | boolean | number | string[]>
    ): string[] {
        const errors: string[] = [];

        for (const variable of template.variables) {
            if (variable.required && !(variable.name in provided)) {
                errors.push(`Missing required variable: ${variable.name}`);
                continue;
            }

            const value = provided[variable.name];
            if (value === undefined) continue;

            // Type validation
            if (variable.type === 'string' && typeof value !== 'string') {
                errors.push(`Variable ${variable.name} must be a string`);
            }
            if (variable.type === 'number' && typeof value !== 'number') {
                errors.push(`Variable ${variable.name} must be a number`);
            }
            if (variable.type === 'boolean' && typeof value !== 'boolean') {
                errors.push(`Variable ${variable.name} must be a boolean`);
            }

            // Pattern validation
            if (variable.validation?.pattern && typeof value === 'string') {
                const regex = new RegExp(variable.validation.pattern);
                if (!regex.test(value)) {
                    errors.push(`Variable ${variable.name} must match pattern: ${variable.validation.pattern}`);
                }
            }

            // Length validation
            if (typeof value === 'string') {
                if (variable.validation?.minLength && value.length < variable.validation.minLength) {
                    errors.push(`Variable ${variable.name} must be at least ${variable.validation.minLength} characters`);
                }
                if (variable.validation?.maxLength && value.length > variable.validation.maxLength) {
                    errors.push(`Variable ${variable.name} must be at most ${variable.validation.maxLength} characters`);
                }
            }

            // Range validation
            if (typeof value === 'number') {
                if (variable.validation?.min !== undefined && value < variable.validation.min) {
                    errors.push(`Variable ${variable.name} must be at least ${variable.validation.min}`);
                }
                if (variable.validation?.max !== undefined && value > variable.validation.max) {
                    errors.push(`Variable ${variable.name} must be at most ${variable.validation.max}`);
                }
            }

            // Select validation
            if (variable.type === 'select' && variable.options) {
                if (!variable.options.includes(value as string)) {
                    errors.push(`Variable ${variable.name} must be one of: ${variable.options.join(', ')}`);
                }
            }
        }

        return errors;
    }

    /**
     * Merge provided variables with defaults
     */
    private mergeWithDefaults(
        template: Template,
        provided: Record<string, string | boolean | number | string[]>
    ): Record<string, string | boolean | number | string[]> {
        const merged: Record<string, string | boolean | number | string[]> = {};

        for (const variable of template.variables) {
            if (variable.name in provided) {
                merged[variable.name] = provided[variable.name];
            } else if (variable.default !== undefined) {
                merged[variable.name] = variable.default;
            }
        }

        return merged;
    }

    /**
     * Process a single file, replacing template variables
     */
    private processFile(
        file: TemplateFile,
        variables: Record<string, string | boolean | number | string[]>
    ): TemplateFile {
        if (!file.isTemplate) {
            return { ...file };
        }

        let content = file.content;
        let path = file.path;

        // Replace {{variable}} placeholders
        for (const [name, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
            const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
            content = content.replace(placeholder, stringValue);
            path = path.replace(placeholder, stringValue);
        }

        return {
            ...file,
            path,
            content,
            size: content.length,
        };
    }

    /**
     * Generate setup instructions for the project
     */
    private generateSetupInstructions(
        template: Template,
        request: TemplateInstantiationRequest
    ): string[] {
        const instructions: string[] = [];
        const projectName = request.variables.projectName || request.projectName;

        instructions.push(`# Setup Instructions for ${projectName}`);
        instructions.push('');
        instructions.push('## 1. Install Dependencies');
        instructions.push('```bash');
        instructions.push('npm install');
        instructions.push('```');
        instructions.push('');

        if (template.database) {
            instructions.push('## 2. Database Setup');
            instructions.push('');
            instructions.push('Create a `.env` file with your database connection:');
            instructions.push('```');
            instructions.push(`DATABASE_URL=your_${template.database}_connection_string`);
            instructions.push('```');
            instructions.push('');

            if (template.devDependencies['drizzle-kit']) {
                instructions.push('Run database migrations:');
                instructions.push('```bash');
                instructions.push('npm run db:push');
                instructions.push('```');
                instructions.push('');
            }
        }

        if (template.auth) {
            instructions.push(`## ${template.database ? '3' : '2'}. Authentication Setup`);
            instructions.push('');
            instructions.push(`This template uses ${template.auth} for authentication.`);
            instructions.push('Add the following to your `.env`:');
            instructions.push('```');
            
            if (template.auth === 'better-auth') {
                instructions.push('BETTER_AUTH_SECRET=generate_a_secure_secret');
                instructions.push('BETTER_AUTH_URL=http://localhost:3000');
            } else if (template.auth === 'clerk') {
                instructions.push('CLERK_SECRET_KEY=your_clerk_secret');
                instructions.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable');
            }
            
            instructions.push('```');
            instructions.push('');
        }

        instructions.push(`## ${template.database ? (template.auth ? '4' : '3') : (template.auth ? '3' : '2')}. Start Development Server`);
        instructions.push('```bash');
        instructions.push('npm run dev');
        instructions.push('```');
        instructions.push('');
        instructions.push(`Your application will be available at http://localhost:${template.framework === 'nextjs' ? '3000' : template.framework === 'express' ? '3000' : '5173'}`);

        return instructions;
    }

    /**
     * Quick instantiate with just project name
     */
    async quickInstantiate(templateId: string, projectName: string): Promise<TemplateInstantiationResult> {
        return this.instantiate({
            templateId,
            projectName,
            variables: { projectName },
        });
    }
}

// Singleton instance
let instance: TemplateInstantiator | null = null;

export function getTemplateInstantiator(): TemplateInstantiator {
    if (!instance) {
        instance = new TemplateInstantiator();
    }
    return instance;
}


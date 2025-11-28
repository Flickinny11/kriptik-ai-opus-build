/**
 * Intent Analyzer Service
 *
 * Analyzes chat history from other AI builders to extract user intent,
 * including core purpose, features requested, design preferences, and
 * frustration points.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type {
    ChatMessage,
    IntentSummary,
    Feature,
    DesignPreference,
    TechnicalRequirement,
    FrustrationPoint,
    ImplementationGap,
} from './types.js';

export class IntentAnalyzer {
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
            systemPrompt: `You are an expert at analyzing conversations between users and AI app builders.
Your task is to extract the user's TRUE INTENT - what they actually wanted to build,
not just what was implemented. Be thorough and don't miss any requested features.`,
        });
    }

    /**
     * Format chat history for AI analysis
     */
    private formatChat(chatHistory: ChatMessage[]): string {
        return chatHistory
            .map(msg => {
                const role = msg.role === 'user' ? 'USER' : 'AI';
                const errorMarker = msg.hasError ? ' [ERROR IN THIS MESSAGE]' : '';
                return `[Message ${msg.messageNumber}]${errorMarker}\n${role}: ${msg.content}`;
            })
            .join('\n\n---\n\n');
    }

    /**
     * Analyze chat history to extract user intent
     */
    async analyzeIntent(chatHistory: ChatMessage[]): Promise<IntentSummary> {
        const formattedChat = this.formatChat(chatHistory);

        const prompt = `Analyze this conversation between a user and an AI app builder.
Read EVERY message carefully - don't miss any feature requests, even small ones mentioned in passing.

CONVERSATION:
${formattedChat}

Extract the following information:

1. **CORE PURPOSE**: What is the main goal/purpose of this application?
   Summarize in 1-2 sentences what the user is trying to build.

2. **PRIMARY FEATURES**: What MUST this app do? List every feature the user explicitly requested.
   Include the message number where each feature was first mentioned.

3. **SECONDARY FEATURES**: What "nice to have" features were mentioned?
   These are features that were suggested but not emphasized.

4. **DESIGN PREFERENCES**: What styling/UI preferences did the user express?
   - Theme preference (dark/light)
   - Color preferences
   - Style preferences (modern, minimal, corporate, playful, etc.)
   - Any specific design mentions

5. **TECHNICAL REQUIREMENTS**: What specific tech/integrations were mentioned?
   - APIs to integrate (Stripe, OpenAI, etc.)
   - Database requirements
   - Authentication needs
   - Third-party services

6. **FRUSTRATION POINTS**: Where did the user express frustration?
   - What issues caused frustration?
   - What did the user complain about?
   - What features were requested multiple times (indicating they weren't implemented)?

Return your analysis as JSON:
{
    "corePurpose": "string describing the main goal",
    "primaryFeatures": [
        {
            "name": "feature name",
            "description": "what this feature should do",
            "mentionedAtMessage": 1,
            "userQuote": "exact quote where user requested this"
        }
    ],
    "secondaryFeatures": [
        {
            "name": "feature name",
            "description": "what this feature should do",
            "mentionedAtMessage": 5,
            "userQuote": "exact quote"
        }
    ],
    "designPreferences": {
        "theme": "dark" | "light" | "custom",
        "colors": ["list of mentioned colors"],
        "style": "overall style description",
        "mentions": ["specific design mentions from user"]
    },
    "technicalRequirements": [
        {
            "requirement": "what is needed",
            "context": "why it's needed",
            "messageNumber": 3
        }
    ],
    "frustrationPoints": [
        {
            "messageNumber": 15,
            "issue": "what was the problem",
            "userQuote": "exact quote showing frustration",
            "severity": "minor" | "moderate" | "major"
        }
    ]
}

Be thorough. Missing a feature request could mean the fixed app is still incomplete.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5, // Use Opus for critical intent analysis
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 20000,
            effort: 'high',
        });

        // Parse response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse intent analysis response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Transform to typed structure
        const intentSummary: IntentSummary = {
            corePurpose: parsed.corePurpose,
            primaryFeatures: (parsed.primaryFeatures || []).map((f: any) => ({
                id: uuidv4(),
                name: f.name,
                description: f.description,
                mentionedAtMessage: f.mentionedAtMessage,
                importance: 'primary' as const,
                status: 'missing' as const, // Will be updated during gap analysis
                userQuote: f.userQuote,
            })),
            secondaryFeatures: (parsed.secondaryFeatures || []).map((f: any) => ({
                id: uuidv4(),
                name: f.name,
                description: f.description,
                mentionedAtMessage: f.mentionedAtMessage,
                importance: 'secondary' as const,
                status: 'missing' as const,
                userQuote: f.userQuote,
            })),
            designPreferences: {
                theme: parsed.designPreferences?.theme || 'dark',
                colors: parsed.designPreferences?.colors || [],
                style: parsed.designPreferences?.style || 'modern',
                mentions: parsed.designPreferences?.mentions || [],
            },
            technicalRequirements: (parsed.technicalRequirements || []).map((r: any) => ({
                requirement: r.requirement,
                context: r.context,
                messageNumber: r.messageNumber,
            })),
            frustrationPoints: (parsed.frustrationPoints || []).map((f: any) => ({
                messageNumber: f.messageNumber,
                issue: f.issue,
                userQuote: f.userQuote,
                severity: f.severity || 'moderate',
            })),
            extractedAt: new Date(),
        };

        return intentSummary;
    }

    /**
     * Compare extracted intent to actual implementation
     */
    async analyzeImplementationGaps(
        intent: IntentSummary,
        files: Map<string, string>
    ): Promise<ImplementationGap[]> {
        const allFeatures = [...intent.primaryFeatures, ...intent.secondaryFeatures];
        const fileList = Array.from(files.entries())
            .map(([path, content]) => `=== ${path} ===\n${content.substring(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}`)
            .join('\n\n');

        const prompt = `Analyze the implementation status of each requested feature.

INTENDED FEATURES:
${allFeatures.map(f => `- ${f.name}: ${f.description}`).join('\n')}

TECHNICAL REQUIREMENTS:
${intent.technicalRequirements.map(r => `- ${r.requirement}: ${r.context}`).join('\n')}

CURRENT CODE:
${fileList}

For each feature, determine:
1. Is it IMPLEMENTED (fully working)?
2. Is it PARTIAL (some code exists but incomplete)?
3. Is it BROKEN (implemented but not working)?
4. Is it MISSING (no implementation at all)?
5. Is it INCORRECT (implemented differently than requested)?

Return JSON array:
[
    {
        "featureName": "feature name",
        "status": "implemented" | "partial" | "broken" | "missing" | "incorrect",
        "severity": "critical" | "major" | "minor",
        "details": "explanation of what's wrong or missing",
        "suggestedFix": "how to fix this",
        "affectedFiles": ["list of files involved"]
    }
]

Be thorough - check every feature and requirement.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to parse implementation gap analysis');
        }

        const gaps: ImplementationGap[] = JSON.parse(jsonMatch[0]).map((g: any) => ({
            featureId: uuidv4(),
            featureName: g.featureName,
            status: g.status,
            severity: g.severity,
            details: g.details,
            suggestedFix: g.suggestedFix,
            affectedFiles: g.affectedFiles || [],
        }));

        // Update feature statuses based on gap analysis
        for (const gap of gaps) {
            const feature = allFeatures.find(f => f.name.toLowerCase() === gap.featureName.toLowerCase());
            if (feature) {
                feature.status = gap.status as Feature['status'];
            }
        }

        // Return all gaps (they are already things that need fixing)
        return gaps;
    }

    /**
     * Extract features that were requested multiple times (indicating they weren't implemented)
     */
    async findRepeatedRequests(chatHistory: ChatMessage[]): Promise<Feature[]> {
        const formattedChat = this.formatChat(chatHistory);

        const prompt = `Analyze this conversation to find features that were requested MULTIPLE TIMES.

When a user requests the same thing more than once, it usually means:
1. It wasn't implemented the first time
2. It was implemented incorrectly
3. The AI forgot about it

CONVERSATION:
${formattedChat}

Find all features/changes that were:
- Requested more than once
- Mentioned with phrases like "I already asked for this" or "this still isn't working"
- Requested with increasing frustration

Return JSON:
{
    "repeatedRequests": [
        {
            "feature": "feature name",
            "firstMention": 5,
            "subsequentMentions": [12, 18, 25],
            "userFrustration": "quote showing frustration",
            "likelyReason": "why it wasn't implemented"
        }
    ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.repeatedRequests || []).map((r: any) => ({
            id: uuidv4(),
            name: r.feature,
            description: `Requested ${r.subsequentMentions.length + 1} times but not implemented. ${r.likelyReason}`,
            mentionedAtMessage: r.firstMention,
            importance: 'primary' as const,
            status: 'missing' as const,
            userQuote: r.userFrustration,
        }));
    }
}

export function createIntentAnalyzer(userId: string, projectId: string): IntentAnalyzer {
    return new IntentAnalyzer(userId, projectId);
}


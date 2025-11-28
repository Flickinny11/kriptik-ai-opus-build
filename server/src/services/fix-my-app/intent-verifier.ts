/**
 * Intent Verifier Service
 *
 * Final verification against original user intent.
 * Ensures all requested features are implemented and working.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { VisualVerificationService, createVisualVerificationService } from '../automation/visual-verifier.js';
import type {
    ChatMessage,
    IntentSummary,
    Feature,
    FrustrationPoint,
    IntentVerificationReport,
    FeatureVerification,
    MissedItem,
    FinalScanResult,
    FrustrationResolution,
    VisualVerification,
} from './types.js';

export class IntentVerifier {
    private claudeService: ReturnType<typeof createClaudeService>;
    private visualVerifier: VisualVerificationService;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'testing',
            projectId,
            userId,
            systemPrompt: `You are a meticulous QA engineer verifying that an application meets all user requirements.
Your job is to ensure NOTHING was missed and all features work as intended.
Be thorough - check every detail.`,
        });
        this.visualVerifier = createVisualVerificationService();
    }

    /**
     * Perform complete intent verification
     */
    async verifyAgainstIntent(
        fixedFiles: Map<string, string>,
        originalChatHistory: ChatMessage[],
        intentSummary: IntentSummary,
        screenshot?: string,
        originalScreenshot?: string
    ): Promise<IntentVerificationReport> {
        // Step 1: Verify each feature
        const allFeatures = [...intentSummary.primaryFeatures, ...intentSummary.secondaryFeatures];
        const featureVerifications = await this.verifyFeatures(allFeatures, fixedFiles);

        // Step 2: Scan for missed requests
        const missedRequests = await this.scanForMissedRequests(
            originalChatHistory,
            featureVerifications
        );

        // Step 3: Visual verification (if screenshot provided)
        const visualVerification = screenshot
            ? await this.performVisualVerification(screenshot, originalScreenshot, intentSummary)
            : this.createDefaultVisualVerification();

        // Step 4: Verify frustration points resolved
        const frustrationResolutions = await this.verifyFrustrationPointsResolved(
            intentSummary.frustrationPoints,
            fixedFiles
        );

        // Step 5: Final scan
        const finalScan = await this.performFinalChatScan(originalChatHistory);

        // Calculate overall score
        const featureScore = featureVerifications.filter(f => f.working).length / featureVerifications.length;
        const missedScore = missedRequests.length === 0 ? 1 : Math.max(0, 1 - missedRequests.length * 0.1);
        const frustrationScore = frustrationResolutions.filter(f => f.resolved).length /
                                 Math.max(1, frustrationResolutions.length);
        const visualScore = visualVerification.designScore / 100;

        const overallScore = Math.round((featureScore * 0.4 + missedScore * 0.2 + frustrationScore * 0.2 + visualScore * 0.2) * 100);

        // Determine if passed
        const passed =
            featureVerifications.every(f => f.implemented) &&
            missedRequests.filter(m => m.importance === 'critical').length === 0 &&
            frustrationResolutions.every(f => f.resolved) &&
            finalScan.nothingMissed;

        // Generate summary
        const summary = this.generateSummary(
            passed,
            overallScore,
            featureVerifications,
            missedRequests,
            frustrationResolutions
        );

        return {
            passed,
            overallScore,
            featureVerifications,
            missedRequests,
            visualVerification,
            frustrationResolutions,
            finalScan,
            summary,
        };
    }

    /**
     * Verify each feature is implemented and working
     */
    private async verifyFeatures(
        features: Feature[],
        files: Map<string, string>
    ): Promise<FeatureVerification[]> {
        const fileList = Array.from(files.entries())
            .map(([path, content]) => `=== ${path} ===\n${content.substring(0, 3000)}`)
            .join('\n\n');

        const verifications: FeatureVerification[] = [];

        for (const feature of features) {
            const verification = await this.verifyFeature(feature, fileList);
            verifications.push(verification);
        }

        return verifications;
    }

    /**
     * Verify a single feature
     */
    private async verifyFeature(
        feature: Feature,
        fileList: string
    ): Promise<FeatureVerification> {
        const prompt = `Verify if this feature is implemented and working.

FEATURE: ${feature.name}
DESCRIPTION: ${feature.description}
USER'S ORIGINAL REQUEST: "${feature.userQuote || 'N/A'}"

CODE FILES:
${fileList}

Check:
1. Is the feature implemented (code exists)?
2. Does the implementation look complete?
3. Are there any obvious issues?
4. Would this feature work in production?

Return JSON:
{
    "implemented": true/false,
    "working": true/false,
    "testResults": ["what you checked"],
    "issues": ["any problems found"]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 6000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                featureId: feature.id,
                featureName: feature.name,
                implemented: false,
                working: false,
                testResults: ['Verification failed'],
                issues: ['Could not verify feature'],
            };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            featureId: feature.id,
            featureName: feature.name,
            implemented: result.implemented,
            working: result.working,
            testResults: result.testResults || [],
            issues: result.issues || [],
        };
    }

    /**
     * Scan chat history for any missed requests
     */
    private async scanForMissedRequests(
        chatHistory: ChatMessage[],
        verifications: FeatureVerification[]
    ): Promise<MissedItem[]> {
        const implementedFeatures = verifications
            .filter(v => v.implemented)
            .map(v => v.featureName);

        const formattedChat = chatHistory
            .filter(m => m.role === 'user')
            .map(m => `[${m.messageNumber}] ${m.content}`)
            .join('\n\n');

        const prompt = `Scan this conversation for ANY user requests that might have been missed.

USER MESSAGES:
${formattedChat}

FEATURES ALREADY IMPLEMENTED:
${implementedFeatures.map(f => `- ${f}`).join('\n')}

Look for:
- Small features mentioned in passing
- Design tweaks requested
- Bug fixes that were asked for
- Specific text or content requests
- Integration details
- Edge cases mentioned
- "Can you also..." requests
- "I want..." statements

Return JSON:
{
    "missedItems": [
        {
            "quote": "exact quote from user",
            "context": "what they were asking for",
            "importance": "critical" | "medium" | "low"
        }
    ]
}

Only include items that are NOT in the implemented features list.
If nothing was missed, return {"missedItems": []}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5, // Use Opus for thorough scanning
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 12000,
            effort: 'high',
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return [];
        }

        const result = JSON.parse(jsonMatch[0]);
        return (result.missedItems || []).map((item: any) => ({
            ...item,
            implemented: false,
        }));
    }

    /**
     * Perform visual verification
     */
    private async performVisualVerification(
        screenshot: string,
        originalScreenshot: string | undefined,
        intent: IntentSummary
    ): Promise<VisualVerification> {
        try {
            const result = await this.visualVerifier.verifyPage(screenshot, `
App should match user's design preferences:
- Theme: ${intent.designPreferences.theme}
- Style: ${intent.designPreferences.style}
- Colors: ${intent.designPreferences.colors.join(', ')}
${intent.designPreferences.mentions.map(m => `- ${m}`).join('\n')}
`);

            return {
                matches: result.passed,
                designScore: result.designScore,
                differences: result.issues.map((i: { description: string }) => i.description),
                screenshots: {
                    original: originalScreenshot,
                    fixed: screenshot,
                },
            };
        } catch (error) {
            return this.createDefaultVisualVerification();
        }
    }

    /**
     * Create default visual verification when no screenshot
     */
    private createDefaultVisualVerification(): VisualVerification {
        return {
            matches: true,
            designScore: 70,
            differences: [],
            screenshots: {
                fixed: '',
            },
        };
    }

    /**
     * Verify frustration points are resolved
     */
    private async verifyFrustrationPointsResolved(
        frustrationPoints: FrustrationPoint[],
        files: Map<string, string>
    ): Promise<FrustrationResolution[]> {
        if (frustrationPoints.length === 0) {
            return [];
        }

        const fileList = Array.from(files.entries())
            .map(([path, content]) => `=== ${path} ===\n${content.substring(0, 1500)}`)
            .join('\n\n');

        const prompt = `Verify if these user frustrations have been resolved.

FRUSTRATION POINTS:
${frustrationPoints.map(f => `- [Message ${f.messageNumber}] "${f.userQuote}": ${f.issue}`).join('\n')}

CODE:
${fileList}

For each frustration, determine if it's been resolved.

Return JSON:
{
    "resolutions": [
        {
            "issue": "the issue",
            "resolved": true/false,
            "resolution": "how it was resolved (or why not)"
        }
    ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 6000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return frustrationPoints.map(f => ({
                pointId: uuidv4(),
                issue: f.issue,
                resolved: false,
                resolution: 'Could not verify',
            }));
        }

        const result = JSON.parse(jsonMatch[0]);
        return (result.resolutions || []).map((r: any, i: number) => ({
            pointId: uuidv4(),
            issue: frustrationPoints[i]?.issue || r.issue,
            resolved: r.resolved,
            resolution: r.resolution,
        }));
    }

    /**
     * Final comprehensive chat scan
     */
    private async performFinalChatScan(chatHistory: ChatMessage[]): Promise<FinalScanResult> {
        const userMessages = chatHistory
            .filter(m => m.role === 'user')
            .map(m => `[${m.messageNumber}] ${m.content}`)
            .join('\n\n');

        const prompt = `You are doing a FINAL verification scan.

Read this ENTIRE conversation VERY carefully.

USER MESSAGES:
${userMessages}

Look for ANYTHING that might have been missed:
- Small features mentioned in passing
- Design tweaks requested
- Bug fixes asked for
- Specific text/content requests
- Integration details mentioned
- Edge cases discussed
- Anything the user asked for

Return JSON:
{
    "missedItems": [
        {
            "quote": "exact user quote",
            "context": "what they wanted",
            "importance": "critical" | "medium" | "low"
        }
    ],
    "nothingMissed": true | false
}

If you find NOTHING that might have been missed, return:
{"missedItems": [], "nothingMissed": true}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { missedItems: [], nothingMissed: true };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            missedItems: (result.missedItems || []).map((m: any) => ({
                ...m,
                implemented: false,
            })),
            nothingMissed: result.nothingMissed ?? (result.missedItems || []).length === 0,
        };
    }

    /**
     * Generate human-readable summary
     */
    private generateSummary(
        passed: boolean,
        score: number,
        featureVerifications: FeatureVerification[],
        missedRequests: MissedItem[],
        frustrationResolutions: FrustrationResolution[]
    ): string {
        const totalFeatures = featureVerifications.length;
        const workingFeatures = featureVerifications.filter(f => f.working).length;
        const resolvedFrustrations = frustrationResolutions.filter(f => f.resolved).length;
        const totalFrustrations = frustrationResolutions.length;

        let summary = `## Verification ${passed ? 'PASSED ✓' : 'NEEDS ATTENTION'}\n\n`;
        summary += `**Overall Score: ${score}%**\n\n`;

        summary += `### Features\n`;
        summary += `${workingFeatures}/${totalFeatures} features verified working\n\n`;

        if (featureVerifications.some(f => !f.working)) {
            summary += `**Issues:**\n`;
            for (const f of featureVerifications.filter(f => !f.working)) {
                summary += `- ${f.featureName}: ${f.issues.join(', ')}\n`;
            }
            summary += '\n';
        }

        if (missedRequests.length > 0) {
            summary += `### Potentially Missed\n`;
            for (const m of missedRequests) {
                summary += `- [${m.importance}] "${m.quote}"\n`;
            }
            summary += '\n';
        }

        if (totalFrustrations > 0) {
            summary += `### Frustration Points\n`;
            summary += `${resolvedFrustrations}/${totalFrustrations} resolved\n\n`;
        }

        return summary;
    }
}

export function createIntentVerifier(userId: string, projectId: string): IntentVerifier {
    return new IntentVerifier(userId, projectId);
}


/**
 * Market Fit Oracle Service
 *
 * AI-powered competitor analysis and market positioning system.
 * Analyzes competitors, identifies market gaps, and suggests differentiation strategies.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BrowserAutomationService, createBrowserAutomationService } from '../automation/browser-service.js';
import { createOpenRouterClient, getPhaseConfig } from '../ai/openrouter-client.js';

// =============================================================================
// TYPES
// =============================================================================

export interface Feature {
    id: string;
    name: string;
    description: string;
    category: string;
    importance: number; // 1-10
    implementationComplexity: 'low' | 'medium' | 'high';
}

export interface PricingTier {
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly' | 'one-time';
    features: string[];
    targetAudience?: string;
}

export interface DesignPattern {
    id: string;
    name: string;
    category: 'layout' | 'navigation' | 'interaction' | 'visual' | 'content';
    description: string;
    screenshot?: string;
}

export interface ReviewSummary {
    averageRating: number;
    totalReviews: number;
    positiveThemes: string[];
    negativeThemes: string[];
    commonComplaints: string[];
    commonPraises: string[];
}

export interface MarketPosition {
    segment: 'enterprise' | 'mid-market' | 'smb' | 'consumer';
    pricePoint: 'premium' | 'mid-tier' | 'budget' | 'freemium';
    primaryDifferentiator: string;
    targetPersona: string;
}

export interface CompetitorProfile {
    id: string;
    name: string;
    url: string;
    description: string;
    tagline?: string;
    features: Feature[];
    pricing: PricingTier[];
    designPatterns: DesignPattern[];
    userReviews: ReviewSummary;
    marketPosition: MarketPosition;
    strengths: string[];
    weaknesses: string[];
    techStack?: string[];
    lastAnalyzed: Date;
    screenshot?: string;
}

export interface MarketGap {
    id: string;
    category: string;
    title: string;
    description: string;
    competitorCoverage: Array<{
        competitor: string;
        competitorId: string;
        coverage: 'none' | 'partial' | 'full';
    }>;
    opportunityScore: number; // 0-100
    implementationEffort: 'low' | 'medium' | 'high';
    estimatedImpact: 'low' | 'medium' | 'high';
    suggestedApproach?: string;
}

export interface Opportunity {
    id: string;
    type: 'feature' | 'pricing' | 'positioning' | 'design' | 'integration';
    title: string;
    description: string;
    potentialValue: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    timeToImplement: string; // e.g., "2 weeks"
    competitiveAdvantage: string;
    actionItems: string[];
}

export interface Differentiator {
    id: string;
    aspect: string;
    currentState: string;
    recommendedAction: string;
    impactArea: 'acquisition' | 'retention' | 'monetization' | 'brand';
    priority: number; // 1-10
}

export interface SuggestedFeature {
    id: string;
    name: string;
    description: string;
    rationale: string;
    competitorInspiration?: string;
    effort: 'low' | 'medium' | 'high';
    potentialImpact: 'low' | 'medium' | 'high';
    implementationNotes: string;
}

export interface PositioningRecommendation {
    currentPosition: string;
    recommendedPosition: string;
    valueProposition: string;
    targetAudience: string;
    keyMessages: string[];
    competitiveAdvantages: string[];
    pricingStrategy: string;
}

export interface MarketAnalysis {
    id: string;
    projectId: string;
    targetMarket: string;
    appDescription: string;
    competitors: CompetitorProfile[];
    gaps: MarketGap[];
    opportunities: Opportunity[];
    differentiators: Differentiator[];
    suggestedFeatures: SuggestedFeature[];
    positioning: PositioningRecommendation;
    createdAt: Date;
    updatedAt: Date;
}

export interface AnalysisProgress {
    phase: 'discovering' | 'analyzing' | 'comparing' | 'generating' | 'complete';
    currentStep: string;
    progress: number; // 0-100
    competitorsFound: number;
    competitorsAnalyzed: number;
}

// =============================================================================
// PROMPTS
// =============================================================================

const COMPETITOR_DISCOVERY_PROMPT = `You are a market research expert. Given a product description and target market, identify the top competitors.

Product Description: {appDescription}
Target Market: {targetMarket}

List 5-8 direct competitors with:
1. Company/product name
2. Website URL
3. Brief description (1-2 sentences)
4. Market segment they target

Respond in JSON format:
{
  "competitors": [
    {
      "name": "Competitor Name",
      "url": "https://example.com",
      "description": "Brief description",
      "segment": "enterprise/mid-market/smb/consumer"
    }
  ]
}`;

const COMPETITOR_ANALYSIS_PROMPT = `You are a competitive intelligence analyst. Analyze this competitor for a {targetMarket} product.

Competitor: {competitorName}
URL: {competitorUrl}
Page Content Summary: {pageContent}
Screenshot available: {hasScreenshot}

Extract and analyze:
1. Key features (list each with importance 1-10 and complexity low/med/high)
2. Pricing tiers (if visible)
3. Design patterns used
4. Value proposition
5. Target audience
6. Strengths and weaknesses

Respond in JSON format:
{
  "description": "Detailed description of what they do",
  "tagline": "Their main tagline if visible",
  "features": [
    {
      "name": "Feature Name",
      "description": "Description",
      "category": "Category",
      "importance": 8,
      "implementationComplexity": "medium"
    }
  ],
  "pricing": [
    {
      "name": "Tier Name",
      "price": 29,
      "billingCycle": "monthly",
      "features": ["Feature 1", "Feature 2"],
      "targetAudience": "Small teams"
    }
  ],
  "designPatterns": [
    {
      "name": "Pattern Name",
      "category": "layout",
      "description": "Description"
    }
  ],
  "marketPosition": {
    "segment": "smb",
    "pricePoint": "mid-tier",
    "primaryDifferentiator": "Main differentiator",
    "targetPersona": "Target user persona"
  },
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "techStack": ["React", "Node.js"]
}`;

const GAP_ANALYSIS_PROMPT = `You are a strategic product advisor. Analyze market gaps and opportunities.

Our Product: {appDescription}
Target Market: {targetMarket}

Competitors Analyzed:
{competitorSummaries}

Identify:
1. Feature gaps - what we could build that competitors don't have or do poorly
2. Market opportunities - underserved needs in the market
3. Differentiation strategies - how to stand out
4. Quick wins - features that take <2 weeks to implement with high impact

Prioritize by opportunity score (0-100) based on:
- Market demand
- Implementation feasibility
- Competitive advantage potential

Respond in JSON format:
{
  "gaps": [
    {
      "category": "Category",
      "title": "Gap Title",
      "description": "Description",
      "competitorCoverage": [
        { "competitor": "Name", "coverage": "none/partial/full" }
      ],
      "opportunityScore": 85,
      "implementationEffort": "low/medium/high",
      "estimatedImpact": "low/medium/high",
      "suggestedApproach": "How to address this gap"
    }
  ],
  "opportunities": [
    {
      "type": "feature/pricing/positioning/design/integration",
      "title": "Opportunity Title",
      "description": "Description",
      "potentialValue": "high",
      "effort": "medium",
      "timeToImplement": "2 weeks",
      "competitiveAdvantage": "Why this matters",
      "actionItems": ["Action 1", "Action 2"]
    }
  ],
  "differentiators": [
    {
      "aspect": "Aspect to differentiate",
      "currentState": "Current state",
      "recommendedAction": "What to do",
      "impactArea": "acquisition/retention/monetization/brand",
      "priority": 9
    }
  ],
  "suggestedFeatures": [
    {
      "name": "Feature Name",
      "description": "Description",
      "rationale": "Why build this",
      "competitorInspiration": "Inspired by X's approach but better",
      "effort": "low",
      "potentialImpact": "high",
      "implementationNotes": "Implementation hints"
    }
  ],
  "positioning": {
    "currentPosition": "Where you currently stand",
    "recommendedPosition": "Where you should position",
    "valueProposition": "Your unique value prop",
    "targetAudience": "Who to target",
    "keyMessages": ["Message 1", "Message 2"],
    "competitiveAdvantages": ["Advantage 1", "Advantage 2"],
    "pricingStrategy": "Recommended pricing approach"
  }
}`;

// =============================================================================
// SERVICE
// =============================================================================

export class MarketFitOracleService extends EventEmitter {
    private analyses: Map<string, MarketAnalysis> = new Map();
    private openRouterClient = createOpenRouterClient();
    private browserService: BrowserAutomationService | null = null;

    constructor() {
        super();
    }

    /**
     * Start a full market analysis for a project
     */
    async analyzeMarket(config: {
        projectId: string;
        targetMarket: string;
        appDescription: string;
        existingCompetitorUrls?: string[];
    }): Promise<MarketAnalysis> {
        const analysisId = uuidv4();

        // Emit start
        this.emitProgress(analysisId, {
            phase: 'discovering',
            currentStep: 'Discovering competitors...',
            progress: 0,
            competitorsFound: 0,
            competitorsAnalyzed: 0,
        });

        try {
            // Step 1: Discover competitors
            let competitors: Array<{ name: string; url: string; description: string; segment: string }> = [];

            if (config.existingCompetitorUrls && config.existingCompetitorUrls.length > 0) {
                // Use provided URLs
                competitors = config.existingCompetitorUrls.map((url, i) => ({
                    name: `Competitor ${i + 1}`,
                    url,
                    description: 'Manually added competitor',
                    segment: 'unknown',
                }));
            } else {
                // Discover via AI
                competitors = await this.discoverCompetitors(config.targetMarket, config.appDescription);
            }

            this.emitProgress(analysisId, {
                phase: 'analyzing',
                currentStep: `Found ${competitors.length} competitors. Starting analysis...`,
                progress: 20,
                competitorsFound: competitors.length,
                competitorsAnalyzed: 0,
            });

            // Step 2: Analyze each competitor
            const competitorProfiles: CompetitorProfile[] = [];

            for (let i = 0; i < competitors.length; i++) {
                const competitor = competitors[i];

                this.emitProgress(analysisId, {
                    phase: 'analyzing',
                    currentStep: `Analyzing ${competitor.name}...`,
                    progress: 20 + Math.round((i / competitors.length) * 40),
                    competitorsFound: competitors.length,
                    competitorsAnalyzed: i,
                });

                try {
                    const profile = await this.analyzeCompetitor(competitor, config.targetMarket);
                    competitorProfiles.push(profile);
                } catch (error) {
                    console.error(`Failed to analyze ${competitor.name}:`, error);
                    // Create minimal profile on failure
                    competitorProfiles.push({
                        id: uuidv4(),
                        name: competitor.name,
                        url: competitor.url,
                        description: competitor.description,
                        features: [],
                        pricing: [],
                        designPatterns: [],
                        userReviews: {
                            averageRating: 0,
                            totalReviews: 0,
                            positiveThemes: [],
                            negativeThemes: [],
                            commonComplaints: [],
                            commonPraises: [],
                        },
                        marketPosition: {
                            segment: competitor.segment as MarketPosition['segment'] || 'smb',
                            pricePoint: 'mid-tier',
                            primaryDifferentiator: 'Unknown',
                            targetPersona: 'Unknown',
                        },
                        strengths: [],
                        weaknesses: [],
                        lastAnalyzed: new Date(),
                    });
                }
            }

            this.emitProgress(analysisId, {
                phase: 'comparing',
                currentStep: 'Analyzing market gaps...',
                progress: 65,
                competitorsFound: competitors.length,
                competitorsAnalyzed: competitorProfiles.length,
            });

            // Step 3: Generate gap analysis and opportunities
            const gapAnalysis = await this.generateGapAnalysis(
                config.appDescription,
                config.targetMarket,
                competitorProfiles
            );

            this.emitProgress(analysisId, {
                phase: 'generating',
                currentStep: 'Generating recommendations...',
                progress: 85,
                competitorsFound: competitors.length,
                competitorsAnalyzed: competitorProfiles.length,
            });

            // Step 4: Build final analysis
            const analysis: MarketAnalysis = {
                id: analysisId,
                projectId: config.projectId,
                targetMarket: config.targetMarket,
                appDescription: config.appDescription,
                competitors: competitorProfiles,
                gaps: gapAnalysis.gaps,
                opportunities: gapAnalysis.opportunities,
                differentiators: gapAnalysis.differentiators,
                suggestedFeatures: gapAnalysis.suggestedFeatures,
                positioning: gapAnalysis.positioning,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            this.analyses.set(config.projectId, analysis);

            this.emitProgress(analysisId, {
                phase: 'complete',
                currentStep: 'Analysis complete!',
                progress: 100,
                competitorsFound: competitors.length,
                competitorsAnalyzed: competitorProfiles.length,
            });

            return analysis;
        } catch (error) {
            console.error('Market analysis failed:', error);
            throw error;
        } finally {
            // Clean up browser if used
            if (this.browserService) {
                await this.browserService.close().catch(() => { });
                this.browserService = null;
            }
        }
    }

    /**
     * Discover competitors using AI
     */
    private async discoverCompetitors(
        targetMarket: string,
        appDescription: string
    ): Promise<Array<{ name: string; url: string; description: string; segment: string }>> {
        const phaseConfig = getPhaseConfig('planning');

        const prompt = COMPETITOR_DISCOVERY_PROMPT
            .replace('{appDescription}', appDescription)
            .replace('{targetMarket}', targetMarket);

        const response = await this.openRouterClient.generate({
            model: phaseConfig.model,
            systemPrompt: 'You are a market research expert. Respond only with valid JSON.',
            userPrompt: prompt,
            maxTokens: phaseConfig.maxTokens,
        });

        try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return data.competitors || [];
            }
        } catch (error) {
            console.error('Failed to parse competitor discovery response:', error);
        }

        return [];
    }

    /**
     * Analyze a single competitor
     */
    private async analyzeCompetitor(
        competitor: { name: string; url: string; description: string; segment: string },
        targetMarket: string
    ): Promise<CompetitorProfile> {
        // Initialize browser if not already
        if (!this.browserService) {
            this.browserService = createBrowserAutomationService({ headed: false });
            await this.browserService.initialize();
        }

        // Navigate to competitor site
        let pageContent = '';
        let screenshot: string | undefined;

        try {
            const navResult = await this.browserService.navigateTo(competitor.url);
            if (navResult.success) {
                screenshot = navResult.screenshot;

                // Extract page content
                const extracted = await this.browserService.extract<{ content: string }>(
                    'Extract all text content from this page including headings, descriptions, features, and pricing information'
                );
                pageContent = extracted.content || '';
            }
        } catch (error) {
            console.warn(`Failed to scrape ${competitor.url}:`, error);
            pageContent = `Unable to access website. Known info: ${competitor.description}`;
        }

        // Analyze with AI
        const phaseConfig = getPhaseConfig('planning');

        const prompt = COMPETITOR_ANALYSIS_PROMPT
            .replace('{targetMarket}', targetMarket)
            .replace('{competitorName}', competitor.name)
            .replace('{competitorUrl}', competitor.url)
            .replace('{pageContent}', pageContent.substring(0, 5000))
            .replace('{hasScreenshot}', screenshot ? 'yes' : 'no');

        const response = await this.openRouterClient.generate({
            model: phaseConfig.model,
            systemPrompt: 'You are a competitive intelligence analyst. Respond only with valid JSON.',
            userPrompt: prompt,
            maxTokens: phaseConfig.maxTokens,
        });

        try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);

                return {
                    id: uuidv4(),
                    name: competitor.name,
                    url: competitor.url,
                    description: data.description || competitor.description,
                    tagline: data.tagline,
                    features: (data.features || []).map((f: any) => ({
                        id: uuidv4(),
                        ...f,
                    })),
                    pricing: data.pricing || [],
                    designPatterns: (data.designPatterns || []).map((d: any) => ({
                        id: uuidv4(),
                        ...d,
                    })),
                    userReviews: data.userReviews || {
                        averageRating: 0,
                        totalReviews: 0,
                        positiveThemes: [],
                        negativeThemes: [],
                        commonComplaints: [],
                        commonPraises: [],
                    },
                    marketPosition: data.marketPosition || {
                        segment: competitor.segment as MarketPosition['segment'] || 'smb',
                        pricePoint: 'mid-tier',
                        primaryDifferentiator: 'Unknown',
                        targetPersona: 'Unknown',
                    },
                    strengths: data.strengths || [],
                    weaknesses: data.weaknesses || [],
                    techStack: data.techStack,
                    screenshot,
                    lastAnalyzed: new Date(),
                };
            }
        } catch (error) {
            console.error('Failed to parse competitor analysis:', error);
        }

        // Return minimal profile on parse failure
        return {
            id: uuidv4(),
            name: competitor.name,
            url: competitor.url,
            description: competitor.description,
            features: [],
            pricing: [],
            designPatterns: [],
            userReviews: {
                averageRating: 0,
                totalReviews: 0,
                positiveThemes: [],
                negativeThemes: [],
                commonComplaints: [],
                commonPraises: [],
            },
            marketPosition: {
                segment: competitor.segment as MarketPosition['segment'] || 'smb',
                pricePoint: 'mid-tier',
                primaryDifferentiator: 'Unknown',
                targetPersona: 'Unknown',
            },
            strengths: [],
            weaknesses: [],
            screenshot,
            lastAnalyzed: new Date(),
        };
    }

    /**
     * Generate gap analysis and opportunities
     */
    private async generateGapAnalysis(
        appDescription: string,
        targetMarket: string,
        competitors: CompetitorProfile[]
    ): Promise<{
        gaps: MarketGap[];
        opportunities: Opportunity[];
        differentiators: Differentiator[];
        suggestedFeatures: SuggestedFeature[];
        positioning: PositioningRecommendation;
    }> {
        const phaseConfig = getPhaseConfig('planning');

        // Build competitor summaries
        const competitorSummaries = competitors.map(c => `
**${c.name}** (${c.url})
- Position: ${c.marketPosition.segment}, ${c.marketPosition.pricePoint}
- Differentiator: ${c.marketPosition.primaryDifferentiator}
- Features: ${c.features.map(f => f.name).join(', ') || 'Unknown'}
- Pricing: ${c.pricing.map(p => `${p.name}: $${p.price}/${p.billingCycle}`).join(', ') || 'Unknown'}
- Strengths: ${c.strengths.join(', ') || 'Unknown'}
- Weaknesses: ${c.weaknesses.join(', ') || 'Unknown'}
`).join('\n');

        const prompt = GAP_ANALYSIS_PROMPT
            .replace('{appDescription}', appDescription)
            .replace('{targetMarket}', targetMarket)
            .replace('{competitorSummaries}', competitorSummaries);

        const response = await this.openRouterClient.generate({
            model: phaseConfig.model,
            systemPrompt: 'You are a strategic product advisor. Respond only with valid JSON.',
            userPrompt: prompt,
            maxTokens: phaseConfig.maxTokens,
            thinkingBudget: phaseConfig.thinkingBudget,
        });

        try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);

                return {
                    gaps: (data.gaps || []).map((g: any) => ({
                        id: uuidv4(),
                        ...g,
                        competitorCoverage: (g.competitorCoverage || []).map((cc: any) => ({
                            ...cc,
                            competitorId: competitors.find(c => c.name === cc.competitor)?.id || '',
                        })),
                    })),
                    opportunities: (data.opportunities || []).map((o: any) => ({
                        id: uuidv4(),
                        ...o,
                    })),
                    differentiators: (data.differentiators || []).map((d: any) => ({
                        id: uuidv4(),
                        ...d,
                    })),
                    suggestedFeatures: (data.suggestedFeatures || []).map((f: any) => ({
                        id: uuidv4(),
                        ...f,
                    })),
                    positioning: data.positioning || {
                        currentPosition: 'Unknown',
                        recommendedPosition: 'Market leader in ' + targetMarket,
                        valueProposition: 'Best-in-class ' + targetMarket + ' solution',
                        targetAudience: 'Professionals seeking ' + targetMarket + ' tools',
                        keyMessages: [],
                        competitiveAdvantages: [],
                        pricingStrategy: 'Competitive mid-tier pricing',
                    },
                };
            }
        } catch (error) {
            console.error('Failed to parse gap analysis:', error);
        }

        // Return empty results on failure
        return {
            gaps: [],
            opportunities: [],
            differentiators: [],
            suggestedFeatures: [],
            positioning: {
                currentPosition: 'Unknown',
                recommendedPosition: 'Market leader in ' + targetMarket,
                valueProposition: 'Best-in-class ' + targetMarket + ' solution',
                targetAudience: 'Professionals seeking ' + targetMarket + ' tools',
                keyMessages: [],
                competitiveAdvantages: [],
                pricingStrategy: 'Competitive mid-tier pricing',
            },
        };
    }

    /**
     * Add a competitor to an existing analysis
     */
    async addCompetitor(
        projectId: string,
        competitorUrl: string,
        targetMarket: string
    ): Promise<CompetitorProfile | null> {
        const analysis = this.analyses.get(projectId);
        if (!analysis) return null;

        // Analyze the new competitor
        const profile = await this.analyzeCompetitor(
            { name: 'New Competitor', url: competitorUrl, description: '', segment: 'unknown' },
            targetMarket
        );

        // Add to analysis
        analysis.competitors.push(profile);
        analysis.updatedAt = new Date();

        // Re-run gap analysis
        const gapAnalysis = await this.generateGapAnalysis(
            analysis.appDescription,
            analysis.targetMarket,
            analysis.competitors
        );

        analysis.gaps = gapAnalysis.gaps;
        analysis.opportunities = gapAnalysis.opportunities;
        analysis.differentiators = gapAnalysis.differentiators;
        analysis.suggestedFeatures = gapAnalysis.suggestedFeatures;
        analysis.positioning = gapAnalysis.positioning;

        return profile;
    }

    /**
     * Get analysis for a project
     */
    getAnalysis(projectId: string): MarketAnalysis | undefined {
        return this.analyses.get(projectId);
    }

    /**
     * Get feature gap matrix
     */
    getGapMatrix(projectId: string): {
        categories: string[];
        competitors: Array<{ id: string; name: string }>;
        matrix: Array<{
            category: string;
            features: Array<{
                name: string;
                ourCoverage: 'none' | 'partial' | 'full';
                competitors: Array<{
                    competitorId: string;
                    coverage: 'none' | 'partial' | 'full';
                }>;
            }>;
        }>;
    } | null {
        const analysis = this.analyses.get(projectId);
        if (!analysis) return null;

        // Extract all feature categories
        const categories = new Set<string>();
        const featuresByCategory = new Map<string, Set<string>>();

        analysis.competitors.forEach(c => {
            c.features.forEach(f => {
                categories.add(f.category);
                if (!featuresByCategory.has(f.category)) {
                    featuresByCategory.set(f.category, new Set());
                }
                featuresByCategory.get(f.category)!.add(f.name);
            });
        });

        // Build matrix
        const matrix = Array.from(categories).map(category => {
            const features = Array.from(featuresByCategory.get(category) || []);

            return {
                category,
                features: features.map(featureName => ({
                    name: featureName,
                    ourCoverage: 'none' as const, // Would need to be set from actual app features
                    competitors: analysis.competitors.map(c => ({
                        competitorId: c.id,
                        coverage: c.features.some(f => f.name === featureName) ? 'full' as const : 'none' as const,
                    })),
                })),
            };
        });

        return {
            categories: Array.from(categories),
            competitors: analysis.competitors.map(c => ({ id: c.id, name: c.name })),
            matrix,
        };
    }

    /**
     * Refresh analysis (re-analyze all competitors)
     */
    async refreshAnalysis(projectId: string): Promise<MarketAnalysis | null> {
        const existing = this.analyses.get(projectId);
        if (!existing) return null;

        return this.analyzeMarket({
            projectId,
            targetMarket: existing.targetMarket,
            appDescription: existing.appDescription,
            existingCompetitorUrls: existing.competitors.map(c => c.url),
        });
    }

    /**
     * Emit progress update
     */
    private emitProgress(analysisId: string, progress: AnalysisProgress): void {
        this.emit('progress', { analysisId, ...progress });
    }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let instance: MarketFitOracleService | null = null;

export function getMarketFitOracleService(): MarketFitOracleService {
    if (!instance) {
        instance = new MarketFitOracleService();
    }
    return instance;
}

export function createMarketFitOracleService(): MarketFitOracleService {
    return new MarketFitOracleService();
}


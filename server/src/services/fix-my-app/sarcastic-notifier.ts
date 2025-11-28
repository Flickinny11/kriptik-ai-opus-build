/**
 * Sarcastic Notifier Service
 *
 * Generates humorous, sarcastic notifications when apps are successfully fixed.
 * Uses a unique AI model (Mixtral/Mistral) for creative, witty responses.
 */

import { OpenAI } from 'openai';
import type { IntentVerificationReport, IntentSummary } from './types.js';

// Use Mistral/Mixtral for creative, witty responses - it's great for humor
const SARCASTIC_MODEL = 'mistralai/mixtral-8x7b-instruct';

export interface SarcasticNotification {
    title: string;
    message: string;
    emoji: string;
    subtext: string;
    celebrationGif?: string;
}

export class SarcasticNotifier {
    private openrouter: OpenAI;

    constructor() {
        this.openrouter = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': process.env.VERCEL_URL || 'https://kriptik.ai',
                'X-Title': 'KripTik AI - Fix My App',
            },
        });
    }

    /**
     * Generate a sarcastic, humorous notification for successful fix
     */
    async generateNotification(
        userName: string,
        report: IntentVerificationReport,
        intent: IntentSummary
    ): Promise<SarcasticNotification> {
        const featuresFixed = report.featureVerifications.filter(f => f.working).length;
        const totalFeatures = report.featureVerifications.length;
        const frustrationPoints = intent.frustrationPoints.length;
        const appPurpose = intent.corePurpose;

        const prompt = `You are a sarcastic, witty AI assistant who just fixed someone's broken app from another AI builder (like Lovable or Bolt.new).

CONTEXT:
- User's name: ${userName}
- App purpose: ${appPurpose}
- Features fixed: ${featuresFixed}/${totalFeatures}
- User frustration points resolved: ${frustrationPoints}
- The app is now FULLY WORKING

Generate a HILARIOUS, sarcastic notification congratulating them. The humor should:
1. Playfully mock the idea of spending money on AI credits for broken apps
2. Suggest ridiculous alternative ways to waste money now that they don't need to pay for app fixes
3. Be self-aware and meta about AI fixing AI's mistakes
4. Include a subtle brag about how good KripTik AI is
5. End with "BTW - your app works now!" or similar

TONE EXAMPLES:
- "Well ${userName}, I hope you're happy. You've just put half the 'AI fix-it' economy out of business."
- "Have you considered taking up expensive hobbies like gold-plated stamp collecting? You clearly have money to burn since your app actually works now."
- "Breaking news: Local developer discovers apps CAN work. Experts baffled."

DO NOT be mean-spirited, just playfully sarcastic and genuinely celebratory underneath.

Return JSON:
{
    "title": "short witty title (max 50 chars)",
    "message": "the main sarcastic message (100-200 chars)",
    "emoji": "one relevant emoji",
    "subtext": "a shorter follow-up joke or the 'btw your app works' message"
}`;

        try {
            const response = await this.openrouter.chat.completions.create({
                model: SARCASTIC_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a comedically sarcastic AI assistant. Your humor is witty, self-aware, and never mean-spirited. You celebrate success through playful mockery.',
                    },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 500,
                temperature: 0.9, // Higher temperature for more creative responses
            });

            const content = response.choices[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    title: parsed.title || this.getFallbackTitle(userName),
                    message: parsed.message || this.getFallbackMessage(userName),
                    emoji: parsed.emoji || '🎉',
                    subtext: parsed.subtext || 'BTW - your app works now!',
                    celebrationGif: this.getRandomCelebrationGif(),
                };
            }
        } catch (error) {
            console.error('Sarcastic notifier error:', error);
        }

        // Fallback to pre-written sarcastic messages
        return this.getFallbackNotification(userName, featuresFixed, frustrationPoints);
    }

    /**
     * Get fallback notification if AI generation fails
     */
    private getFallbackNotification(
        userName: string,
        featuresFixed: number,
        frustrationPoints: number
    ): SarcasticNotification {
        const messages = [
            {
                title: 'Financial Crisis Averted! 💸',
                message: `${userName}, have you considered smoking or illicit drug use? You now need a new way to waste your hard-earned money because you don't need to spend it on AI credits to fix your apps.`,
                emoji: '🎰',
                subtext: 'BTW - your app works now!',
            },
            {
                title: 'App.exe Has Stopped Not Working',
                message: `Congratulations ${userName}! Your app now does that thing where it... works? Wild concept, I know. ${featuresFixed} features are now operational. This must feel illegal.`,
                emoji: '🪄',
                subtext: 'We accept thank-you notes and expensive coffee.',
            },
            {
                title: 'The AI Uprising Delayed',
                message: `${userName}, we've fixed ${featuresFixed} features and ${frustrationPoints} rage-inducing issues. The other AI clearly needed adult supervision. You're welcome.`,
                emoji: '🤖',
                subtext: 'Your app works now. Please remain calm.',
            },
            {
                title: 'Breaking: App Actually Functions',
                message: `${userName}, I regret to inform you that your app is now fully operational. Your excuse for doom-scrolling instead of launching is hereby revoked.`,
                emoji: '📰',
                subtext: 'Your therapist will miss hearing about this.',
            },
            {
                title: 'Productivity Unlocked 🔓',
                message: `Bad news ${userName}: We fixed everything. ${featuresFixed} features are working. You can no longer blame "technical difficulties" for procrastinating on your launch.`,
                emoji: '😏',
                subtext: 'BTW - your app works now. No take-backs.',
            },
        ];

        const randomIndex = Math.floor(Math.random() * messages.length);
        return {
            ...messages[randomIndex],
            celebrationGif: this.getRandomCelebrationGif(),
        };
    }

    private getFallbackTitle(userName: string): string {
        const titles = [
            `${userName}'s App Resurrection Complete`,
            'App Successfully Un-Broken',
            'Mission Accomplished (For Real This Time)',
            'The App Whisperer Strikes Again',
            'App.exe Has Stopped Crashing',
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    }

    private getFallbackMessage(userName: string): string {
        return `Well ${userName}, your app works now. Please contain your excitement.`;
    }

    private getRandomCelebrationGif(): string {
        const gifs = [
            'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', // Leonardo DiCaprio cheers
            'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', // Pikachu celebration
            'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', // Confetti celebration
            'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // The Office celebration
            'https://media.giphy.com/media/KYElw07kzDspaBOwf9/giphy.gif', // Yes! celebration
        ];
        return gifs[Math.floor(Math.random() * gifs.length)];
    }

    /**
     * Generate a quick one-liner for toast notifications
     */
    async generateOneLiner(userName: string): Promise<string> {
        const oneLiners = [
            `${userName}, your app works now. Try not to faint.`,
            `Fixed it. You're welcome, ${userName}. 😎`,
            `${userName}'s app is alive! IT'S ALIVE!`,
            `App fixed. ${userName} owes us a coffee. ☕`,
            `${userName}, you can stop stress-eating now. App works.`,
            `Breaking: ${userName} discovers functional software exists.`,
            `Done! ${userName}'s app has been successfully un-Lovable'd.`,
            `${userName}, good news and bad news. Good: App works. Bad: No more excuses.`,
        ];

        return oneLiners[Math.floor(Math.random() * oneLiners.length)];
    }
}

export function createSarcasticNotifier(): SarcasticNotifier {
    return new SarcasticNotifier();
}


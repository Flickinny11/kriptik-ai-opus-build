/**
 * User Settings API Routes
 *
 * Comprehensive user account management:
 * - Profile settings
 * - Billing preferences (spending limits, auto top-up)
 * - Payment methods
 * - Notification preferences
 * - AI preferences
 * - Privacy settings
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { users, userSettings, subscriptions, generations } from '../schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
});

// =============================================================================
// USER PROFILE
// =============================================================================

/**
 * GET /api/settings
 * Get user settings
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get or create settings
        let [settings] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        if (!settings) {
            // Create default settings
            [settings] = await db.insert(userSettings).values({
                userId,
            }).returning();
        }

        // Get subscription
        const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                credits: user.credits,
                tier: user.tier,
                createdAt: user.createdAt,
            },
            settings,
            subscription: subscription || null,
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * PATCH /api/settings
 * Update user settings
 */
router.patch('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updates = req.body;

        // Validate allowed fields
        const allowedFields = [
            'spendingLimit',
            'alertThreshold',
            'autoTopUp',
            'autoTopUpAmount',
            'autoTopUpThreshold',
            'theme',
            'editorTheme',
            'fontSize',
            'tabSize',
            'preferredModel',
            'autoSave',
            'streamingEnabled',
            'emailNotifications',
            'deploymentAlerts',
            'billingAlerts',
            'weeklyDigest',
            'analyticsOptIn',
            'crashReports',
            // Advanced Developer Options
            'softInterruptEnabled',
            'softInterruptAutoClassify',
            'softInterruptPriority',
            'preDeployValidationEnabled',
            'preDeployStrictMode',
            'preDeployDefaultPlatform',
            'preDeployAutoRun',
            'ghostModeEnabled',
            'ghostModeMaxRuntime',
            'ghostModeMaxCredits',
            'ghostModeCheckpointInterval',
            'ghostModeAutonomyLevel',
            'ghostModePauseOnError',
            'ghostModeNotifyEmail',
            'ghostModeNotifySlack',
            'ghostModeSlackWebhook',
            'developerModeDefaultModel',
            'developerModeDefaultVerification',
            'developerModeMaxConcurrentAgents',
            'developerModeAutoFix',
            'developerModeAutoFixRetries',
            'defaultBuildMode',
            'extendedThinkingEnabled',
            'tournamentModeEnabled',
            'designScoreThreshold',
            'codeQualityThreshold',
            'securityScanEnabled',
            'placeholderCheckEnabled',
            'timeMachineEnabled',
            'timeMachineAutoCheckpoint',
            'timeMachineRetentionDays',
        ];

        const sanitizedUpdates: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field];
            }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        sanitizedUpdates.updatedAt = new Date().toISOString();

        // Update or create settings
        const [existing] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        let settings;
        if (existing) {
            [settings] = await db
                .update(userSettings)
                .set(sanitizedUpdates)
                .where(eq(userSettings.userId, userId))
                .returning();
        } else {
            [settings] = await db.insert(userSettings).values({
                userId,
                ...sanitizedUpdates,
            }).returning();
        }

        res.json({ settings });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * PATCH /api/settings/profile
 * Update user profile (name, image)
 */
router.patch('/profile', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, image } = req.body;

        const updates: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };
        if (name !== undefined) updates.name = name;
        if (image !== undefined) updates.image = image;

        const [user] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, userId))
            .returning();

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =============================================================================
// BILLING & CREDITS
// =============================================================================

/**
 * GET /api/settings/credits
 * Get user credit balance and usage stats
 */
router.get('/credits', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get this month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usageThisMonth = await db
            .select({
                totalTokens: sql<number>`SUM(${generations.tokensUsed})`,
                totalCredits: sql<number>`SUM(${generations.creditsUsed})`,
                count: sql<number>`COUNT(*)`,
            })
            .from(generations)
            .where(and(
                eq(generations.userId, userId),
                gte(generations.createdAt, startOfMonth.toISOString())
            ));

        // Get subscription limits
        const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

        res.json({
            balance: user.credits,
            tier: user.tier,
            usage: {
                tokensThisMonth: usageThisMonth[0]?.totalTokens || 0,
                creditsThisMonth: usageThisMonth[0]?.totalCredits || 0,
                generationsThisMonth: usageThisMonth[0]?.count || 0,
            },
            limits: {
                monthlyCredits: subscription?.creditsPerMonth || 500,
                currentPeriodStart: subscription?.currentPeriodStart,
                currentPeriodEnd: subscription?.currentPeriodEnd,
            },
        });
    } catch (error) {
        console.error('Get credits error:', error);
        res.status(500).json({ error: 'Failed to get credit info' });
    }
});

/**
 * POST /api/settings/credits/topup
 * Create Stripe checkout for credit top-up
 */
router.post('/credits/topup', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { amount } = req.body; // Amount in credits

        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Minimum top-up is 100 credits' });
        }

        // Get or create Stripe customer
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get subscription for customer ID
        const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

        let customerId = subscription?.stripeCustomerId;

        if (!customerId) {
            // Create Stripe customer
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId },
            });
            customerId = customer.id;

            // Save customer ID
            if (subscription) {
                await db
                    .update(subscriptions)
                    .set({ stripeCustomerId: customerId })
                    .where(eq(subscriptions.userId, userId));
            } else {
                await db.insert(subscriptions).values({
                    userId,
                    stripeCustomerId: customerId,
                    plan: 'free',
                    status: 'active',
                    creditsPerMonth: 500,
                });
            }
        }

        // Calculate price (100 credits = $1)
        const priceInCents = Math.ceil(amount);

        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer: customerId,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${amount} KripTik Credits`,
                            description: 'Use for AI code generation, deployments, and more',
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                type: 'credit_topup',
                userId,
                credits: amount.toString(),
            },
            success_url: `${frontendUrl}/dashboard?topup_success=true`,
            cancel_url: `${frontendUrl}/settings?topup_cancelled=true`,
        });

        res.json({
            checkoutUrl: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        console.error('Top-up error:', error);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});

/**
 * POST /api/settings/credits/webhook
 * Handle Stripe webhooks for credit top-ups
 */
router.post('/credits/webhook', async (req: Request, res: Response) => {
    try {
        const sig = req.headers['stripe-signature'] as string;

        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            console.warn('STRIPE_WEBHOOK_SECRET not configured');
            return res.status(400).json({ error: 'Webhook not configured' });
        }

        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.metadata?.type === 'credit_topup') {
                const { userId, credits } = session.metadata;
                const creditAmount = parseInt(credits, 10);

                // Add credits to user
                await db
                    .update(users)
                    .set({
                        credits: sql`${users.credits} + ${creditAmount}`,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(users.id, userId));

                console.log(`Added ${creditAmount} credits to user ${userId}`);
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: 'Webhook failed' });
    }
});

// =============================================================================
// PAYMENT METHODS
// =============================================================================

/**
 * GET /api/settings/payment-methods
 * List user's payment methods
 */
router.get('/payment-methods', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get subscription for customer ID
        const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

        if (!subscription?.stripeCustomerId) {
            return res.json({ paymentMethods: [], defaultPaymentMethodId: null });
        }

        // Get payment methods from Stripe
        const paymentMethods = await stripe.paymentMethods.list({
            customer: subscription.stripeCustomerId,
            type: 'card',
        });

        // Get default payment method
        const [settings] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        res.json({
            paymentMethods: paymentMethods.data.map(pm => ({
                id: pm.id,
                brand: pm.card?.brand,
                last4: pm.card?.last4,
                expMonth: pm.card?.exp_month,
                expYear: pm.card?.exp_year,
                isDefault: pm.id === settings?.defaultPaymentMethodId,
            })),
            defaultPaymentMethodId: settings?.defaultPaymentMethodId,
        });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

/**
 * POST /api/settings/payment-methods/setup
 * Create Stripe SetupIntent for adding new payment method
 */
router.post('/payment-methods/setup', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get or create customer
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

        let customerId = subscription?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId },
            });
            customerId = customer.id;

            if (!subscription) {
                await db.insert(subscriptions).values({
                    userId,
                    stripeCustomerId: customerId,
                    plan: 'free',
                    status: 'active',
                    creditsPerMonth: 500,
                });
            } else {
                await db
                    .update(subscriptions)
                    .set({ stripeCustomerId: customerId })
                    .where(eq(subscriptions.userId, userId));
            }
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
        });

        res.json({
            clientSecret: setupIntent.client_secret,
        });
    } catch (error) {
        console.error('Setup intent error:', error);
        res.status(500).json({ error: 'Failed to create setup intent' });
    }
});

/**
 * POST /api/settings/payment-methods/:id/default
 * Set default payment method
 */
router.post('/payment-methods/:id/default', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        // Update settings
        await db
            .update(userSettings)
            .set({
                defaultPaymentMethodId: id,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(userSettings.userId, userId));

        res.json({ success: true });
    } catch (error) {
        console.error('Set default payment method error:', error);
        res.status(500).json({ error: 'Failed to set default payment method' });
    }
});

/**
 * DELETE /api/settings/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        // Detach payment method from customer
        await stripe.paymentMethods.detach(id);

        // If this was the default, clear it
        const [settings] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        if (settings?.defaultPaymentMethodId === id) {
            await db
                .update(userSettings)
                .set({
                    defaultPaymentMethodId: null,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(userSettings.userId, userId));
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Remove payment method error:', error);
        res.status(500).json({ error: 'Failed to remove payment method' });
    }
});

// =============================================================================
// USAGE HISTORY
// =============================================================================

/**
 * GET /api/settings/usage
 * Get usage history
 */
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { limit = '50', offset = '0' } = req.query;

        const history = await db
            .select({
                id: generations.id,
                projectId: generations.projectId,
                prompt: generations.prompt,
                model: generations.model,
                tokensUsed: generations.tokensUsed,
                creditsUsed: generations.creditsUsed,
                createdAt: generations.createdAt,
            })
            .from(generations)
            .where(eq(generations.userId, userId))
            .orderBy(sql`${generations.createdAt} DESC`)
            .limit(parseInt(limit as string, 10))
            .offset(parseInt(offset as string, 10));

        res.json({ usage: history });
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage history' });
    }
});

// =============================================================================
// ADVANCED DEVELOPER OPTIONS
// =============================================================================

/**
 * GET /api/settings/developer
 * Get advanced developer options
 */
router.get('/developer', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get or create settings
        let [settings] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        if (!settings) {
            // Create default settings
            [settings] = await db.insert(userSettings).values({
                userId,
            }).returning();
        }

        // Return only advanced developer settings
        res.json({
            softInterrupt: {
                enabled: settings.softInterruptEnabled ?? true,
                autoClassify: settings.softInterruptAutoClassify ?? true,
                priority: settings.softInterruptPriority ?? 'normal',
            },
            preDeployValidation: {
                enabled: settings.preDeployValidationEnabled ?? true,
                strictMode: settings.preDeployStrictMode ?? false,
                defaultPlatform: settings.preDeployDefaultPlatform ?? 'vercel',
                autoRun: settings.preDeployAutoRun ?? true,
            },
            ghostMode: {
                enabled: settings.ghostModeEnabled ?? true,
                maxRuntime: settings.ghostModeMaxRuntime ?? 120,
                maxCredits: settings.ghostModeMaxCredits ?? 100,
                checkpointInterval: settings.ghostModeCheckpointInterval ?? 15,
                autonomyLevel: settings.ghostModeAutonomyLevel ?? 'moderate',
                pauseOnError: settings.ghostModePauseOnError ?? true,
                notifyEmail: settings.ghostModeNotifyEmail ?? true,
                notifySlack: settings.ghostModeNotifySlack ?? false,
                slackWebhook: settings.ghostModeSlackWebhook ?? null,
            },
            developerMode: {
                defaultModel: settings.developerModeDefaultModel ?? 'claude-sonnet-4-5',
                defaultVerification: settings.developerModeDefaultVerification ?? 'standard',
                maxConcurrentAgents: settings.developerModeMaxConcurrentAgents ?? 3,
                autoFix: settings.developerModeAutoFix ?? true,
                autoFixRetries: settings.developerModeAutoFixRetries ?? 3,
            },
            buildMode: {
                defaultMode: settings.defaultBuildMode ?? 'standard',
                extendedThinking: settings.extendedThinkingEnabled ?? false,
                tournamentMode: settings.tournamentModeEnabled ?? false,
            },
            quality: {
                designScoreThreshold: settings.designScoreThreshold ?? 75,
                codeQualityThreshold: settings.codeQualityThreshold ?? 70,
                securityScan: settings.securityScanEnabled ?? true,
                placeholderCheck: settings.placeholderCheckEnabled ?? true,
            },
            timeMachine: {
                enabled: settings.timeMachineEnabled ?? true,
                autoCheckpoint: settings.timeMachineAutoCheckpoint ?? true,
                retentionDays: settings.timeMachineRetentionDays ?? 30,
            },
        });
    } catch (error) {
        console.error('Get developer settings error:', error);
        res.status(500).json({ error: 'Failed to get developer settings' });
    }
});

/**
 * PATCH /api/settings/developer
 * Update advanced developer options
 */
router.patch('/developer', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updates = req.body;
        const sanitizedUpdates: Record<string, unknown> = {};

        // Map nested structure to flat database columns
        if (updates.softInterrupt) {
            if (updates.softInterrupt.enabled !== undefined) {
                sanitizedUpdates.softInterruptEnabled = updates.softInterrupt.enabled;
            }
            if (updates.softInterrupt.autoClassify !== undefined) {
                sanitizedUpdates.softInterruptAutoClassify = updates.softInterrupt.autoClassify;
            }
            if (updates.softInterrupt.priority !== undefined) {
                sanitizedUpdates.softInterruptPriority = updates.softInterrupt.priority;
            }
        }

        if (updates.preDeployValidation) {
            if (updates.preDeployValidation.enabled !== undefined) {
                sanitizedUpdates.preDeployValidationEnabled = updates.preDeployValidation.enabled;
            }
            if (updates.preDeployValidation.strictMode !== undefined) {
                sanitizedUpdates.preDeployStrictMode = updates.preDeployValidation.strictMode;
            }
            if (updates.preDeployValidation.defaultPlatform !== undefined) {
                sanitizedUpdates.preDeployDefaultPlatform = updates.preDeployValidation.defaultPlatform;
            }
            if (updates.preDeployValidation.autoRun !== undefined) {
                sanitizedUpdates.preDeployAutoRun = updates.preDeployValidation.autoRun;
            }
        }

        if (updates.ghostMode) {
            if (updates.ghostMode.enabled !== undefined) {
                sanitizedUpdates.ghostModeEnabled = updates.ghostMode.enabled;
            }
            if (updates.ghostMode.maxRuntime !== undefined) {
                sanitizedUpdates.ghostModeMaxRuntime = updates.ghostMode.maxRuntime;
            }
            if (updates.ghostMode.maxCredits !== undefined) {
                sanitizedUpdates.ghostModeMaxCredits = updates.ghostMode.maxCredits;
            }
            if (updates.ghostMode.checkpointInterval !== undefined) {
                sanitizedUpdates.ghostModeCheckpointInterval = updates.ghostMode.checkpointInterval;
            }
            if (updates.ghostMode.autonomyLevel !== undefined) {
                sanitizedUpdates.ghostModeAutonomyLevel = updates.ghostMode.autonomyLevel;
            }
            if (updates.ghostMode.pauseOnError !== undefined) {
                sanitizedUpdates.ghostModePauseOnError = updates.ghostMode.pauseOnError;
            }
            if (updates.ghostMode.notifyEmail !== undefined) {
                sanitizedUpdates.ghostModeNotifyEmail = updates.ghostMode.notifyEmail;
            }
            if (updates.ghostMode.notifySlack !== undefined) {
                sanitizedUpdates.ghostModeNotifySlack = updates.ghostMode.notifySlack;
            }
            if (updates.ghostMode.slackWebhook !== undefined) {
                sanitizedUpdates.ghostModeSlackWebhook = updates.ghostMode.slackWebhook;
            }
        }

        if (updates.developerMode) {
            if (updates.developerMode.defaultModel !== undefined) {
                sanitizedUpdates.developerModeDefaultModel = updates.developerMode.defaultModel;
            }
            if (updates.developerMode.defaultVerification !== undefined) {
                sanitizedUpdates.developerModeDefaultVerification = updates.developerMode.defaultVerification;
            }
            if (updates.developerMode.maxConcurrentAgents !== undefined) {
                sanitizedUpdates.developerModeMaxConcurrentAgents = updates.developerMode.maxConcurrentAgents;
            }
            if (updates.developerMode.autoFix !== undefined) {
                sanitizedUpdates.developerModeAutoFix = updates.developerMode.autoFix;
            }
            if (updates.developerMode.autoFixRetries !== undefined) {
                sanitizedUpdates.developerModeAutoFixRetries = updates.developerMode.autoFixRetries;
            }
        }

        if (updates.buildMode) {
            if (updates.buildMode.defaultMode !== undefined) {
                sanitizedUpdates.defaultBuildMode = updates.buildMode.defaultMode;
            }
            if (updates.buildMode.extendedThinking !== undefined) {
                sanitizedUpdates.extendedThinkingEnabled = updates.buildMode.extendedThinking;
            }
            if (updates.buildMode.tournamentMode !== undefined) {
                sanitizedUpdates.tournamentModeEnabled = updates.buildMode.tournamentMode;
            }
        }

        if (updates.quality) {
            if (updates.quality.designScoreThreshold !== undefined) {
                sanitizedUpdates.designScoreThreshold = updates.quality.designScoreThreshold;
            }
            if (updates.quality.codeQualityThreshold !== undefined) {
                sanitizedUpdates.codeQualityThreshold = updates.quality.codeQualityThreshold;
            }
            if (updates.quality.securityScan !== undefined) {
                sanitizedUpdates.securityScanEnabled = updates.quality.securityScan;
            }
            if (updates.quality.placeholderCheck !== undefined) {
                sanitizedUpdates.placeholderCheckEnabled = updates.quality.placeholderCheck;
            }
        }

        if (updates.timeMachine) {
            if (updates.timeMachine.enabled !== undefined) {
                sanitizedUpdates.timeMachineEnabled = updates.timeMachine.enabled;
            }
            if (updates.timeMachine.autoCheckpoint !== undefined) {
                sanitizedUpdates.timeMachineAutoCheckpoint = updates.timeMachine.autoCheckpoint;
            }
            if (updates.timeMachine.retentionDays !== undefined) {
                sanitizedUpdates.timeMachineRetentionDays = updates.timeMachine.retentionDays;
            }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        sanitizedUpdates.updatedAt = new Date().toISOString();

        // Update or create settings
        const [existing] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        let settings;
        if (existing) {
            [settings] = await db
                .update(userSettings)
                .set(sanitizedUpdates)
                .where(eq(userSettings.userId, userId))
                .returning();
        } else {
            [settings] = await db.insert(userSettings).values({
                userId,
                ...sanitizedUpdates,
            }).returning();
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Update developer settings error:', error);
        res.status(500).json({ error: 'Failed to update developer settings' });
    }
});

/**
 * POST /api/settings/developer/reset
 * Reset advanced developer options to defaults
 */
router.post('/developer/reset', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const defaultSettings = {
            softInterruptEnabled: true,
            softInterruptAutoClassify: true,
            softInterruptPriority: 'normal',
            preDeployValidationEnabled: true,
            preDeployStrictMode: false,
            preDeployDefaultPlatform: 'vercel',
            preDeployAutoRun: true,
            ghostModeEnabled: true,
            ghostModeMaxRuntime: 120,
            ghostModeMaxCredits: 100,
            ghostModeCheckpointInterval: 15,
            ghostModeAutonomyLevel: 'moderate',
            ghostModePauseOnError: true,
            ghostModeNotifyEmail: true,
            ghostModeNotifySlack: false,
            ghostModeSlackWebhook: null,
            developerModeDefaultModel: 'claude-sonnet-4-5',
            developerModeDefaultVerification: 'standard',
            developerModeMaxConcurrentAgents: 3,
            developerModeAutoFix: true,
            developerModeAutoFixRetries: 3,
            defaultBuildMode: 'standard',
            extendedThinkingEnabled: false,
            tournamentModeEnabled: false,
            designScoreThreshold: 75,
            codeQualityThreshold: 70,
            securityScanEnabled: true,
            placeholderCheckEnabled: true,
            timeMachineEnabled: true,
            timeMachineAutoCheckpoint: true,
            timeMachineRetentionDays: 30,
            updatedAt: new Date().toISOString(),
        };

        await db
            .update(userSettings)
            .set(defaultSettings)
            .where(eq(userSettings.userId, userId));

        res.json({ success: true, message: 'Developer settings reset to defaults' });
    } catch (error) {
        console.error('Reset developer settings error:', error);
        res.status(500).json({ error: 'Failed to reset developer settings' });
    }
});

export default router;


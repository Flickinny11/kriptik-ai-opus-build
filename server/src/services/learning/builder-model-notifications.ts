/**
 * Builder Model Notifications
 *
 * Provides intelligent notifications in the builder view to suggest
 * model creation and usage to users. Triggered after the first NLP
 * input in the streaming chat.
 *
 * Features:
 * - First interaction notification for new projects
 * - Smart model suggestions based on project type
 * - Marketplace recommendations
 * - Learning mode explanations
 * - Multi-model setup guidance
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getUserModelManager, ModelSuggestion } from './user-model-manager.js';
import { getModelMarketplace, MarketplaceModel } from './model-marketplace.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BuilderNotification {
    id: string;
    projectId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high';
    actions: NotificationAction[];
    metadata?: Record<string, unknown>;
    dismissed: boolean;
    dismissedAt?: Date;
    createdAt: Date;
    expiresAt?: Date;
}

export type NotificationType =
    | 'first_interaction_model_prompt'
    | 'model_suggestion'
    | 'marketplace_recommendation'
    | 'training_milestone'
    | 'model_ready'
    | 'takeover_preview'
    | 'multi_model_suggestion'
    | 'skill_improvement';

export interface NotificationAction {
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'dismiss';
    action: NotificationActionType;
    payload?: Record<string, unknown>;
}

export type NotificationActionType =
    | 'create_model'
    | 'use_existing_model'
    | 'browse_marketplace'
    | 'skip_model'
    | 'add_model_to_project'
    | 'start_training'
    | 'view_model_details'
    | 'configure_multi_model'
    | 'dismiss';

export interface ProjectNotificationState {
    projectId: string;
    userId: string;
    interactionCount: number;
    firstInteractionAt?: Date;
    modelPromptShown: boolean;
    modelPromptDismissed: boolean;
    modelConfigured: boolean;
    lastNotificationAt?: Date;
    dismissedNotifications: string[];
}

export interface ModelNotificationConfig {
    showFirstInteractionPrompt: boolean;
    firstInteractionDelay: number;  // Seconds after first message
    suggestionFrequency: number;  // Hours between suggestions
    marketplaceRecommendationThreshold: number;  // Interactions before recommending marketplace
    enableTrainingMilestones: boolean;
    enableTakeoverPreviews: boolean;
}

// =============================================================================
// BUILDER MODEL NOTIFICATIONS SERVICE
// =============================================================================

export class BuilderModelNotifications extends EventEmitter {
    private notifications: Map<string, BuilderNotification[]> = new Map();  // projectId -> notifications
    private projectStates: Map<string, ProjectNotificationState> = new Map();
    private config: ModelNotificationConfig;

    constructor() {
        super();

        this.config = {
            showFirstInteractionPrompt: true,
            firstInteractionDelay: 3,  // Show after 3 seconds
            suggestionFrequency: 24,  // Once per day
            marketplaceRecommendationThreshold: 10,  // After 10 interactions
            enableTrainingMilestones: true,
            enableTakeoverPreviews: true,
        };
    }

    // =========================================================================
    // INTERACTION TRACKING
    // =========================================================================

    /**
     * Record a user interaction in the builder
     * This is called after each NLP input in the streaming chat
     */
    async recordInteraction(input: {
        projectId: string;
        userId: string;
        interactionType: 'nlp_input' | 'code_generation' | 'design_choice' | 'file_creation';
        context?: {
            projectType?: string;
            technologies?: string[];
            prompt?: string;
        };
    }): Promise<BuilderNotification | null> {
        // Get or create project state
        let state = this.projectStates.get(input.projectId);

        if (!state) {
            state = {
                projectId: input.projectId,
                userId: input.userId,
                interactionCount: 0,
                modelPromptShown: false,
                modelPromptDismissed: false,
                modelConfigured: false,
                dismissedNotifications: [],
            };
            this.projectStates.set(input.projectId, state);
        }

        state.interactionCount++;

        // First interaction handling
        if (state.interactionCount === 1 && !state.firstInteractionAt) {
            state.firstInteractionAt = new Date();

            // Check if should show model prompt
            if (this.config.showFirstInteractionPrompt && !state.modelPromptShown) {
                // Delay the notification slightly for better UX
                setTimeout(() => {
                    this.showFirstInteractionPrompt(input.projectId, input.userId, input.context);
                }, this.config.firstInteractionDelay * 1000);
            }
        }

        // Check for marketplace recommendation threshold
        if (state.interactionCount === this.config.marketplaceRecommendationThreshold &&
            !state.modelConfigured) {
            return this.showMarketplaceRecommendation(input.projectId, input.userId, input.context);
        }

        return null;
    }

    // =========================================================================
    // NOTIFICATION CREATION
    // =========================================================================

    /**
     * Show the first interaction model prompt
     * "Would you like to create a new model for this project or use an existing model?"
     */
    private async showFirstInteractionPrompt(
        projectId: string,
        userId: string,
        context?: { projectType?: string; technologies?: string[] }
    ): Promise<BuilderNotification> {
        const state = this.projectStates.get(projectId);
        if (!state || state.modelPromptShown) {
            return this.notifications.get(projectId)?.[0]!;
        }

        state.modelPromptShown = true;

        // Get model suggestions
        const modelManager = getUserModelManager();
        const suggestions = await modelManager.suggestModelsForProject({
            userId,
            projectType: context?.projectType,
            technologies: context?.technologies,
        });

        // Build notification message
        let message = 'Create a personalized AI model that learns your coding style, preferences, and patterns. ';
        message += 'The more you work on this project, the better your model gets at predicting what\'s next.';

        // Build actions
        const actions: NotificationAction[] = [
            {
                id: 'create-new',
                label: 'Create New Model',
                type: 'primary',
                action: 'create_model',
                payload: {
                    projectId,
                    suggestedName: `${context?.projectType || 'Project'} Model`,
                },
            },
        ];

        // Add existing model option if available
        const existingSuggestion = suggestions.find(s => s.type === 'use_existing');
        if (existingSuggestion) {
            actions.push({
                id: 'use-existing',
                label: `Use "${existingSuggestion.name}"`,
                type: 'secondary',
                action: 'use_existing_model',
                payload: {
                    modelId: existingSuggestion.modelId,
                    projectId,
                },
            });
        }

        // Add marketplace option
        actions.push({
            id: 'browse-marketplace',
            label: 'Browse Marketplace',
            type: 'secondary',
            action: 'browse_marketplace',
        });

        // Add skip option
        actions.push({
            id: 'skip',
            label: 'Maybe Later',
            type: 'dismiss',
            action: 'skip_model',
        });

        const notification: BuilderNotification = {
            id: `notif-${uuidv4().slice(0, 12)}`,
            projectId,
            userId,
            type: 'first_interaction_model_prompt',
            title: 'Create Your Personal AI Model?',
            message,
            priority: 'high',
            actions,
            metadata: {
                suggestions,
                context,
            },
            dismissed: false,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),  // Expires in 24 hours
        };

        this.addNotification(projectId, notification);
        this.emit('notification_created', notification);

        return notification;
    }

    /**
     * Show marketplace recommendation
     */
    private async showMarketplaceRecommendation(
        projectId: string,
        userId: string,
        context?: { projectType?: string; technologies?: string[] }
    ): Promise<BuilderNotification> {
        const marketplace = getModelMarketplace();

        // Get relevant marketplace models
        let recommendations: MarketplaceModel[] = [];

        if (context?.technologies?.length) {
            const result = await marketplace.searchModels({
                frameworks: context.technologies,
                sortBy: 'rating',
            });
            recommendations = result.models.slice(0, 3);
        }

        if (recommendations.length === 0) {
            const featured = await marketplace.getFeaturedModels();
            recommendations = featured.slice(0, 3);
        }

        const actions: NotificationAction[] = recommendations.map((model, index) => ({
            id: `add-${model.id}`,
            label: model.name,
            type: index === 0 ? 'primary' : 'secondary',
            action: 'add_model_to_project',
            payload: {
                marketplaceModelId: model.id,
                projectId,
            },
        }));

        actions.push({
            id: 'browse-all',
            label: 'See All Models',
            type: 'secondary',
            action: 'browse_marketplace',
        });

        actions.push({
            id: 'dismiss',
            label: 'Not Now',
            type: 'dismiss',
            action: 'dismiss',
        });

        const notification: BuilderNotification = {
            id: `notif-${uuidv4().slice(0, 12)}`,
            projectId,
            userId,
            type: 'marketplace_recommendation',
            title: 'Boost Your Project with Community Models',
            message: 'Check out these popular models that match your project. See what others have built and add their styles to your project.',
            priority: 'normal',
            actions,
            metadata: {
                recommendations: recommendations.map(m => ({
                    id: m.id,
                    name: m.name,
                    rating: m.stats.averageRating,
                    downloads: m.stats.downloads,
                })),
            },
            dismissed: false,
            createdAt: new Date(),
        };

        this.addNotification(projectId, notification);
        this.emit('notification_created', notification);

        return notification;
    }

    /**
     * Show training milestone notification
     */
    async showTrainingMilestone(input: {
        projectId: string;
        userId: string;
        modelId: string;
        modelName: string;
        milestone: 'data_collected' | 'training_started' | 'training_complete' | 'model_improved';
        details?: Record<string, unknown>;
    }): Promise<BuilderNotification> {
        const milestoneMessages: Record<string, { title: string; message: string }> = {
            data_collected: {
                title: 'Model Learning in Progress',
                message: `Your model "${input.modelName}" has collected enough data to start improving. It's learning from your coding patterns!`,
            },
            training_started: {
                title: 'Training Started',
                message: `Your model "${input.modelName}" is now training on your data. This usually takes a few minutes.`,
            },
            training_complete: {
                title: 'Model Training Complete!',
                message: `Great news! "${input.modelName}" has finished training and is now smarter about your preferences.`,
            },
            model_improved: {
                title: 'Model Got Better',
                message: `"${input.modelName}" just improved by ${input.details?.improvementPercent || 5}%! Keep working and it'll get even better.`,
            },
        };

        const { title, message } = milestoneMessages[input.milestone];

        const notification: BuilderNotification = {
            id: `notif-${uuidv4().slice(0, 12)}`,
            projectId: input.projectId,
            userId: input.userId,
            type: 'training_milestone',
            title,
            message,
            priority: input.milestone === 'training_complete' ? 'high' : 'normal',
            actions: [
                {
                    id: 'view-model',
                    label: 'View Model Details',
                    type: 'primary',
                    action: 'view_model_details',
                    payload: { modelId: input.modelId },
                },
                {
                    id: 'dismiss',
                    label: 'Got It',
                    type: 'dismiss',
                    action: 'dismiss',
                },
            ],
            metadata: { modelId: input.modelId, milestone: input.milestone, ...input.details },
            dismissed: false,
            createdAt: new Date(),
        };

        this.addNotification(input.projectId, notification);
        this.emit('notification_created', notification);

        return notification;
    }

    /**
     * Show multi-model suggestion
     */
    async showMultiModelSuggestion(input: {
        projectId: string;
        userId: string;
        suggestedModels: Array<{
            modelId: string;
            name: string;
            specialization: string;
            reason: string;
        }>;
    }): Promise<BuilderNotification> {
        const modelList = input.suggestedModels
            .map(m => `• ${m.name} (${m.specialization})`)
            .join('\n');

        const notification: BuilderNotification = {
            id: `notif-${uuidv4().slice(0, 12)}`,
            projectId: input.projectId,
            userId: input.userId,
            type: 'multi_model_suggestion',
            title: 'Try Multiple Models Together',
            message: `Combine different AI specialties for better results:\n\n${modelList}`,
            priority: 'normal',
            actions: [
                {
                    id: 'configure',
                    label: 'Configure Multi-Model',
                    type: 'primary',
                    action: 'configure_multi_model',
                    payload: {
                        projectId: input.projectId,
                        suggestedModels: input.suggestedModels,
                    },
                },
                {
                    id: 'learn-more',
                    label: 'Learn More',
                    type: 'secondary',
                    action: 'view_model_details',
                },
                {
                    id: 'dismiss',
                    label: 'Not Now',
                    type: 'dismiss',
                    action: 'dismiss',
                },
            ],
            metadata: { suggestedModels: input.suggestedModels },
            dismissed: false,
            createdAt: new Date(),
        };

        this.addNotification(input.projectId, notification);
        this.emit('notification_created', notification);

        return notification;
    }

    /**
     * Show takeover preview notification
     */
    async showTakeoverPreview(input: {
        projectId: string;
        userId: string;
        modelType: string;
        trafficPercentage: number;
        performanceMetrics: {
            successRate: number;
            avgLatency: number;
            satisfaction: number;
        };
    }): Promise<BuilderNotification> {
        const notification: BuilderNotification = {
            id: `notif-${uuidv4().slice(0, 12)}`,
            projectId: input.projectId,
            userId: input.userId,
            type: 'takeover_preview',
            title: 'KripTik AI Getting Smarter',
            message: `Our ${input.modelType} model is now handling ${input.trafficPercentage}% of requests. It's ${input.performanceMetrics.successRate}% accurate and users love it (${input.performanceMetrics.satisfaction}% satisfaction)!`,
            priority: 'low',
            actions: [
                {
                    id: 'view-details',
                    label: 'Learn More',
                    type: 'secondary',
                    action: 'view_model_details',
                    payload: { modelType: input.modelType },
                },
                {
                    id: 'dismiss',
                    label: 'Got It',
                    type: 'dismiss',
                    action: 'dismiss',
                },
            ],
            metadata: input,
            dismissed: false,
            createdAt: new Date(),
        };

        this.addNotification(input.projectId, notification);
        this.emit('notification_created', notification);

        return notification;
    }

    // =========================================================================
    // NOTIFICATION MANAGEMENT
    // =========================================================================

    /**
     * Get notifications for a project
     */
    getNotifications(projectId: string, includeExpired: boolean = false): BuilderNotification[] {
        const notifications = this.notifications.get(projectId) || [];
        const now = new Date();

        return notifications.filter(n => {
            if (n.dismissed) return false;
            if (!includeExpired && n.expiresAt && n.expiresAt < now) return false;
            return true;
        });
    }

    /**
     * Dismiss a notification
     */
    dismissNotification(projectId: string, notificationId: string): void {
        const notifications = this.notifications.get(projectId);
        if (!notifications) return;

        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.dismissed = true;
            notification.dismissedAt = new Date();

            // Update project state
            const state = this.projectStates.get(projectId);
            if (state) {
                state.dismissedNotifications.push(notificationId);

                if (notification.type === 'first_interaction_model_prompt') {
                    state.modelPromptDismissed = true;
                }
            }

            this.emit('notification_dismissed', { projectId, notificationId });
        }
    }

    /**
     * Handle notification action
     */
    async handleAction(
        projectId: string,
        notificationId: string,
        actionId: string
    ): Promise<{ success: boolean; result?: unknown }> {
        const notifications = this.notifications.get(projectId);
        if (!notifications) return { success: false };

        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return { success: false };

        const action = notification.actions.find(a => a.id === actionId);
        if (!action) return { success: false };

        // Emit action event for handler
        this.emit('action_triggered', {
            projectId,
            notificationId,
            action,
        });

        // Handle dismiss action
        if (action.action === 'dismiss' || action.action === 'skip_model') {
            this.dismissNotification(projectId, notificationId);
        }

        // Mark model as configured for certain actions
        if (action.action === 'create_model' || action.action === 'use_existing_model' || action.action === 'add_model_to_project') {
            const state = this.projectStates.get(projectId);
            if (state) {
                state.modelConfigured = true;
            }
            this.dismissNotification(projectId, notificationId);
        }

        return { success: true, result: action.payload };
    }

    /**
     * Get project notification state
     */
    getProjectState(projectId: string): ProjectNotificationState | undefined {
        return this.projectStates.get(projectId);
    }

    /**
     * Clear all notifications for a project
     */
    clearProjectNotifications(projectId: string): void {
        this.notifications.delete(projectId);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private addNotification(projectId: string, notification: BuilderNotification): void {
        const existing = this.notifications.get(projectId) || [];
        existing.push(notification);
        this.notifications.set(projectId, existing);

        const state = this.projectStates.get(projectId);
        if (state) {
            state.lastNotificationAt = new Date();
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ModelNotificationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): ModelNotificationConfig {
        return { ...this.config };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: BuilderModelNotifications | null = null;

export function getBuilderModelNotifications(): BuilderModelNotifications {
    if (!instance) {
        instance = new BuilderModelNotifications();
    }
    return instance;
}

/**
 * Alert System Service
 * 
 * Manages alerts and notifications for system events.
 * Supports Slack, Discord, and PagerDuty integrations.
 */

import { getHealthMonitor } from './health-monitor.js';
import { getAutoRecoveryService } from './auto-recovery.js';

interface Alert {
    id: string;
    level: 'info' | 'warning' | 'critical' | 'emergency';
    title: string;
    message: string;
    service?: string;
    timestamp: Date;
    acknowledged: boolean;
    resolvedAt?: Date;
}

interface AlertConfig {
    slackWebhook?: string;
    discordWebhook?: string;
    emailRecipients?: string[];
    pagerDutyKey?: string;
}

export class AlertSystem {
    private alerts: Map<string, Alert> = new Map();
    private config: AlertConfig;
    private initialized = false;

    constructor(config: AlertConfig = {}) {
        this.config = {
            slackWebhook: process.env.SLACK_WEBHOOK_URL,
            discordWebhook: process.env.DISCORD_WEBHOOK_URL,
            emailRecipients: process.env.ALERT_EMAILS?.split(','),
            pagerDutyKey: process.env.PAGERDUTY_KEY,
            ...config,
        };
    }

    /**
     * Initialize alert listeners
     */
    initialize(): void {
        if (this.initialized) return;
        
        this.setupListeners();
        this.initialized = true;
        console.log('[AlertSystem] Initialized');
    }

    private setupListeners(): void {
        const monitor = getHealthMonitor();
        const recovery = getAutoRecoveryService();

        // Health events
        monitor.on('critical_failure', ({ service, error }) => {
            this.createAlert({
                level: 'critical',
                title: `Service Down: ${service}`,
                message: `The ${service} service is experiencing a critical failure. Error: ${error}`,
                service,
            });
        });

        monitor.on('system_critical', (health) => {
            this.createAlert({
                level: 'emergency',
                title: 'System Critical',
                message: `System health is critical. Active alerts: ${health.activeAlerts.join(', ')}`,
            });
        });

        monitor.on('service_recovered', ({ service }) => {
            this.resolveAlertsForService(service);
            this.createAlert({
                level: 'info',
                title: `Service Recovered: ${service}`,
                message: `The ${service} service has recovered and is now healthy.`,
                service,
            });
        });

        // Recovery events
        recovery.on('recovery_failed', ({ service, error }) => {
            this.createAlert({
                level: 'emergency',
                title: `Auto-Recovery Failed: ${service}`,
                message: `All automatic recovery attempts failed for ${service}. Manual intervention required. Error: ${error}`,
                service,
            });
        });

        recovery.on('recovery_success', ({ service, action }) => {
            this.createAlert({
                level: 'info',
                title: `Auto-Recovery Success: ${service}`,
                message: `Successfully recovered ${service} using ${action}.`,
                service,
            });
        });
    }

    /**
     * Create and send an alert
     */
    async createAlert(params: {
        level: Alert['level'];
        title: string;
        message: string;
        service?: string;
    }): Promise<Alert> {
        const alert: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            level: params.level,
            title: params.title,
            message: params.message,
            service: params.service,
            timestamp: new Date(),
            acknowledged: false,
        };

        this.alerts.set(alert.id, alert);

        // Send notifications based on alert level
        await this.sendNotifications(alert);

        console.log(`[Alert] ${alert.level.toUpperCase()}: ${alert.title}`);

        return alert;
    }

    private async sendNotifications(alert: Alert): Promise<void> {
        const promises: Promise<void>[] = [];

        // Always log
        console.log(`[ALERT ${alert.level}] ${alert.title}: ${alert.message}`);

        // Slack
        if (this.config.slackWebhook && ['critical', 'emergency'].includes(alert.level)) {
            promises.push(this.sendSlack(alert));
        }

        // Discord
        if (this.config.discordWebhook && ['warning', 'critical', 'emergency'].includes(alert.level)) {
            promises.push(this.sendDiscord(alert));
        }

        // PagerDuty (emergency only)
        if (this.config.pagerDutyKey && alert.level === 'emergency') {
            promises.push(this.sendPagerDuty(alert));
        }

        await Promise.allSettled(promises);
    }

    private async sendSlack(alert: Alert): Promise<void> {
        if (!this.config.slackWebhook) return;

        const emoji: Record<string, string> = {
            info: ':information_source:',
            warning: ':warning:',
            critical: ':rotating_light:',
            emergency: ':fire:',
        };

        try {
            await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `${emoji[alert.level]} *${alert.title}*`,
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `${emoji[alert.level]} *${alert.title}*\n${alert.message}`,
                            },
                        },
                        {
                            type: 'context',
                            elements: [
                                {
                                    type: 'mrkdwn',
                                    text: `Level: ${alert.level} | Service: ${alert.service || 'system'} | Time: ${alert.timestamp.toISOString()}`,
                                },
                            ],
                        },
                    ],
                }),
            });
        } catch (error) {
            console.error('[AlertSystem] Failed to send Slack notification:', error);
        }
    }

    private async sendDiscord(alert: Alert): Promise<void> {
        if (!this.config.discordWebhook) return;

        const color: Record<string, number> = {
            info: 0x3498db,
            warning: 0xf39c12,
            critical: 0xe74c3c,
            emergency: 0x8b0000,
        };

        try {
            await fetch(this.config.discordWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: alert.title,
                        description: alert.message,
                        color: color[alert.level],
                        fields: [
                            { name: 'Level', value: alert.level, inline: true },
                            { name: 'Service', value: alert.service || 'system', inline: true },
                        ],
                        timestamp: alert.timestamp.toISOString(),
                    }],
                }),
            });
        } catch (error) {
            console.error('[AlertSystem] Failed to send Discord notification:', error);
        }
    }

    private async sendPagerDuty(alert: Alert): Promise<void> {
        if (!this.config.pagerDutyKey) return;

        try {
            await fetch('https://events.pagerduty.com/v2/enqueue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    routing_key: this.config.pagerDutyKey,
                    event_action: 'trigger',
                    payload: {
                        summary: alert.title,
                        severity: alert.level === 'emergency' ? 'critical' : 'error',
                        source: 'kriptik-ai',
                        custom_details: {
                            message: alert.message,
                            service: alert.service,
                        },
                    },
                }),
            });
        } catch (error) {
            console.error('[AlertSystem] Failed to send PagerDuty notification:', error);
        }
    }

    /**
     * Resolve all alerts for a service
     */
    resolveAlertsForService(service: string): void {
        for (const [id, alert] of this.alerts) {
            if (alert.service === service && !alert.resolvedAt) {
                alert.resolvedAt = new Date();
            }
        }
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): Alert[] {
        return Array.from(this.alerts.values())
            .filter(a => !a.resolvedAt)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Get all alerts
     */
    getAllAlerts(limit: number = 100): Alert[] {
        return Array.from(this.alerts.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): boolean {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }
}

// Singleton
let alertSystem: AlertSystem | null = null;

export function getAlertSystem(): AlertSystem {
    if (!alertSystem) {
        alertSystem = new AlertSystem();
    }
    return alertSystem;
}


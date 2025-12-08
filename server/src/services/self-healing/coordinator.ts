/**
 * Self-Healing Coordinator
 * 
 * Main entry point for the self-healing system.
 * Coordinates health monitoring, auto-recovery, and alerts.
 */

import { getHealthMonitor, HealthMonitor } from './health-monitor.js';
import { getAutoRecoveryService, AutoRecoveryService } from './auto-recovery.js';
import { getAlertSystem, AlertSystem } from './alert-system.js';
import { getCreditPoolService } from '../billing/credit-pool.js';

export class SelfHealingCoordinator {
    private healthMonitor: HealthMonitor;
    private autoRecovery: AutoRecoveryService;
    private alertSystem: AlertSystem;
    private isRunning = false;

    constructor() {
        this.healthMonitor = getHealthMonitor();
        this.autoRecovery = getAutoRecoveryService();
        this.alertSystem = getAlertSystem();
    }

    /**
     * Initialize and start all self-healing systems
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[SelfHealing] Already running');
            return;
        }

        console.log('[SelfHealing] Starting self-healing coordinator...');

        // Initialize alert system listeners
        this.alertSystem.initialize();

        // Start health monitoring
        this.healthMonitor.start();

        // Initialize credit pool monitoring
        this.setupPoolMonitoring();

        this.isRunning = true;
        console.log('[SelfHealing] Self-healing coordinator started');
    }

    /**
     * Stop all self-healing systems
     */
    stop(): void {
        this.healthMonitor.stop();
        this.isRunning = false;
        console.log('[SelfHealing] Self-healing coordinator stopped');
    }

    private setupPoolMonitoring(): void {
        const pool = getCreditPoolService();

        pool.on('pool_alert', async ({ health, pool: poolData }) => {
            if (health.status === 'critical' || health.status === 'emergency') {
                await this.alertSystem.createAlert({
                    level: health.status === 'emergency' ? 'emergency' : 'critical',
                    title: 'Credit Pool Alert',
                    message: `Credit pool health: ${health.status}. API runway: ${health.apiRunway.toFixed(1)} days. Alerts: ${health.alerts.join('; ')}`,
                    service: 'billing',
                });
            }
        });
    }

    /**
     * Get comprehensive system status
     */
    getStatus(): {
        running: boolean;
        health: ReturnType<HealthMonitor['getSystemHealth']>;
        activeAlerts: ReturnType<AlertSystem['getActiveAlerts']>;
        recoveryHistory: ReturnType<AutoRecoveryService['getAttemptHistory']>;
    } {
        return {
            running: this.isRunning,
            health: this.healthMonitor.getSystemHealth(),
            activeAlerts: this.alertSystem.getActiveAlerts(),
            recoveryHistory: this.autoRecovery.getAttemptHistory(),
        };
    }

    /**
     * Manually trigger recovery for a service
     */
    async triggerRecovery(service: string): Promise<boolean> {
        return this.autoRecovery.manualRecovery(service);
    }

    /**
     * Get health monitor
     */
    getHealthMonitor(): HealthMonitor {
        return this.healthMonitor;
    }

    /**
     * Get alert system
     */
    getAlertSystem(): AlertSystem {
        return this.alertSystem;
    }
}

// Singleton
let coordinator: SelfHealingCoordinator | null = null;

export function getSelfHealingCoordinator(): SelfHealingCoordinator {
    if (!coordinator) {
        coordinator = new SelfHealingCoordinator();
    }
    return coordinator;
}


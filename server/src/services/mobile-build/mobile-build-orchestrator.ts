/**
 * Mobile Build Orchestrator
 *
 * Main orchestration service for mobile app builds
 * Coordinates:
 * - Expo project generation
 * - Code generation via BuildLoopOrchestrator
 * - EAS Build triggers
 * - Artifact management
 */

import { EventEmitter } from 'events';
import type {
  MobileBuild,
  MobileBuildRequest,
  MobileBuildConfig,
  MobileBuildEvent,
  BuildStatus,
} from './types.js';
import { ExpoProjectGenerator } from './expo-project-generator.js';
import { EASBuildService } from './eas-build-service.js';
import { BuildArtifactManager } from './build-artifact-manager.js';
import { v4 as uuid } from 'uuid';

export class MobileBuildOrchestrator extends EventEmitter {
  private builds: Map<string, MobileBuild> = new Map();
  private expoGenerator: ExpoProjectGenerator;
  private easService: EASBuildService;
  private artifactManager: BuildArtifactManager;

  constructor() {
    super();
    this.expoGenerator = new ExpoProjectGenerator();
    this.easService = new EASBuildService();
    this.artifactManager = new BuildArtifactManager();
  }

  /**
   * Start a new mobile app build
   */
  async startBuild(request: MobileBuildRequest): Promise<MobileBuild> {
    const buildId = uuid();
    const now = new Date();

    const build: MobileBuild = {
      id: buildId,
      projectId: request.projectId,
      userId: request.userId,
      prompt: request.prompt,
      config: request.config,
      status: 'queued',
      progress: 0,
      currentPhase: 'Initializing',
      sandboxId: request.sandboxId,
      easBuilds: {},
      createdAt: now,
      updatedAt: now,
    };

    this.builds.set(buildId, build);
    this.emitEvent(buildId, 'status', { status: 'queued', message: 'Build queued' });

    // Start the build pipeline asynchronously
    this.executeBuildPipeline(build).catch((error) => {
      this.handleBuildError(buildId, error);
    });

    return build;
  }

  /**
   * Get a build by ID
   */
  getBuild(buildId: string): MobileBuild | undefined {
    return this.builds.get(buildId);
  }

  /**
   * Get all builds for a user
   */
  getUserBuilds(userId: string): MobileBuild[] {
    return Array.from(this.builds.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a build
   */
  async cancelBuild(buildId: string): Promise<boolean> {
    const build = this.builds.get(buildId);
    if (!build) return false;

    if (build.status === 'complete' || build.status === 'failed') {
      return false;
    }

    // Cancel any EAS builds
    if (build.easBuilds.ios?.id) {
      await this.easService.cancelBuild(build.easBuilds.ios.id);
    }
    if (build.easBuilds.android?.id) {
      await this.easService.cancelBuild(build.easBuilds.android.id);
    }

    this.updateBuild(buildId, { status: 'cancelled' });
    this.emitEvent(buildId, 'status', { status: 'cancelled', message: 'Build cancelled' });

    return true;
  }

  /**
   * Execute the full build pipeline
   */
  private async executeBuildPipeline(build: MobileBuild): Promise<void> {
    const buildId = build.id;

    try {
      // Phase 1: Generate Expo project structure
      this.updateBuild(buildId, {
        status: 'in_progress',
        currentPhase: 'Generating project structure',
        progress: 10,
      });
      this.emitEvent(buildId, 'phase', {
        phase: 'project_generation',
        message: 'Generating Expo project structure',
      });

      const projectPath = await this.expoGenerator.generateProject({
        name: build.config.appName,
        slug: this.slugify(build.config.appName),
        version: build.config.version,
        bundleIdentifier: build.config.bundleIdentifier,
        package: build.config.bundleIdentifier,
        scheme: this.slugify(build.config.appName),
        iosSupportsTablet: build.config.iosConfig?.supportsTablet ?? false,
        androidMinSdkVersion: build.config.androidConfig?.minSdkVersion ?? 24,
        androidTargetSdkVersion: build.config.androidConfig?.targetSdkVersion ?? 34,
      });

      this.updateBuild(buildId, { expoProjectPath: projectPath, progress: 20 });

      // Phase 2: Generate app code based on prompt
      this.updateBuild(buildId, {
        currentPhase: 'Building app code',
        progress: 30,
      });
      this.emitEvent(buildId, 'phase', {
        phase: 'code_generation',
        message: 'Building mobile app based on your description',
      });

      // This would integrate with the BuildLoopOrchestrator
      // For now, simulate code generation progress
      await this.simulateCodeGeneration(buildId);

      this.updateBuild(buildId, { progress: 60 });

      // Phase 3: Trigger EAS builds based on platform selection
      this.updateBuild(buildId, {
        currentPhase: 'Compiling app',
        progress: 65,
      });
      this.emitEvent(buildId, 'phase', {
        phase: 'eas_build',
        message: 'Compiling native app bundles',
      });

      const currentBuild = this.builds.get(buildId)!;
      const easBuilds = await this.triggerEASBuilds(currentBuild);

      this.updateBuild(buildId, {
        easBuilds,
        progress: 70,
      });

      // Phase 4: Monitor EAS builds until completion
      await this.monitorEASBuilds(buildId);

      // Phase 5: Store and serve artifacts
      this.updateBuild(buildId, {
        currentPhase: 'Preparing download',
        progress: 95,
      });
      this.emitEvent(buildId, 'phase', {
        phase: 'artifact_storage',
        message: 'Preparing download links',
      });

      const finalBuild = this.builds.get(buildId)!;
      await this.artifactManager.storeArtifacts(finalBuild);

      // Complete
      this.updateBuild(buildId, {
        status: 'complete',
        currentPhase: 'Complete',
        progress: 100,
        completedAt: new Date(),
      });

      this.emitEvent(buildId, 'complete', {
        status: 'complete',
        message: 'Mobile app build complete',
      });
    } catch (error) {
      this.handleBuildError(buildId, error);
    }
  }

  /**
   * Trigger EAS builds for the specified platforms
   */
  private async triggerEASBuilds(
    build: MobileBuild
  ): Promise<MobileBuild['easBuilds']> {
    const easBuilds: MobileBuild['easBuilds'] = {};
    const { platform, distribution } = build.config;

    if (platform === 'ios' || platform === 'all') {
      const iosBuild = await this.easService.startBuild({
        projectPath: build.expoProjectPath!,
        platform: 'ios',
        profile: distribution,
      });
      easBuilds.ios = iosBuild;

      this.emitEvent(build.id, 'eas_update', {
        platform: 'ios',
        easBuildId: iosBuild.id,
        status: iosBuild.status,
        message: 'iOS build started',
      });
    }

    if (platform === 'android' || platform === 'all') {
      const androidBuild = await this.easService.startBuild({
        projectPath: build.expoProjectPath!,
        platform: 'android',
        profile: distribution,
      });
      easBuilds.android = androidBuild;

      this.emitEvent(build.id, 'eas_update', {
        platform: 'android',
        easBuildId: androidBuild.id,
        status: androidBuild.status,
        message: 'Android build started',
      });
    }

    return easBuilds;
  }

  /**
   * Monitor EAS builds until they complete
   */
  private async monitorEASBuilds(buildId: string): Promise<void> {
    const pollInterval = 10000; // 10 seconds
    const maxWait = 30 * 60 * 1000; // 30 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const build = this.builds.get(buildId);
      if (!build || build.status === 'cancelled') break;

      let allComplete = true;
      let progress = 70;

      // Check iOS build
      if (build.easBuilds.ios && build.easBuilds.ios.status !== 'complete') {
        const iosStatus = await this.easService.getBuildStatus(build.easBuilds.ios.id);
        if (iosStatus) {
          build.easBuilds.ios = { ...build.easBuilds.ios, ...iosStatus };
          this.emitEvent(buildId, 'eas_update', {
            platform: 'ios',
            easBuildId: build.easBuilds.ios.id,
            status: iosStatus.status,
            artifactUrl: iosStatus.artifactUrl,
            qrCodeUrl: iosStatus.qrCodeUrl,
          });

          if (iosStatus.status === 'failed') {
            throw new Error(`iOS build failed: ${iosStatus.error}`);
          }
          if (iosStatus.status !== 'complete') {
            allComplete = false;
          }
        }
      }

      // Check Android build
      if (build.easBuilds.android && build.easBuilds.android.status !== 'complete') {
        const androidStatus = await this.easService.getBuildStatus(build.easBuilds.android.id);
        if (androidStatus) {
          build.easBuilds.android = { ...build.easBuilds.android, ...androidStatus };
          this.emitEvent(buildId, 'eas_update', {
            platform: 'android',
            easBuildId: build.easBuilds.android.id,
            status: androidStatus.status,
            artifactUrl: androidStatus.artifactUrl,
            qrCodeUrl: androidStatus.qrCodeUrl,
          });

          if (androidStatus.status === 'failed') {
            throw new Error(`Android build failed: ${androidStatus.error}`);
          }
          if (androidStatus.status !== 'complete') {
            allComplete = false;
          }
        }
      }

      // Update progress
      const elapsed = Date.now() - startTime;
      progress = 70 + Math.min(20, (elapsed / maxWait) * 25);
      this.updateBuild(buildId, { easBuilds: build.easBuilds, progress });

      if (allComplete) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Simulate code generation progress (to be replaced with actual BuildLoopOrchestrator integration)
   */
  private async simulateCodeGeneration(buildId: string): Promise<void> {
    const phases = [
      'Analyzing requirements',
      'Designing UI structure',
      'Generating components',
      'Adding navigation',
      'Implementing features',
      'Verifying code quality',
    ];

    for (let i = 0; i < phases.length; i++) {
      const build = this.builds.get(buildId);
      if (!build || build.status === 'cancelled') break;

      const progress = 30 + Math.floor((i / phases.length) * 30);
      this.updateBuild(buildId, {
        currentPhase: phases[i],
        progress,
      });
      this.emitEvent(buildId, 'progress', {
        progress,
        phase: 'code_generation',
        message: phases[i],
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Handle build errors
   */
  private handleBuildError(buildId: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MobileBuildOrchestrator] Build ${buildId} failed:`, error);

    this.updateBuild(buildId, {
      status: 'failed',
      error: errorMessage,
    });

    this.emitEvent(buildId, 'error', {
      status: 'failed',
      error: errorMessage,
      message: `Build failed: ${errorMessage}`,
    });
  }

  /**
   * Update a build in storage
   */
  private updateBuild(buildId: string, updates: Partial<MobileBuild>): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    const updated = { ...build, ...updates, updatedAt: new Date() };
    this.builds.set(buildId, updated);
  }

  /**
   * Emit a build event
   */
  private emitEvent(
    buildId: string,
    type: MobileBuildEvent['type'],
    data: MobileBuildEvent['data']
  ): void {
    const event: MobileBuildEvent = {
      type,
      buildId,
      data,
      timestamp: Date.now(),
    };
    this.emit('build_event', event);
    this.emit(`build_${buildId}`, event);
  }

  /**
   * Convert a string to a URL-safe slug
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export const mobileBuildOrchestrator = new MobileBuildOrchestrator();
export default mobileBuildOrchestrator;

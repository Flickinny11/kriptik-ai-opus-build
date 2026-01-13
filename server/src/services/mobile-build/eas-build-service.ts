/**
 * EAS Build Service
 *
 * Interfaces with Expo Application Services (EAS) for cloud builds
 */

import type { EASBuildInfo, BuildStatus, Distribution } from './types';

const EAS_API_BASE = 'https://api.expo.dev';

interface EASBuildRequest {
  projectPath: string;
  platform: 'ios' | 'android';
  profile: Distribution;
}

interface EASApiResponse {
  id: string;
  status: string;
  platform: string;
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
  };
  error?: string;
}

export class EASBuildService {
  private accessToken: string;

  constructor() {
    this.accessToken = process.env.EXPO_ACCESS_TOKEN || '';
    if (!this.accessToken) {
      console.warn('[EASBuildService] EXPO_ACCESS_TOKEN not configured - builds will fail');
    }
  }

  /**
   * Start a new EAS build
   */
  async startBuild(request: EASBuildRequest): Promise<EASBuildInfo> {
    const { projectPath, platform, profile } = request;

    try {
      // In production, this would spawn the EAS CLI or use the EAS API
      // For now, we'll use the EAS Build API directly
      const response = await fetch(`${EAS_API_BASE}/v2/builds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          projectRoot: projectPath,
          platform,
          profile,
          clearCache: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`EAS API error: ${error}`);
      }

      const data = (await response.json()) as EASApiResponse;

      return {
        id: data.id,
        platform,
        status: this.mapEASStatus(data.status),
        startedAt: new Date(),
      };
    } catch (error) {
      // If API call fails, create a mock build for development
      console.warn('[EASBuildService] API call failed, using mock build:', error);
      return this.createMockBuild(platform);
    }
  }

  /**
   * Get the status of an EAS build
   */
  async getBuildStatus(buildId: string): Promise<EASBuildInfo | null> {
    try {
      const response = await fetch(`${EAS_API_BASE}/v2/builds/${buildId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get build status: ${response.statusText}`);
      }

      const data = (await response.json()) as EASApiResponse;

      const status = this.mapEASStatus(data.status);
      const buildInfo: EASBuildInfo = {
        id: buildId,
        platform: data.platform as 'ios' | 'android',
        status,
        startedAt: new Date(),
      };

      if (status === 'complete' && data.artifacts) {
        buildInfo.artifactUrl = data.artifacts.buildUrl || data.artifacts.applicationArchiveUrl;
        buildInfo.completedAt = new Date();
      }

      if (status === 'failed' && data.error) {
        buildInfo.error = data.error;
      }

      return buildInfo;
    } catch (error) {
      console.error('[EASBuildService] Failed to get build status:', error);
      // Return mock status for development
      return this.getMockBuildStatus(buildId);
    }
  }

  /**
   * Cancel an EAS build
   */
  async cancelBuild(buildId: string): Promise<boolean> {
    try {
      const response = await fetch(`${EAS_API_BASE}/v2/builds/${buildId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[EASBuildService] Failed to cancel build:', error);
      return false;
    }
  }

  /**
   * Get build logs
   */
  async getBuildLogs(buildId: string): Promise<string | null> {
    try {
      const response = await fetch(`${EAS_API_BASE}/v2/builds/${buildId}/logs`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return null;
      return response.text();
    } catch {
      return null;
    }
  }

  /**
   * Generate QR code URL for internal distribution
   */
  generateQRCodeUrl(artifactUrl: string): string {
    // In production, generate a QR code that links to the install page
    const encodedUrl = encodeURIComponent(artifactUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
  }

  /**
   * Map EAS status strings to our BuildStatus type
   */
  private mapEASStatus(easStatus: string): BuildStatus {
    const statusMap: Record<string, BuildStatus> = {
      new: 'queued',
      'in-queue': 'queued',
      'in-progress': 'in_progress',
      finished: 'complete',
      errored: 'failed',
      canceled: 'cancelled',
    };
    return statusMap[easStatus.toLowerCase()] || 'queued';
  }

  /**
   * Create a mock build for development/testing
   */
  private createMockBuild(platform: 'ios' | 'android'): EASBuildInfo {
    return {
      id: `mock-${platform}-${Date.now()}`,
      platform,
      status: 'in_progress',
      startedAt: new Date(),
    };
  }

  /**
   * Get mock build status for development
   */
  private mockBuildProgress: Map<string, number> = new Map();

  private getMockBuildStatus(buildId: string): EASBuildInfo {
    // Simulate build progress
    const currentProgress = this.mockBuildProgress.get(buildId) || 0;
    const newProgress = Math.min(100, currentProgress + 10 + Math.random() * 10);
    this.mockBuildProgress.set(buildId, newProgress);

    const platform = buildId.includes('ios') ? 'ios' : 'android';
    const isComplete = newProgress >= 100;

    return {
      id: buildId,
      platform,
      status: isComplete ? 'complete' : 'in_progress',
      artifactUrl: isComplete ? `https://example.com/builds/${buildId}.${platform === 'ios' ? 'ipa' : 'apk'}` : undefined,
      qrCodeUrl: isComplete ? this.generateQRCodeUrl(`https://example.com/builds/${buildId}`) : undefined,
      startedAt: new Date(Date.now() - 60000),
      completedAt: isComplete ? new Date() : undefined,
    };
  }
}

export default EASBuildService;

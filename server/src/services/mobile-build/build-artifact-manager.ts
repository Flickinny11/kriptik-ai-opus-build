/**
 * Build Artifact Manager
 *
 * Manages storage and retrieval of mobile app build artifacts (.ipa, .apk)
 */

import fs from 'fs/promises';
import path from 'path';
import type { MobileBuild, EASBuildInfo } from './types.js';

const ARTIFACT_STORAGE_PATH = process.env.ARTIFACT_STORAGE_PATH || '/tmp/kriptik-artifacts';
const ARTIFACT_BASE_URL = process.env.ARTIFACT_BASE_URL || 'https://artifacts.kriptik.ai';
const ARTIFACT_EXPIRY_DAYS = 7;

interface StoredArtifact {
  buildId: string;
  platform: 'ios' | 'android';
  originalUrl: string;
  localPath: string;
  publicUrl: string;
  qrCodeUrl: string;
  filename: string;
  size: number;
  storedAt: Date;
  expiresAt: Date;
}

export class BuildArtifactManager {
  private artifacts: Map<string, StoredArtifact> = new Map();

  constructor() {
    // Initialize storage directory
    this.initStorage();
  }

  private async initStorage(): Promise<void> {
    try {
      await fs.mkdir(ARTIFACT_STORAGE_PATH, { recursive: true });
    } catch (error) {
      console.error('[BuildArtifactManager] Failed to create storage directory:', error);
    }
  }

  /**
   * Store artifacts from a completed build
   */
  async storeArtifacts(build: MobileBuild): Promise<void> {
    const { id: buildId, easBuilds } = build;

    // Store iOS artifact if available
    if (easBuilds.ios?.artifactUrl) {
      await this.storeArtifact(buildId, 'ios', easBuilds.ios);
    }

    // Store Android artifact if available
    if (easBuilds.android?.artifactUrl) {
      await this.storeArtifact(buildId, 'android', easBuilds.android);
    }
  }

  /**
   * Store a single artifact
   */
  private async storeArtifact(
    buildId: string,
    platform: 'ios' | 'android',
    easBuild: EASBuildInfo
  ): Promise<StoredArtifact | null> {
    if (!easBuild.artifactUrl) return null;

    try {
      const extension = platform === 'ios' ? 'ipa' : 'apk';
      const filename = `${buildId}-${platform}.${extension}`;
      const localPath = path.join(ARTIFACT_STORAGE_PATH, filename);

      // Download the artifact
      const response = await fetch(easBuild.artifactUrl);
      if (!response.ok) {
        throw new Error(`Failed to download artifact: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(localPath, buffer);

      const stats = await fs.stat(localPath);
      const storedAt = new Date();
      const expiresAt = new Date(storedAt.getTime() + ARTIFACT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const artifact: StoredArtifact = {
        buildId,
        platform,
        originalUrl: easBuild.artifactUrl,
        localPath,
        publicUrl: `${ARTIFACT_BASE_URL}/${filename}`,
        qrCodeUrl: this.generateQRCode(`${ARTIFACT_BASE_URL}/install/${buildId}/${platform}`),
        filename,
        size: stats.size,
        storedAt,
        expiresAt,
      };

      this.artifacts.set(`${buildId}-${platform}`, artifact);
      return artifact;
    } catch (error) {
      console.error(`[BuildArtifactManager] Failed to store ${platform} artifact:`, error);
      return null;
    }
  }

  /**
   * Get artifact by build ID and platform
   */
  getArtifact(buildId: string, platform: 'ios' | 'android'): StoredArtifact | undefined {
    return this.artifacts.get(`${buildId}-${platform}`);
  }

  /**
   * Get all artifacts for a build
   */
  getBuildArtifacts(buildId: string): StoredArtifact[] {
    const result: StoredArtifact[] = [];
    const ios = this.artifacts.get(`${buildId}-ios`);
    const android = this.artifacts.get(`${buildId}-android`);
    if (ios) result.push(ios);
    if (android) result.push(android);
    return result;
  }

  /**
   * Delete expired artifacts
   */
  async cleanupExpiredArtifacts(): Promise<number> {
    const now = new Date();
    let deleted = 0;

    for (const [key, artifact] of this.artifacts.entries()) {
      if (artifact.expiresAt < now) {
        try {
          await fs.unlink(artifact.localPath);
          this.artifacts.delete(key);
          deleted++;
        } catch (error) {
          console.error(`[BuildArtifactManager] Failed to delete artifact ${key}:`, error);
        }
      }
    }

    return deleted;
  }

  /**
   * Delete artifacts for a specific build
   */
  async deleteBuildArtifacts(buildId: string): Promise<void> {
    for (const platform of ['ios', 'android'] as const) {
      const key = `${buildId}-${platform}`;
      const artifact = this.artifacts.get(key);
      if (artifact) {
        try {
          await fs.unlink(artifact.localPath);
          this.artifacts.delete(key);
        } catch (error) {
          console.error(`[BuildArtifactManager] Failed to delete ${key}:`, error);
        }
      }
    }
  }

  /**
   * Generate QR code URL for installing the app
   */
  private generateQRCode(installUrl: string): string {
    const encodedUrl = encodeURIComponent(installUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`;
  }

  /**
   * Get install page URL for a build
   */
  getInstallPageUrl(buildId: string, platform: 'ios' | 'android'): string {
    return `${ARTIFACT_BASE_URL}/install/${buildId}/${platform}`;
  }

  /**
   * Get artifact file path for serving
   */
  getArtifactFilePath(buildId: string, platform: 'ios' | 'android'): string | null {
    const artifact = this.artifacts.get(`${buildId}-${platform}`);
    return artifact?.localPath || null;
  }

  /**
   * Check if artifact exists and is not expired
   */
  isArtifactValid(buildId: string, platform: 'ios' | 'android'): boolean {
    const artifact = this.artifacts.get(`${buildId}-${platform}`);
    if (!artifact) return false;
    return artifact.expiresAt > new Date();
  }
}

export default BuildArtifactManager;

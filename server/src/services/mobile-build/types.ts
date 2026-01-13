/**
 * Mobile Build Types
 *
 * Type definitions for the mobile app build pipeline
 */

export type Platform = 'ios' | 'android' | 'all';
export type Distribution = 'development' | 'internal' | 'store';
export type BuildStatus = 'queued' | 'in_progress' | 'complete' | 'failed' | 'cancelled';

export interface IOSConfig {
  devices: ('iphone' | 'ipad')[];
  minimumVersion: string;
  supportsTablet: boolean;
}

export interface AndroidConfig {
  minSdkVersion: number;
  targetSdkVersion: number;
  devices: ('phone' | 'tablet')[];
}

export interface MobileBuildConfig {
  platform: Platform;
  iosConfig?: IOSConfig;
  androidConfig?: AndroidConfig;
  distribution: Distribution;
  appName: string;
  bundleIdentifier: string;
  version: string;
  buildNumber: number;
}

export interface MobileBuildRequest {
  projectId: string;
  userId: string;
  prompt: string;
  config: MobileBuildConfig;
  sandboxId?: string;
}

export interface EASBuildInfo {
  id: string;
  platform: 'ios' | 'android';
  status: BuildStatus;
  artifactUrl?: string;
  qrCodeUrl?: string;
  expiresAt?: Date;
  logs?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface MobileBuild {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  config: MobileBuildConfig;
  status: BuildStatus;
  progress: number;
  currentPhase?: string;
  sandboxId?: string;
  expoProjectPath?: string;
  easBuilds: {
    ios?: EASBuildInfo;
    android?: EASBuildInfo;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ExpoProjectTemplate {
  name: string;
  slug: string;
  version: string;
  bundleIdentifier: string;
  package: string;
  icon?: string;
  splash?: {
    image: string;
    backgroundColor: string;
    resizeMode: 'contain' | 'cover';
  };
  scheme: string;
  iosSupportsTablet: boolean;
  androidMinSdkVersion: number;
  androidTargetSdkVersion: number;
}

export interface MobileBuildEvent {
  type: 'status' | 'progress' | 'phase' | 'eas_update' | 'artifact' | 'error' | 'complete';
  buildId: string;
  data: {
    status?: BuildStatus;
    progress?: number;
    phase?: string;
    platform?: 'ios' | 'android';
    easBuildId?: string;
    artifactUrl?: string;
    qrCodeUrl?: string;
    error?: string;
    message?: string;
  };
  timestamp: number;
}

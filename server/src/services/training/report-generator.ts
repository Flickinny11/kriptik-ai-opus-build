/**
 * Training Report Generator
 *
 * Generates comprehensive training reports in HTML and JSON formats.
 * Includes metrics, configuration, usage code, and recommendations.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { db } from '../../db.js';
import { eq } from 'drizzle-orm';
import { trainingJobs, trainingReports } from '../../schema.js';
import { UsageCodeGenerator, getUsageCodeGenerator } from './usage-code-generator.js';
import { ReportTemplates, getReportTemplates, type ReportTemplateData } from './report-templates.js';
import type {
  TrainingConfig,
  TrainingReport,
  GPUConfig,
  MultiModalTrainingJob
} from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingReportData {
  jobId: string;
  userId: string;
  createdAt: string;
  completedAt: string;
  config: TrainingConfig;
  gpuUsed: GPUConfig;
  metrics: {
    finalLoss: number;
    bestLoss: number;
    lossHistory: number[];
    learningRateHistory?: number[];
    totalSteps: number;
    totalEpochs?: number;
    trainingDuration: number;
    samplesProcessed: number;
  };
  dataset: {
    source: string;
    totalSamples: number;
    trainSamples: number;
    valSamples?: number;
    description: string;
    samplePreviews?: string[];
  };
  model: {
    baseModelId: string;
    baseModelName: string;
    outputModelName: string;
    parameterCount?: number;
    loraRank?: number;
  };
  location: {
    huggingFaceRepo?: string;
    huggingFaceUrl?: string;
    s3Url?: string;
    downloadUrl?: string;
  };
  endpoints?: {
    inferenceUrl?: string;
    apiKey?: string;
  };
  cost: {
    gpuHours: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
  };
}

export interface GeneratedReport {
  htmlReport: string;
  jsonReport: string;
  pdfUrl?: string;
  recommendations: string[];
}

// =============================================================================
// TRAINING REPORT GENERATOR
// =============================================================================

export class TrainingReportGenerator {
  private usageCodeGenerator: UsageCodeGenerator;
  private reportTemplates: ReportTemplates;

  constructor() {
    this.usageCodeGenerator = getUsageCodeGenerator();
    this.reportTemplates = getReportTemplates();
  }

  /**
   * Generate a complete training report
   */
  async generateReport(data: TrainingReportData): Promise<GeneratedReport> {
    // Generate usage code
    const modelUrl = data.location.huggingFaceUrl || data.location.huggingFaceRepo || '';
    const usageCode = this.usageCodeGenerator.generateAll(data.config, {
      modelUrl,
      endpoint: data.endpoints?.inferenceUrl,
      apiKey: data.endpoints?.apiKey,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(data);

    // Convert to TrainingReport format
    const trainingReport: TrainingReport = this.convertToTrainingReport(data);

    // Generate HTML report
    const templateData: ReportTemplateData = {
      report: trainingReport,
      usageCode: {
        python: usageCode.python,
        typescript: usageCode.typescript,
        curl: usageCode.curl,
      },
      recommendations,
    };

    const htmlReport = this.reportTemplates.generateHTML(templateData);

    // Generate JSON report
    const jsonReport = JSON.stringify({
      ...trainingReport,
      usageCode,
      recommendations,
    }, null, 2);

    return {
      htmlReport,
      jsonReport,
      recommendations,
    };
  }

  /**
   * Generate report from training job
   */
  async generateFromJob(job: MultiModalTrainingJob): Promise<GeneratedReport> {
    const report = job.result?.trainingReport;
    if (!report) {
      throw new Error('Training job has no report data');
    }

    const data: TrainingReportData = {
      jobId: job.id,
      userId: job.userId,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || new Date().toISOString(),
      config: job.config,
      gpuUsed: job.config.gpuConfig,
      metrics: {
        finalLoss: report.metrics.finalLoss,
        bestLoss: report.metrics.bestLoss,
        lossHistory: report.metrics.lossHistory || [],
        learningRateHistory: report.metrics.learningRateHistory,
        totalSteps: report.metrics.totalSteps,
        totalEpochs: report.metrics.totalEpochs,
        trainingDuration: report.metrics.trainingDurationSeconds,
        samplesProcessed: report.metrics.samplesProcessed,
      },
      dataset: {
        source: report.datasetInfo.source,
        totalSamples: report.datasetInfo.samples,
        trainSamples: report.datasetInfo.trainSamples,
        valSamples: report.datasetInfo.validationSamples,
        description: report.datasetInfo.description,
      },
      model: {
        baseModelId: job.config.baseModelId,
        baseModelName: job.config.baseModelName,
        outputModelName: job.config.outputModelName,
      },
      location: {
        huggingFaceRepo: report.modelLocation.huggingFaceRepo,
        huggingFaceUrl: report.modelLocation.huggingFaceUrl,
        s3Url: report.modelLocation.s3Url,
      },
      endpoints: report.endpoints ? {
        inferenceUrl: report.endpoints.inferenceUrl,
      } : undefined,
      cost: {
        gpuHours: report.cost.gpuHours,
        gpuCost: report.cost.gpuCostUsd,
        storageCost: report.cost.storageCostUsd || 0,
        totalCost: report.cost.totalCostUsd,
      },
    };

    return this.generateReport(data);
  }

  /**
   * Generate report from job ID
   */
  async generateFromJobId(jobId: string): Promise<GeneratedReport> {
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Training job ${jobId} not found`);
    }

    // Convert DB job to MultiModalTrainingJob format
    const config = job.config as TrainingConfig;
    const trainingReport = job.trainingReport as TrainingReport | null;

    const multiModalJob: MultiModalTrainingJob = {
      id: job.id,
      userId: job.userId,
      projectId: job.projectId || undefined,
      config,
      status: job.status as MultiModalTrainingJob['status'],
      progress: {
        status: job.status as MultiModalTrainingJob['progress']['status'],
        currentStep: 0,
        totalSteps: 0,
      },
      result: trainingReport ? {
        success: job.status === 'completed',
        trainingReport,
        totalCost: trainingReport.cost?.totalCostUsd || 0,
        totalDuration: trainingReport.metrics?.trainingDurationSeconds || 0,
      } : undefined,
      logs: [],
      createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
      startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
      completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
    };

    return this.generateFromJob(multiModalJob);
  }

  /**
   * Save report to database
   */
  async saveReport(
    jobId: string,
    userId: string,
    report: GeneratedReport
  ): Promise<string> {
    const reportId = `report-${jobId}-${Date.now()}`;

    await db.insert(trainingReports).values({
      id: reportId,
      trainingJobId: jobId,
      userId,
      htmlReport: report.htmlReport,
      jsonReport: report.jsonReport,
      pdfUrl: report.pdfUrl || null,
      createdAt: new Date().toISOString(),
    });

    return reportId;
  }

  /**
   * Get saved report
   */
  async getReport(reportId: string): Promise<{
    htmlReport: string;
    jsonReport: string;
    pdfUrl?: string;
  } | null> {
    const report = await db.query.trainingReports.findFirst({
      where: eq(trainingReports.id, reportId),
    });

    if (!report) {
      return null;
    }

    return {
      htmlReport: report.htmlReport,
      jsonReport: report.jsonReport,
      pdfUrl: report.pdfUrl || undefined,
    };
  }

  /**
   * Generate recommendations based on training results
   */
  generateRecommendations(data: TrainingReportData): string[] {
    const recommendations: string[] = [];
    const { metrics, config, cost } = data;

    // Loss-based recommendations
    if (metrics.finalLoss > 2.0) {
      recommendations.push(
        'Consider training for more steps or epochs to reduce the loss further.'
      );
    } else if (metrics.finalLoss < 0.1 && metrics.lossHistory.length > 100) {
      recommendations.push(
        'The very low loss might indicate overfitting. Consider adding regularization or reducing epochs.'
      );
    }

    // Check for loss plateau
    if (metrics.lossHistory.length > 50) {
      const lastLosses = metrics.lossHistory.slice(-50);
      const avgChange = lastLosses.reduce((sum, val, i) => {
        if (i === 0) return sum;
        return sum + Math.abs(val - lastLosses[i - 1]);
      }, 0) / (lastLosses.length - 1);

      if (avgChange < 0.001) {
        recommendations.push(
          'Training appears to have plateaued. Consider using a learning rate scheduler or early stopping.'
        );
      }
    }

    // Modality-specific recommendations
    if (config.modality === 'llm') {
      const llmConfig = config as import('./types.js').LLMTrainingConfig;

      if (llmConfig.loraConfig && llmConfig.loraConfig.rank > 64) {
        recommendations.push(
          'High LoRA rank detected. Consider reducing rank for faster inference with minimal quality loss.'
        );
      }

      if (!llmConfig.quantization || llmConfig.quantization === 'none') {
        recommendations.push(
          'Consider using quantization (4-bit or 8-bit) for faster inference with reduced memory usage.'
        );
      }
    }

    if (config.modality === 'image') {
      const imageConfig = config as import('./types.js').ImageTrainingConfig;

      if (imageConfig.steps < 500) {
        recommendations.push(
          'Consider training for more steps (1000+) for better image quality and style transfer.'
        );
      }

      if (!imageConfig.triggerWord) {
        recommendations.push(
          'Consider adding a unique trigger word to make the style easier to invoke in prompts.'
        );
      }
    }

    // Cost recommendations
    if (cost.totalCost > 50) {
      recommendations.push(
        'For future training runs, consider using smaller batch sizes or fewer steps to reduce costs.'
      );
    }

    // Deployment recommendations
    if (data.location.huggingFaceUrl) {
      recommendations.push(
        `Your model is available on HuggingFace. Consider creating an Inference Endpoint for production use.`
      );
    }

    // General recommendations
    recommendations.push(
      'Test the model with diverse inputs before deploying to production.'
    );

    return recommendations;
  }

  /**
   * Generate usage code for a training config
   */
  generateUsageCode(config: TrainingConfig, endpoint?: string): string {
    const modelUrl = config.hubRepoName || config.outputModelName;
    return this.usageCodeGenerator.generatePythonCode(config, modelUrl);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private convertToTrainingReport(data: TrainingReportData): TrainingReport {
    return {
      id: `report-${data.jobId}`,
      trainingId: data.jobId,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      config: data.config,
      metrics: {
        finalLoss: data.metrics.finalLoss,
        bestLoss: data.metrics.bestLoss,
        lossHistory: data.metrics.lossHistory,
        learningRateHistory: data.metrics.learningRateHistory,
        totalSteps: data.metrics.totalSteps,
        totalEpochs: data.metrics.totalEpochs,
        trainingDurationSeconds: data.metrics.trainingDuration,
        samplesProcessed: data.metrics.samplesProcessed,
      },
      datasetInfo: {
        source: data.dataset.source,
        samples: data.dataset.totalSamples,
        trainSamples: data.dataset.trainSamples,
        validationSamples: data.dataset.valSamples,
        description: data.dataset.description,
      },
      gpuInfo: {
        gpuType: data.gpuUsed.gpuType,
        gpuCount: data.gpuUsed.gpuCount,
        provider: data.gpuUsed.provider,
      },
      modelLocation: {
        huggingFaceRepo: data.location.huggingFaceRepo,
        huggingFaceUrl: data.location.huggingFaceUrl,
        s3Url: data.location.s3Url,
      },
      endpoints: data.endpoints ? {
        inferenceUrl: data.endpoints.inferenceUrl,
      } : undefined,
      cost: {
        gpuHours: data.cost.gpuHours,
        gpuCostUsd: data.cost.gpuCost,
        storageCostUsd: data.cost.storageCost,
        totalCostUsd: data.cost.totalCost,
        creditsUsed: Math.ceil(data.cost.totalCost * 100), // 1 credit = $0.01
      },
      usageCode: {
        python: this.usageCodeGenerator.generatePythonCode(
          data.config,
          data.location.huggingFaceUrl || ''
        ),
        typescript: this.usageCodeGenerator.generateTypeScriptCode(
          data.config,
          data.location.huggingFaceUrl || ''
        ),
      },
      recommendations: this.generateRecommendations(data),
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let reportGeneratorInstance: TrainingReportGenerator | null = null;

export function getTrainingReportGenerator(): TrainingReportGenerator {
  if (!reportGeneratorInstance) {
    reportGeneratorInstance = new TrainingReportGenerator();
  }
  return reportGeneratorInstance;
}

export default TrainingReportGenerator;

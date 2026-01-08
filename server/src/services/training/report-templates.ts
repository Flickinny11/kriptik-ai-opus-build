/**
 * Training Report Templates
 *
 * HTML templates for training reports.
 * Supports all modalities with modality-specific sections.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { TrainingReport, ModelModality } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ReportTemplateData {
  report: TrainingReport;
  usageCode: {
    python: string;
    typescript: string;
    curl?: string;
  };
  recommendations: string[];
}

// =============================================================================
// BASE STYLES
// =============================================================================

const BASE_STYLES = `
<style>
  :root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --success: #10b981;
    --warning: #f59e0b;
    --error: #ef4444;
    --background: #0f172a;
    --surface: #1e293b;
    --surface-light: #334155;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --border: #475569;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--background);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    background: linear-gradient(135deg, var(--primary-dark), var(--primary));
    padding: 2rem;
    border-radius: 1rem;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .header .subtitle {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1rem;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-success { background: var(--success); color: white; }
  .badge-warning { background: var(--warning); color: black; }
  .badge-error { background: var(--error); color: white; }
  .badge-primary { background: var(--primary); color: white; }

  .section {
    background: var(--surface);
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid var(--border);
  }

  .section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }

  @media (max-width: 768px) {
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
  }

  .stat-card {
    background: var(--surface-light);
    border-radius: 0.75rem;
    padding: 1rem;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  td {
    color: var(--text);
  }

  pre {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: var(--surface-light);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
  }

  .tab {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .tab.active {
    background: var(--primary);
    color: white;
  }

  .chart-container {
    background: var(--surface-light);
    border-radius: 0.75rem;
    padding: 1rem;
    min-height: 300px;
  }

  .recommendation {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--surface-light);
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .recommendation-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .link {
    color: var(--primary);
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  .footer {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
</style>
`;

// =============================================================================
// TEMPLATE GENERATOR CLASS
// =============================================================================

export class ReportTemplates {
  /**
   * Generate full HTML report
   */
  generateHTML(data: ReportTemplateData): string {
    const { report, usageCode, recommendations } = data;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Training Report - ${report.config.outputModelName}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    ${this.generateHeader(report)}
    ${this.generateSummaryStats(report)}
    ${this.generateConfigSection(report)}
    ${this.generateMetricsSection(report)}
    ${this.generateDatasetSection(report)}
    ${this.generateModelSection(report)}
    ${this.generateCostSection(report)}
    ${this.generateUsageSection(usageCode)}
    ${this.generateRecommendationsSection(recommendations)}
    ${this.generateFooter()}
  </div>
  ${this.generateChartScript(report)}
</body>
</html>`;
  }

  /**
   * Generate header section
   */
  private generateHeader(report: TrainingReport): string {
    const statusBadge = report.metrics.finalLoss < 1.0
      ? '<span class="badge badge-success">Successful</span>'
      : '<span class="badge badge-warning">Review Recommended</span>';

    return `
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>${report.config.outputModelName}</h1>
          <p class="subtitle">Training Report • ${new Date(report.createdAt).toLocaleDateString()}</p>
        </div>
        ${statusBadge}
      </div>
    </div>`;
  }

  /**
   * Generate summary statistics
   */
  private generateSummaryStats(report: TrainingReport): string {
    const duration = report.metrics.trainingDurationSeconds;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return `
    <div class="section">
      <h2>📊 Summary</h2>
      <div class="grid grid-4">
        <div class="stat-card">
          <div class="stat-value">${report.metrics.finalLoss.toFixed(4)}</div>
          <div class="stat-label">Final Loss</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.metrics.totalSteps.toLocaleString()}</div>
          <div class="stat-label">Total Steps</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${durationStr}</div>
          <div class="stat-label">Training Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${report.cost.totalCostUsd.toFixed(2)}</div>
          <div class="stat-label">Total Cost</div>
        </div>
      </div>
    </div>`;
  }

  /**
   * Generate configuration section
   */
  private generateConfigSection(report: TrainingReport): string {
    const config = report.config;

    let modalitySpecific = '';
    if (config.modality === 'llm') {
      const llmConfig = config as import('./types.js').LLMTrainingConfig;
      modalitySpecific = `
        <tr><td>Epochs</td><td>${llmConfig.epochs}</td></tr>
        <tr><td>Max Sequence Length</td><td>${llmConfig.maxSeqLength}</td></tr>
        <tr><td>Quantization</td><td>${llmConfig.quantization || 'None'}</td></tr>
        ${llmConfig.loraConfig ? `
        <tr><td>LoRA Rank</td><td>${llmConfig.loraConfig.rank}</td></tr>
        <tr><td>LoRA Alpha</td><td>${llmConfig.loraConfig.alpha}</td></tr>
        ` : ''}
      `;
    } else if (config.modality === 'image') {
      const imageConfig = config as import('./types.js').ImageTrainingConfig;
      modalitySpecific = `
        <tr><td>Steps</td><td>${imageConfig.steps}</td></tr>
        <tr><td>Resolution</td><td>${imageConfig.resolution}px</td></tr>
        ${imageConfig.triggerWord ? `<tr><td>Trigger Word</td><td><code>${imageConfig.triggerWord}</code></td></tr>` : ''}
        ${imageConfig.loraConfig ? `
        <tr><td>LoRA Rank</td><td>${imageConfig.loraConfig.rank}</td></tr>
        ` : ''}
      `;
    }

    return `
    <div class="section">
      <h2>⚙️ Training Configuration</h2>
      <div class="grid grid-2">
        <div>
          <table>
            <tr><td>Base Model</td><td>${config.baseModelName}</td></tr>
            <tr><td>Modality</td><td>${this.formatModality(config.modality)}</td></tr>
            <tr><td>Method</td><td>${config.method}</td></tr>
            <tr><td>Learning Rate</td><td>${this.formatLearningRate(config)}</td></tr>
            <tr><td>Batch Size</td><td>${this.getBatchSize(config)}</td></tr>
          </table>
        </div>
        <div>
          <table>
            ${modalitySpecific}
          </table>
        </div>
      </div>
    </div>`;
  }

  /**
   * Generate metrics section with chart
   */
  private generateMetricsSection(report: TrainingReport): string {
    const metrics = report.metrics;

    return `
    <div class="section">
      <h2>📈 Training Metrics</h2>
      <div class="grid grid-2">
        <div class="chart-container">
          <canvas id="lossChart"></canvas>
        </div>
        <div>
          <table>
            <tr><td>Final Loss</td><td>${metrics.finalLoss.toFixed(4)}</td></tr>
            <tr><td>Best Loss</td><td>${metrics.bestLoss.toFixed(4)}</td></tr>
            <tr><td>Total Steps</td><td>${metrics.totalSteps.toLocaleString()}</td></tr>
            ${metrics.totalEpochs ? `<tr><td>Total Epochs</td><td>${metrics.totalEpochs}</td></tr>` : ''}
            <tr><td>Samples Processed</td><td>${metrics.samplesProcessed.toLocaleString()}</td></tr>
            ${metrics.tokensProcessed ? `<tr><td>Tokens Processed</td><td>${metrics.tokensProcessed.toLocaleString()}</td></tr>` : ''}
          </table>
        </div>
      </div>
    </div>`;
  }

  /**
   * Generate dataset section
   */
  private generateDatasetSection(report: TrainingReport): string {
    const dataset = report.datasetInfo;

    return `
    <div class="section">
      <h2>📁 Dataset Information</h2>
      <table>
        <tr><td>Source</td><td>${dataset.source}</td></tr>
        <tr><td>Total Samples</td><td>${dataset.samples.toLocaleString()}</td></tr>
        <tr><td>Training Samples</td><td>${dataset.trainSamples.toLocaleString()}</td></tr>
        ${dataset.validationSamples ? `<tr><td>Validation Samples</td><td>${dataset.validationSamples.toLocaleString()}</td></tr>` : ''}
        <tr><td>Description</td><td>${dataset.description}</td></tr>
      </table>
    </div>`;
  }

  /**
   * Generate model section
   */
  private generateModelSection(report: TrainingReport): string {
    const location = report.modelLocation;

    return `
    <div class="section">
      <h2>🤖 Model Information</h2>
      <table>
        <tr><td>Output Model Name</td><td>${report.config.outputModelName}</td></tr>
        <tr><td>Base Model</td><td>${report.config.baseModelId}</td></tr>
        ${location.huggingFaceUrl ? `<tr><td>HuggingFace</td><td><a class="link" href="${location.huggingFaceUrl}" target="_blank">${location.huggingFaceRepo || location.huggingFaceUrl}</a></td></tr>` : ''}
        ${location.s3Url ? `<tr><td>S3 Backup</td><td><code>${location.s3Url}</code></td></tr>` : ''}
        ${report.endpoints?.inferenceUrl ? `<tr><td>Inference Endpoint</td><td><code>${report.endpoints.inferenceUrl}</code></td></tr>` : ''}
      </table>
    </div>`;
  }

  /**
   * Generate cost section
   */
  private generateCostSection(report: TrainingReport): string {
    const cost = report.cost;

    return `
    <div class="section">
      <h2>💰 Cost Breakdown</h2>
      <div class="grid grid-3">
        <div class="stat-card">
          <div class="stat-value">${cost.gpuHours.toFixed(2)}h</div>
          <div class="stat-label">GPU Hours</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${cost.gpuCostUsd.toFixed(2)}</div>
          <div class="stat-label">GPU Cost</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${cost.totalCostUsd.toFixed(2)}</div>
          <div class="stat-label">Total Cost</div>
        </div>
      </div>
      ${cost.storageCostUsd ? `<p style="margin-top: 1rem; color: var(--text-muted);">Storage Cost: $${cost.storageCostUsd.toFixed(2)}</p>` : ''}
    </div>`;
  }

  /**
   * Generate usage code section
   */
  private generateUsageSection(usageCode: ReportTemplateData['usageCode']): string {
    return `
    <div class="section">
      <h2>💻 Usage Code</h2>
      <div class="tabs">
        <button class="tab active" onclick="showTab('python')">Python</button>
        <button class="tab" onclick="showTab('typescript')">TypeScript</button>
        ${usageCode.curl ? `<button class="tab" onclick="showTab('curl')">cURL</button>` : ''}
      </div>
      <div id="python-code">
        <pre><code>${this.escapeHtml(usageCode.python)}</code></pre>
      </div>
      <div id="typescript-code" style="display: none;">
        <pre><code>${this.escapeHtml(usageCode.typescript)}</code></pre>
      </div>
      ${usageCode.curl ? `
      <div id="curl-code" style="display: none;">
        <pre><code>${this.escapeHtml(usageCode.curl)}</code></pre>
      </div>
      ` : ''}
    </div>
    <script>
      function showTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('[id$="-code"]').forEach(c => c.style.display = 'none');
        event.target.classList.add('active');
        document.getElementById(tab + '-code').style.display = 'block';
      }
    </script>`;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendationsSection(recommendations: string[]): string {
    if (recommendations.length === 0) return '';

    return `
    <div class="section">
      <h2>💡 Recommendations</h2>
      ${recommendations.map(rec => `
        <div class="recommendation">
          <span class="recommendation-icon">✨</span>
          <span>${rec}</span>
        </div>
      `).join('')}
    </div>`;
  }

  /**
   * Generate footer
   */
  private generateFooter(): string {
    return `
    <div class="footer">
      <p>Generated by KripTik AI • ${new Date().toISOString()}</p>
      <p><a class="link" href="https://kriptik.ai">kriptik.ai</a></p>
    </div>`;
  }

  /**
   * Generate chart script
   */
  private generateChartScript(report: TrainingReport): string {
    const lossHistory = report.metrics.lossHistory || [];
    const labels = lossHistory.map((_, i) => i + 1);

    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const ctx = document.getElementById('lossChart')?.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: 'Training Loss',
              data: ${JSON.stringify(lossHistory)},
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                labels: { color: '#f1f5f9' }
              }
            },
            scales: {
              x: {
                title: { display: true, text: 'Step', color: '#94a3b8' },
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(71, 85, 105, 0.5)' }
              },
              y: {
                title: { display: true, text: 'Loss', color: '#94a3b8' },
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(71, 85, 105, 0.5)' }
              }
            }
          }
        });
      }
    </script>`;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private formatModality(modality: ModelModality): string {
    const labels: Record<ModelModality, string> = {
      llm: 'Large Language Model',
      image: 'Image Generation',
      video: 'Video Generation',
      audio: 'Audio/Speech',
      multimodal: 'Multimodal',
    };
    return labels[modality] || modality;
  }

  private formatLearningRate(config: TrainingReport['config']): string {
    if ('learningRate' in config) {
      const lr = (config as { learningRate: number }).learningRate;
      return lr.toExponential(1);
    }
    return 'N/A';
  }

  private getBatchSize(config: TrainingReport['config']): string {
    if ('batchSize' in config) {
      return String((config as { batchSize: number }).batchSize);
    }
    return 'N/A';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let reportTemplatesInstance: ReportTemplates | null = null;

export function getReportTemplates(): ReportTemplates {
  if (!reportTemplatesInstance) {
    reportTemplatesInstance = new ReportTemplates();
  }
  return reportTemplatesInstance;
}

export default ReportTemplates;

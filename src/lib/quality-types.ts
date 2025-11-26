export type ScanCategory = 'security' | 'quality' | 'testing' | 'accessibility' | 'performance';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface QualityIssue {
    id: string;
    category: ScanCategory;
    severity: IssueSeverity;
    message: string;
    file?: string;
    line?: number;
    fixAvailable: boolean;
    description: string;
    codeSnippet?: string;
}

export interface CategoryScore {
    score: number; // 0-100
    issues: QualityIssue[];
}

export interface QualityReport {
    id: string;
    timestamp: string;
    overallScore: number;
    status: 'ready' | 'needs_review' | 'critical_issues';
    categories: Record<ScanCategory, CategoryScore>;
}

import { create } from 'zustand';
import { QualityReport } from '../lib/quality-types';

interface QualityStore {
    report: QualityReport | null;
    isScanning: boolean;
    isFixing: string | null; // issueId being fixed

    setReport: (report: QualityReport) => void;
    setIsScanning: (isScanning: boolean) => void;
    setIsFixing: (issueId: string | null) => void;
    resolveIssue: (issueId: string) => void;
}

export const useQualityStore = create<QualityStore>((set) => ({
    report: null,
    isScanning: false,
    isFixing: null,

    setReport: (report) => set({ report }),
    setIsScanning: (isScanning) => set({ isScanning }),
    setIsFixing: (issueId) => set({ isFixing: issueId }),

    resolveIssue: (issueId: string) => set((state: QualityStore) => {
        if (!state.report) return {};

        // Deep clone to update nested state safely
        const newReport = JSON.parse(JSON.stringify(state.report)) as QualityReport;

        // Remove issue from all categories
        Object.keys(newReport.categories).forEach((key) => {
            const category = key as keyof typeof newReport.categories;
            newReport.categories[category].issues = newReport.categories[category].issues.filter(
                (i: { id: string }) => i.id !== issueId
            );

            // Recalculate score slightly (mock logic)
            if (state.report!.categories[category].issues.find((i: { id: string }) => i.id === issueId)) {
                newReport.categories[category].score = Math.min(100, newReport.categories[category].score + 5);
            }
        });

        // Recalculate overall score
        const scores = Object.values(newReport.categories).map(c => c.score);
        newReport.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        if (newReport.overallScore >= 95) newReport.status = 'ready';
        else if (newReport.overallScore >= 80) newReport.status = 'needs_review';

        return { report: newReport };
    })
}));

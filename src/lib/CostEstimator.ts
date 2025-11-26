import { CostEstimate } from './cost-types';

export class CostEstimator {
    estimate(prompt: string): CostEstimate {
        // Simple heuristic-based estimation
        const length = prompt.length;
        const hasAuth = prompt.toLowerCase().includes('auth') || prompt.toLowerCase().includes('login');
        const hasDatabase = prompt.toLowerCase().includes('database') || prompt.toLowerCase().includes('schema');
        const hasApi = prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('fetch');

        let complexity: 'Low' | 'Medium' | 'High' = 'Low';
        let baseCredits = 5;

        if (length > 200 || (hasAuth && hasDatabase)) {
            complexity = 'Medium';
            baseCredits = 12;
        }

        if (length > 500 || (hasAuth && hasDatabase && hasApi)) {
            complexity = 'High';
            baseCredits = 20;
        }

        // Add variation based on keywords
        let totalCredits = baseCredits;
        const costDrivers = [];

        if (hasAuth) {
            totalCredits += 3;
            costDrivers.push('Authentication System');
        }
        if (hasDatabase) {
            totalCredits += 3;
            costDrivers.push('Database Schema');
        }
        if (hasApi) {
            totalCredits += 2;
            costDrivers.push('API Integration');
        }

        // Distribute credits across agents
        const planning = Math.ceil(totalCredits * 0.15);
        const generation = Math.ceil(totalCredits * 0.5);
        const testing = Math.ceil(totalCredits * 0.25);
        const refinement = totalCredits - planning - generation - testing;

        return {
            totalCredits,
            complexity,
            breakdown: {
                planning,
                generation,
                testing,
                refinement
            },
            costDrivers,
            confidence: 85
        };
    }
}

export const costEstimator = new CostEstimator();

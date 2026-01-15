/**
 * AI Lab Standalone Page
 *
 * Full-page access to the comprehensive AI Lab:
 * - Open Source Studio (HuggingFace models)
 * - Training & Fine-tuning
 * - Endpoints management
 * - Multi-agent research orchestration
 */

import { AILabHub } from '../components/ai-lab/AILabHub';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import './AILabPage.css';

export default function AILabPage() {
    return (
        <div className="ai-lab-page">
            <HoverSidebar />
            <main className="ai-lab-main">
                <AILabHub />
            </main>
        </div>
    );
}

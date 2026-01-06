/**
 * AI Lab Standalone Page (PROMPT 9)
 *
 * Full-page access to the AI Lab multi-agent research orchestration system.
 */

import { AILab } from '../components/ai-lab/AILab';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import './AILabPage.css';

export default function AILabPage() {
    return (
        <div className="ai-lab-page">
            <HoverSidebar />
            <main className="ai-lab-main">
                <AILab />
            </main>
        </div>
    );
}

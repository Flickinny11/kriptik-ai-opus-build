/**
 * Open Source Studio Standalone Page (PROMPT 9)
 *
 * Full-page access to the Open Source Studio for browsing HuggingFace models.
 */

import { OpenSourceStudio } from '../components/open-source-studio/OpenSourceStudio';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import './OpenSourceStudioPage.css';

export default function OpenSourceStudioPage() {
    return (
        <div className="open-source-studio-page">
            <HoverSidebar />
            <main className="open-source-studio-main">
                <OpenSourceStudio />
            </main>
        </div>
    );
}

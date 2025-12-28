import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Production canonical-domain redirect:
// - Ensures users landing on the Vercel-assigned frontend URL end up on `kriptik.app`
// - This is required for embedded/mobile browsers where cross-site cookies are blocked
if (import.meta.env.PROD && typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const canonicalHost = 'kriptik.app';

    const isKriptikVercelFrontend =
        host.endsWith('.vercel.app') && host.includes('kriptik');

    const isWWW = host === 'www.kriptik.app';

    if ((isKriptikVercelFrontend || isWWW) && host !== canonicalHost) {
        const url = new URL(window.location.href);
        url.hostname = canonicalHost;
        // Preserve protocol/path/query/hash exactly
        window.location.replace(url.toString());
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
)

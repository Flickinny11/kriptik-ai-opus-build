import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from './components/ui/toaster';
import { CriticalErrorBoundary, PageErrorBoundary } from './components/ui/error-boundary';
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import Builder from './pages/Builder';
import UsageDashboard from './pages/UsageDashboard';
import SettingsPage from './pages/SettingsPage';
import FixMyApp from './pages/FixMyApp';
import MyStuff from './pages/MyStuff';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { useUserStore } from './store/useUserStore';

// Lazy load new pages (will be created)
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const DesignRoom = lazy(() => import('./pages/DesignRoom'));
const CredentialVault = lazy(() => import('./pages/CredentialVault'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const MyAccount = lazy(() => import('./pages/MyAccount'));
const GitHubCallback = lazy(() => import('./pages/GitHubCallback'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

// GPU & AI Lab pages (PROMPT 9)
const OpenSourceStudioPage = lazy(() => import('./pages/OpenSourceStudioPage'));
const AILabPage = lazy(() => import('./pages/AILabPage'));

// Endpoints Dashboard (Auto-Deploy Private Endpoints - PROMPT 5)
const EndpointsPage = lazy(() => import('./pages/EndpointsPage'));

// Loading fallback
const PageLoader = () => (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
);

function App() {
    const { initialize } = useUserStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <CriticalErrorBoundary>
            <Routes>
                {/* Public Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={
                        <PageErrorBoundary>
                            <LandingPage />
                        </PageErrorBoundary>
                    } />
                    <Route path="/privacy" element={
                        <PageErrorBoundary>
                            <PrivacyPolicy />
                        </PageErrorBoundary>
                    } />
                </Route>

                {/* Auth Routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={
                        <PageErrorBoundary>
                            <LoginPage />
                        </PageErrorBoundary>
                    } />
                    <Route path="/signup" element={
                        <PageErrorBoundary>
                            <SignupPage />
                        </PageErrorBoundary>
                    } />
                </Route>

                {/* Protected Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={
                        <PageErrorBoundary>
                            <Dashboard />
                        </PageErrorBoundary>
                    } />
                    <Route path="/my-stuff" element={
                        <PageErrorBoundary>
                            <MyStuff />
                        </PageErrorBoundary>
                    } />
                    <Route path="/templates" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <TemplatesPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/design-room" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <DesignRoom />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/vault" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <CredentialVault />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/integrations" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <IntegrationsPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/account" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <MyAccount />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/usage" element={
                        <PageErrorBoundary>
                            <UsageDashboard />
                        </PageErrorBoundary>
                    } />
                    <Route path="/settings" element={
                        <PageErrorBoundary>
                            <SettingsPage />
                        </PageErrorBoundary>
                    } />
                    <Route path="/fix-my-app" element={
                        <PageErrorBoundary>
                            <FixMyApp />
                        </PageErrorBoundary>
                    } />
                    <Route path="/auth/github/callback" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <GitHubCallback />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/oauth-callback" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <OAuthCallback />
                            </Suspense>
                        </PageErrorBoundary>
                    } />

                    {/* GPU & AI Lab Routes (PROMPT 9) */}
                    <Route path="/ai-lab" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <AILabPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/open-source-studio" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <OpenSourceStudioPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />

                    {/* Endpoints Management (Auto-Deploy Private Endpoints - PROMPT 5) */}
                    <Route path="/endpoints" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <EndpointsPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                    <Route path="/ai-lab/endpoints" element={
                        <PageErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <EndpointsPage />
                            </Suspense>
                        </PageErrorBoundary>
                    } />
                </Route>

                {/* Builder Route */}
                <Route element={<BuilderLayout />}>
                    <Route path="/builder/:projectId" element={
                        <PageErrorBoundary>
                            <Builder />
                        </PageErrorBoundary>
                    } />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
        </CriticalErrorBoundary>
    );
}

export default App;

// Placeholder for BuilderLayout if not imported
import { Outlet } from 'react-router-dom';
const BuilderLayout = () => <Outlet />;

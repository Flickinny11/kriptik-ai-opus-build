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
import { useUserStore } from './store/useUserStore';

// Lazy load new pages (will be created)
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const DesignRoom = lazy(() => import('./pages/DesignRoom'));
const CredentialVault = lazy(() => import('./pages/CredentialVault'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const MyAccount = lazy(() => import('./pages/MyAccount'));

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

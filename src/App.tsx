import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from './components/ui/toaster';
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import Builder from './pages/Builder';
import UsageDashboard from './pages/UsageDashboard';
import { useUserStore } from './store/useUserStore';

function App() {
    const { initialize } = useUserStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <>
            <Routes>
                {/* Public Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={<LandingPage />} />
                </Route>

                {/* Auth Routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                </Route>

                {/* Protected Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/usage" element={<UsageDashboard />} />
                </Route>

                {/* Builder Route */}
                <Route element={<BuilderLayout />}>
                    <Route path="/builder/:projectId" element={<Builder />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
        </>
    );
}

export default App;

// Placeholder for BuilderLayout if not imported
import { Outlet } from 'react-router-dom';
const BuilderLayout = () => <Outlet />;

import { Outlet } from 'react-router-dom';

export default function MainLayout() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <main>
                <Outlet />
            </main>
        </div>
    );
}

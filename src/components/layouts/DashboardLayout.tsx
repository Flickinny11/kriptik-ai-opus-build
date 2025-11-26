import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
            <header className="border-b border-border p-4 flex justify-between items-center">
                <div className="font-bold text-xl">KripTik AI</div>
                <div>User Profile</div>
            </header>
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}

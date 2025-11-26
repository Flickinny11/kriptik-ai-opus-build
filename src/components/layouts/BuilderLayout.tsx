import { Outlet } from 'react-router-dom';

export default function BuilderLayout() {
    return (
        <div className="h-screen bg-background font-sans antialiased overflow-hidden">
            <Outlet />
        </div>
    );
}

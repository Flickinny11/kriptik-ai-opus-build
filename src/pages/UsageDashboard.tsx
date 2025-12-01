import { useNavigate } from 'react-router-dom';
import { useCostStore } from '../store/useCostStore';
import { ScrollArea } from '../components/ui/scroll-area';
import { Coins, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import '../styles/realistic-glass.css';

export default function UsageDashboard() {
    const navigate = useNavigate();
    const { balance, usageHistory } = useCostStore();
    const percentUsed = (balance.totalUsedThisMonth / balance.limit) * 100;

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}>
            <HoverSidebar />

            {/* Header - 3D Glass */}
            <header
                className="sticky top-0 z-40"
                style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.45) 100%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    boxShadow: `
                        0 4px 20px rgba(0, 0, 0, 0.06),
                        0 1px 0 rgba(255, 255, 255, 0.8),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.04),
                        inset 0 1px 1px rgba(255, 255, 255, 0.9)
                    `,
                }}
            >
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HandDrawnArrow className="mr-2" />
                        <div
                            className="flex items-center gap-4 cursor-pointer group"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated />
                            <GlitchText
                                text="KripTik AI"
                                className="text-2xl group-hover:opacity-90 transition-opacity"
                            />
                        </div>
                    </div>
                </div>
            </header>

        <div className="p-8 space-y-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>Usage & Billing</h1>
                <div className="text-sm" style={{ color: '#666' }}>
                    Billing Cycle Resets: {new Date(balance.resetDate).toLocaleDateString()}
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex flex-row items-center justify-between pb-2">
                        <div className="text-sm font-medium" style={{ color: '#666' }}>Current Balance</div>
                        <Coins className="h-4 w-4" style={{ color: '#a03810' }} />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>{balance.available} Credits</div>
                    <p className="text-xs" style={{ color: '#888' }}>
                        {balance.limit - balance.available} used this month
                    </p>
                </div>
                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex flex-row items-center justify-between pb-2">
                        <div className="text-sm font-medium" style={{ color: '#666' }}>Monthly Usage</div>
                        <TrendingUp className="h-4 w-4" style={{ color: '#a03810' }} />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>{Math.round(percentUsed)}%</div>
                    <div className="h-2 mt-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                        <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                                width: `${percentUsed}%`,
                                background: percentUsed > 80 ? '#dc2626' : 'linear-gradient(90deg, #a03810, #ea580c)'
                            }}
                        />
                    </div>
                </div>
                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex flex-row items-center justify-between pb-2">
                        <div className="text-sm font-medium" style={{ color: '#666' }}>Projected Cost</div>
                        <Zap className="h-4 w-4" style={{ color: '#a03810' }} />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>~{Math.round(balance.totalUsedThisMonth * 1.2)} Credits</div>
                    <p className="text-xs" style={{ color: '#888' }}>
                        Based on current usage trends
                    </p>
                </div>
            </div>

            {/* Usage History */}
            <div className="glass-panel p-6 rounded-2xl flex-1">
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>Usage History</h3>
                <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                        {usageHistory.length === 0 ? (
                            <div className="text-center py-8" style={{ color: '#666' }}>
                                No usage history available yet.
                            </div>
                        ) : (
                            usageHistory.map((log) => (
                                <div key={log.id} className="flex items-center justify-between pb-4 last:pb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                    <div className="space-y-1">
                                        <div className="font-medium flex items-center gap-2">
                                            <span className="capitalize" style={{ color: '#1a1a1a' }}>{log.actionType}</span>
                                            <span className="text-xs font-normal" style={{ color: '#888' }}>
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-sm" style={{ color: '#666' }}>{log.details}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold" style={{ color: '#dc2626' }}>-{log.creditsUsed} credits</div>
                                        <div className="text-xs" style={{ color: '#888' }}>Balance: {log.balanceAfter}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Alerts Configuration (Mock) */}
            <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                    <AlertTriangle className="h-5 w-5" style={{ color: '#eab308' }} />
                    Usage Alerts
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="font-medium" style={{ color: '#1a1a1a' }}>50% Usage Warning</div>
                            <div className="text-sm" style={{ color: '#666' }}>Get notified when you use half your credits</div>
                        </div>
                        <div className="h-6 w-11 rounded-full relative cursor-pointer" style={{ background: 'linear-gradient(90deg, #a03810, #ea580c)' }}>
                            <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="font-medium" style={{ color: '#1a1a1a' }}>Low Balance Alert (10 credits)</div>
                            <div className="text-sm" style={{ color: '#666' }}>Get notified when running low</div>
                        </div>
                        <div className="h-6 w-11 rounded-full relative cursor-pointer" style={{ background: 'linear-gradient(90deg, #a03810, #ea580c)' }}>
                            <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}

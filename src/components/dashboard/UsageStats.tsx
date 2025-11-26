
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Zap, Database, HardDrive } from 'lucide-react';

export default function UsageStats() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Usage & Credits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> AI Generations</span>
                        <span className="text-muted-foreground">850 / 1000</span>
                    </div>
                    <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" /> Database Rows</span>
                        <span className="text-muted-foreground">2.4k / 10k</span>
                    </div>
                    <Progress value={24} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-green-500" /> Storage</span>
                        <span className="text-muted-foreground">450MB / 1GB</span>
                    </div>
                    <Progress value={45} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}

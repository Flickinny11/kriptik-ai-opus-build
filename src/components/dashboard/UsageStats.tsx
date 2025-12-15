
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { ZapIcon, DatabaseIcon, ServerIcon } from '../ui/icons';

export default function UsageStats() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Usage & Credits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><ZapIcon size={16} className="text-yellow-500" /> AI Generations</span>
                        <span className="text-muted-foreground">850 / 1000</span>
                    </div>
                    <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><DatabaseIcon size={16} className="text-blue-500" /> Database Rows</span>
                        <span className="text-muted-foreground">2.4k / 10k</span>
                    </div>
                    <Progress value={24} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><ServerIcon size={16} className="text-green-500" /> Storage</span>
                        <span className="text-muted-foreground">450MB / 1GB</span>
                    </div>
                    <Progress value={45} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}

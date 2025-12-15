import { useCollaborationStore } from '../../store/useCollaborationStore';
import { ScrollArea } from '../ui/scroll-area';
import { ActivityIcon } from '../ui/icons';

export default function ActivityFeed() {
    const { activityFeed } = useCollaborationStore();

    return (
        <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <ActivityIcon size={16} className="" />
                Activity
            </div>
            <ScrollArea className="h-[150px]">
                <div className="space-y-3">
                    {activityFeed.map((item) => (
                        <div key={item.id} className="text-sm">
                            <span className="font-medium text-foreground">{item.userName}</span>
                            <span className="text-muted-foreground"> {item.action} </span>
                            <span className="text-primary">{item.target}</span>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

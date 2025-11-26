import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Button } from '../ui/button';
import { UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export default function CollaborationHeader() {
    const { collaborators, setShareModalOpen } = useCollaborationStore();

    return (
        <div className="flex items-center gap-2 mr-4">
            <div className="flex -space-x-2">
                {collaborators.map((user) => (
                    <TooltipProvider key={user.id}>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={`relative w-8 h-8 rounded-full border-2 border-background overflow-hidden ring-2 ring-offset-1 ring-offset-background ${user.status === 'online' ? 'ring-green-500' : 'ring-transparent'}`}>
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{user.name}</p>
                                {user.currentFile && <p className="text-xs text-muted-foreground">Editing {user.currentFile}</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>

            <Button size="sm" variant="outline" className="ml-2 gap-2" onClick={() => setShareModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Share
            </Button>
        </div>
    );
}

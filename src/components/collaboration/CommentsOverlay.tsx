import { useCollaborationStore } from '../../store/useCollaborationStore';
import { MessageSquare, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';

export default function CommentsOverlay() {
    const { comments, resolveComment } = useCollaborationStore();
    const [activeComment, setActiveComment] = useState<string | null>(null);

    // Filter only unresolved comments
    const activeComments = comments.filter(c => !c.resolved);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            {activeComments.map((comment) => (
                <div
                    key={comment.id}
                    className="absolute pointer-events-auto"
                    style={{
                        left: comment.position?.x || '50%',
                        top: comment.position?.y || '50%'
                    }}
                >
                    <div className="relative group">
                        <div
                            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => setActiveComment(activeComment === comment.id ? null : comment.id)}
                        >
                            <MessageSquare className="h-4 w-4" />
                        </div>

                        {/* Comment Popover */}
                        {(activeComment === comment.id || false) && (
                            <div className="absolute left-10 top-0 w-64 bg-card border border-border rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-left-2">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-sm">{comment.userName}</span>
                                    <span className="text-xs text-muted-foreground">{new Date(comment.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm mb-3">{comment.content}</p>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => resolveComment(comment.id)}>
                                        <Check className="h-3 w-3 mr-1" /> Resolve
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

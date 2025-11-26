import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useCollaborationStore, UserRole } from '../../store/useCollaborationStore';
import { Copy, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../ui/use-toast';

export default function ShareModal() {
    const { isShareModalOpen, setShareModalOpen, collaborators, currentUser, addCollaborator, removeCollaborator } = useCollaborationStore();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('editor');
    const { toast } = useToast();

    const handleInvite = () => {
        if (email) {
            addCollaborator(email, role);
            setEmail('');
            toast({ title: "Invitation sent", description: `Invited ${email} as ${role}` });
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText("https://kriptik.ai/p/abc123");
        toast({ title: "Copied!", description: "Link copied to clipboard" });
    };

    return (
        <Dialog open={isShareModalOpen} onOpenChange={setShareModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Share "My Awesome App"</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                            <Label>Invite by email</Label>
                            <Input
                                placeholder="colleague@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Select value={role} onValueChange={(v: string) => setRole(v as UserRole)}>
                            <SelectTrigger className="w-[110px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleInvite}>Send</Button>
                    </div>

                    <div className="space-y-4">
                        <Label>Team Members</Label>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={currentUser.avatar} className="w-8 h-8 rounded-full" alt={currentUser.name} />
                                    <div>
                                        <div className="text-sm font-medium">{currentUser.name} (You)</div>
                                        <div className="text-xs text-muted-foreground">{currentUser.email}</div>
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">Owner</span>
                            </div>

                            {collaborators.map(user => (
                                <div key={user.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={user.avatar} className="w-8 h-8 rounded-full" alt={user.name} />
                                        <div>
                                            <div className="text-sm font-medium">{user.name}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCollaborator(user.id)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <Label>Share Link</Label>
                        <div className="flex gap-2 mt-2">
                            <Input readOnly value="https://kriptik.ai/p/abc123" className="bg-muted" />
                            <Button variant="outline" onClick={copyLink}>
                                <Copy className="h-4 w-4 mr-2" /> Copy
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';

const formSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
});

export default function NewProjectModal() {
    const navigate = useNavigate();
    const { addProject } = useProjectStore();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);

        try {
            // Create project via backend API (persists to database)
            const result = await apiClient.createProject({
                name: values.name,
                description: values.description || undefined,
                framework: 'react',
            });

            console.log('[NewProjectModal] Created project:', result.project);

            // Also add to local store for immediate UI update
            addProject({
                id: result.project.id,
                name: result.project.name,
                description: result.project.description || "",
                createdAt: new Date(result.project.createdAt),
                lastEdited: "Just now",
                framework: result.project.framework,
                status: "development" as const
            });

            toast.success('Project created!');
            setOpen(false);
            navigate(`/builder/${result.project.id}`);
        } catch (error: unknown) {
            console.error('[NewProjectModal] Failed to create project:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create project');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="group"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '14px',
                        background: 'linear-gradient(145deg, rgba(35,35,40,0.9) 0%, rgba(22,22,28,0.95) 100%)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(80,80,90,0.4)',
                        boxShadow: `
                            0 4px 0 rgba(0,0,0,0.5),
                            0 8px 20px rgba(0,0,0,0.35),
                            0 16px 40px rgba(0,0,0,0.2),
                            inset 0 1px 0 rgba(255,255,255,0.06)
                        `,
                        transform: 'perspective(600px) rotateX(2deg) rotateY(1deg)',
                        transformStyle: 'preserve-3d',
                        transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#d4d4d4',
                        cursor: 'pointer',
                        letterSpacing: '0.02em',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = `
                            0 8px 0 rgba(0,0,0,0.5),
                            0 16px 32px rgba(0,0,0,0.4),
                            0 24px 56px rgba(0,0,0,0.25),
                            0 4px 20px rgba(220,38,38,0.12),
                            inset 0 1px 0 rgba(255,255,255,0.1)
                        `;
                        e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)';
                        e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'perspective(600px) rotateX(2deg) rotateY(1deg)';
                        e.currentTarget.style.boxShadow = `
                            0 4px 0 rgba(0,0,0,0.5),
                            0 8px 20px rgba(0,0,0,0.35),
                            0 16px 40px rgba(0,0,0,0.2),
                            inset 0 1px 0 rgba(255,255,255,0.06)
                        `;
                        e.currentTarget.style.borderColor = 'rgba(80,80,90,0.4)';
                        e.currentTarget.style.color = '#d4d4d4';
                    }}
                >
                    {/* Plus icon container with 3D effect */}
                    <span
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '8px',
                            background: 'linear-gradient(145deg, rgba(220,38,38,0.15) 0%, rgba(185,28,28,0.2) 100%)',
                            border: '1px solid rgba(220,38,38,0.2)',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <Plus className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
                    </span>
                    <span>New Project</span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                        Start building your next AI-powered application.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input id="name" placeholder="My Awesome App" {...form.register("name")} />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what you want to build..."
                            {...form.register("description")}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Project"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

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
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> New Project
                </Button>
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

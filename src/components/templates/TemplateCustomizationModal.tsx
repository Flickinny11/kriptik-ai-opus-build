import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useTemplateStore } from '../../store/useTemplateStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { useNavigate } from 'react-router-dom';

export default function TemplateCustomizationModal() {
    const { isCustomizing, setCustomizing, selectedTemplate, useTemplate, setGalleryOpen } = useTemplateStore();
    const { addProject } = useProjectStore();
    const [projectName, setProjectName] = useState('My Awesome Project');
    const [primaryColor, setPrimaryColor] = useState('#7C3AED');
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const navigate = useNavigate();

    if (!selectedTemplate) return null;

    const handleFeatureToggle = (feature: string) => {
        const newFeatures = new Set(selectedFeatures);
        if (newFeatures.has(feature)) {
            newFeatures.delete(feature);
        } else {
            newFeatures.add(feature);
        }
        setSelectedFeatures(newFeatures);
    };

    const handleCreate = () => {
        useTemplate(selectedTemplate.id, {
            projectName,
            primaryColor,
            features: Array.from(selectedFeatures)
        });

        // Create project in store
        const newProject = {
            id: Math.random().toString(36).substr(2, 9),
            name: projectName,
            description: `Created from ${selectedTemplate.name} template`,
            createdAt: new Date(),
            lastEdited: "Just now",
            framework: selectedTemplate.techStack.framework,
            status: "development" as const
        };

        addProject(newProject);

        toast({
            title: "Project created! 🎉",
            description: `${projectName} is ready to go. Opening builder...`
        });

        // Close modals
        setCustomizing(false);
        setGalleryOpen(false);

        // Navigate to builder with project ID
        setTimeout(() => {
            navigate(`/builder/${newProject.id}`);
        }, 500);
    };

    return (
        <Dialog open={isCustomizing} onOpenChange={setCustomizing}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Customize "{selectedTemplate.name}"</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Project Name */}
                    <div className="space-y-2">
                        <Label>Project Name</Label>
                        <Input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="My Awesome Project"
                        />
                    </div>

                    {/* Primary Color */}
                    <div className="space-y-2">
                        <Label>Primary Color</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-16 h-10 p-1"
                            />
                            <Input
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                placeholder="#7C3AED"
                                className="flex-1"
                            />
                        </div>
                    </div>

                    {/* Features to Include */}
                    <div className="space-y-3">
                        <Label>Features to Include</Label>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {selectedTemplate.features.map((feature) => (
                                <div key={feature} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={feature}
                                        checked={selectedFeatures.has(feature)}
                                        onCheckedChange={() => handleFeatureToggle(feature)}
                                    />
                                    <label
                                        htmlFor={feature}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {feature}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <div>
                                <span className="font-semibold">Templates are free!</span>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Estimated setup time: {selectedTemplate.estimatedTime} • 0 credits
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setCustomizing(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Create Project
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


import { useMemoryStore } from '../../store/useMemoryStore';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BrainIcon, WorkflowIcon, LayersIcon, ShieldIcon, InfoIcon } from '../ui/icons';

export default function ProjectMemoryPanel() {
    const { memory } = useMemoryStore();
    const { knowledgeGraph } = memory;

    return (
        <div className="h-full flex flex-col bg-background border-l border-border w-[300px]">
            <div className="p-4 border-b border-border flex items-center gap-2">
                <BrainIcon size={20} className="text-primary" />
                <h2 className="font-semibold">Project Memory</h2>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* Architecture Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <WorkflowIcon size={16} />
                            Architecture
                        </div>
                        <Card>
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-sm font-medium">
                                    {knowledgeGraph.architecture.framework}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                                {knowledgeGraph.architecture.reasoning}
                            </CardContent>
                        </Card>
                    </section>

                    {/* Patterns Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <LayersIcon size={16} />
                            Active Patterns
                        </div>
                        <div className="grid gap-2">
                            {knowledgeGraph.patterns.map((pattern) => (
                                <div key={pattern.id} className="bg-card border border-border rounded-md p-2 text-xs">
                                    <div className="font-medium mb-1 capitalize">{pattern.category}</div>
                                    <div className="text-muted-foreground">{pattern.description}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Business Rules Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <ShieldIcon size={16} />
                            Business Rules
                        </div>
                        <div className="space-y-2">
                            {knowledgeGraph.businessRules.map((rule) => (
                                <div key={rule.id} className="flex items-start gap-2 text-xs bg-primary/5 p-2 rounded-md border border-primary/10">
                                    <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                    <span>{rule.rule}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Learnings Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <InfoIcon size={16} />
                            Learned Preferences
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {knowledgeGraph.learnings.map((learning) => (
                                <Badge key={learning.id} variant="secondary" className="text-xs font-normal">
                                    {learning.insight}
                                </Badge>
                            ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>
        </div>
    );
}

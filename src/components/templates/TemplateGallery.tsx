import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { useTemplateStore } from '../../store/useTemplateStore';
import { SearchIcon, UsersIcon, ClockIcon, ZapIcon } from '../ui/icons';

const CATEGORIES = [
    { id: 'all', label: 'All Templates' },
    { id: 'landing-pages', label: 'Landing Pages' },
    { id: 'dashboards', label: 'Dashboards' },
    { id: 'e-commerce', label: 'E-commerce' },
    { id: 'auth', label: 'Auth & Account' },
    { id: 'full-apps', label: 'Full Applications' }
];

export default function TemplateGallery() {
    const {
        isGalleryOpen,
        setGalleryOpen,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        getFilteredTemplates,
        setSelectedTemplate,
        setCustomizing
    } = useTemplateStore();

    const filteredTemplates = getFilteredTemplates();

    const handleUseTemplate = (template: any) => {
        setSelectedTemplate(template);
        setCustomizing(true);
    };

    return (
        <Dialog open={isGalleryOpen} onOpenChange={setGalleryOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Template Gallery</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Search */}
                    <div className="relative">
                        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Categories */}
                    <div className="flex gap-2 flex-wrap">
                        {CATEGORIES.map((cat) => (
                            <Button
                                key={cat.id}
                                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.label}
                            </Button>
                        ))}
                    </div>

                    {/* Templates Grid */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                            {filteredTemplates.map((template) => (
                                <Card key={template.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="relative h-40 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                                        <img
                                            src={template.thumbnail}
                                            alt={template.name}
                                            className="w-full h-full object-cover opacity-60"
                                        />
                                        <div className="absolute top-2 right-2">
                                            <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                                                {template.difficulty}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <div>
                                            <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {template.description}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {template.tags.slice(0, 3).map(tag => (
                                                <Badge key={tag} variant="outline" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <UsersIcon size={12} />
                                                    {template.useCount.toLocaleString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ClockIcon size={12} />
                                                    {template.estimatedTime}
                                                </span>
                                            </div>
                                            <span className="flex items-center gap-1 text-primary">
                                                <ZapIcon size={12} />
                                                Free
                                            </span>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => window.open(template.livePreview, '_blank')}
                                            >
                                                Preview
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleUseTemplate(template)}
                                            >
                                                Use This
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {filteredTemplates.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No templates found matching your criteria.</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

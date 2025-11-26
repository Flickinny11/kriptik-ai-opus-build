import { Link } from 'react-router-dom';
import { MoreVertical, GitBranch, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ProjectCardProps {
    project: {
        id: string;
        name: string;
        description: string;
        lastEdited: string;
        framework: string;
        status: 'live' | 'development';
    };
}

export default function ProjectCard({ project }: ProjectCardProps) {
    return (
        <Card className="group hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                    <Link to={`/builder?project=${project.id}`} className="hover:underline">
                        {project.name}
                    </Link>
                </CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Deploy</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {project.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 rounded-full bg-accent text-accent-foreground">
                        {project.framework}
                    </span>
                    <span className={`px-2 py-1 rounded-full ${project.status === 'live' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                        {project.status}
                    </span>
                </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground border-t border-border pt-4 flex justify-between">
                <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {project.lastEdited}
                </div>
                <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    main
                </div>
            </CardFooter>
        </Card>
    );
}

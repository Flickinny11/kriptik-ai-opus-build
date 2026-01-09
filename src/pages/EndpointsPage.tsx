/**
 * Endpoint Management Dashboard
 *
 * Displays all deployed endpoints with status, usage stats, and management actions.
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature (PROMPT 5).
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PlusIcon,
  SearchIcon,
  ActivityIcon,
  ClockIcon,
  CopyIcon,
  CodeIcon,
  SettingsIcon,
  TrashIcon,
  MoreHorizontalIcon,
  RefreshIcon,
  ExternalLinkIcon,
  LoadingIcon,
  ZapIcon,
} from '@/components/ui/icons';
import { toast } from 'sonner';
import { useUserEndpoints, useTerminateEndpoint, useCopyApiKey } from '@/hooks/useEndpoints';
import { ModalityIcon, getModalityLabel } from '@/components/endpoints/ModalityIcon';
import { ProviderBadge } from '@/components/endpoints/ProviderBadge';
import { EndpointStatusBadge } from '@/components/endpoints/EndpointStatusBadge';
import { CodeSamplesModal, generateCodeSamples } from '@/components/endpoints/CodeSamplesModal';
import type { EndpointInfo, EndpointConnection } from '@/components/endpoints/types';

// =============================================================================
// Stats Card Component
// =============================================================================

function StatsCard({
  title,
  value,
  icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p className={cn(
              'text-xs mt-1',
              trend.value >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// Endpoint Card Component
// =============================================================================

function EndpointCard({
  endpoint,
  onShowCode,
  onTerminate,
  onCopyUrl,
  onCopyApiKey,
}: {
  endpoint: EndpointInfo;
  onShowCode: () => void;
  onTerminate: () => void;
  onCopyUrl: () => void;
  onCopyApiKey: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Card className="p-4 hover:border-amber-500/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
            <ModalityIcon modality={endpoint.modality} size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">{endpoint.modelName}</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {endpoint.endpointUrl || 'Provisioning...'}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontalIcon size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopyUrl}>
              <CopyIcon size={14} className="mr-2" />
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyApiKey}>
              <CopyIcon size={14} className="mr-2" />
              Copy API Key
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowCode}>
              <CodeIcon size={14} className="mr-2" />
              View Code Samples
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/endpoints/${endpoint.id}`)}>
              <SettingsIcon size={14} className="mr-2" />
              Manage
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500 focus:text-red-500"
              onClick={onTerminate}
            >
              <TrashIcon size={14} className="mr-2" />
              Terminate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <EndpointStatusBadge status={endpoint.status} />
        <ProviderBadge provider={endpoint.provider} />
        <Badge variant="outline" className="text-xs">
          {getModalityLabel(endpoint.modality).split(' ')[0]}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">GPU</span>
          <p className="font-medium">{endpoint.gpuType || 'Auto'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Workers</span>
          <p className="font-medium">{endpoint.minWorkers}-{endpoint.maxWorkers}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Created</span>
          <p className="font-medium">
            {new Date(endpoint.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function EndpointsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConnection | null>(null);
  const [terminateDialog, setTerminateDialog] = useState<{ open: boolean; endpoint: EndpointInfo | null }>({
    open: false,
    endpoint: null,
  });

  // Fetch endpoints
  const { data: endpoints, isLoading, refetch } = useUserEndpoints();
  const { terminateEndpoint, isLoading: isTerminating } = useTerminateEndpoint();
  const { copyApiKey } = useCopyApiKey();

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return [];

    return endpoints.filter((ep: EndpointInfo) => {
      // Search filter
      if (search && !ep.modelName.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Modality filter
      if (modalityFilter !== 'all' && ep.modality !== modalityFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && ep.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [endpoints, search, modalityFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!endpoints) return { total: 0, active: 0, idle: 0, error: 0 };
    return {
      total: endpoints.length,
      active: endpoints.filter((ep: EndpointInfo) => ep.status === 'active').length,
      idle: endpoints.filter((ep: EndpointInfo) => ep.status === 'idle').length,
      error: endpoints.filter((ep: EndpointInfo) => ep.status === 'error').length,
    };
  }, [endpoints]);

  // Handlers
  const handleShowCode = (endpoint: EndpointInfo) => {
    const connection: EndpointConnection = {
      endpointId: endpoint.id,
      endpointUrl: endpoint.endpointUrl || '',
      modelName: endpoint.modelName,
      modality: endpoint.modality as 'llm' | 'image' | 'video' | 'audio' | 'multimodal',
      provider: endpoint.provider as 'runpod' | 'modal',
      apiKey: 'YOUR_API_KEY',
      status: endpoint.status as 'provisioning' | 'active' | 'scaling' | 'idle' | 'error' | 'terminated',
      codeSamples: generateCodeSamples(
        endpoint.id,
        'YOUR_API_KEY',
        endpoint.modality as 'llm' | 'image' | 'video' | 'audio' | 'multimodal',
        endpoint.modelName
      ),
    };

    if (endpoint.modality === 'llm') {
      connection.openaiConfig = {
        baseUrl: `https://api.kriptik.app/api/v1/inference/${endpoint.id}/`,
        apiKey: 'YOUR_API_KEY',
        model: endpoint.modelName,
      };
    }

    setSelectedEndpoint(connection);
    setShowCodeModal(true);
  };

  const handleCopyUrl = (endpoint: EndpointInfo) => {
    if (endpoint.endpointUrl) {
      navigator.clipboard.writeText(endpoint.endpointUrl);
      toast.success('Endpoint URL copied to clipboard');
    } else {
      toast.error('Endpoint URL not available');
    }
  };

  const handleCopyApiKey = async (endpoint: EndpointInfo) => {
    const success = await copyApiKey(endpoint.id);
    if (success) {
      toast.success('API key copied to clipboard');
    } else {
      toast.error('Failed to copy API key');
    }
  };

  const handleTerminate = async () => {
    if (!terminateDialog.endpoint) return;

    const success = await terminateEndpoint(terminateDialog.endpoint.id);
    if (success) {
      toast.success('Endpoint terminated');
      refetch();
    } else {
      toast.error('Failed to terminate endpoint');
    }
    setTerminateDialog({ open: false, endpoint: null });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Model Endpoints</h1>
            <p className="text-muted-foreground mt-1">
              Manage your deployed models and inference endpoints
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshIcon size={16} className="mr-2" />
              Refresh
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-black"
              onClick={() => navigate('/ai-lab/training')}
            >
              <PlusIcon size={16} className="mr-2" />
              Train New Model
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Endpoints"
            value={stats.total}
            icon={<ZapIcon size={20} className="text-amber-500" />}
          />
          <StatsCard
            title="Active"
            value={stats.active}
            icon={<ActivityIcon size={20} className="text-green-500" />}
          />
          <StatsCard
            title="Idle"
            value={stats.idle}
            icon={<ClockIcon size={20} className="text-gray-500" />}
          />
          <StatsCard
            title="Errors"
            value={stats.error}
            icon={<ExternalLinkIcon size={20} className="text-red-500" />}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={modalityFilter} onValueChange={setModalityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Modality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="multimodal">Multimodal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="scaling">Scaling</SelectItem>
              <SelectItem value="provisioning">Provisioning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingIcon size={40} className="animate-spin text-amber-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredEndpoints.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-20">
            <ZapIcon size={48} className="text-muted-foreground opacity-30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Endpoints Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {search || modalityFilter !== 'all' || statusFilter !== 'all'
                ? 'No endpoints match your filters. Try adjusting your search criteria.'
                : 'Train a model to automatically deploy it as a private inference endpoint.'}
            </p>
            {!search && modalityFilter === 'all' && statusFilter === 'all' && (
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-black"
                onClick={() => navigate('/ai-lab/training')}
              >
                <PlusIcon size={16} className="mr-2" />
                Train Your First Model
              </Button>
            )}
          </Card>
        )}

        {/* Endpoints Grid */}
        {!isLoading && filteredEndpoints.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEndpoints.map((endpoint: EndpointInfo) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                onShowCode={() => handleShowCode(endpoint)}
                onTerminate={() => setTerminateDialog({ open: true, endpoint })}
                onCopyUrl={() => handleCopyUrl(endpoint)}
                onCopyApiKey={() => handleCopyApiKey(endpoint)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Code Samples Modal */}
      <CodeSamplesModal
        open={showCodeModal}
        onOpenChange={setShowCodeModal}
        endpoint={selectedEndpoint}
      />

      {/* Terminate Confirmation Dialog */}
      <Dialog
        open={terminateDialog.open}
        onOpenChange={(open) => setTerminateDialog({ ...terminateDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Endpoint?</DialogTitle>
            <DialogDescription>
              This will permanently shut down the endpoint for{' '}
              <strong>{terminateDialog.endpoint?.modelName}</strong>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTerminateDialog({ open: false, endpoint: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={isTerminating}
            >
              {isTerminating ? (
                <>
                  <LoadingIcon size={16} className="mr-2 animate-spin" />
                  Terminating...
                </>
              ) : (
                'Terminate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

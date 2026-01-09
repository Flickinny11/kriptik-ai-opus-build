/**
 * Connect Dropdown Component
 *
 * Universal dropdown for selecting and connecting to deployed model endpoints.
 * Appears throughout KripTik: Builder View, Feature Agent, Open Source Studio, AI Lab, etc.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature (PROMPT 4).
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  PlugIcon,
  ChevronDownIcon,
  PlusIcon,
  ExternalLinkIcon,
  CopyIcon,
  CodeIcon,
  KeyIcon,
  MoreHorizontalIcon,
  SearchIcon,
  LoadingIcon,
} from '@/components/ui/icons';
import { toast } from 'sonner';
import { useUserEndpoints, useCopyApiKey } from '@/hooks/useEndpoints';
import { ModalityIcon, getModalityLabel } from './ModalityIcon';
import { ProviderBadge } from './ProviderBadge';
import { StatusDot } from './EndpointStatusBadge';
import { CodeSamplesModal, generateCodeSamples } from './CodeSamplesModal';
import type { ConnectDropdownProps, EndpointInfo, EndpointConnection } from './types';

// =============================================================================
// Component
// =============================================================================

export function ConnectDropdown({
  modality = 'all',
  sourceType = 'all',
  onConnect,
  connectedEndpointId,
  size = 'md',
  variant = 'button',
  placeholder = 'Connect Model',
  showQuickActions = true,
  className,
}: ConnectDropdownProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedEndpointForCode, setSelectedEndpointForCode] = useState<EndpointConnection | null>(null);

  // Fetch endpoints
  const { data: endpoints, isLoading } = useUserEndpoints({
    modality: modality === 'all' ? undefined : modality,
    sourceType: sourceType === 'all' ? undefined : sourceType,
  });

  // Copy API key hook
  const { copyApiKey, isCopying } = useCopyApiKey();

  // Filter endpoints by search
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return [];
    if (!search.trim()) return endpoints;

    const searchLower = search.toLowerCase();
    return endpoints.filter(
      (ep: EndpointInfo) =>
        ep.modelName.toLowerCase().includes(searchLower) ||
        ep.modality.toLowerCase().includes(searchLower)
    );
  }, [endpoints, search]);

  // Group endpoints by modality
  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, EndpointInfo[]> = {};
    for (const ep of filteredEndpoints) {
      const mod = ep.modality;
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(ep);
    }
    return groups;
  }, [filteredEndpoints]);

  // Get the name of the connected endpoint
  const getEndpointName = (id?: string) => {
    if (!id || !endpoints) return placeholder;
    const ep = endpoints.find((e) => e.id === id);
    return ep?.modelName || placeholder;
  };

  // Handle selecting an endpoint
  const handleSelect = async (endpoint: EndpointInfo) => {
    // Build connection object
    const connection: EndpointConnection = {
      endpointId: endpoint.id,
      endpointUrl: endpoint.endpointUrl || '',
      modelName: endpoint.modelName,
      modality: endpoint.modality as string,
      provider: endpoint.provider as string,
      apiKey: '', // API key is fetched separately
      status: endpoint.status as string,
      codeSamples: generateCodeSamples(
        endpoint.id,
        'YOUR_API_KEY',
        endpoint.modality as string,
        endpoint.modelName
      ),
    };

    if (endpoint.modality === 'llm' && endpoint.endpointUrl) {
      connection.openaiConfig = {
        baseUrl: `https://api.kriptik.app/api/v1/inference/${endpoint.id}/`,
        apiKey: 'YOUR_API_KEY',
        model: endpoint.modelName,
      };
    }

    onConnect(connection);
    setIsOpen(false);
  };

  // Handle copying API key
  const handleCopyApiKey = async (endpointId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyApiKey(endpointId);
    if (success) {
      toast.success('API key copied to clipboard');
    } else {
      toast.error('Failed to copy API key');
    }
  };

  // Handle copying URL
  const handleCopyUrl = (endpoint: EndpointInfo, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (endpoint.endpointUrl) {
      navigator.clipboard.writeText(endpoint.endpointUrl);
      toast.success('Endpoint URL copied to clipboard');
    }
  };

  // Handle showing code samples
  const handleShowCode = (endpoint: EndpointInfo, e: { stopPropagation: () => void }) => {
    e.stopPropagation();

    const connection: EndpointConnection = {
      endpointId: endpoint.id,
      endpointUrl: endpoint.endpointUrl || '',
      modelName: endpoint.modelName,
      modality: endpoint.modality as string,
      provider: endpoint.provider as string,
      apiKey: 'YOUR_API_KEY',
      status: endpoint.status as string,
      codeSamples: generateCodeSamples(
        endpoint.id,
        'YOUR_API_KEY',
        endpoint.modality as string,
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

    setSelectedEndpointForCode(connection);
    setShowCodeModal(true);
  };

  // Button size classes
  const sizeClasses = {
    sm: 'h-8 text-xs px-2',
    md: 'h-9 text-sm px-3',
    lg: 'h-10 text-sm px-4',
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant === 'button' ? 'outline' : 'ghost'}
            className={cn(
              sizeClasses[size],
              'gap-2',
              connectedEndpointId && 'border-amber-500/30 bg-amber-500/5',
              className
            )}
          >
            <PlugIcon size={16} className={cn(connectedEndpointId && 'text-amber-500')} />
            <span className="truncate max-w-[150px]">
              {getEndpointName(connectedEndpointId)}
            </span>
            <ChevronDownIcon size={14} className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-80" align="start">
          {/* Search */}
          <div className="px-2 py-2">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Loading State */}
          {isLoading && (
            <div className="px-4 py-6 text-center">
              <LoadingIcon size={24} className="mx-auto mb-2 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Loading endpoints...</p>
            </div>
          )}

          {/* Grouped Endpoints */}
          {!isLoading && Object.entries(groupedEndpoints).map(([mod, eps]) => (
            <DropdownMenuGroup key={mod}>
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <ModalityIcon modality={mod} size={14} />
                {getModalityLabel(mod)}
                <span className="text-[10px] opacity-60">({eps.length})</span>
              </DropdownMenuLabel>

              {eps.map((ep) => (
                <DropdownMenuItem
                  key={ep.id}
                  onSelect={() => handleSelect(ep)}
                  className={cn(
                    'flex items-center justify-between cursor-pointer',
                    connectedEndpointId === ep.id && 'bg-amber-500/10'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusDot status={ep.status} />
                    <span className="truncate">{ep.modelName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ProviderBadge provider={ep.provider} />

                    {showQuickActions && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                          className="h-6 w-6 p-0 data-[state=open]:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontalIcon size={14} />
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                          <DropdownMenuItem onClick={(e) => handleCopyUrl(ep, e)}>
                            <CopyIcon size={14} className="mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleCopyApiKey(ep.id, e)}
                            disabled={isCopying}
                          >
                            <KeyIcon size={14} className="mr-2" />
                            Copy API Key
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleShowCode(ep, e)}>
                            <CodeIcon size={14} className="mr-2" />
                            View Code Samples
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}

          {/* Empty State */}
          {!isLoading && filteredEndpoints.length === 0 && (
            <div className="px-4 py-6 text-center">
              <PlugIcon size={32} className="mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching models found' : 'No deployed models yet'}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground mt-1">
                  Train a model to get started
                </p>
              )}
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Actions */}
          <DropdownMenuItem onSelect={() => navigate('/ai-lab/training')}>
            <PlusIcon size={14} className="mr-2" />
            Train New Model
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => navigate('/ai-lab/endpoints')}>
            <ExternalLinkIcon size={14} className="mr-2" />
            Manage Endpoints
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Code Samples Modal */}
      <CodeSamplesModal
        open={showCodeModal}
        onOpenChange={setShowCodeModal}
        endpoint={selectedEndpointForCode}
      />
    </>
  );
}

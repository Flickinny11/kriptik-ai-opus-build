/**
 * Provider Badge Component
 *
 * Displays a badge indicating the deployment provider (RunPod or Modal).
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { DeploymentProvider } from './types';

interface ProviderBadgeProps {
  provider: DeploymentProvider | string;
  className?: string;
  size?: 'sm' | 'md';
}

export function ProviderBadge({ provider, className, size = 'sm' }: ProviderBadgeProps) {
  const isSmall = size === 'sm';

  const providerConfig = {
    runpod: {
      label: 'RunPod',
      className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20',
    },
    modal: {
      label: 'Modal',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20',
    },
  };

  const config = providerConfig[provider as DeploymentProvider] || providerConfig.runpod;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border',
        isSmall ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}

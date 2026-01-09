/**
 * Endpoint Status Badge Component
 *
 * Displays the status of an endpoint with appropriate styling.
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { cn } from '@/lib/utils';
import type { EndpointStatus } from './types';

interface EndpointStatusBadgeProps {
  status: EndpointStatus | string;
  className?: string;
  showDot?: boolean;
}

const statusConfig: Record<EndpointStatus, { label: string; dotClass: string; textClass: string }> = {
  provisioning: {
    label: 'Provisioning',
    dotClass: 'bg-yellow-400 animate-pulse',
    textClass: 'text-yellow-600',
  },
  active: {
    label: 'Active',
    dotClass: 'bg-green-400',
    textClass: 'text-green-600',
  },
  scaling: {
    label: 'Scaling',
    dotClass: 'bg-blue-400 animate-pulse',
    textClass: 'text-blue-600',
  },
  idle: {
    label: 'Idle',
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-500',
  },
  error: {
    label: 'Error',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
  },
  terminated: {
    label: 'Terminated',
    dotClass: 'bg-gray-600',
    textClass: 'text-gray-600',
  },
};

export function EndpointStatusBadge({ status, className, showDot = true }: EndpointStatusBadgeProps) {
  const config = statusConfig[status as EndpointStatus] || statusConfig.idle;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showDot && (
        <span className={cn('w-2 h-2 rounded-full', config.dotClass)} />
      )}
      <span className={cn('text-xs font-medium', config.textClass)}>
        {config.label}
      </span>
    </div>
  );
}

export function StatusDot({ status, className }: { status: EndpointStatus | string; className?: string }) {
  const config = statusConfig[status as EndpointStatus] || statusConfig.idle;
  return <span className={cn('w-2 h-2 rounded-full', config.dotClass, className)} />;
}

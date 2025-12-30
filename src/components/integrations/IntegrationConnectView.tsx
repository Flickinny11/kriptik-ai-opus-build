/**
 * Integration Connect View - Premium OAuth UI Component
 *
 * Replaces manual credential input with beautiful OAuth "Connect" buttons.
 * Matches the KripTik AI aesthetic:
 * - Frosted glass cards with 3D depth
 * - Smooth micro-animations
 * - Premium typography (Cal Sans / Outfit)
 * - Warm amber accents
 * - No purple, no emojis, no Lucide icons
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './IntegrationConnectView.css';

// Integration requirement from backend
export interface IntegrationRequirement {
  id: string;
  integrationId: string;
  integrationName: string;
  reason: string;
  required: boolean;
  connected: boolean;
  connectionId?: string;
}

interface IntegrationConnectViewProps {
  requirements: IntegrationRequirement[];
  buildIntentId?: string;
  featureAgentId?: string;
  onAllConnected: () => void;
  onSkip?: () => void;
}

// Custom SVG Icons - No Lucide/emoji
const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M8 12l2.5 2.5L16 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2l8 4v6c0 5.52-3.45 9.45-8 11-4.55-1.55-8-5.48-8-11V6l8-4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6.2 3h6.8v6.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 3L7.2 8.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.6 3H4.3A1.3 1.3 0 0 0 3 4.3v7.4A1.3 1.3 0 0 0 4.3 13h7.4A1.3 1.3 0 0 0 13 11.7V9.4"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
  </svg>
);

const DisconnectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="31.416"
      strokeDashoffset="10"
      strokeLinecap="round"
    />
  </svg>
);

// Brand icons for popular integrations
const BrandIcons: Record<string, React.FC<{ className?: string }>> = {
  stripe: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  ),
  github: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  slack: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  ),
  google: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  openai: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681v6.722zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  shopify: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zm-1.278-16.637c0-.137-.09-.21-.209-.227 0 0-.443-.083-.9-.168-.241-1.381-.908-2.545-2.005-2.545-.041 0-.085.003-.128.008-.332-.438-.738-.629-1.091-.629-2.696 0-3.985 3.368-4.387 5.078-.993.308-1.701.526-1.787.555-.554.173-.571.19-.643.711C2.877 9.406 1 24 1 24l13.059 2.226V7.342zm-4.042-.934v.141c-.645.2-1.352.418-2.05.634.395-1.518 1.137-2.249 1.783-2.526.175.439.267.993.267 1.751zm-.941-2.695c.117 0 .235.042.351.12-.839.394-1.743 1.391-2.124 3.38-.561.173-1.107.342-1.618.501.45-1.527 1.461-4.001 3.391-4.001z"/>
    </svg>
  ),
  notion: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.118c-.42-.327-.98-.7-2.054-.607L3.01 2.721c-.467.047-.56.28-.374.466l1.823 1.021zm.793 3.358v13.998c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.54c0-.606-.233-.933-.746-.886l-15.177.887c-.56.047-.747.327-.747.886zm14.337.745c.093.42 0 .84-.42.887l-.7.14v10.265c-.606.327-1.166.513-1.632.513-.747 0-.933-.234-1.493-.933l-4.572-7.186v6.953l1.446.327s0 .84-1.166.84l-3.218.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.451-.233 4.759 7.279V9.34l-1.213-.14c-.093-.513.28-.886.746-.933l3.218-.186zm-15.924-5.73L17.078.62c1.353-.14 1.707-.046 2.567.607l3.544 2.568c.56.42.747.98.747 1.633v16.846c0 1.073-.373 1.726-1.68 1.82l-15.457.933c-.98.047-1.446-.093-1.96-.747l-2.754-3.591c-.56-.747-.793-1.307-.793-1.96V4.101c0-.84.373-1.54 1.307-1.633z"/>
    </svg>
  ),
  supabase: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642l-.06-7.509z"/>
    </svg>
  ),
  vercel: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z"/>
    </svg>
  ),
  aws: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311l-1.884-6.199a1.435 1.435 0 0 1-.071-.351c0-.144.072-.216.216-.216h.846c.151 0 .255.024.311.08.064.048.112.16.16.311l1.348 5.31 1.25-5.31c.04-.16.088-.263.151-.311a.568.568 0 0 1 .32-.08h.686c.159 0 .263.024.32.08.063.048.12.16.159.311l1.262 5.374 1.39-5.374c.047-.16.103-.263.159-.311.064-.048.168-.08.32-.08h.798c.144 0 .216.064.216.216 0 .04-.008.088-.016.136a1.126 1.126 0 0 1-.056.216l-1.94 6.199c-.048.16-.104.263-.168.311a.544.544 0 0 1-.303.08h-.743c-.152 0-.256-.024-.32-.08-.063-.056-.12-.16-.151-.311l-1.238-5.174-1.222 5.174c-.048.16-.096.255-.16.311-.063.048-.167.08-.31.08h-.75zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247a.453.453 0 0 1 .144.024c.048.016.12.048.2.08.271.12.566.215.886.279.327.064.646.104.966.104.503 0 .894-.088 1.166-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.806-.407l-1.158-.359c-.583-.183-1.014-.454-1.277-.806a1.856 1.856 0 0 1-.4-1.158c0-.335.073-.63.216-.886.143-.255.335-.479.574-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.319-.79 1.03-2.57.695-2.994z"/>
    </svg>
  ),
};

// Get brand icon or default link icon
const getIntegrationIcon = (integrationId: string): React.FC<{ className?: string }> => {
  const normalizedId = integrationId.toLowerCase();
  return BrandIcons[normalizedId] || (({ className }) => (
    <div className={className}>
      <LinkIcon />
    </div>
  ));
};

export function IntegrationConnectView({
  requirements,
  buildIntentId,
  featureAgentId,
  onAllConnected,
  onSkip,
}: IntegrationConnectViewProps) {
  const [connections, setConnections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    requirements.forEach((req) => {
      initial[req.integrationId] = req.connected;
    });
    return initial;
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const connectedCount = Object.values(connections).filter(Boolean).length;
  const requiredCount = requirements.filter((r) => r.required).length;
  const allRequiredConnected = requirements
    .filter((r) => r.required)
    .every((r) => connections[r.integrationId]);

  // Check if all connected
  useEffect(() => {
    if (allRequiredConnected && requiredCount > 0) {
      // Small delay for visual feedback
      const timer = setTimeout(() => {
        onAllConnected();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [allRequiredConnected, requiredCount, onAllConnected]);

  const handleConnect = useCallback(
    async (integrationId: string) => {
      setLoading((prev) => ({ ...prev, [integrationId]: true }));
      setError(null);

      try {
        const response = await fetch('/api/integrations/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            integrationId,
            projectId: buildIntentId,
            redirectUrl: `${window.location.origin}/oauth-callback`,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to initiate connection');
        }

        const { authUrl } = await response.json();

        // Store context for callback
        sessionStorage.setItem(
          'oauth_context',
          JSON.stringify({
            integrationId,
            buildIntentId,
            featureAgentId,
            returnUrl: window.location.href,
          })
        );

        // Open OAuth popup or redirect
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          authUrl,
          'oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popup || popup.closed) {
          // Popup blocked, redirect instead
          window.location.href = authUrl;
          return;
        }

        // Poll for popup close
        const pollInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollInterval);
            setLoading((prev) => ({ ...prev, [integrationId]: false }));
            // Check connection status
            checkConnectionStatus(integrationId);
          }
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setLoading((prev) => ({ ...prev, [integrationId]: false }));
      }
    },
    [buildIntentId, featureAgentId]
  );

  const handleDisconnect = useCallback(async (integrationId: string) => {
    setLoading((prev) => ({ ...prev, [integrationId]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/integrations/disconnect/${integrationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      setConnections((prev) => ({ ...prev, [integrationId]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading((prev) => ({ ...prev, [integrationId]: false }));
    }
  }, []);

  const checkConnectionStatus = useCallback(async (integrationId: string) => {
    try {
      const response = await fetch('/api/integrations/connections', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const connection = data.connections.find(
          (c: { integrationId: string }) => c.integrationId === integrationId
        );
        if (connection?.status === 'connected') {
          setConnections((prev) => ({ ...prev, [integrationId]: true }));
        }
      }
    } catch {
      // Silently handle - user can retry
    }
  }, []);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'oauth_callback' && event.data?.success) {
        const { integrationId } = event.data;
        setConnections((prev) => ({ ...prev, [integrationId]: true }));
        setLoading((prev) => ({ ...prev, [integrationId]: false }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="integration-connect-view">
      {/* Header */}
      <motion.div
        className="integration-connect-view__header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="integration-connect-view__header-icon">
          <ShieldIcon />
        </div>
        <div className="integration-connect-view__header-text">
          <h3 className="integration-connect-view__title">Connect Services</h3>
          <p className="integration-connect-view__subtitle">
            {connectedCount}/{requirements.length} connected • Secure OAuth
          </p>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        className="integration-connect-view__progress-bar"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
      >
        <motion.div
          className="integration-connect-view__progress-fill"
          initial={{ width: 0 }}
          animate={{
            width: `${(connectedCount / requirements.length) * 100}%`,
          }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        />
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="integration-connect-view__error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Cards */}
      <div className="integration-connect-view__cards">
        <AnimatePresence mode="sync">
          {requirements.map((req, index) => {
            const isConnected = connections[req.integrationId];
            const isLoading = loading[req.integrationId];
            const IconComponent = getIntegrationIcon(req.integrationId);

            return (
              <motion.div
                key={req.id}
                className={`integration-card ${isConnected ? 'integration-card--connected' : ''} ${req.required ? 'integration-card--required' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.05,
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ scale: 1.01, y: -2 }}
              >
                {/* Card inner glow */}
                <div className="integration-card__glow" />

                {/* Card content */}
                <div className="integration-card__content">
                  <div className="integration-card__header">
                    <div className="integration-card__header-left">
                      <div className="integration-card__icon">
                        <IconComponent className="integration-card__brand-icon" />
                      </div>
                      <div className="integration-card__info">
                        <div className="integration-card__name">
                          {req.integrationName}
                          {req.required && !isConnected && (
                            <span className="integration-card__required-badge">
                              Required
                            </span>
                          )}
                          {isConnected && (
                            <span className="integration-card__connected-badge">
                              Connected
                            </span>
                          )}
                        </div>
                        <div className="integration-card__reason">{req.reason}</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="integration-card__actions">
                      {isConnected ? (
                        <button
                          type="button"
                          className="integration-card__disconnect-btn"
                          onClick={() => handleDisconnect(req.integrationId)}
                          disabled={isLoading}
                          title="Disconnect"
                        >
                          <DisconnectIcon />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`integration-card__connect-btn ${isLoading ? 'integration-card__connect-btn--loading' : ''}`}
                          onClick={() => handleConnect(req.integrationId)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <motion.span
                              className="integration-card__spinner"
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                            >
                              <SpinnerIcon />
                            </motion.span>
                          ) : (
                            <>
                              <span>Connect</span>
                              <ExternalLinkIcon />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connected indicator */}
                <AnimatePresence>
                  {isConnected && (
                    <motion.div
                      className="integration-card__check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <CheckCircleIcon />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3D edge effects */}
                <div className="integration-card__edge-right" />
                <div className="integration-card__edge-bottom" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.div
        className="integration-connect-view__footer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {allRequiredConnected ? (
          <motion.div
            className="integration-connect-view__success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircleIcon />
            <span>All required services connected</span>
          </motion.div>
        ) : (
          <>
            <p className="integration-connect-view__remaining">
              {requiredCount - connectedCount} required connection
              {requiredCount - connectedCount !== 1 ? 's' : ''} remaining
            </p>
            {onSkip && (
              <button
                type="button"
                className="integration-connect-view__skip-btn"
                onClick={onSkip}
              >
                Skip for now
              </button>
            )}
          </>
        )}

        <p className="integration-connect-view__security-note">
          OAuth connections are secure and can be revoked anytime
        </p>
      </motion.div>
    </div>
  );
}

export default IntegrationConnectView;

# Credit Ceiling Integration Guide

This guide shows how to integrate the credit ceiling system into build loops, feature agents, and other operations.

## Overview

The credit ceiling system provides:
- **User-controlled spending limits** (no hard $50 cap)
- **Real-time warnings** at 75%, 90%, and 100% thresholds
- **Estimated credits to completion** based on task progress
- **Popup warnings** with quick adjustment options
- **Links to add funds** when ceiling exceeds available credits

## Quick Start

### 1. Import the Integration Helper

```typescript
import {
    createBuildLoopCeilingGuard,
    createPeriodicCeilingChecker,
} from '../billing/ceiling-integration.js';
```

### 2. Add to Build Loop

```typescript
// In build-loop.ts or feature-agent-service.ts

class BuildLoopOrchestrator extends EventEmitter {
    private ceilingGuard = createBuildLoopCeilingGuard();

    async executePhase(phaseName: string, userId: string, buildId: string) {
        // Check ceiling before expensive operation
        const canProceed = await this.ceilingGuard.checkBeforeOperation({
            userId,
            buildId,
            operationName: `Phase: ${phaseName}`,
            estimatedCost: 50, // Estimate for this phase
            onWarning: async (warning) => {
                // Emit event to show popup to user
                this.emit('ceiling_warning', {
                    userId,
                    buildId,
                    warning,
                });
            },
            onPause: async (reason) => {
                // Pause the build
                this.emit('build_paused', {
                    userId,
                    buildId,
                    reason,
                });
            },
        });

        if (!canProceed) {
            throw new Error('Build paused: Credit ceiling exceeded');
        }

        // Execute the phase...
        const result = await this.doPhaseWork();

        // Record actual usage
        await this.ceilingGuard.recordUsage(userId, actualCreditsUsed, buildId);

        return result;
    }
}
```

### 3. Add Periodic Checking for Long-Running Builds

```typescript
class FeatureAgentService {
    async startBuild(userId: string, buildId: string) {
        // Create periodic checker
        const checker = createPeriodicCeilingChecker(userId, buildId, {
            interval: 30000, // Check every 30 seconds
            onWarning: async (warning) => {
                // Send SSE event to frontend
                this.sendSSE(userId, 'ceiling_warning', warning);
            },
            onExceeded: async () => {
                // Pause the build
                await this.pauseBuild(buildId);
                this.sendSSE(userId, 'build_paused', {
                    reason: 'Credit ceiling exceeded',
                });
            },
        });

        // Start checking
        checker.start();

        try {
            // Run the build...
            await this.runBuildPhases();
        } finally {
            // Stop checking when done
            checker.stop();
        }
    }
}
```

## API Endpoints

### Get Ceiling Status

```typescript
GET /api/billing/ceiling?buildId=optional-build-id

Response:
{
    userId: string;
    ceiling: number | null;
    currentUsage: number;
    remainingCredits: number;
    percentUsed: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
    estimatedToComplete?: number;
    canProceed: boolean;
}
```

### Set Ceiling

```typescript
POST /api/billing/ceiling
Body: { ceiling: number | null }

Response:
{
    success: true,
    status: CreditCeilingSettings,
    message: string
}
```

### Check Before Operation

```typescript
POST /api/billing/ceiling/check
Body: {
    estimatedCost: number,
    buildId?: string
}

Response:
{
    allowed: boolean;
    warning?: CeilingWarning;
    shouldPause: boolean;
    reason?: string;
}
```

### Quick Adjustments

```typescript
POST /api/billing/ceiling/adjust
Body: { amount: number }

POST /api/billing/ceiling/unlimited
```

## Frontend Integration

### 1. Create Warning Popup Component

```tsx
import { CeilingWarning, warningToPopupData } from '@/types/credit-ceiling';

function CeilingWarningPopup({ warning }: { warning: CeilingWarning }) {
    const popupData = warningToPopupData(warning);

    return (
        <Dialog open={true}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{popupData.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p>{popupData.message}</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${popupData.percentUsed}%` }}
                        />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Current Usage</p>
                            <p className="text-lg font-semibold">
                                {popupData.currentUsage} credits
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Remaining</p>
                            <p className="text-lg font-semibold">
                                {popupData.remainingCredits} credits
                            </p>
                        </div>
                    </div>

                    {popupData.estimatedToComplete && (
                        <div>
                            <p className="text-sm text-gray-500">Estimated to Complete</p>
                            <p className="text-lg font-semibold">
                                {popupData.estimatedToComplete} credits
                            </p>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex flex-col gap-2">
                        {popupData.quickActions.map((action) => (
                            <Button
                                key={action.id}
                                variant={action.type}
                                onClick={() => handleAction(action)}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

### 2. Listen for SSE Events

```typescript
// In BuilderView or FeatureAgent component

useEffect(() => {
    const eventSource = new EventSource(`/api/feature-agent/${agentId}/stream`);

    eventSource.addEventListener('ceiling_warning', (event) => {
        const warning = JSON.parse(event.data);
        setShowCeilingWarning(warning);
    });

    eventSource.addEventListener('build_paused', (event) => {
        const data = JSON.parse(event.data);
        setIsPaused(true);
        setPauseReason(data.reason);
    });

    return () => eventSource.close();
}, [agentId]);
```

### 3. Handle User Actions

```typescript
async function handleAction(action: QuickAction) {
    switch (action.action) {
        case 'increase_by_10':
            await fetch('/api/billing/ceiling/adjust', {
                method: 'POST',
                body: JSON.stringify({ amount: 1000 }),
            });
            break;

        case 'increase_by_25':
            await fetch('/api/billing/ceiling/adjust', {
                method: 'POST',
                body: JSON.stringify({ amount: 2500 }),
            });
            break;

        case 'increase_by_50':
            await fetch('/api/billing/ceiling/adjust', {
                method: 'POST',
                body: JSON.stringify({ amount: 5000 }),
            });
            break;

        case 'set_unlimited':
            await fetch('/api/billing/ceiling/unlimited', {
                method: 'POST',
            });
            break;

        case 'add_funds':
            window.location.href = action.value as string;
            break;

        case 'pause_build':
            await fetch(`/api/feature-agent/${agentId}/pause`, {
                method: 'POST',
            });
            break;

        case 'continue':
            setShowCeilingWarning(null);
            break;
    }
}
```

## Testing

### 1. Set a Low Ceiling

```bash
curl -X POST http://localhost:3001/api/billing/ceiling \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ceiling": 100}'
```

### 2. Start a Build

The build will trigger warnings as it approaches the ceiling.

### 3. Test Adjustment

```bash
curl -X POST http://localhost:3001/api/billing/ceiling/adjust \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}'
```

## Best Practices

1. **Check Before Every Phase**: Don't just check at the start - check before each expensive operation
2. **Show Warnings Early**: Display warnings at 75% so users have time to adjust
3. **Estimate Accurately**: Update estimates as the build progresses
4. **Fail Gracefully**: If ceiling is exceeded, pause cleanly and save state
5. **Make Adjustment Easy**: One-click actions to increase ceiling or add funds

## Migration from Old System

If you had a hard $50 limit before:

```typescript
// Old (hard-coded)
if (totalSpent > 50) {
    throw new Error('$50 limit exceeded');
}

// New (user-controlled)
const check = await checkCeilingForPhase(userId, buildId, phaseName, estimatedCost);
if (check.shouldPause) {
    // Show popup, let user decide
    await showWarningPopup(check.warning);
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│        Build Loop / Feature Agent        │
│                                          │
│  1. Check ceiling before operation       │
│  2. Show warning if approaching          │
│  3. Pause if exceeded                    │
│  4. Record actual usage                  │
└────────────┬────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│      CreditCeilingService                │
│                                          │
│  - Get current status                    │
│  - Estimate credits to complete          │
│  - Check if can proceed                  │
│  - Create warning with actions           │
└────────────┬────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│           Database (users)               │
│                                          │
│  creditCeiling: number | null            │
└──────────────────────────────────────────┘
```

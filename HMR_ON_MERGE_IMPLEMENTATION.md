# HMR on Merge Completion Implementation

## Overview

This implementation adds automatic Hot Module Replacement (HMR) triggering when Developer Mode agent work is merged to the main sandbox. The preview automatically refreshes to show the updated app without requiring manual intervention.

## Architecture

### Components Modified

1. **Database Schema** (`server/src/schema.ts`)
   - Added `changedFilesList` field to `developerModeMergeQueue` table
   - Stores list of changed file paths for efficient HMR triggering

2. **Orchestrator** (`server/src/services/developer-mode/orchestrator.ts`)
   - `createMergeQueueEntry()`: Now captures and stores the list of changed files
   - `executeMerge()`: Emits `merge:completed` event with changed files list

3. **Sandbox Service** (`server/src/services/developer-mode/sandbox-service.ts`)
   - `triggerMergeHMR()`: New method to trigger HMR for multiple files
   - Categorizes files as frontend vs backend
   - Handles Vite HMR for frontend files via file touch
   - Detects backend changes and emits restart notification

4. **API Routes** (`server/src/routes/developer-mode.ts`)
   - `initializeMergeHMRListener()`: Auto-triggers HMR on merge completion
   - `POST /api/developer-mode/sandbox/:sessionId/hmr-batch`: Manual batch HMR endpoint
   - Added `merge:hmr-triggered` to SSE event stream

## How It Works

### Flow Diagram

```
Agent Work Complete
       ↓
Merge Queue Entry Created (stores changed files)
       ↓
User Approves Merge
       ↓
executeMerge() runs
       ↓
Git merge executes
       ↓
merge:completed event emitted (with changed files)
       ↓
Merge HMR Listener catches event
       ↓
triggerMergeHMR() called
       ↓
Files categorized (frontend/backend)
       ↓
Frontend: Vite HMR via file touch
Backend: Restart notification
       ↓
merge:hmr-triggered event → UI
       ↓
Preview updates automatically
```

### File Categorization

**Frontend Files** (Vite HMR via file touch):
- `.tsx`, `.jsx`, `.ts`, `.js`
- `.css`, `.scss`
- `.vue`, `.svelte`

**Backend Files** (Restart notification):
- Files in `server/`, `api/`, `backend/` directories
- Triggers sandbox restart recommendation

### Event Flow

1. **merge:completed**
   - Emitted by: `orchestrator.executeMerge()`
   - Payload: `{ mergeId, sessionId, agentId, projectId, changedFiles }`
   - Listeners: Merge HMR listener

2. **merge:hmr-triggered**
   - Emitted by: Merge HMR listener
   - Payload: `{ mergeId, sessionId, agentId, frontendFilesUpdated, backendFilesChanged, needsRestart }`
   - Listeners: SSE streams → UI

3. **hmrTriggered** (per file)
   - Emitted by: SandboxService
   - Payload: `{ sandboxId, filePath }`
   - Listeners: Monitoring/logging

4. **hmrBackendChanged**
   - Emitted by: SandboxService
   - Payload: `{ sandboxId, agentId, needsRestart, backendFiles }`
   - Listeners: Sandbox management, UI notifications

5. **hmrMergeComplete**
   - Emitted by: SandboxService
   - Payload: `{ sandboxId, agentId, frontendFilesUpdated, backendFilesChanged, needsRestart, totalFiles }`
   - Listeners: Logging, metrics

## API Endpoints

### Automatic HMR (via event listener)

```typescript
// Automatically triggered on merge completion
orchestrator.on('merge:completed', async (data) => {
  const result = await sandbox.triggerMergeHMR(data.agentId, data.changedFiles);
  // Emits merge:hmr-triggered event for UI
});
```

### Manual HMR Trigger

```http
POST /api/developer-mode/sandbox/:sessionId/hmr-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "files": [
    "src/components/Button.tsx",
    "src/styles/main.css",
    "server/routes/api.ts"
  ]
}

Response:
{
  "success": true,
  "frontendFilesUpdated": 2,
  "backendFilesChanged": true,
  "needsRestart": true
}
```

## HMR Implementation Details

### Vite HMR Mechanism

Vite watches for file changes via `fs.watch()`. To trigger HMR programmatically:

```typescript
// Touch file to update mtime
await fs.utimes(fullPath, new Date(), new Date());
```

This causes Vite to detect a change and send HMR updates to the browser.

### Backend Restart

When backend files change:
1. `hmrBackendChanged` event is emitted
2. Sandbox service logs restart recommendation
3. UI can display restart prompt or auto-restart

## SSE Event Stream Integration

Frontend can listen for HMR events via SSE:

```typescript
// Connect to session event stream
const eventSource = new EventSource('/api/developer-mode/sessions/:sessionId/events');

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'merge:hmr-triggered') {
    console.log(`HMR triggered: ${data.frontendFilesUpdated} files updated`);

    if (data.needsRestart) {
      showRestartPrompt();
    } else {
      showRefreshNotification();
    }
  }
});
```

## Database Migration

The new `changedFilesList` column is added to the schema:

```sql
-- Added to developer_mode_merge_queue table
ALTER TABLE developer_mode_merge_queue
ADD COLUMN changed_files_list TEXT; -- JSON array of file paths
```

This will be applied via Drizzle schema push:

```bash
cd server
npx drizzle-kit push:sqlite
```

## Testing

### Manual Test Flow

1. Start Developer Mode session
2. Deploy agent with a task
3. Agent completes work
4. Approve merge
5. Execute merge via API
6. Observe:
   - Console logs: "Merge completed, triggering HMR for N files"
   - Console logs: "HMR triggered: N frontend files updated"
   - Preview refreshes automatically
   - SSE stream emits `merge:hmr-triggered` event

### Test Endpoint

```bash
# Manual batch HMR trigger
curl -X POST http://localhost:3001/api/developer-mode/sandbox/SESSION_ID/hmr-batch \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "src/components/Button.tsx",
      "src/App.tsx"
    ]
  }'
```

## Performance Considerations

1. **File Touch Overhead**: Minimal - just updates file mtime
2. **Vite HMR**: Fast - typically <100ms per file
3. **Event Emission**: Async, non-blocking
4. **Batch Processing**: Files processed sequentially to avoid race conditions

## Error Handling

1. **Sandbox Not Running**: Silently skips HMR
2. **File Not Found**: Logs error, continues with remaining files
3. **Git Error**: Falls back to empty file list
4. **HMR Failure**: Logs error, emits event with partial success

## Future Enhancements

1. **Smart Restart**: Auto-restart backend when needed
2. **HMR Status UI**: Visual indicator of HMR progress
3. **File Grouping**: Batch similar files for faster HMR
4. **WebSocket Fallback**: Alternative to SSE for real-time updates
5. **HMR Metrics**: Track HMR speed and success rate

## Key Files

| File | Purpose |
|------|---------|
| `server/src/schema.ts` | Database schema with `changedFilesList` |
| `server/src/services/developer-mode/orchestrator.ts` | Merge execution + event emission |
| `server/src/services/developer-mode/sandbox-service.ts` | HMR triggering logic |
| `server/src/routes/developer-mode.ts` | API endpoints + event listener |
| `server/src/services/developer-mode/git-branch-manager.ts` | File diff stats |

## Summary

This implementation provides automatic HMR on merge completion:

✅ **Automatic**: No manual refresh needed
✅ **Fast**: Vite HMR typically <100ms
✅ **Smart**: Categorizes frontend vs backend
✅ **Real-time**: SSE events for UI feedback
✅ **Robust**: Error handling + fallbacks
✅ **Production-ready**: Full TypeScript, no placeholders

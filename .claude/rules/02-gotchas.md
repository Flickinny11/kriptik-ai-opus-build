# Gotchas - KripTik AI

> Known issues, workarounds, and things to watch out for. Check this before making changes in related areas.

---

## Critical Issues

### Three.js Barrel Export Issue (RESOLVED)
**Problem**: Importing from `../3d` barrel export causes ALL Three.js modules to load, triggering "Cannot read properties of undefined (reading 'S')" error.

**Solution**: Use direct imports instead of barrel exports.
```typescript
// BAD - causes error
import { MagneticCTA } from '../3d';

// GOOD - works correctly
import { MagneticCTA } from '../3d/MagneticButton';
```

**Affected Files**:
- `src/components/landing/FinalCTA.tsx`
- `src/components/landing/PricingRedesign.tsx`

**Status**: Fixed, but be careful when adding new 3D component imports.

---

## Database Constraints

### Turso SQLite Column Modifications
**Problem**: Cannot change existing column types in Turso SQLite migrations.

**Solution**: Always add new columns instead of modifying existing ones.

**Example**:
```sql
-- BAD - will fail
ALTER TABLE users MODIFY COLUMN credits INTEGER;

-- GOOD - add new column
ALTER TABLE users ADD COLUMN credits_v2 INTEGER;
```

**Reference**: AD001 in decisions.json

---

## Authentication

### Better Auth Session Cookie
**Problem**: Session validation requires proper Cookie header reading.

**Solution**: Use configured prefix when reading session cookies.

**Recent Fix**: Commit ac6e237

**Files**: `server/src/auth.ts`

### Better Auth Date Handling (CRITICAL)
**Problem**: Better Auth with Drizzle adapter stores dates as text strings in SQLite, but the middleware and session service expect Date objects with `.getTime()` method.

**Symptoms**:
- Auth silently fails with "TypeError: response.session.expiresAt.getTime is not a function"
- Sessions fail to cache or validate properly
- Social and email auth both affected

**Solution**: Use defensive date handling functions in middleware:
```typescript
function toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(); // fallback
}
```

**Fixed In**: `server/src/middleware/auth.ts` - Added `toDate()` and `toTimestamp()` helper functions.

**Note**: Cannot change schema column types (Turso limitation per AD001). Schema uses `text` for date fields which Better Auth returns as strings, not Date objects.

### CORS Configuration
**Problem**: CORS must allow specific patterns for Vercel deployments.

**Allowed Patterns**:
- `https://kriptik.app` (production custom domain)
- `https://kriptik-ai-opus-build.vercel.app` (production Vercel)
- `https://kriptik-ai-opus-build-*.vercel.app` (preview)
- `http://localhost:*` (development)
- Custom domains via `FRONTEND_URL` env

---

## Anti-Slop Triggers

### Instant Fail Patterns
These will cause immediate design rejection:

1. **Purple-to-pink gradients**: `from-purple-* to-pink-*`
2. **Blue-to-purple gradients**: `from-blue-* to-purple-*`
3. **Emoji in UI**: Any Unicode U+1F300-U+1F9FF
4. **Placeholder text**: "Coming soon", "TODO", "FIXME", "lorem ipsum"
5. **System fonts only**: `font-sans` without custom font override
6. **Default grays**: `gray-200`, `gray-300`, `gray-400` without intent

### Common Mistakes
- Using `shadow-sm` without custom shadow color (looks flat)
- No animations on interactive elements (static = dead)
- Generic button styling (needs depth, hover states)
- Card without layered shadows (needs glassmorphism)

---

## Large Files - Edit Carefully

### Size Warnings
| File | Size | Risk |
|------|------|------|
| `src/pages/Builder.tsx` | 72KB | High - many integrations |
| `src/pages/FixMyApp.tsx` | 102KB | Very High - complex logic |
| `server/src/schema.ts` | 600+ lines | High - all DB tables |
| `src/store/useDeveloperModeStore.ts` | 25KB | Medium - state management |

### Recommendations
- Make targeted edits, not sweeping changes
- Test build after each significant change
- Consider extracting components when adding features

---

## API Patterns

### SSE Event Streaming
**Pattern**: Use Server-Sent Events for real-time updates.

**Implementation**:
```typescript
// Server
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Client (in Zustand store)
const eventSource = new EventSource(`/api/events/${id}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // handle event
};
```

**Used In**: Developer Mode, Feature Agent, Ghost Mode

### Credit Calculations
**Pattern**: Always estimate before executing.

**Files**: `server/src/services/developer-mode/credit-calculator.ts`

**Important**: Check user balance before deploying agents.

---

## State Management

### Zustand Store Patterns
**Pattern**: Each feature domain has its own store.

**Existing Stores** (16 total):
- `useBuilderStore` - main builder state
- `useDeveloperModeStore` - agent sessions
- `useFeatureAgentTileStore` - feature tiles
- `useLearningStore` - evolution flywheel
- `useProjectStore` - project management
- `useAuthStore` - authentication

**Rule**: Check if state already exists before adding new.

---

## OpenRouter Integration

### Extended Thinking
**Requirement**: Must enable beta features for extended thinking.

**Configuration**:
```typescript
{
  effort: 'high',
  thinking_budget: 64000 // for Opus
}
```

### Model Fallback
**Pattern**: Automatic fallback with exponential backoff on rate limits.

**Order**: Premium -> Critical -> Standard -> Simple

---

## Deployment

### Vercel Edge Cases
- Bundle size limits affect large dependencies
- Environment variables must be set in Vercel dashboard
- Preview URLs use different pattern than production

### Pre-Deployment Validation
**Files**: `server/src/services/validation/pre-flight-validator.ts`

**Checks**:
- Platform constraints (Vercel, Cloudflare, AWS)
- Bundle size
- Missing environment variables
- API compatibility

---

## Known Non-Critical Warnings

### React Warnings (Cosmetic)
- `GlassPillButton` needs forwardRef (functional, just warning)
- StrictMode double-render warnings (expected in dev)

### CORS Errors (Expected)
- CORS errors when backend not running (expected in frontend-only dev)

---

*Last updated: 2025-12-26*
*Add new gotchas as discovered*

# Quick Start - KripTik AI

> **Read this first!** Essential context for each session.

---

## File Structure (Cleaned 2026-01-20)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Operational rules - HOW Claude should work |
| `.claude/KRIPTIK-PROJECT-CONTEXT.md` | Project architecture - WHAT KripTik AI is |
| `.claude/HONEST-FEATURE-STATUS.md` | **READ THIS** - Real feature status (not optimistic) |
| `.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md` | Auth rules - DO NOT MODIFY auth system |
| `.claude/archive/` | Historical implementation plans and old docs |

---

## Project Overview

**KripTik AI** is an autonomous AI-first build platform that transforms natural language into production-ready applications.

### Architecture Summary
- **Frontend**: React 18, TypeScript, Vite, Tailwind, Zustand, 200+ components
- **Backend**: Express 5, Drizzle ORM, Turso SQLite, 92 routes
- **Mobile**: Expo SDK 52, React Native 0.76.9, EAS Build ready
- **AI**: OpenRouter unified gateway + Anthropic/OpenAI SDKs

---

## Quick Commands

```bash
npm run build          # TypeScript build (must pass)
npm run dev            # Start dev server
~/bin/chrome-dev       # Launch Chrome with DevTools MCP
```

---

## Design Standards

- **Icons**: `BrandIcons.tsx` or custom SVGs - NO emojis, NO Lucide React
- **Colors**: Amber/gold accents (`#F5A86C`), no purple-pink gradients
- **Typography**: Cal Sans, Outfit, DM Sans
- **Depth**: Glassmorphism, shadows - no flat designs

---

## Recent Session (2026-01-31)

### 8-Phase Cursor 2.4 Feature Integration Completed

1. **Streaming Verification Display** - Real-time SSE-based verification progress
2. **Tiered Verification Gating** - Tier 1 (instant) + Tier 2 (depth) checks
3. **Ghost Preview** - V-JEPA inspired 3D drag-drop previews
4. **Tournament Judge** - AI Lab model comparison system
5. **Streaming Plan Mode** - Cursor-style animated planning UI
6. **Cost Estimation** - Updated Jan 2026 pricing for all models
7. **AI Lab Cleanup** - Tournament tab integrated into AI Lab
8. **Testing & Integration** - All verified and passing build

### New Components
- `src/components/builder/StreamingPlanMode.tsx` - Plan mode UI
- `src/components/design/GhostPreview.tsx` - Drag-drop previews
- `src/components/ai-lab/TournamentJudge.tsx` - Model comparison
- `server/src/services/verification/tiered-gate.ts` - Verification system
- `server/src/services/billing/cost-estimation.ts` - Pricing service

### New API Endpoints
- `GET /api/billing/pricing` - Model pricing table
- `POST /api/billing/cost-estimate` - Task cost estimation
- `POST /api/billing/calculate-cost` - Exact cost calculation
- `GET /api/verification/gate/:projectId/stream` - SSE verification stream
- `POST /api/verification/gate/check` - Tiered gate check

---

*Last updated: 2026-01-31*

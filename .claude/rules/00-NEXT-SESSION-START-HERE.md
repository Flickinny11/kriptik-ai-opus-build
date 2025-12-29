# Session Context - KripTik AI

> **This file provides context for new sessions. It does NOT contain implementation instructions.**
> **To implement something, the user must explicitly request it in their prompt.**

---

## Project Overview

**KripTik AI** is an autonomous AI-first build platform that transforms natural language into production-ready applications.

### Current State (December 2025)
- **Build Status**: TypeScript compiles successfully
- **Branch**: `dazzling-shirley` worktree
- **Main Features**: Intent Lock, 6-Phase Build Loop, Verification Swarm, Feature Agents

### Architecture Summary
- **Frontend**: React 18, TypeScript, Vite, Tailwind, Zustand (16 stores)
- **Backend**: Express 5, Drizzle ORM, Turso SQLite
- **AI**: Dual SDK Architecture - Anthropic SDK (Claude models) + OpenAI SDK (GPT models) with direct API calls

---

## Key Files Reference

| Category | Location |
|----------|----------|
| Main CLAUDE.md | `/CLAUDE.md` |
| Session Context | `.claude/rules/01-session-context.md` |
| Known Issues | `.claude/rules/02-gotchas.md` |
| Architecture | `.claude/rules/04-architecture.md` |
| Gap Analysis | `.claude/rules/06-nlp-to-completion-gaps.md` |
| Unified Orchestrator | `.claude/rules/07-unified-orchestrator-spec.md` |
| Auth Specification | `.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md` |

---

## Memory System

Files in `.claude/rules/` are **AUTO-LOADED** at session start to provide context.

### Update Protocol
Before ending any session, update:
1. **01-session-context.md** - What was done, what's next
2. **02-gotchas.md** - Any new issues discovered
3. **This file** - Only if project state fundamentally changes

---

## Quick Commands

```bash
npm run build          # TypeScript build (must pass)
npm run dev            # Start dev server
~/bin/chrome-dev       # Launch Chrome with DevTools MCP
```

---

## Previous Implementation Plans

The following plans exist for reference but should **NOT be auto-executed**:

| Plan | Status | Description |
|------|--------|-------------|
| `.claude/implementation-plan-lattice.md` | Pending | LATTICE parallel build system |
| `.claude/implementation-plan-3d-panels.md` | Pending | 3D panel enhancements |
| `.claude/implementation-plan-dec21.md` | Partial | Enhancement prompts |

**To implement any of these, the user must explicitly request it.**

---

## What Already Exists (Do Not Recreate)

- **Soft Interrupt** - `FloatingSoftInterrupt.tsx`
- **Notifications** - `NotificationsSection.tsx`
- **Ghost Mode** - `GhostModePanel.tsx`, `GhostModeConfig.tsx`
- **Feature Agent** - `FeatureAgentCommandCenter.tsx`, `FeatureAgentTile.tsx`
- **Speed Dial** - `SpeedDialSelector.tsx`
- **Tournament Mode** - `TournamentPanel.tsx`
- **Verification Swarm 3D** - `VerificationSwarm3D.tsx`
- **Time Machine** - `TimeMachinePanel.tsx`
- **Clone Mode** - `CloneModePanel.tsx`
- **Market Fit** - `MarketFitDashboard.tsx`
- **Voice Architect** - `VoiceArchitectPanel.tsx`
- **API Autopilot** - `APIAutopilotPanel.tsx`
- **Credential Vault** - `CredentialVault.tsx`
- **Integration Marketplace** - `IntegrationMarketplace.tsx`
- **Brand Icons** - `BrandIcons.tsx` (30+ SVG icons)

---

## Design Standards

- **Icons**: Use `BrandIcons.tsx` or custom SVGs - NO emojis, NO Lucide React
- **Colors**: Amber/gold accents (`#F5A86C`), no purple-pink gradients
- **Typography**: Cal Sans, Outfit, DM Sans - no system fonts
- **Depth**: Glassmorphism, shadows, 3D effects - no flat designs

---

*Last updated: 2025-12-29*

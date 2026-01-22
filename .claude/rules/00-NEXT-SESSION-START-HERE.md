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

*Last updated: 2026-01-20*

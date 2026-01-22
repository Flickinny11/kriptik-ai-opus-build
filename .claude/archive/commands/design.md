# Design Command

Implement UI/design changes with KripTik's premium design standards and visual verification.

## Design Philosophy

KripTik must create the reaction: **"Holy shit, this is amazing - this is more advanced than anything I've ever used."**

## Mandatory Design Principles

### 1. DEPTH AND DIMENSION
- NO flat designs. Ever.
- Layered shadows (multiple shadow layers)
- Glassmorphism with backdrop-blur
- Subtle gradients for depth
- Elements exist in 3D space

### 2. MOTION AND LIFE
- Static UI is dead UI
- Micro-interactions on EVERY interactive element
- Smooth state transitions (Framer Motion)
- Interesting loading states (not boring spinners)
- Hover states that feel alive

### 3. PREMIUM TYPOGRAPHY
- Use: DM Sans, Space Mono, Inter
- Clear hierarchy (size, weight, spacing)
- Never use: Arial, Helvetica, system-ui alone
- Code uses premium monospace

### 4. COLOR PHILOSOPHY
- Rich, intentional palette
- Proper contrast (accessibility)
- Subtle gradients > flat colors
- Glow effects (sparingly)

### BANNED PATTERNS
- Purple-to-pink gradients
- Blue-to-purple gradients
- Emoji in UI
- `font-sans` without override
- `shadow-sm` without custom color
- Default grays (200, 300, 400)

## Design Implementation Flow

### 1. Understand Request
- What component/page?
- What's the desired feel?
- Reference existing KripTik patterns

### 2. Find Reference
- Look at existing components for patterns
- Check `src/components/ui/` for base styles
- Review `tailwind.config.js` for theme

### 3. Implement with Quality
- Apply depth (shadows, layers)
- Add motion (Framer Motion)
- Use proper typography
- Test responsive behavior

### 4. Visual Verification (MANDATORY)

After implementation:
```
1. Take screenshot via browser tools
2. Check against design principles
3. Verify no anti-slop violations
4. Check console for errors
5. Test hover/interaction states
```

### 5. Report

```
=== DESIGN IMPLEMENTATION ===

Component: [name]
Files Changed: [list]

Design Choices:
- Depth: [how achieved]
- Motion: [animations added]
- Typography: [fonts used]
- Color: [palette used]

Visual Verification:
- Screenshot: [taken]
- Anti-Slop Score: [X/100]
- Accessibility: [contrast OK?]

Before/After:
- [describe visual change]
```

## Quick Reference: Tailwind Patterns

**Glassmorphism**:
```
bg-black/20 backdrop-blur-xl border border-white/10
```

**Layered Shadows**:
```
shadow-lg shadow-black/20
```

**Premium Button**:
```
bg-gradient-to-r from-amber-500 to-orange-600
hover:from-amber-400 hover:to-orange-500
transition-all duration-300
shadow-lg shadow-amber-500/25
hover:shadow-xl hover:shadow-amber-500/40
```

**Card with Depth**:
```
bg-zinc-900/80 backdrop-blur-xl
border border-zinc-800/50
shadow-xl shadow-black/50
rounded-2xl
```

---

Design request: $ARGUMENTS

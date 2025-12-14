# Intent Check Command

Validate that proposed or completed changes align with the Intent Lock contract.

## Steps to Execute

### 1. Read Intent Contract

Read `intent.json` and extract:
- `core_value_prop`
- `success_criteria` (list all)
- `anti_patterns` (list all)
- `constraints` (list all)
- `visual_identity`

### 2. Analyze Current/Proposed Changes

For the changes being validated:
- List files affected
- Summarize what the change does
- Identify which systems are impacted

### 3. Check Alignment

#### Core Value Proposition
Does the change support: "Transform KripTik AI into the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform in the market"?

- [ ] Supports core value prop
- [ ] Neutral to core value prop
- [ ] Conflicts with core value prop

#### Success Criteria Impact
Which success criteria does this affect?
- SC001: Intent Lock System
- SC002: 6-Phase Build Loop
- SC003: Verification Swarm
- SC004: Zero Placeholders
- SC005: App Soul System
- SC006: Speed Dial Modes
- SC007: Fix My App Forensic Analysis
- SC008: 4-Level Error Escalation
- SC009: Anti-Slop Detection
- SC010: Preserve Turso/OpenRouter

### 4. Anti-Pattern Check

Verify none of these are violated:
- [ ] NO placeholder content (TODO, FIXME, lorem ipsum)
- [ ] NO mock implementations or demo data
- [ ] NO breaking changes to existing architecture
- [ ] NO new databases or AI service providers
- [ ] NO emoji as design elements
- [ ] NO flat design without depth
- [ ] NO generic fonts (Inter, Roboto, Arial without override)

### 5. Constraint Check

Verify constraints are respected:
- [ ] Database: Using Turso SQLite (not adding new DB)
- [ ] AI Services: Using OpenRouter (not adding new providers)
- [ ] Authentication: Using Better Auth (not replacing)
- [ ] Frontend: React + Vite + Tailwind (not replacing)
- [ ] Backend: Express + TypeScript (not replacing)
- [ ] Deployment: Vercel, Cloudflare, AWS (existing integrations)

### 6. Visual Identity Check

If UI changes, verify alignment with:
- Soul: developer
- Primary emotion: professional_power
- Depth level: medium
- Motion philosophy: snappy_purposeful

## Expected Output Format

```
## Intent Check Report

### Changes Being Validated
- [Description of changes]
- Files: [list of files]

### Core Value Prop Alignment
Status: [ALIGNED / NEUTRAL / CONFLICT]
Reason: [explanation]

### Success Criteria Impact
- Supports: [list criteria this helps]
- Neutral: [list criteria unaffected]
- Risks: [list criteria potentially impacted]

### Anti-Pattern Check
Status: [PASS / VIOLATION]
Violations: [list any, or "None"]

### Constraint Check
Status: [PASS / VIOLATION]
Violations: [list any, or "None"]

### Visual Identity (if applicable)
Status: [ALIGNED / NEEDS_ADJUSTMENT / N/A]
Notes: [any concerns]

### VERDICT
[ALIGNED - Proceed with changes]
[DRIFT_DETECTED - Adjust before proceeding]
[ANTI_PATTERN_VIOLATION - Do not proceed]
```

## When to Run

- Before starting significant changes
- Before marking features complete
- When uncertain if approach is correct
- After receiving feedback that something "doesn't feel right"

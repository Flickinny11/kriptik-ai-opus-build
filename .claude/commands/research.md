# Research Command

Before implementing ANYTHING involving external services, APIs, or libraries, run this research protocol.

## Why This Matters

Your training data is approximately 1 year old. In AI/tech, this means:
- Model IDs have changed (e.g., claude-3 → claude-4.5)
- APIs have new endpoints, deprecated old ones
- Libraries have breaking changes
- Best practices have evolved
- New features exist you don't know about

## Research Protocol

### Step 1: Identify What Needs Research

What technology/service/API is being integrated?
- [ ] AI Model (OpenRouter, Anthropic, OpenAI)
- [ ] Payment (Stripe)
- [ ] Database (Turso, Drizzle)
- [ ] Auth (Better Auth)
- [ ] Cloud (Vercel, AWS, Cloudflare)
- [ ] Other: ___

### Step 2: Search for Current Information

Use WebSearch with these patterns:

```
"[technology] API December 2025"
"[technology] latest version 2025"
"[technology] breaking changes 2025"
"[technology] migration guide 2025"
"[technology] best practices 2025"
```

### Step 3: Verify Critical Details

For each technology, confirm:

**AI Models**:
- [ ] Current model IDs (they change frequently!)
- [ ] Available parameters
- [ ] Pricing changes
- [ ] New capabilities

**APIs**:
- [ ] Current endpoint URLs
- [ ] Authentication method
- [ ] Required headers
- [ ] Rate limits
- [ ] New/deprecated endpoints

**Libraries**:
- [ ] Latest stable version
- [ ] Breaking changes from version in package.json
- [ ] New recommended patterns
- [ ] Deprecated features

### Step 4: Document Findings

Create a research summary:

```markdown
## Research: [Technology]
**Date**: [Today's date]
**Current Version**: [version]

### Key Findings
- [Important changes from what I knew]
- [New features to leverage]
- [Deprecated patterns to avoid]

### Action Items
- [What needs updating in implementation]
```

### Step 5: Update Implementation

Apply research findings to your implementation plan.

## Example Research Session

```
User: /research Stripe API for subscription management

Claude:
1. Searching "Stripe API subscription December 2025"...
2. Found: Stripe now recommends Customer Portal v2
3. Found: New webhook events for subscription lifecycle
4. Found: checkout.session.completed now includes subscription_id directly
5. Updating implementation to use latest patterns...
```

## Output Format

```
=== RESEARCH REPORT ===

Technology: [name]
Research Date: [today]
Your Knowledge Cutoff: ~January 2024

### Current State (as of December 2025)
- Version: [current]
- Key Changes Since Your Cutoff:
  - [change 1]
  - [change 2]

### What You Would Have Done Wrong
- [outdated pattern you might have used]
- [deprecated API you might have called]

### Correct Current Approach
- [current best practice]
- [current API/method to use]

### Implementation Notes
- [specific things to do differently]
```

---

Research topic: $ARGUMENTS

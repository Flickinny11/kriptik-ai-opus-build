# Implement Feature Command

You are implementing a feature for KripTik AI. Follow this autonomous implementation protocol:

## Phase 1: Research & Context (MANDATORY)

1. **Read memory files first**:
   - `.claude/memory/session_context.md` - Current state
   - `.claude/memory/gotchas.md` - Known issues
   - `feature_list.json` - Feature status
   - `intent.json` - Sacred contract

2. **Check if this feature involves external integrations**:
   - If YES → Use WebSearch to get current API docs, model IDs, configuration formats
   - Search for "[technology] 2025" or "[service] latest API December 2025"
   - NEVER assume your knowledge is current

3. **Understand the codebase context**:
   - Find related files using Glob/Grep
   - Read existing implementations of similar features
   - Identify integration points

## Phase 2: Plan

1. Create a clear implementation plan with:
   - Files to create/modify
   - Dependencies needed
   - Integration points
   - Potential risks

2. Present plan to user for approval (unless they said "just do it")

## Phase 3: Implement

1. **For each file change**:
   - Read the file FIRST (mandatory)
   - Make targeted changes
   - Run `npm run build` after significant changes
   - If build fails, fix immediately before continuing

2. **Quality gates**:
   - No placeholder content (TODO, FIXME, lorem ipsum)
   - No flat designs (use shadows, depth, glassmorphism)
   - No emoji in production UI
   - No generic fonts
   - No purple-to-pink or blue-to-purple gradients

## Phase 4: Verify

1. Run `npm run build` - must pass
2. If UI change, use browser tools:
   - Take screenshot to verify visual appearance
   - Check console for errors
3. Run TypeScript check: `npx tsc --noEmit`

## Phase 5: Document

1. Update `.claude/memory/session_context.md` with what was done
2. Update `.claude/memory/implementation_log.md` with details
3. Add any gotchas to `.claude/memory/gotchas.md`

## Completion Criteria

Before claiming done, verify:
- [ ] Build passes
- [ ] No TypeScript errors
- [ ] No placeholder content
- [ ] Visual verification (if UI)
- [ ] Memory files updated
- [ ] All acceptance criteria met

Now implement the feature described: $ARGUMENTS

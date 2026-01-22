# Feature Command

Look up detailed information about a specific feature.

## Usage

```
/feature F0XX
```

Example: `/feature F051` or `/feature F065`

## Steps to Execute

### 1. Find Feature in feature_list.json

Read `feature_list.json` and locate the feature by ID.

### 2. Extract Feature Details

Get all available information:
- ID
- Name
- Description
- Priority
- Status (passes: true/false)
- Phase
- Files (associated files)
- Dependencies
- Completed_at (if complete)
- Features_implemented (if available)
- Notes (if available)

### 3. Check Dependencies

If feature has dependencies:
- List dependent features
- Check if dependencies are complete
- Flag any incomplete dependencies

### 4. For Pending Features

If feature is not complete:
- Show headline (if available)
- Show planned files
- List what blocks it (incomplete dependencies)
- Suggest implementation approach

### 5. Cross-Reference

Check `.claude/memory/feature_dependencies.md` for:
- Additional context
- Known integration points
- Related features

## Expected Output Format

### For Completed Feature

```
## Feature: F065 - Feature Agent Command Center V2

### Status: COMPLETE
Completed: 2025-12-12
Phase: 13
Priority: 1

### Description
ACC-V2 UI, Feature Agent Tiles, and backend Feature Agent flow

### Files
- src/components/developer-bar/panels/FeatureAgentCommandCenter.tsx
- src/components/feature-agent/FeatureAgentTile.tsx
- src/components/feature-agent/FeatureAgentTileHost.tsx
- src/store/useFeatureAgentTileStore.ts
- server/src/services/feature-agent/feature-agent-service.ts

### Dependencies
- F001: Intent Lock Engine (COMPLETE)
- F030: Developer Mode Agent Service (COMPLETE)
- F031: Developer Mode Orchestrator (COMPLETE)
- F034: Developer Mode API Routes (COMPLETE)

### Features Implemented
- Renamed Agents → Feature Agent in Developer Bar
- Feature Agent Command Center panel
- Feature Agent Tile popout with SSE streaming
- Implementation Plan approval UI
- Credentials collection UI
- Backend FeatureAgentService
```

### For Pending Feature

```
## Feature: F051 - Clone Mode Video Analyzer

### Status: PENDING
Phase: 16
Priority: 1

### Description
Point camera at app, AI reverse-engineers it

### Headline
"See an app you love? Point your phone at it."

### Planned Files
- server/src/services/clone-mode/video-analyzer.ts
- server/src/services/clone-mode/flow-extractor.ts
- server/src/services/clone-mode/code-reconstructor.ts
- src/components/builder/CloneModeWizard.tsx

### Dependencies
- F001: Intent Lock Engine (COMPLETE) ✓

### Blocked By
Nothing - dependencies met

### Implementation Notes
This feature requires:
1. Video capture/upload capability
2. Frame extraction for key screens
3. AI analysis of UI patterns
4. Flow reconstruction from transitions
5. Code generation matching visual style
```

## Notes

- Use this to understand feature scope before working on it
- Use to check if dependencies are met
- Use to find related files to understand context

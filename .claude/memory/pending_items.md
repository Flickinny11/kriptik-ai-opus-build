# Pending Items - KripTik AI

> Tracks features, tasks, and items that are pending, deferred, or partially complete.

---

## Pending Features (15 remaining)

### Phase 15: Advanced Core Infrastructure (1 pending)

| ID | Name | Priority | Notes |
|----|------|----------|-------|
| F050 | Notification Integrations | 2 | SMS/Slack channel specifics needed |

### Phase 16: Advanced Intelligence Features (4 pending)

| ID | Name | Priority | Notes |
|----|------|----------|-------|
| F051 | Clone Mode Video Analyzer | 1 | Point camera at app, AI reverse-engineers |
| F052 | User Twin Persona Generator | 1 | AI synthetic users test app |
| F053 | Market Fit Oracle | 2 | Predict app success before building |
| F054 | Context Bridge Code Ingester | 1 | Import existing codebase, learn style |

### Phase 17: Advanced Interaction Features (3 pending)

| ID | Name | Priority | Notes |
|----|------|----------|-------|
| F055 | Voice Architect | 1 | Build apps with voice |
| F056 | API Autopilot Discovery Engine | 1 | Auto-find and connect APIs |
| F057 | Enhanced Time Machine Timeline | 2 | Visual scrub-able timeline with branching |

### Phase 18: Advanced Production Features (3 pending)

| ID | Name | Priority | Notes |
|----|------|----------|-------|
| F058 | Adaptive UI Behavior Tracking | 1 | Track real user behavior |
| F059 | Adaptive UI Optimizer | 1 | Auto-optimize based on behavior |
| F060 | Universal Export Platform Adapters | 1 | Web, iOS, Android, Desktop |

### Phase 19: Advanced UI Integration (3 pending)

| ID | Name | Priority | Notes |
|----|------|----------|-------|
| F062 | Builder Mode Component Integration | 1 | Advanced features in Builder |
| F063 | Agents Mode Component Integration | 1 | Advanced features in Agents mode |
| F064 | Feature Flags & Settings Sync | 1 | Gradual rollout system |

---

## Deferred Items

### F032: Micro Intent Lock
- **Status**: Deferred (F045 completed instead)
- **Reason**: Functionality covered by F045's implementation
- **Notes**: May revisit if additional micro-contract features needed

---

## Partially Complete Items

*None currently*

---

## Frontend Wiring Needs

These backend features are complete but need frontend integration:

1. **Pre-Deployment Validation** (F047)
   - Backend: `server/src/services/validation/pre-flight-validator.ts`
   - Needs: Integration in deployment flow UI

2. **Soft Interrupt System** (F046)
   - Backend: `server/src/services/soft-interrupt/interrupt-manager.ts`
   - UI exists: `src/components/builder/SoftInterruptInput.tsx`
   - Needs: Full integration with Developer Mode flow

3. **Ghost Mode Events** (F049)
   - Backend: `server/src/services/ghost-mode/event-recorder.ts`
   - UI exists: `GhostModePanel.tsx`, `GhostModeReplay.tsx`
   - Needs: Polish and testing

---

## Config UI Needs

Settings that exist in backend but need UI controls:

1. **Learning Engine Settings**
   - Controls for evolution cycle frequency
   - Model training thresholds
   - Pattern library management

2. **Ghost Mode Wake Conditions**
   - Full UI for all 8 wake condition types
   - Threshold configuration

3. **Verification Swarm Thresholds**
   - Per-agent threshold adjustment
   - Polling frequency configuration

---

## Technical Debt

1. **Three.js Barrel Export**
   - Issue: Resolved but should refactor 3d/index.ts
   - Risk: Low (workaround in place)

2. **Large Component Files**
   - Builder.tsx: 72KB
   - FixMyApp.tsx: 102KB
   - Consider: Component extraction when adding features

3. **Store Consolidation**
   - 16 Zustand stores
   - Consider: Audit for redundancy

---

*Last updated: 2025-12-14*

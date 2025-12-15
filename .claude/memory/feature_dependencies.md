# Feature Dependencies - KripTik AI

> Maps features to their files and cross-feature dependencies.

---

## Completed Features (51)

### Foundational Components

#### F001 - Intent Lock Engine
**Status**: Complete
**Files**:
- `server/src/services/ai/intent-lock.ts`
**Dependencies**: None
**Depended on by**: F006, F014, F017, F018, F030, F045, F051, F054

#### F002 - Feature List Manager
**Status**: Complete
**Files**:
- `server/src/services/ai/feature-list.ts`
**Dependencies**: None
**Depended on by**: F006

#### F003 - Progress Artifacts
**Status**: Complete
**Files**:
- `server/src/services/ai/artifacts.ts`
**Dependencies**: None
**Depended on by**: F054

#### F004 - OpenRouter Beta Features
**Status**: Complete
**Files**:
- `server/src/services/ai/openrouter-client.ts`
**Dependencies**: None
**Depended on by**: F005, F022

#### F005 - Context Editing
**Status**: Complete
**Files**:
- `server/src/services/ai/openrouter-client.ts`
**Dependencies**: F004

#### F006 - 6-Phase Build Loop
**Status**: Complete
**Files**:
- `server/src/services/automation/build-loop.ts`
**Dependencies**: F001, F002, F003
**Depended on by**: F007, F016, F019, F021, F026

---

### Verification Swarm

#### F007 - Verification Swarm Coordinator
**Status**: Complete
**Files**:
- `server/src/services/verification/swarm.ts`
**Dependencies**: F006
**Depended on by**: F008-F013, F017, F023, F027, F033

#### F008 - Error Checker Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/error-checker.ts`
**Dependencies**: F007

#### F009 - Code Quality Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/code-quality.ts`
**Dependencies**: F007

#### F010 - Visual Verifier Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/visual-verifier.ts`
**Dependencies**: F007

#### F011 - Security Scanner Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/security-scanner.ts`
**Dependencies**: F007

#### F012 - Placeholder Eliminator Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/placeholder-eliminator.ts`
**Dependencies**: F007

#### F013 - Design Style Agent
**Status**: Complete
**Files**:
- `server/src/services/verification/design-style-agent.ts`
**Dependencies**: F007, F014

---

### Design System

#### F014 - App Soul Mapper
**Status**: Complete
**Files**:
- `server/src/services/ai/app-soul.ts`
**Dependencies**: F001
**Depended on by**: F013, F015

#### F015 - Anti-Slop Detection
**Status**: Complete
**Files**:
- `server/src/services/verification/anti-slop-detector.ts`
**Dependencies**: F014

---

### Error Handling

#### F016 - Error Escalation Engine
**Status**: Complete
**Files**:
- `server/src/services/automation/error-escalation.ts`
**Dependencies**: F006
**Depended on by**: F017, F023

---

### Fix My App

#### F017 - Enhanced Fix Executor
**Status**: Complete
**Files**:
- `server/src/services/fix-my-app/enhanced-fix-executor.ts`
- `server/src/services/fix-my-app/import-controller.ts`
**Dependencies**: F001, F002, F006, F007, F016

#### F018 - Intent Lock Integration
**Status**: Complete
**Files**:
- `server/src/services/fix-my-app/enhanced-fix-executor.ts`
**Dependencies**: F017

---

### Competitive Enhancements

#### F019 - Speed Dial Architecture
**Status**: Complete
**Files**:
- `server/src/services/ai/speed-dial.ts`
**Dependencies**: F006
**Depended on by**: F020, F024

#### F020 - Tournament Mode
**Status**: Complete
**Files**:
- `server/src/services/ai/tournament.ts`
**Dependencies**: F019

#### F021 - Time Machine Checkpoints
**Status**: Complete
**Files**:
- `server/src/services/checkpoints/time-machine.ts`
- `server/src/services/checkpoints/index.ts`
**Dependencies**: F006
**Depended on by**: F048, F057

#### F022 - Intelligence Dial
**Status**: Complete
**Files**:
- `server/src/services/ai/intelligence-dial.ts`
**Dependencies**: F004
**Depended on by**: F025

#### F023 - Infinite Reflection Engine
**Status**: Complete
**Files**:
- `server/src/services/ai/reflection-engine.ts`
**Dependencies**: F016, F007

---

### UI Enhancements

#### F024 - Speed Dial Selector UI
**Status**: Complete
**Files**:
- `src/components/builder/SpeedDialSelector.tsx`
**Dependencies**: F019

#### F025 - Intelligence Toggles UI
**Status**: Complete
**Files**:
- `src/components/builder/IntelligenceToggles.tsx`
**Dependencies**: F022

#### F026 - Build Phase Indicator
**Status**: Complete
**Files**:
- `src/components/builder/BuildPhaseIndicator.tsx`
**Dependencies**: F006

#### F027 - Verification Swarm Status
**Status**: Complete
**Files**:
- `src/components/builder/VerificationSwarmStatus.tsx`
**Dependencies**: F007

---

### Database

#### F028 - Database Migrations
**Status**: Complete
**Files**:
- `server/src/schema.ts`
- `server/drizzle/0002_ultimate_builder_architecture.sql`
- `server/src/seed-ultimate-builder.ts`
**Dependencies**: None
**Depended on by**: F035, F047

---

### Developer Mode

#### F029 - Developer View UI Foundation
**Status**: Complete
**Files**:
- `src/components/builder/BuilderAgentsToggle.tsx`
- `src/components/builder/AgentModeSidebar.tsx`
- `src/pages/Builder.tsx`
**Dependencies**: None
**Depended on by**: F036, F037

#### F030 - Developer Mode Agent Service
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/agent-service.ts`
**Dependencies**: F029
**Depended on by**: F031, F032, F033, F040, F041, F042, F043, F045, F046, F055

#### F031 - Developer Mode Orchestrator
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/orchestrator.ts`
**Dependencies**: F030
**Depended on by**: F034, F046, F048

#### F033 - Verification Mode Scaling
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/verification-modes.ts`
**Dependencies**: F007, F030

#### F034 - Developer Mode API Routes
**Status**: Complete
**Files**:
- `server/src/routes/developer-mode.ts`
**Dependencies**: F030, F031
**Depended on by**: F037, F065

#### F035 - Developer Mode Database Schema
**Status**: Complete
**Files**:
- `server/src/schema.ts`
- `server/drizzle/0003_developer_mode.sql`
**Dependencies**: F028

#### F036 - Developer Mode Store (Frontend)
**Status**: Complete
**Files**:
- `src/store/useDeveloperModeStore.ts`
**Dependencies**: F029
**Depended on by**: F037, F039

#### F037 - AgentModeSidebar Backend Connection
**Status**: Complete
**Files**:
- `src/components/builder/AgentModeSidebar.tsx`
**Dependencies**: F034, F036

#### F038 - Sandbox Preview Component
**Status**: Complete
**Files**:
- `src/components/builder/AgentSandboxPreview.tsx`
**Dependencies**: F037

#### F039 - Deploy Agent Modal
**Status**: Complete
**Files**:
- `src/components/builder/DeployAgentModal.tsx`
**Dependencies**: F036

#### F040 - SSE Event Streaming
**Status**: Complete
**Files**:
- `server/src/routes/developer-mode.ts`
- `src/store/useDeveloperModeStore.ts`
**Dependencies**: F030

#### F041 - Git Branch Manager
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/git-branch-manager.ts`
**Dependencies**: F030
**Depended on by**: F042, F044

#### F042 - Sandbox Service
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/sandbox-service.ts`
**Dependencies**: F030, F041
**Depended on by**: F052

#### F043 - Credit Calculator
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/credit-calculator.ts`
**Dependencies**: F030

#### F044 - PR Creation Integration
**Status**: Complete
**Files**:
- `server/src/services/developer-mode/pr-integration.ts`
**Dependencies**: F041

#### F045 - Micro Intent Lock
**Status**: Complete
**Files**:
- `server/src/services/ai/intent-lock.ts`
**Dependencies**: F001, F030

---

### Advanced Features

#### F046 - Soft Interrupt System
**Status**: Complete
**Files**:
- `server/src/services/soft-interrupt/interrupt-manager.ts`
- `server/src/routes/soft-interrupt.ts`
- `src/components/builder/SoftInterruptInput.tsx`
**Dependencies**: F030, F031

#### F047 - Pre-Deployment Validation
**Status**: Complete
**Files**:
- `server/src/services/validation/pre-flight-validator.ts`
- `server/src/routes/validation.ts`
- `src/components/builder/PlatformValidatorPanel.tsx`
**Dependencies**: F028
**Depended on by**: F060

#### F048 - Ghost Mode Controller
**Status**: Complete
**Files**:
- `server/src/services/ghost-mode/ghost-controller.ts`
- `server/src/routes/ghost-mode.ts`
**Dependencies**: F031, F021
**Depended on by**: F049, F050

#### F049 - Ghost Session Events & Replay
**Status**: Complete
**Files**:
- `server/src/services/ghost-mode/event-recorder.ts`
- `src/components/builder/GhostModePanel.tsx`
- `src/components/builder/GhostModeReplay.tsx`
**Dependencies**: F048

#### F061 - Advanced Developer Settings Page
**Status**: Complete
**Files**:
- `src/components/settings/DeveloperSettingsSection.tsx`
- `src/pages/SettingsPage.tsx`
- `server/src/routes/user-settings.ts`
- `server/src/schema.ts`
**Dependencies**: F046, F047, F048
**Depended on by**: F062, F063

---

### Feature Agent

#### F065 - Feature Agent Command Center V2
**Status**: Complete
**Files**:
- `src/components/developer-bar/panels/FeatureAgentCommandCenter.tsx`
- `src/components/feature-agent/FeatureAgentTile.tsx`
- `src/components/feature-agent/FeatureAgentTileHost.tsx`
- `src/components/feature-agent/ImplementationPlanView.tsx`
- `src/components/feature-agent/CredentialsCollectionView.tsx`
- `src/store/useFeatureAgentTileStore.ts`
- `server/src/services/feature-agent/feature-agent-service.ts`
**Dependencies**: F001, F030, F031, F034

#### F066 - Notifications System
**Status**: Complete
**Files**:
- `server/src/services/notifications/notification-service.ts`
- `server/src/routes/notifications.ts`
- `src/components/dashboard/NotificationsSection.tsx`
- `src/pages/Dashboard.tsx`
**Dependencies**: F034, F065

---

### Autonomous Learning Engine (Component 28)

#### C28-L1 - Experience Capture Layer
**Status**: Complete
**Files**:
- `server/src/services/learning/types.ts`
- `server/src/services/learning/experience-capture.ts`
**Dependencies**: None

#### C28-L2 - AI Judgment Layer
**Status**: Complete
**Files**:
- `server/src/services/learning/ai-judgment.ts`
**Dependencies**: C28-L1

#### C28-L3 - Shadow Model Registry
**Status**: Complete
**Files**:
- `server/src/services/learning/shadow-model-registry.ts`
**Dependencies**: C28-L2

#### C28-L4 - Meta-Learning Layer
**Status**: Complete
**Files**:
- `server/src/services/learning/pattern-library.ts`
- `server/src/services/learning/strategy-evolution.ts`
**Dependencies**: C28-L2

#### C28-L5 - Evolution Flywheel
**Status**: Complete
**Files**:
- `server/src/services/learning/evolution-flywheel.ts`
- `server/src/routes/learning.ts`
- `src/components/builder/LearningInsightsPanel.tsx`
- `src/components/settings/LearningSettingsSection.tsx`
- `src/store/useLearningStore.ts`
**Dependencies**: C28-L1, C28-L2, C28-L3, C28-L4

---

## Pending Features (15)

### F032 - Micro Intent Lock (Deferred)
**Files**: `server/src/services/ai/intent-lock.ts`
**Dependencies**: F001, F030
**Note**: Covered by F045

### F050 - Notification Integrations
**Files**: `server/src/services/notifications/channels/*`
**Dependencies**: F048

### F051 - Clone Mode Video Analyzer
**Files**:
- `server/src/services/clone-mode/video-analyzer.ts`
- `server/src/services/clone-mode/flow-extractor.ts`
- `server/src/services/clone-mode/code-reconstructor.ts`
- `src/components/builder/CloneModeWizard.tsx`
**Dependencies**: F001

### F052 - User Twin Persona Generator
**Files**:
- `server/src/services/user-twin/persona-generator.ts`
- `server/src/services/user-twin/behavior-simulator.ts`
- `server/src/services/user-twin/friction-analyzer.ts`
- `src/components/builder/UserTwinReport.tsx`
**Dependencies**: F042

### F053 - Market Fit Oracle
**Files**:
- `server/src/services/market-fit/competitor-analyzer.ts`
- `server/src/services/market-fit/market-sizer.ts`
- `server/src/services/market-fit/feature-prioritizer.ts`
- `src/components/builder/MarketFitReport.tsx`
**Dependencies**: None

### F054 - Context Bridge Code Ingester
**Files**:
- `server/src/services/context-bridge/code-ingester.ts`
- `server/src/services/context-bridge/pattern-extractor.ts`
- `server/src/services/context-bridge/convention-mapper.ts`
- `src/components/builder/ImportWizard.tsx`
**Dependencies**: F003

### F055 - Voice Architect
**Files**:
- `server/src/services/voice/voice-transcriber.ts`
- `server/src/services/voice/intent-parser.ts`
- `server/src/services/voice/voice-responder.ts`
- `src/components/builder/VoiceMode.tsx`
**Dependencies**: F030

### F056 - API Autopilot Discovery Engine
**Files**:
- `server/src/services/api-autopilot/api-discoverer.ts`
- `server/src/services/api-autopilot/integration-generator.ts`
- `server/src/services/api-autopilot/auth-handler.ts`
- `src/components/builder/APIAutopilotPanel.tsx`
**Dependencies**: None

### F057 - Enhanced Time Machine Timeline
**Files**:
- `server/src/services/checkpoints/time-machine.ts`
- `src/components/builder/TimeMachineTimeline.tsx`
**Dependencies**: F021

### F058 - Adaptive UI Behavior Tracking
**Files**:
- `server/src/services/adaptive-ui/behavior-tracker.ts`
- `server/src/services/adaptive-ui/tracking-script.ts`
**Dependencies**: None

### F059 - Adaptive UI Optimizer
**Files**:
- `server/src/services/adaptive-ui/optimizer.ts`
- `server/src/services/adaptive-ui/ab-runner.ts`
- `src/components/deployment/AdaptiveUIReport.tsx`
**Dependencies**: F058

### F060 - Universal Export Platform Adapters
**Files**:
- `server/src/services/universal-export/platform-adapter.ts`
- `server/src/services/universal-export/ios-exporter.ts`
- `server/src/services/universal-export/android-exporter.ts`
- `server/src/services/universal-export/desktop-exporter.ts`
- `src/components/deployment/UniversalExportPanel.tsx`
**Dependencies**: F047

### F062 - Builder Mode Component Integration
**Files**: `src/pages/Builder.tsx`
**Dependencies**: F061

### F063 - Agents Mode Component Integration
**Files**: `src/components/builder/AgentModeSidebar.tsx`
**Dependencies**: F061

### F064 - Feature Flags & Settings Sync
**Files**:
- `server/src/services/feature-flags/flag-service.ts`
- `src/hooks/useFeatureFlags.ts`
**Dependencies**: None

---

*Last updated: 2025-12-14*

# KripTik AI Implementation Plan: Replit Agent 3 Parity + Mobile





> **Purpose**: Structured NLP prompts for Opus 4.5 in Cursor 2.2


> **Date**: January 13, 2026


> **Status**: Implementation Plan (DO NOT EXECUTE - Copy prompts to Cursor 2.2)





---





## TABLE OF CONTENTS





1. [Overview & Research Summary](#overview--research-summary)


2. [Phase 1: Builder View UI/UX Overhaul](#phase-1-builder-view-uiux-overhaul)


3. [Phase 2: Agent-Controlled Browser in Streaming Chat](#phase-2-agent-controlled-browser-in-streaming-chat)


4. [Phase 3: Feature Agent Critical Fixes](#phase-3-feature-agent-critical-fixes)


5. [Phase 4: Feature Agent UI Polish](#phase-4-feature-agent-ui-polish)


6. [Phase 5: Mobile App Integration](#phase-5-mobile-app-integration)


7. [Phase 6: Mobile App Building Capabilities](#phase-6-mobile-app-building-capabilities)


8. [Credential Requirements](#credential-requirements)





---





## OVERVIEW & RESEARCH SUMMARY





### Replit Agent 3 Key Features (January 2026)


- **Streaming Chat Interface**: Real-time message streaming with agent "thinking" indicators


- **Integrated Browser Preview**: Small browser window showing agent actions in real-time


- **App Testing Feature**: Agent-controlled browser clicks through app, identifies issues


- **Self-Testing Loop**: Automatic issue detection and fixing until perfect


- **Mobile App**: Check on jobs, iterate from mobile, nearly identical desktop experience


- **200-Minute Autonomy**: Runs extended tasks without user intervention


- **Integrations**: Notion, Linear, Dropbox, GitHub connections





### KripTik Existing Backend (PRESERVE)


- **BuildLoopOrchestrator**: 7-phase build loop (6047 lines)


- **Verification Swarm**: 6 continuous agents


- **7 Gap Closers**: Accessibility, Adversarial, Cross-Browser, Error State, Exploratory, Performance, Real Data


- **Intent Lock**: Immutable Sacred Contract


- **TimeMachine**: Checkpoint and rollback system


- **4-Level Error Escalation**: Pattern Library → Sonnet 4.5 → Opus 4.5 + 64K → Component Rewrite → Full Rebuild


- **KripToeNite**: Intelligent model routing





### Feature Agent Issues to Fix (18 Total)


**CRITICAL (4)**:


1. "Take Control" button not wired


2. Sandbox route `/api/feature-agent/{agentId}/sandbox` missing


3. Merge doesn't write files to disk


4. Plan modifications not persisted





**HIGH (3)**:


5. 6-agent limit UI only (no server enforcement)


6. No inter-agent context sharing


7. Verification fallback bypasses gates





**MEDIUM (11)**:


8. Ghost Mode non-functional


9. No real-time preview during build


10. Tile resize issues


11. No session persistence


12. Cursor sticking when resizing


13. Tile position issues after task start


14. No stop/merge mid-task capability


15. Streaming message parsing issues


16. Width/height individual control missing


17. Tile expansion animations broken


18. Minimize/maximize state persistence





---





## PHASE 1: BUILDER VIEW UI/UX OVERHAUL





### Prompt 1.1: Streaming Chat Interface Redesign





```


<task>


ULTRATHINK MODE: Redesign KripTik AI Builder View chat interface to match Replit Agent 3's streaming UI/UX flow while preserving KripTik's backend, button names, and developer toolbar.





REQUIREMENTS:


1. READ these files completely before making any changes:


   - src/components/builder/ChatInterface.tsx


   - src/components/builder/BuilderDesktop.tsx


   - src/components/builder/BuildPhaseIndicator.tsx


   - src/pages/Builder.tsx


   - src/store/useBuilderStore.ts





2. IMPLEMENT streaming chat UI with these exact features:





   A. Message Stream Layout:


   - Full-height chat panel on left side (60% width)


   - Live preview panel on right side (40% width)


   - Messages stream in real-time with typing indicators


   - Agent "thinking" animation when processing (pulsing dots)


   - Code blocks render inline with syntax highlighting


   - File creation/modification shown as collapsible cards


   - Error messages shown with amber warning styling (NOT red)





   B. Agent Status Indicators:


   - Circular avatar with animated ring when active


   - Phase indicator integrated into chat header


   - "Agent is working on..." contextual status


   - Time elapsed counter during builds


   - Token usage indicator (subtle, bottom right)





   C. Message Types to Support:


   - user_message: User's NLP input


   - agent_thinking: "Analyzing your request..." with spinner


   - agent_response: Agent's text response


   - code_block: Syntax-highlighted code with copy button


   - file_created: Collapsible card showing new file


   - file_modified: Diff view showing changes


   - phase_started: Phase transition notification


   - phase_complete: Phase completion with checkmark


   - verification_result: Inline verification status


   - error_detected: Error card with fix suggestion


   - build_complete: Success card with "Open App" button





3. STYLING (NOT Replit's colors - KripTik's palette):


   - Background: slate-900 with subtle gradient


   - Messages: Glass cards with backdrop-blur-md


   - Agent messages: Left-aligned, amber accent border


   - User messages: Right-aligned, slate-700 background


   - Code blocks: slate-800 with amber syntax highlights


   - Buttons: 3D effect with warm glow on hover


   - Fonts: Keep existing KripTik typography (Cal Sans, Outfit)





4. ANIMATIONS (Framer Motion):


   - Messages slide in from bottom


   - Typing indicator pulses


   - Phase transitions have smooth crossfade


   - Code blocks expand with spring animation


   - Success checkmarks animate with scale+fade





5. PRESERVE:


   - All existing WebSocket connections to /api/execute


   - BuildLoopOrchestrator integration


   - SSE streaming for real-time updates


   - Developer toolbar functionality


   - Speed dial selector


   - All button names (Build, Generate, etc.)





6. CREATE these new components:


   - src/components/builder/StreamingMessage.tsx


   - src/components/builder/AgentThinkingIndicator.tsx


   - src/components/builder/FileChangeCard.tsx


   - src/components/builder/PhaseTransitionCard.tsx


   - src/components/builder/VerificationResultInline.tsx





7. WIRE UP:


   - Connect all new components to useBuilderStore


   - Ensure SSE events map to correct message types


   - Preserve existing API routes - only add new if necessary





DO NOT:


- Use any emojis in UI


- Use Lucide React icons (use custom SVGs from src/components/icons/)


- Create placeholder content or mock data


- Leave TODO comments


- Use purple-pink gradients


- Break existing functionality





VERIFY:


- Run npm run build - must pass with zero errors


- Test SSE streaming still works


- Test phase indicator updates correctly


- Test code blocks render with syntax highlighting


</task>


```





### Prompt 1.2: Live Preview Panel with Agent Browser





```


<task>


EXTENDED THINKING MODE: Implement live preview panel in Builder View that shows agent-controlled browser during builds, mimicking Replit Agent 3's integrated browser preview.





REQUIREMENTS:


1. READ these files completely:


   - src/components/builder/LivePreview.tsx (if exists)


   - src/components/builder/BuilderDesktop.tsx


   - server/src/services/verification/browser-in-loop.ts


   - server/src/services/preview/headless-preview-service.ts





2. IMPLEMENT live preview panel with these features:





   A. Preview Container Layout:


   - Resizable width (drag handle between chat and preview)


   - Minimum width: 320px, maximum: 60% of viewport


   - Browser chrome styling (URL bar, back/forward/refresh buttons)


   - Device frame selector (Desktop/Tablet/Mobile)


   - Fullscreen toggle button





   B. Agent Browser View (CRITICAL):


   - Shows agent's POV during Phase 4 (Functional Test) and Phase 6 (Browser Demo)


   - Visual cursor showing where agent is clicking


   - Highlight boxes around elements agent is interacting with


   - Action overlay text ("Clicking Login button...", "Filling email field...")


   - Screenshot refresh every 500ms during agent actions


   - Smooth transitions between screenshots (crossfade)





   C. Preview States:


   - idle: "Start a build to see preview"


   - initializing: Spinner with "Starting development server..."


   - loading: Progress bar with "Loading preview..."


   - ready: Live HMR preview with URL


   - agent_testing: Agent browser view with action overlays


   - error: Error message with retry button





   D. URL Bar Functionality:


   - Shows current preview URL


   - Copy URL button


   - Open in new tab button


   - Route history dropdown





   E. Device Frames:


   - Desktop: Full width, no frame


   - Tablet: iPad-style frame (768x1024)


   - Mobile: iPhone-style frame (390x844)


   - Frame selector buttons with device icons





3. BACKEND INTEGRATION:


   - Connect to existing BrowserInLoopService for screenshots


   - Add new SSE event type: 'agent_browser_action'


   - Event payload: { action: string, selector: string, screenshot: base64 }


   - Add WebSocket endpoint for real-time screenshot streaming





4. CREATE these files:


   - src/components/builder/LivePreviewPanel.tsx (main container)


   - src/components/builder/AgentBrowserOverlay.tsx (action visualization)


   - src/components/builder/DeviceFrameSelector.tsx


   - src/components/builder/BrowserChrome.tsx (URL bar, controls)


   - server/src/routes/preview-stream.ts (screenshot streaming)





5. STYLING:


   - Browser chrome: slate-800 with subtle border


   - URL bar: slate-700 input field


   - Buttons: Glass effect with amber hover


   - Device frames: Subtle shadow, rounded corners


   - Agent cursor: Amber glow, pulsing animation


   - Action highlights: Amber dashed border, semi-transparent fill





6. ANIMATIONS:


   - Screenshot crossfade: 300ms ease-out


   - Agent cursor: Smooth movement with trail


   - Action text: Fade in/out with slide


   - Device frame switch: Scale+fade transition





7. PRESERVE:


   - Existing HMR functionality


   - All existing preview routes


   - headless-preview-service.ts functionality





DO NOT:


- Use emojis


- Use Lucide React icons


- Create mock data or placeholders


- Break existing HMR preview


- Leave TODO comments





VERIFY:


- npm run build passes


- HMR preview still works


- Agent browser view shows during builds


- Device frames render correctly


- Screenshots stream smoothly


</task>


```





---





## PHASE 2: AGENT-CONTROLLED BROWSER IN STREAMING CHAT





### Prompt 2.1: Phase Verification Display in Chat





```


<task>


HARD THINKING MODE: Implement real-time phase verification display in streaming chat, showing verification swarm results before auto-merging sandboxes.





REQUIREMENTS:


1. READ these files completely:


   - server/src/services/verification/swarm.ts


   - server/src/services/automation/build-loop.ts


   - src/components/builder/VerificationSwarmStatus.tsx


   - src/components/builder/ChatInterface.tsx (new streaming version)





2. IMPLEMENT verification display with these features:





   A. Verification Stream Cards (in chat):


   - Card appears when phase verification starts


   - Shows 6 verification agents as small icons in a row


   - Each agent icon: gray (pending) → amber (running) → green (pass) / red (fail)


   - Agent names: Error, Quality, Visual, Security, Placeholder, Design


   - Progress bar showing overall verification progress


   - Expandable details for each agent result





   B. Real-Time Verification Events:


   - verification_started: Card appears with all agents pending


   - agent_started: Specific agent icon turns amber with spinner


   - agent_completed: Icon turns green/red, score shown below


   - verification_complete: Summary card with overall status


   - merge_ready: "Ready to merge" indicator with progress


   - merge_complete: "Merged successfully" with checkmark





   C. Agent Result Details (expandable):


   - Error Checker: Error count, error list if any


   - Code Quality: Score out of 100, top issues


   - Visual Verifier: Screenshot diff, anti-slop score


   - Security Scanner: Vulnerability count, severity levels


   - Placeholder Eliminator: Count of remaining placeholders


   - Design Style: App Soul match score, suggestions





   D. Verification Summary Card:


   - Overall score: 0-100


   - Pass/Fail status with icon


   - Time taken


   - "View Details" toggle


   - If failed: "Fixing issues..." indicator





   E. Gap Closer Results (Stage 2+):


   - Accessibility: WCAG violations


   - Performance: Core Web Vitals


   - Cross-Browser: Compatibility issues


   - Show only when gap closers run





3. BACKEND CHANGES:


   - Add SSE events for each verification step in swarm.ts


   - Event types: verification_started, agent_started, agent_completed, verification_complete


   - Ensure build-loop.ts emits these events during Phase 6





4. CREATE these components:


   - src/components/builder/VerificationStreamCard.tsx


   - src/components/builder/VerificationAgentIcon.tsx


   - src/components/builder/VerificationDetails.tsx


   - src/components/builder/MergeProgressIndicator.tsx





5. STYLING:


   - Card: Glass effect, amber border when running


   - Agent icons: 24x24, custom SVGs (NOT Lucide)


   - Progress bar: Amber gradient fill


   - Pass state: Green-400 text and icon


   - Fail state: Red-400 text and icon


   - Score: Large bold number with /100





6. WIRE UP:


   - Connect to existing WebSocket events


   - Map verification events to chat message stream


   - Preserve all existing verification logic


   - Don't modify swarm behavior - only add events





DO NOT:


- Use emojis


- Use Lucide icons


- Change verification logic


- Create mock data


- Leave TODOs





VERIFY:


- npm run build passes


- Verification cards appear in chat


- All 6 agents shown correctly


- Scores display accurately


- Expand/collapse works


</task>


```





### Prompt 2.2: Mini Browser Window in Chat Messages





```


<task>


ULTRATHINK MODE: Implement mini browser window that appears inline in chat messages during agent browser actions, showing real-time screenshots of what the agent is doing.





REQUIREMENTS:


1. READ these files:


   - src/components/builder/ChatInterface.tsx


   - src/components/builder/StreamingMessage.tsx (created in 1.1)


   - server/src/services/verification/browser-in-loop.ts


   - server/src/services/automation/build-loop.ts





2. IMPLEMENT mini browser in chat with these features:





   A. Mini Browser Component:


   - Appears inline in chat when agent performs browser actions


   - Size: 400px width, 16:9 aspect ratio


   - Shows real-time screenshots from BrowserInLoopService


   - Minimal chrome: just URL indicator and close button


   - Amber border when agent is actively interacting





   B. Action Overlay on Screenshots:


   - Visual cursor with amber glow


   - Click targets highlighted with dashed box


   - Action text overlay at bottom ("Clicking Submit...")


   - Form fill visualization (text appearing in fields)





   C. Message Types with Mini Browser:


   - agent_testing_started: Mini browser appears


   - agent_click: Screenshot with click indicator


   - agent_type: Screenshot with typing animation


   - agent_scroll: Screenshot with scroll indicator


   - agent_wait: Screenshot with waiting spinner


   - agent_assertion: Screenshot with pass/fail overlay


   - agent_testing_complete: Final screenshot with results





   D. Screenshot Streaming:


   - WebSocket connection for screenshot stream


   - Max 2 FPS to prevent overload


   - Smooth crossfade between frames


   - Fallback to static screenshot if stream fails





   E. Expandability:


   - Click mini browser to expand to larger view


   - Expanded view: 80% viewport width


   - Full browser controls in expanded view


   - Close button returns to mini view





3. BACKEND:


   - Modify BrowserInLoopService to emit screenshot events


   - Add new route: /api/agent-browser/:buildId/stream


   - Return base64 screenshots via SSE


   - Include action metadata with each screenshot





4. CREATE these files:


   - src/components/builder/MiniBrowserWindow.tsx


   - src/components/builder/BrowserActionOverlay.tsx


   - src/components/builder/ExpandedBrowserModal.tsx


   - server/src/routes/agent-browser-stream.ts





5. STYLING:


   - Mini browser: Rounded corners, subtle shadow


   - Border: 2px amber when active, slate-700 when idle


   - Action overlay: Semi-transparent black bar at bottom


   - Cursor: 16x16 amber circle with glow


   - Click target: Amber dashed border, 20% amber fill





6. ANIMATIONS:


   - Screenshots crossfade 200ms


   - Cursor smooth movement with easing


   - Click: Scale pulse effect


   - Type: Text appears character by character


   - Expand: Scale up from center with fade





7. PRESERVE:


   - All existing browser-in-loop functionality


   - Existing screenshot capture logic


   - Phase 4 and Phase 6 browser testing





DO NOT:


- Use emojis


- Use Lucide icons


- Create placeholder images


- Leave TODO comments


- Break existing browser testing





VERIFY:


- npm run build passes


- Mini browser appears during agent actions


- Screenshots stream correctly


- Expand/collapse works


- Actions render with overlays


</task>


```





---





## PHASE 3: FEATURE AGENT CRITICAL FIXES





### Prompt 3.1: Fix "Take Control" and Sandbox Routes





```


<task>


HARD THINKING MODE: Fix critical Feature Agent bugs - wire "Take Control" button and implement sandbox route.





REQUIREMENTS:


1. READ these files completely:


   - src/components/feature-agent/FeatureAgentTile.tsx (lines 400-450 for Take Control button)


   - server/src/services/feature-agent/feature-agent-service.ts


   - server/src/routes/feature-agent.ts


   - src/components/feature-agent/FeaturePreviewWindow.tsx





2. FIX "Take Control" Button:





   A. Current State (BROKEN):


   - Button exists at line ~405 in FeatureAgentTile.tsx


   - onClick handler is empty or calls non-existent function


   - Button appears but does nothing when clicked





   B. Required Behavior:


   - Click opens FeaturePreviewWindow in user-control mode


   - User can interact with the sandbox preview


   - Agent releases control, preview becomes interactive iframe


   - Shows "Agent released control" message





   C. Implementation:


   - Add 'takeControl' action to useFeatureAgentTileStore


   - Implement takeControl handler in tile component


   - Call backend to signal agent release


   - Open FeaturePreviewWindow with interactive: true


   - Store user control state in tile store





3. IMPLEMENT Sandbox Route:





   A. Current State (MISSING):


   - /api/feature-agent/:agentId/sandbox route doesn't exist


   - FeaturePreviewWindow tries to load this but fails





   B. Required Route:


   - GET /api/feature-agent/:agentId/sandbox


   - Returns sandbox preview URL for the agent


   - Starts sandbox server if not running


   - Returns { url: string, port: number, status: string }





   C. Implementation in server/src/routes/feature-agent.ts:


   - Add GET /:agentId/sandbox route


   - Get agent from feature-agent-service


   - Get sandbox URL from agent's sandbox instance


   - If no sandbox, start one via sandbox-service


   - Return sandbox URL for iframe embedding





4. UPDATE FeaturePreviewWindow:


   - Fetch sandbox URL from new route


   - Handle loading states


   - Handle error states (sandbox failed to start)


   - Add refresh button


   - Add "Back to Agent Control" button when in user mode





5. BACKEND CHANGES:


   - Add getSandboxUrl method to feature-agent-service.ts


   - Add takeControl method that pauses agent activity


   - Add releaseControl method to resume agent


   - Emit events for control state changes





6. WIRE UP:


   - Connect button to store action


   - Connect store to API calls


   - Connect preview window to sandbox route


   - Add SSE event for control state changes





DO NOT:


- Use emojis


- Use Lucide icons


- Create mock sandbox URLs


- Leave TODO comments


- Break existing tile functionality





VERIFY:


- npm run build passes


- "Take Control" button opens preview


- Sandbox route returns valid URL


- Preview window loads sandbox


- User can interact with sandbox


</task>


```





### Prompt 3.2: Fix Merge File Writing and Plan Persistence





```


<task>


EXTENDED THINKING MODE: Fix critical bugs - merge must write files to disk and plan modifications must persist.





REQUIREMENTS:


1. READ these files completely:


   - server/src/services/feature-agent/feature-agent-service.ts (lines 2199-2242 acceptAndMerge)


   - server/src/services/automation/build-loop.ts (file writing sections)


   - server/src/routes/feature-agent.ts (plan approval routes)


   - src/components/feature-agent/ImplementationPlanView.tsx





2. FIX Merge File Writing:





   A. Current State (BROKEN):


   - acceptAndMerge method in feature-agent-service.ts


   - Returns success but doesn't actually write files


   - Files remain in sandbox, never reach project directory





   B. Required Behavior:


   - Get all files from agent's sandbox


   - Write each file to project directory


   - Create directories if they don't exist


   - Handle file conflicts (overwrite with backup)


   - Update file table in database


   - Trigger HMR refresh on frontend





   C. Implementation (add to acceptAndMerge):


   ```typescript


   // After getting sandbox files


   const sandboxFiles = await this.getSandboxFiles(agentId);


   const projectPath = agent.projectPath;





   for (const file of sandboxFiles) {


     const fullPath = path.join(projectPath, file.path);


     const dir = path.dirname(fullPath);





     // Create directory if needed


     await fs.mkdir(dir, { recursive: true });





     // Backup existing file if exists


     if (await fs.access(fullPath).then(() => true).catch(() => false)) {


       await fs.copyFile(fullPath, `${fullPath}.backup`);


     }





     // Write new file


     await fs.writeFile(fullPath, file.content, 'utf-8');





     // Update database


     await this.updateFileInDatabase(agent.projectId, file.path, file.content);


   }





   // Emit HMR trigger event


   this.emit('files_merged', { agentId, fileCount: sandboxFiles.length });


   ```





3. FIX Plan Persistence:





   A. Current State (BROKEN):


   - User modifies phases in ImplementationPlanView


   - Changes sent to API but not saved


   - On refresh, modifications lost


   - Build uses original plan





   B. Required Behavior:


   - Save modified plan to database


   - Load modified plan on refresh


   - Build uses modified plan


   - Show "Modified" indicator if plan changed





   C. Implementation:


   - Add planModifications column to feature_agent_runs table (if not exists)


   - Add PUT /api/feature-agent/:agentId/plan route


   - Save plan modifications as JSON


   - Load modifications when fetching agent state


   - Merge modifications with original plan before build





4. DATABASE CHANGES:


   - Add migration if planModifications column doesn't exist


   - Schema: planModifications TEXT (JSON string)


   - Store: { phases: [...], modifiedAt: timestamp }





5. FRONTEND CHANGES:


   - Save plan on modification (debounced)


   - Load saved modifications on component mount


   - Show "Saved" indicator after save


   - Show "Modified" badge if plan differs from original





6. WIRE UP:


   - Connect ImplementationPlanView save to API


   - Connect API to database


   - Load modifications in useFeatureAgentTileStore


   - Pass modified plan to build executor





DO NOT:


- Use emojis


- Use Lucide icons


- Create mock file content


- Leave TODO comments


- Skip database migration


- Break existing plan display





VERIFY:


- npm run build passes


- Merge writes files to project directory


- Files appear in file tree after merge


- Plan modifications persist on refresh


- Build uses modified plan


</task>


```





### Prompt 3.3: Server-Side Agent Limit and Context Sharing





```


<task>


HARD THINKING MODE: Fix high-priority bugs - enforce 6-agent limit on server and implement inter-agent context sharing.





REQUIREMENTS:


1. READ these files:


   - server/src/services/feature-agent/feature-agent-service.ts


   - server/src/routes/feature-agent.ts


   - server/src/services/context/unified-context.ts


   - src/components/feature-agent/FeatureAgentCommandCenter.tsx (line 726 for UI limit)





2. IMPLEMENT Server-Side 6-Agent Limit:





   A. Current State (UI ONLY):


   - Limit enforced only in FeatureAgentCommandCenter.tsx


   - Direct API calls can create unlimited agents


   - Multiple browser tabs can bypass limit





   B. Required Behavior:


   - Server rejects new agent if user has 6+ active agents


   - Return 429 Too Many Requests with message


   - Include current agent count in response


   - Allow configurable limit per user tier





   C. Implementation in feature-agent-service.ts:


   ```typescript


   async deployAgent(userId: string, config: AgentConfig): Promise<AgentDeployResult> {


     // Check current active agent count


     const activeAgents = await this.getActiveAgentCount(userId);


     const maxAgents = await this.getUserMaxAgents(userId); // 6 for free, more for paid





     if (activeAgents >= maxAgents) {


       throw new AgentLimitError(


         `Maximum ${maxAgents} concurrent agents allowed. Currently running: ${activeAgents}`,


         { currentCount: activeAgents, limit: maxAgents }


       );


     }





     // Continue with deployment...


   }


   ```





   D. Route Handler:


   - Catch AgentLimitError in route handler


   - Return 429 status with error details


   - Include Retry-After header





3. IMPLEMENT Inter-Agent Context Sharing:





   A. Current State (ISOLATED):


   - Each agent has separate context


   - Agents don't see each other's changes


   - No learning transfer between agents





   B. Required Behavior:


   - All agents share unified project context


   - Agent discoveries broadcast to others


   - Error patterns learned by one help others


   - File changes visible to all agents





   C. Implementation - Shared Context Store:


   ```typescript


   class SharedAgentContext {


     private contexts: Map<string, AgentContext> = new Map();


     private sharedPatterns: ErrorPattern[] = [];


     private sharedDiscoveries: Discovery[] = [];





     async broadcastDiscovery(agentId: string, discovery: Discovery) {


       this.sharedDiscoveries.push({ ...discovery, agentId, timestamp: Date.now() });


       this.emit('discovery', { agentId, discovery });


     }





     async getSharedContext(agentId: string): Promise<SharedContext> {


       return {


         patterns: this.sharedPatterns,


         discoveries: this.sharedDiscoveries,


         otherAgentChanges: this.getOtherAgentChanges(agentId),


       };


     }





     async registerFileChange(agentId: string, file: FileChange) {


       // Broadcast to other agents working on same project


       this.emit('file_changed', { agentId, file });


     }


   }


   ```





   D. Integration Points:


   - Inject SharedAgentContext into each agent


   - Subscribe agents to file_changed events


   - Include shared context in code generation prompts


   - Update shared patterns when errors fixed





4. CREATE these files:


   - server/src/services/feature-agent/shared-context.ts


   - server/src/services/feature-agent/agent-limit-service.ts





5. UPDATE:


   - feature-agent-service.ts: Add limit check and shared context


   - Routes: Handle 429 responses


   - Frontend: Show error message for limit exceeded





DO NOT:


- Use emojis


- Use Lucide icons


- Create placeholder context


- Leave TODO comments


- Skip database queries for agent count





VERIFY:


- npm run build passes


- Creating 7th agent returns 429


- Error message shows in UI


- Agents share discoveries


- File changes broadcast to others


</task>


```





---





## PHASE 4: FEATURE AGENT UI POLISH





### Prompt 4.1: Fix Tile Resize and Cursor Issues





```


<task>


EXTENDED THINKING MODE: Fix Feature Agent tile resize issues including cursor sticking, individual width/height control, and position problems.





REQUIREMENTS:


1. READ these files completely:


   - src/components/feature-agent/FeatureAgentTile.tsx


   - src/store/useFeatureAgentTileStore.ts


   - src/components/feature-agent/FeatureAgentCommandCenter.tsx





2. FIX Tile Resize Issues:





   A. Current Problems:


   - Cursor sticks to resize handle after mouseup


   - No individual width/height control (only corner resize)


   - Tiles jump position when resizing starts


   - Resize doesn't respect minimum dimensions





   B. Required Behavior:


   - Clean cursor release on mouseup anywhere


   - Edge resize handles for width-only and height-only


   - Corner resize for proportional


   - Smooth resize without position jumping


   - Minimum size: 300x200, Maximum: 80% viewport





   C. Implementation - Resize Handles:


   ```tsx


   const ResizeHandles = () => (


     <>


       {/* Right edge - width only */}


       <div


         className="absolute right-0 top-4 bottom-4 w-2 cursor-ew-resize hover:bg-amber-500/20"


         onMouseDown={(e) => startResize(e, 'width')}


       />


       {/* Bottom edge - height only */}


       <div


         className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize hover:bg-amber-500/20"


         onMouseDown={(e) => startResize(e, 'height')}


       />


       {/* Corner - both */}


       <div


         className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-amber-500/30"


         onMouseDown={(e) => startResize(e, 'both')}


       />


     </>


   );


   ```





   D. Fix Cursor Sticking:


   ```tsx


   useEffect(() => {


     const handleMouseUp = () => {


       if (isResizing) {


         setIsResizing(false);


         setResizeMode(null);


         document.body.style.cursor = '';


         document.body.style.userSelect = '';


       }


     };





     // Listen on window, not just element


     window.addEventListener('mouseup', handleMouseUp);


     window.addEventListener('mouseleave', handleMouseUp);





     return () => {


       window.removeEventListener('mouseup', handleMouseUp);


       window.removeEventListener('mouseleave', handleMouseUp);


     };


   }, [isResizing]);


   ```





   E. Fix Position Jump:


   - Store initial position on resize start


   - Calculate delta from initial, not current


   - Apply transform during resize, update state on end


   - Use requestAnimationFrame for smooth updates





3. FIX Tile Position After Task Start:





   A. Current Problem:


   - Tiles disappear or move off-screen when task starts


   - Position state gets reset





   B. Required Behavior:


   - Tiles stay where user placed them


   - Position persists through task lifecycle


   - Tiles remain visible and draggable during execution





   C. Implementation:


   - Store position in useFeatureAgentTileStore


   - Don't reset position on status change


   - Save position to localStorage for persistence


   - Load position on component mount





4. UPDATE Store (useFeatureAgentTileStore.ts):


   ```typescript


   interface TileState {


     position: { x: number; y: number };


     size: { width: number; height: number };


     isMinimized: boolean;


     isExpanded: boolean;


   }





   // Add actions


   setTileSize: (id: string, size: { width: number; height: number }) => void;


   setTilePosition: (id: string, position: { x: number; y: number }) => void;


   persistTileState: (id: string) => void; // Save to localStorage


   loadTileState: (id: string) => TileState | null; // Load from localStorage


   ```





5. ADD localStorage Persistence:


   - Save tile state on every position/size change (debounced)


   - Load tile state when tile mounts


   - Clear stored state when tile is closed/removed


   - Key format: `kriptik-tile-${agentId}`





DO NOT:


- Use emojis


- Use Lucide icons


- Create placeholder dimensions


- Leave TODO comments


- Remove existing drag functionality





VERIFY:


- npm run build passes


- Cursor releases properly on mouseup


- Width-only resize works


- Height-only resize works


- Corner resize works


- Tiles stay in position during tasks


- Position persists on page refresh


</task>


```





### Prompt 4.2: Fix Streaming and Stop/Merge Functionality





```


<task>


HARD THINKING MODE: Fix Feature Agent streaming issues and implement stop/merge mid-task capability.





REQUIREMENTS:


1. READ these files:


   - src/components/feature-agent/FeatureAgentTile.tsx


   - src/store/useFeatureAgentTileStore.ts


   - server/src/services/feature-agent/feature-agent-service.ts


   - server/src/routes/feature-agent.ts





2. FIX Streaming Issues:





   A. Current Problems:


   - Messages sometimes duplicate


   - Parsing errors on special characters


   - Buffer overflow on long streams


   - Connection drops without reconnect





   B. Required Behavior:


   - Clean message parsing


   - Automatic reconnection on disconnect


   - Proper buffer management (keep last 1200, discard oldest)


   - Handle all SSE event types correctly





   C. Implementation - Robust SSE Handler:


   ```typescript


   const connectToStream = (agentId: string) => {


     const eventSource = new EventSource(`/api/feature-agent/${agentId}/stream`);


     let reconnectAttempts = 0;


     const maxReconnectAttempts = 5;





     eventSource.onmessage = (event) => {


       try {


         const data = JSON.parse(event.data);





         // Deduplicate by message ID


         if (messageIds.has(data.id)) return;


         messageIds.add(data.id);





         // Add to buffer with size limit


         addMessage(agentId, {


           id: data.id,


           type: data.type,


           content: data.content,


           timestamp: data.timestamp,


         });





         reconnectAttempts = 0; // Reset on successful message


       } catch (e) {


         console.error('Message parse error:', e);


       }


     };





     eventSource.onerror = () => {


       if (reconnectAttempts < maxReconnectAttempts) {


         reconnectAttempts++;


         setTimeout(() => connectToStream(agentId), 1000 * reconnectAttempts);


       }


     };





     return eventSource;


   };


   ```





3. IMPLEMENT Stop/Merge Mid-Task:





   A. Current State (MISSING):


   - No way to stop a running agent


   - No way to merge partial work


   - User stuck waiting for completion





   B. Required Behavior:


   - "Stop" button pauses agent execution


   - "Merge What's Done" merges completed work


   - "Resume" continues from where stopped


   - "Cancel" discards all work





   C. UI Changes (FeatureAgentTile.tsx):


   ```tsx


   // Add control buttons based on status


   {status === 'running' && (


     <div className="flex gap-2">


       <button onClick={() => stopAgent(id)} className="btn-amber">


         Stop


       </button>


     </div>


   )}





   {status === 'stopped' && (


     <div className="flex gap-2">


       <button onClick={() => mergePartial(id)} className="btn-green">


         Merge What's Done


       </button>


       <button onClick={() => resumeAgent(id)} className="btn-amber">


         Resume


       </button>


       <button onClick={() => cancelAgent(id)} className="btn-red">


         Cancel


       </button>


     </div>


   )}


   ```





   D. Backend Changes (feature-agent-service.ts):


   ```typescript


   async stopAgent(agentId: string): Promise<void> {


     const agent = this.agents.get(agentId);


     if (!agent) throw new Error('Agent not found');





     // Pause the build loop


     await agent.buildLoop.pause();





     // Save current state for resume


     await this.saveAgentCheckpoint(agentId);





     // Update status


     agent.status = 'stopped';


     this.emit('agent_stopped', { agentId });


   }





   async mergePartial(agentId: string): Promise<MergeResult> {


     const agent = this.agents.get(agentId);





     // Get completed files from sandbox


     const completedFiles = await this.getCompletedFiles(agentId);





     // Write only completed files


     for (const file of completedFiles) {


       await this.writeFileToProject(agent.projectPath, file);


     }





     return { merged: completedFiles.length, status: 'partial' };


   }





   async resumeAgent(agentId: string): Promise<void> {


     const agent = this.agents.get(agentId);





     // Load checkpoint


     const checkpoint = await this.loadAgentCheckpoint(agentId);





     // Resume build loop


     await agent.buildLoop.resume(checkpoint);





     agent.status = 'running';


     this.emit('agent_resumed', { agentId });


   }


   ```





4. ADD Routes:


   - POST /api/feature-agent/:agentId/stop


   - POST /api/feature-agent/:agentId/merge-partial


   - POST /api/feature-agent/:agentId/resume


   - POST /api/feature-agent/:agentId/cancel





5. UPDATE Store Actions:


   - stopAgent(id: string)


   - mergePartial(id: string)


   - resumeAgent(id: string)


   - cancelAgent(id: string)





DO NOT:


- Use emojis


- Use Lucide icons


- Create placeholder implementations


- Leave TODO comments


- Break existing streaming





VERIFY:


- npm run build passes


- Messages stream without duplicates


- Reconnection works on disconnect


- Stop button pauses agent


- Merge partial works correctly


- Resume continues from checkpoint


</task>


```





---





## PHASE 5: MOBILE APP INTEGRATION





### Prompt 5.1: Mobile App Foundation (React Native + Expo)





```


<task>


ULTRATHINK MODE: Create KripTik AI mobile app foundation using React Native and Expo, mimicking Replit Agent 3's mobile experience.





REQUIREMENTS:


1. READ existing KripTik architecture:


   - src/lib/api-config.ts (API configuration)


   - src/store/ (all Zustand stores)


   - src/types/ (TypeScript types)





2. CREATE mobile app structure:





   A. Initialize Project:


   ```bash


   # In project root


   npx create-expo-app@latest mobile --template blank-typescript


   cd mobile


   npx expo install expo-router expo-linking expo-constants


   npx expo install @react-native-async-storage/async-storage


   npx expo install expo-secure-store


   npx expo install expo-notifications


   npx expo install react-native-reanimated


   npx expo install react-native-gesture-handler


   ```





   B. Directory Structure:


   ```


   mobile/


   ├── app/


   │   ├── (tabs)/


   │   │   ├── _layout.tsx


   │   │   ├── index.tsx (Dashboard)


   │   │   ├── projects.tsx


   │   │   ├── agents.tsx


   │   │   └── settings.tsx


   │   ├── project/


   │   │   └── [id].tsx


   │   ├── agent/


   │   │   └── [id].tsx


   │   ├── _layout.tsx


   │   └── +not-found.tsx


   ├── components/


   │   ├── ProjectCard.tsx


   │   ├── AgentTile.tsx


   │   ├── StreamingChat.tsx


   │   ├── MiniBrowser.tsx


   │   └── common/


   ├── hooks/


   │   ├── useAuth.ts


   │   ├── useProjects.ts


   │   ├── useAgents.ts


   │   └── useSSE.ts


   ├── store/


   │   └── (shared with web, adapted)


   ├── lib/


   │   ├── api.ts


   │   └── storage.ts


   └── assets/


   ```





3. IMPLEMENT Core Features:





   A. Authentication (mobile/hooks/useAuth.ts):


   - Secure token storage using expo-secure-store


   - Biometric authentication option


   - Auto-refresh tokens


   - Deep link handling for OAuth





   B. SSE Connection (mobile/hooks/useSSE.ts):


   ```typescript


   import { useEffect, useRef, useState } from 'react';


   import { AppState, AppStateStatus } from 'react-native';





   export function useSSE<T>(url: string) {


     const [data, setData] = useState<T | null>(null);


     const [connected, setConnected] = useState(false);


     const eventSourceRef = useRef<EventSource | null>(null);





     useEffect(() => {


       const connect = () => {


         // Use fetch-based SSE for React Native


         fetch(url, {


           headers: { Accept: 'text/event-stream' },


         }).then(async (response) => {


           const reader = response.body?.getReader();


           if (!reader) return;





           setConnected(true);





           while (true) {


             const { done, value } = await reader.read();


             if (done) break;





             const text = new TextDecoder().decode(value);


             const lines = text.split('\n');





             for (const line of lines) {


               if (line.startsWith('data: ')) {


                 const data = JSON.parse(line.slice(6));


                 setData(data);


               }


             }


           }


         });


       };





       // Handle app state changes (reconnect on foreground)


       const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {


         if (state === 'active') connect();


       });





       connect();





       return () => {


         subscription.remove();


       };


     }, [url]);





     return { data, connected };


   }


   ```





   C. Dashboard Screen (mobile/app/(tabs)/index.tsx):


   - Recent projects list


   - Active agents overview


   - Quick actions (New Project, Resume Build)


   - Pull-to-refresh





   D. Project Detail (mobile/app/project/[id].tsx):


   - Streaming chat interface


   - Mini browser preview


   - Phase indicator


   - Quick iterate actions





   E. Agent View (mobile/app/agent/[id].tsx):


   - Agent status and progress


   - Streaming messages


   - Control buttons (Stop, Resume, Merge)


   - Preview window





4. STYLING (NativeWind - Tailwind for React Native):


   ```bash


   npx expo install nativewind tailwindcss


   ```





   - Same color scheme as web app


   - Amber accents, slate backgrounds


   - Glass effects using blur views


   - Smooth animations with Reanimated





5. PUSH NOTIFICATIONS:


   - Build complete notifications


   - Error alerts


   - Agent status changes


   - Integration with expo-notifications





6. PRESERVE:


   - Use same API endpoints as web


   - Same authentication flow


   - Same data structures


   - Consistent UX patterns





DO NOT:


- Use emojis


- Create placeholder screens


- Leave TODO comments


- Skip TypeScript types


- Use different API endpoints than web





VERIFY:


- Project builds: cd mobile && npx expo start


- Authentication works


- SSE streaming works


- Navigation works


- Styling matches design system


</task>


```





### Prompt 5.2: Mobile Streaming Chat and Agent Control





```


<task>


EXTENDED THINKING MODE: Implement mobile streaming chat interface and agent control, matching Replit Agent 3's mobile flow.





REQUIREMENTS:


1. READ web implementations:


   - src/components/builder/ChatInterface.tsx (streaming logic)


   - src/components/builder/StreamingMessage.tsx


   - src/components/feature-agent/FeatureAgentTile.tsx





2. IMPLEMENT Mobile Streaming Chat:





   A. StreamingChat Component (mobile/components/StreamingChat.tsx):


   ```tsx


   import React, { useRef, useEffect } from 'react';


   import { View, ScrollView, Text, TextInput, Pressable } from 'react-native';


   import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';


   import { useSSE } from '../hooks/useSSE';





   interface Message {


     id: string;


     type: 'user' | 'agent' | 'code' | 'phase' | 'verification';


     content: string;


     timestamp: number;


   }





   export function StreamingChat({ projectId }: { projectId: string }) {


     const scrollRef = useRef<ScrollView>(null);


     const [input, setInput] = useState('');


     const { data: message } = useSSE<Message>(`/api/project/${projectId}/stream`);


     const [messages, setMessages] = useState<Message[]>([]);





     useEffect(() => {


       if (message) {


         setMessages(prev => [...prev, message]);


         scrollRef.current?.scrollToEnd({ animated: true });


       }


     }, [message]);





     const sendMessage = async () => {


       if (!input.trim()) return;





       // Add user message immediately


       const userMessage: Message = {


         id: Date.now().toString(),


         type: 'user',


         content: input,


         timestamp: Date.now(),


       };


       setMessages(prev => [...prev, userMessage]);


       setInput('');





       // Send to API


       await fetch(`/api/project/${projectId}/chat`, {


         method: 'POST',


         body: JSON.stringify({ message: input }),


       });


     };





     return (


       <View className="flex-1 bg-slate-900">


         <ScrollView


           ref={scrollRef}


           className="flex-1 px-4"


           contentContainerStyle={{ paddingVertical: 16 }}


         >


           {messages.map((msg) => (


             <Animated.View


               key={msg.id}


               entering={SlideInDown.duration(200)}


               className={`mb-3 ${msg.type === 'user' ? 'items-end' : 'items-start'}`}


             >


               <MessageBubble message={msg} />


             </Animated.View>


           ))}


         </ScrollView>





         <View className="p-4 bg-slate-800 border-t border-slate-700">


           <View className="flex-row items-center gap-2">


             <TextInput


               value={input}


               onChangeText={setInput}


               placeholder="What would you like to build?"


               placeholderTextColor="#64748b"


               className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-xl"


               multiline


             />


             <Pressable


               onPress={sendMessage}


               className="bg-amber-500 p-3 rounded-xl"


             >


               <SendIcon />


             </Pressable>


           </View>


         </View>


       </View>


     );


   }


   ```





   B. Message Bubble Types:


   - User message: Right-aligned, slate-700 background


   - Agent message: Left-aligned, glass effect background


   - Code block: Syntax highlighting, copy button


   - Phase transition: Full-width card with progress


   - Verification result: Compact status with expandable details





   C. Mini Browser (mobile/components/MiniBrowser.tsx):


   - Smaller than web (full width, 40% height)


   - Tap to expand to full screen


   - Shows agent actions with overlays


   - Pinch to zoom on screenshots





3. IMPLEMENT Agent Control:





   A. AgentTile Component (mobile/components/AgentTile.tsx):


   - Swipe actions (stop, merge, cancel)


   - Tap to expand details


   - Progress indicator


   - Status badge





   B. Agent Control Buttons:


   - Stop: Haptic feedback, confirmation


   - Resume: Immediate action


   - Merge: Show completion percentage


   - Cancel: Confirm dialog





4. HAPTIC FEEDBACK:


   ```tsx


   import * as Haptics from 'expo-haptics';





   // On button press


   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);





   // On success


   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);





   // On error


   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);


   ```





5. OFFLINE SUPPORT:


   - Cache recent messages


   - Show offline indicator


   - Queue messages for sending


   - Auto-retry on reconnect





DO NOT:


- Use emojis


- Create placeholder components


- Leave TODO comments


- Skip haptic feedback


- Use different API structure than web





VERIFY:


- Streaming chat works


- Messages appear in real-time


- Agent controls function correctly


- Haptic feedback triggers


- Offline mode works


</task>


```





---





## PHASE 6: MOBILE APP BUILDING CAPABILITIES





### Prompt 6.1: Mobile App Building Infrastructure





```


<task>


ULTRATHINK MODE: Implement mobile app building capabilities in KripTik AI, allowing users to build iOS and Android apps from browser or mobile app.





REQUIREMENTS:


1. READ existing build infrastructure:


   - server/src/services/automation/build-loop.ts


   - server/src/services/ai/intent-lock.ts


   - server/src/services/preview/headless-preview-service.ts





2. IMPLEMENT Mobile Build Support:





   A. Intent Lock Extensions (server/src/services/ai/intent-lock.ts):


   ```typescript


   interface MobileAppIntent extends IntentContract {


     platform: 'ios' | 'android' | 'both';


     targetDevices: DeviceTarget[];


     appStoreDetails?: {


       name: string;


       description: string;


       category: string;


       keywords: string[];


     };


   }





   interface DeviceTarget {


     type: 'iphone' | 'ipad' | 'android-phone' | 'android-tablet';


     minVersion: string;


     screenSizes: string[];


   }


   ```





   B. Mobile Framework Selection:


   - React Native + Expo (primary - cross-platform)


   - Flutter (alternative - high performance)


   - Swift/SwiftUI (iOS native option)


   - Kotlin (Android native option)





   C. Build Configuration:


   ```typescript


   interface MobileBuildConfig {


     framework: 'expo' | 'react-native' | 'flutter' | 'native';


     platforms: ('ios' | 'android')[];


     targetDevices: DeviceTarget[];


     features: {


       pushNotifications: boolean;


       deepLinking: boolean;


       biometricAuth: boolean;


       offlineSupport: boolean;


       inAppPurchases: boolean;


     };


     credentials: {


       ios?: {


         teamId: string;


         bundleId: string;


         provisioningProfile?: string;


       };


       android?: {


         packageName: string;


         keystoreAlias?: string;


       };


     };


   }


   ```





3. IMPLEMENT Build Pipeline:





   A. Mobile Build Service (server/src/services/mobile/mobile-build-service.ts):


   ```typescript


   export class MobileBuildService {


     async buildApp(config: MobileBuildConfig): Promise<BuildResult> {


       // 1. Generate project with Expo


       await this.generateExpoProject(config);





       // 2. Build for platforms


       const builds = await Promise.all([


         config.platforms.includes('ios') && this.buildIOS(config),


         config.platforms.includes('android') && this.buildAndroid(config),


       ]);





       // 3. Return download URLs


       return {


         ios: builds[0]?.url,


         android: builds[1]?.url,


         expoLink: builds[0]?.expoLink, // For testing


       };


     }





     private async buildIOS(config: MobileBuildConfig): Promise<IOSBuildResult> {


       // Use EAS Build (Expo Application Services)


       const result = await this.easBuild({


         platform: 'ios',


         profile: 'production',


         credentials: config.credentials.ios,


       });





       return {


         url: result.artifacts.url,


         expoLink: result.expoLink,


       };


     }





     private async buildAndroid(config: MobileBuildConfig): Promise<AndroidBuildResult> {


       // Use EAS Build


       const result = await this.easBuild({


         platform: 'android',


         profile: 'production',


         buildType: 'apk', // or 'aab' for Play Store


         credentials: config.credentials.android,


       });





       return {


         url: result.artifacts.url,


         expoLink: result.expoLink,


       };


     }


   }


   ```





   B. Device Preview Service:


   - Run in Expo Go for quick testing


   - Generate QR code for device preview


   - Support for specific device frames





4. IMPLEMENT Device Selection UI:





   A. DeviceSelector Component (src/components/builder/DeviceSelector.tsx):


   ```tsx


   const deviceOptions = {


     iphone: [


       { id: 'iphone-16-pro', name: 'iPhone 16 Pro', screen: '6.3"', resolution: '2622x1206' },


       { id: 'iphone-16-pro-max', name: 'iPhone 16 Pro Max', screen: '6.9"', resolution: '2868x1320' },


       { id: 'iphone-16', name: 'iPhone 16', screen: '6.1"', resolution: '2556x1179' },


       { id: 'iphone-15', name: 'iPhone 15 & newer', screen: '6.1"+', resolution: 'Various' },


     ],


     ipad: [


       { id: 'ipad-pro-13', name: 'iPad Pro 13"', screen: '13"', resolution: '2752x2064' },


       { id: 'ipad-pro-11', name: 'iPad Pro 11"', screen: '11"', resolution: '2420x1668' },


       { id: 'ipad-air', name: 'iPad Air', screen: '10.9"', resolution: '2360x1640' },


     ],


     android: [


       { id: 'android-flagship', name: 'Android Flagship (2024+)', screen: '6.5"+', resolution: 'Various' },


       { id: 'android-mid', name: 'Android Mid-range', screen: '6.0"+', resolution: 'Various' },


       { id: 'android-tablet', name: 'Android Tablet', screen: '10"+', resolution: 'Various' },


     ],


   };


   ```





5. ADD API Routes:


   - POST /api/mobile/build - Start mobile build


   - GET /api/mobile/build/:id/status - Build status


   - GET /api/mobile/build/:id/download - Download artifacts


   - POST /api/mobile/preview - Generate preview QR code





6. DATABASE SCHEMA:


   ```typescript


   export const mobileBuilds = sqliteTable('mobile_builds', {


     id: text('id').primaryKey(),


     projectId: text('project_id').references(() => projects.id),


     platform: text('platform').notNull(), // 'ios' | 'android' | 'both'


     status: text('status').notNull(), // 'queued' | 'building' | 'complete' | 'failed'


     config: text('config').notNull(), // JSON MobileBuildConfig


     artifacts: text('artifacts'), // JSON { ios?: url, android?: url }


     expoLink: text('expo_link'),


     createdAt: text('created_at').default(sql`(datetime('now'))`),


     completedAt: text('completed_at'),


   });


   ```





DO NOT:


- Use emojis


- Create placeholder build logic


- Leave TODO comments


- Skip credential handling


- Use deprecated APIs





VERIFY:


- npm run build passes


- Build config validates correctly


- Device selection works


- API routes respond correctly


</task>


```





### Prompt 6.2: App Download and Device Installation





```


<task>


EXTENDED THINKING MODE: Implement app download and direct device installation flow for mobile apps built with KripTik AI.





REQUIREMENTS:


1. READ mobile build infrastructure:


   - server/src/services/mobile/mobile-build-service.ts (from 6.1)


   - server/src/routes/mobile.ts





2. IMPLEMENT Download Flow:





   A. iOS Installation Options:


   - TestFlight: For testing (requires Apple Developer account)


   - Ad Hoc: Direct install with provisioning profile


   - Expo Go: Quick preview without build





   B. Android Installation Options:


   - APK Download: Direct install


   - Play Store Internal Testing: For beta testing


   - Expo Go: Quick preview without build





   C. Download UI (src/components/builder/AppDownloadModal.tsx):


   ```tsx


   export function AppDownloadModal({ buildId }: { buildId: string }) {


     const { data: build } = useBuild(buildId);





     return (


       <div className="glass-panel p-6 max-w-md">


         <h2 className="text-xl font-bold mb-4">Download Your App</h2>





         {build.status === 'building' && (


           <div className="text-center py-8">


             <Spinner className="w-12 h-12 text-amber-500 mx-auto mb-4" />


             <p className="text-slate-300">Building your app...</p>


             <p className="text-sm text-slate-500">{build.progress}%</p>


           </div>


         )}





         {build.status === 'complete' && (


           <div className="space-y-4">


             {build.artifacts.ios && (


               <div className="bg-slate-800 rounded-xl p-4">


                 <div className="flex items-center gap-3 mb-3">


                   <AppleIcon className="w-8 h-8" />


                   <div>


                     <h3 className="font-semibold">iOS</h3>


                     <p className="text-sm text-slate-400">iPhone & iPad</p>


                   </div>


                 </div>





                 <div className="space-y-2">


                   <button


                     onClick={() => downloadFile(build.artifacts.ios)}


                     className="btn-amber w-full"


                   >


                     Download IPA


                   </button>





                   {build.testFlightLink && (


                     <a


                       href={build.testFlightLink}


                       className="btn-outline w-full block text-center"


                     >


                       Open in TestFlight


                     </a>


                   )}





                   <button


                     onClick={() => showQRCode(build.expoLink)}


                     className="btn-ghost w-full"


                   >


                     Preview in Expo Go


                   </button>


                 </div>


               </div>


             )}





             {build.artifacts.android && (


               <div className="bg-slate-800 rounded-xl p-4">


                 <div className="flex items-center gap-3 mb-3">


                   <AndroidIcon className="w-8 h-8" />


                   <div>


                     <h3 className="font-semibold">Android</h3>


                     <p className="text-sm text-slate-400">Phone & Tablet</p>


                   </div>


                 </div>





                 <div className="space-y-2">


                   <button


                     onClick={() => downloadFile(build.artifacts.android)}


                     className="btn-green w-full"


                   >


                     Download APK


                   </button>





                   <button


                     onClick={() => showQRCode(build.expoLink)}


                     className="btn-ghost w-full"


                   >


                     Preview in Expo Go


                   </button>


                 </div>


               </div>


             )}


           </div>


         )}





         {/* QR Code for Expo Go */}


         <QRCodeModal


           isOpen={showingQR}


           url={build.expoLink}


           onClose={() => setShowingQR(false)}


         />


       </div>


     );


   }


   ```





3. IMPLEMENT Expo Go Preview:





   A. QR Code Generation:


   ```typescript


   // Server-side


   async generateExpoPreviewUrl(projectId: string): Promise<string> {


     // Start Expo development server


     const server = await this.startExpoServer(projectId);





     // Generate shareable URL


     const url = `exp://${server.host}:${server.port}`;





     return url;


   }


   ```





   B. QR Code Display:


   - Large, scannable QR code


   - Instructions for Expo Go


   - Deep link for mobile users


   - Copy URL button





4. IMPLEMENT Direct Install Flow:





   A. iOS Ad Hoc Install:


   - Generate .plist manifest file


   - Serve over HTTPS (required)


   - Use itms-services:// protocol





   ```typescript


   async generateIOSInstallManifest(buildId: string): Promise<string> {


     const build = await this.getBuild(buildId);





     const manifest = {


       items: [{


         assets: [{


           kind: 'software-package',


           url: build.artifacts.ios,


         }],


         metadata: {


           'bundle-identifier': build.config.credentials.ios.bundleId,


           'bundle-version': build.version,


           kind: 'software',


           title: build.appName,


         },


       }],


     };





     // Store manifest and return URL


     const manifestUrl = await this.storeManifest(buildId, manifest);


     return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;


   }


   ```





   B. Android Direct Install:


   - Serve APK directly


   - Handle unknown sources permission


   - Provide clear instructions





5. ADD Routes:


   - GET /api/mobile/build/:id/ios/manifest - iOS plist manifest


   - GET /api/mobile/build/:id/download/ios - IPA download


   - GET /api/mobile/build/:id/download/android - APK download


   - GET /api/mobile/build/:id/expo-qr - QR code image


   - GET /api/mobile/build/:id/expo-url - Expo preview URL





6. MOBILE APP Integration:


   - Show download options in mobile app


   - "Install" button detects platform


   - Open TestFlight/download APK appropriately


   - Share build link with others





DO NOT:


- Use emojis


- Create placeholder download URLs


- Leave TODO comments


- Skip iOS manifest generation


- Ignore security for downloads





VERIFY:


- npm run build passes


- Download modal shows correctly


- QR codes generate properly


- iOS manifest validates


- APK download works


</task>


```





---





## CREDENTIAL REQUIREMENTS





### Apple Developer Account Setup





```


CREDENTIAL INSTRUCTIONS FOR APPLE DEVELOPER:





1. Apple Developer Account ($99/year):


   - Sign up at https://developer.apple.com/programs/


   - Wait for approval (usually 24-48 hours)


   - Note your Team ID from Membership page





2. Create App ID:


   - Go to Certificates, Identifiers & Profiles


   - Click Identifiers → + button


   - Select App IDs → Continue


   - Enter Description and Bundle ID (e.g., com.yourname.appname)


   - Select capabilities needed (Push Notifications, Sign in with Apple, etc.)


   - Click Register





3. Create Distribution Certificate:


   - Go to Certificates → + button


   - Select "Apple Distribution" → Continue


   - Upload CSR (created with Keychain Access)


   - Download certificate, add to Keychain





4. Create Provisioning Profile:


   - Go to Profiles → + button


   - Select "App Store" for production or "Ad Hoc" for testing


   - Select your App ID → Continue


   - Select your certificate → Continue


   - Name your profile and download





5. For EAS Build (recommended):


   - Run: eas credentials -p ios


   - Follow prompts to set up


   - EAS can manage certificates for you





ENVIRONMENT VARIABLES NEEDED:


- APPLE_TEAM_ID: Your Team ID


- APPLE_BUNDLE_ID: Your app's bundle identifier


- EXPO_APPLE_APP_SPECIFIC_PASSWORD: For automated submissions


```





### Android Developer Account Setup





```


CREDENTIAL INSTRUCTIONS FOR ANDROID:





1. Google Play Developer Account ($25 one-time):


   - Sign up at https://play.google.com/console/signup


   - Complete registration with valid payment


   - Wait for verification (usually instant)





2. Create App in Play Console:


   - Go to All Apps → Create app


   - Enter app details


   - Complete app setup checklist





3. Generate Upload Key:


   - For new apps, use Play App Signing (recommended)


   - Run: keytool -genkey -v -keystore my-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias


   - Keep keystore file secure (never commit to git!)


   - Upload to Play Console → Setup → App signing





4. For EAS Build:


   - Run: eas credentials -p android


   - Follow prompts to set up


   - EAS can generate and manage keys





ENVIRONMENT VARIABLES NEEDED:


- ANDROID_PACKAGE_NAME: Your app's package name (e.g., com.yourname.appname)


- ANDROID_KEYSTORE_PATH: Path to .jks file


- ANDROID_KEY_ALIAS: Alias used when generating key


- ANDROID_KEYSTORE_PASSWORD: Keystore password


- ANDROID_KEY_PASSWORD: Key password


```





### KripTik Required Environment Variables





```


# Add these to .env file for mobile builds:





# Apple Developer


APPLE_TEAM_ID=ABC123DEFG


APPLE_BUNDLE_ID_PREFIX=com.yourcompany





# Android Developer


ANDROID_PACKAGE_PREFIX=com.yourcompany





# EAS Build (Expo)


EXPO_TOKEN=your-expo-access-token





# Optional: For automated TestFlight uploads


APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx


APPLE_ID=your@email.com


```





---





## IMPLEMENTATION ORDER





Execute prompts in this order for optimal results:





1. **Phase 1.1**: Streaming Chat Interface Redesign


2. **Phase 1.2**: Live Preview Panel with Agent Browser


3. **Phase 2.1**: Phase Verification Display in Chat


4. **Phase 2.2**: Mini Browser Window in Chat Messages


5. **Phase 3.1**: Fix "Take Control" and Sandbox Routes (CRITICAL)


6. **Phase 3.2**: Fix Merge File Writing and Plan Persistence (CRITICAL)


7. **Phase 3.3**: Server-Side Agent Limit and Context Sharing


8. **Phase 4.1**: Fix Tile Resize and Cursor Issues


9. **Phase 4.2**: Fix Streaming and Stop/Merge Functionality


10. **Phase 5.1**: Mobile App Foundation


11. **Phase 5.2**: Mobile Streaming Chat and Agent Control


12. **Phase 6.1**: Mobile App Building Infrastructure


13. **Phase 6.2**: App Download and Device Installation





---





## VERIFICATION CHECKLIST





After each prompt implementation:





1. `npm run build` passes with zero errors


2. No TypeScript errors in IDE


3. No console errors in browser


4. Feature works as described


5. No emojis in UI


6. No Lucide icons used


7. No placeholder content


8. No TODO comments


9. No mock data in production code


10. Styling matches KripTik design system





---





*This implementation plan is for Opus 4.5 in Cursor 2.2*


*DO NOT modify any files - copy prompts individually to Cursor*


*Created: January 13, 2026*

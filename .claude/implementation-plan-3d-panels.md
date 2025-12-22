# 3D Panel Enhancement Implementation Plan

> **Goal**: Upgrade existing developer toolbar panels from generic placeholders to premium 3D visualizations with real-time data, WITHOUT creating redundant features.

**Created**: December 22, 2025
**Design Reference**: Liquid glass styling, 3D bar charts, splatting animations, vibrant colors

---

## AUDIT: What Already Exists (DO NOT RECREATE)

### Fully Working Systems (UI + Backend + Integration)
- **Feature Agent Command Center** → In toolbar, full implementation
- **Ghost Mode** → In Feature Agent Command Center + standalone panels
- **Soft Interrupt** → FloatingSoftInterrupt.tsx in Builder view (floating)
- **Notifications** → NotificationsSection.tsx on Dashboard
- **Verification Swarm** → VerificationSwarm3D.tsx, FloatingVerificationSwarm.tsx
- **Speed Dial** → SpeedDialSelector.tsx in Builder
- **Tournament Mode** → TournamentPanel.tsx (NOT in toolbar - needs button wiring)
- **Time Machine** → TimeMachinePanel.tsx (in toolbar, basic)
- **Credential Vault** → CredentialVault.tsx page, CredentialsCollectionView.tsx
- **Clone Mode** → CloneModePanel.tsx (in toolbar)
- **Market Fit** → MarketFitDashboard.tsx (in toolbar)
- **Voice Architect** → VoiceArchitectPanel.tsx (in toolbar)
- **API Autopilot** → APIAutopilotPanel.tsx (in toolbar)

### Buttons with GenericPanel (Need Premium Upgrade)
These buttons EXIST in DeveloperBar.tsx but show placeholder content:
- `memory`, `quality-check`, `integrations`, `production-stack`
- `predictive-engine`, `ai-slop-catch`, `user-twin`
- `workflows`, `database`, `developer-settings`
- `dna`, `live-debug`, `live-health`, `test-gen`
- `self-heal`, `rules`, `agent-builder`, `living-docs`
- `deployment`, `cloud-deploy`, `migration-wizard`
- `repo-aware`, `zero-trust-sec`, `multiplayer`, `publish`, `share`

---

## Phase 1: 3D Visualization Library

### P1.1: Create Shared 3D Components

**New file**: `src/components/visualizations/3d/index.ts`

Export reusable 3D visualization components:

```tsx
// Core 3D building blocks
export { Bar3DChart } from './Bar3DChart';           // 3D bar chart with perspective
export { SplattingViz } from './SplattingViz';       // Particle splatting animation
export { NeuralNetworkViz } from './NeuralNetworkViz'; // Node/connection visualization
export { TimelineViz3D } from './TimelineViz3D';     // 3D timeline scrubber
export { RadarChart3D } from './RadarChart3D';       // 3D radar/spider chart
export { HeatMap3D } from './HeatMap3D';             // 3D heatmap
export { FlowGraph3D } from './FlowGraph3D';         // 3D flow/pipeline visualization
export { GaugeCluster3D } from './GaugeCluster3D';   // 3D gauge cluster
export { LiveStream3D } from './LiveStream3D';       // Real-time data stream viz
```

### P1.2: Bar3DChart Component

**File**: `src/components/visualizations/3d/Bar3DChart.tsx`

```tsx
/**
 * 3D Bar Chart with Perspective
 *
 * Inspired by the reference images:
 * - Gradient coloring (teal to orange to red)
 * - Perspective depth
 * - Grid base
 * - Smooth animations
 */

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface Bar3DChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  animated?: boolean;
  colorScale?: 'gradient' | 'discrete' | 'heat';
}

// Color interpolation for gradient scale
const getGradientColor = (value: number, min: number, max: number): string => {
  const normalized = (value - min) / (max - min);

  // Teal → Yellow → Orange → Red gradient
  if (normalized < 0.33) {
    return `rgb(${Math.round(20 + normalized * 3 * 200)}, ${Math.round(180 + normalized * 3 * 75)}, ${Math.round(180 - normalized * 3 * 100)})`;
  } else if (normalized < 0.66) {
    const t = (normalized - 0.33) / 0.33;
    return `rgb(${Math.round(220 + t * 35)}, ${Math.round(255 - t * 100)}, ${Math.round(80 - t * 40)})`;
  } else {
    const t = (normalized - 0.66) / 0.34;
    return `rgb(${Math.round(255 - t * 55)}, ${Math.round(155 - t * 100)}, ${Math.round(40 + t * 20)})`;
  }
};

function AnimatedBar({
  position,
  targetHeight,
  color,
  index
}: {
  position: [number, number, number];
  targetHeight: number;
  color: string;
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentHeight = useRef(0);

  useFrame((_, delta) => {
    if (meshRef.current) {
      // Smooth animation to target height
      currentHeight.current += (targetHeight - currentHeight.current) * delta * 3;
      meshRef.current.scale.y = Math.max(0.01, currentHeight.current);
      meshRef.current.position.y = currentHeight.current / 2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], 0, position[2]]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.6, 1, 0.6]} />
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.4}
        emissive={color}
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

function BarChart3DScene({ data, colorScale = 'gradient' }: { data: DataPoint[]; colorScale?: string }) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);
  const minValue = useMemo(() => Math.min(...data.map(d => d.value)), [data]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={45} />
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={20}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#F5A86C" />

      {/* Grid floor */}
      <Grid
        args={[20, 20]}
        position={[0, -0.01, 0]}
        cellColor="#1a3a4a"
        sectionColor="#2a5a6a"
        fadeDistance={25}
        fadeStrength={1}
      />

      {/* Bars */}
      {data.map((point, index) => {
        const x = (index - data.length / 2) * 1.2;
        const height = (point.value / maxValue) * 5;
        const color = point.color || getGradientColor(point.value, minValue, maxValue);

        return (
          <AnimatedBar
            key={point.label}
            position={[x, 0, 0]}
            targetHeight={height}
            color={color}
            index={index}
          />
        );
      })}
    </>
  );
}

export function Bar3DChart({
  data,
  title,
  height = 300,
  animated = true,
  colorScale = 'gradient'
}: Bar3DChartProps) {
  return (
    <div className="bar-3d-chart" style={{ height, position: 'relative' }}>
      {title && (
        <div className="bar-3d-chart__title" style={{
          position: 'absolute',
          top: 12,
          left: 16,
          zIndex: 10,
          color: 'rgba(255,255,255,0.9)',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </div>
      )}
      <Canvas shadows>
        <BarChart3DScene data={data} colorScale={colorScale} />
      </Canvas>
    </div>
  );
}
```

### P1.3: SplattingViz Component

**File**: `src/components/visualizations/3d/SplattingViz.tsx`

```tsx
/**
 * Splatting Visualization
 *
 * Particle-based data visualization with clustering
 * Inspired by the reference image with colored dot clusters
 */

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface DataCluster {
  id: string;
  label: string;
  value: number;
  color: string;
  position?: [number, number, number];
}

interface SplattingVizProps {
  clusters: DataCluster[];
  title?: string;
  height?: number;
  interactive?: boolean;
  onClusterHover?: (cluster: DataCluster | null) => void;
}

function ParticleCluster({
  cluster,
  basePosition,
  scale = 1
}: {
  cluster: DataCluster;
  basePosition: [number, number, number];
  scale?: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = Math.max(20, Math.min(200, cluster.value));

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const color = new THREE.Color(cluster.color);

    for (let i = 0; i < particleCount; i++) {
      // Gaussian distribution for natural clustering
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = Math.random() * scale * 2;

      pos[i * 3] = basePosition[0] + radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = basePosition[1] + radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = basePosition[2] + radius * Math.cos(phi);

      // Slight color variation
      const variation = 0.9 + Math.random() * 0.2;
      col[i * 3] = color.r * variation;
      col[i * 3 + 1] = color.g * variation;
      col[i * 3 + 2] = color.b * variation;
    }

    return [pos, col];
  }, [cluster, basePosition, particleCount, scale]);

  useFrame((state) => {
    if (particlesRef.current) {
      // Gentle floating animation
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      particlesRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SplattingScene({ clusters }: { clusters: DataCluster[] }) {
  // Calculate positions in a circular layout
  const positionedClusters = useMemo(() => {
    return clusters.map((cluster, index) => {
      const angle = (index / clusters.length) * Math.PI * 2;
      const radius = 4;
      const position: [number, number, number] = cluster.position || [
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 2,
        Math.sin(angle) * radius
      ];
      return { ...cluster, position };
    });
  }, [clusters]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 8, 12]} fov={50} />
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={25}
        autoRotate
        autoRotateSpeed={0.5}
      />

      <ambientLight intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={1} />

      {positionedClusters.map((cluster) => (
        <ParticleCluster
          key={cluster.id}
          cluster={cluster}
          basePosition={cluster.position!}
          scale={Math.sqrt(cluster.value / 100)}
        />
      ))}
    </>
  );
}

export function SplattingViz({
  clusters,
  title,
  height = 400,
}: SplattingVizProps) {
  return (
    <div className="splatting-viz" style={{ height, position: 'relative' }}>
      {title && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 16,
          zIndex: 10,
          color: 'rgba(255,255,255,0.9)',
          fontSize: 14,
          fontWeight: 700,
        }}>
          {title}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 16,
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {clusters.map(cluster => (
          <div key={cluster.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cluster.color,
              boxShadow: `0 0 8px ${cluster.color}`,
            }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
              {cluster.label}
            </span>
          </div>
        ))}
      </div>

      <Canvas>
        <SplattingScene clusters={clusters} />
      </Canvas>
    </div>
  );
}
```

### P1.4: Shared Styles

**File**: `src/components/visualizations/3d/viz-3d.css`

```css
/* 3D Visualization Container Styles */
.viz-3d-container {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(10, 20, 30, 0.95), rgba(5, 10, 15, 0.98));
  border: 1px solid rgba(245, 168, 108, 0.15);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.viz-3d-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(245, 168, 108, 0.08) 0%,
    transparent 50%
  );
  pointer-events: none;
}

.viz-3d-title {
  position: absolute;
  top: 16px;
  left: 20px;
  z-index: 10;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.viz-3d-subtitle {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.viz-3d-stats {
  position: absolute;
  top: 16px;
  right: 20px;
  z-index: 10;
  display: flex;
  gap: 12px;
}

.viz-3d-stat {
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  backdrop-filter: blur(12px);
}

.viz-3d-stat-value {
  font-size: 18px;
  font-weight: 800;
  color: #F5A86C;
  letter-spacing: -0.03em;
}

.viz-3d-stat-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

/* Interactive hover states */
.viz-3d-container canvas {
  cursor: grab;
}

.viz-3d-container canvas:active {
  cursor: grabbing;
}

/* Config panel overlay */
.viz-3d-config {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.viz-3d-config-btn {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.viz-3d-config-btn:hover {
  background: rgba(245, 168, 108, 0.15);
  border-color: rgba(245, 168, 108, 0.3);
  color: #F5A86C;
}

.viz-3d-config-btn--active {
  background: rgba(245, 168, 108, 0.2);
  border-color: rgba(245, 168, 108, 0.4);
  color: #F5A86C;
}
```

---

## Phase 2: Premium Panel Implementations

### P2.1: Quality Check Panel (Enhanced)

**File**: `src/components/developer-bar/panels/QualityCheckPanel3D.tsx`

Upgrade the existing basic panel to show:
- 3D bar chart of quality scores (code, visual, security, performance)
- Real-time verification swarm status
- Anti-slop detection results
- Gap closer status

**Backend connection**: `/api/verification/swarm/:buildId`, `/api/quality`

```tsx
// Structure (not full code for brevity)
export function QualityCheckPanel3D({ projectId, isActive }: Props) {
  // Fetch real-time data from verification endpoints
  const { data: swarmStatus } = useVerificationSwarm(projectId);
  const { data: qualityScores } = useQualityScores(projectId);

  return (
    <div className="quality-panel-3d">
      <Bar3DChart
        data={[
          { label: 'Code', value: qualityScores?.code || 0, color: '#20c997' },
          { label: 'Visual', value: qualityScores?.visual || 0, color: '#3b82f6' },
          { label: 'Security', value: qualityScores?.security || 0, color: '#f59e0b' },
          { label: 'Performance', value: qualityScores?.performance || 0, color: '#ef4444' },
        ]}
        title="Quality Metrics"
        height={200}
      />

      <SwarmStatusGrid agents={swarmStatus?.agents} />
      <GapCloserStatus status={swarmStatus?.gapClosers} />

      <ConfigSection>
        <VerificationModeSelector />
        <AntiSlopSettings />
      </ConfigSection>
    </div>
  );
}
```

### P2.2: Memory/Learning Panel (Enhanced)

**File**: `src/components/developer-bar/panels/MemoryPanel3D.tsx`

Show:
- 3D neural network visualization of learned patterns
- Splatting viz of experience categories
- Pattern library stats
- Learning cycle status

**Backend connection**: `/api/learning/evolution-status`, `/api/learning/patterns`

### P2.3: Live Health Panel (Enhanced)

**File**: `src/components/developer-bar/panels/LiveHealthPanel3D.tsx`

Show:
- 3D gauge cluster for CPU, Memory, API latency
- Real-time streaming line chart
- Error rate visualization
- System status indicators

**Backend connection**: `/api/monitoring/health`, SSE stream

### P2.4: Predictive Engine Panel

**File**: `src/components/developer-bar/panels/PredictivePanel3D.tsx`

Show:
- 3D prediction confidence bars
- Error prevention stats
- Pattern match visualization
- Pre-generation status

**Backend connection**: `/api/ai/predictive`, existing predictive-error-prevention.ts

### P2.5: AI-Slop Catch Panel

**File**: `src/components/developer-bar/panels/AntiSlopPanel3D.tsx`

Show:
- 3D radar chart of 7 anti-slop principles
- Violation history
- Configuration toggles
- Current scan results

**Backend connection**: existing verification/anti-slop-detector.ts

### P2.6: Self-Heal Panel

**File**: `src/components/developer-bar/panels/SelfHealPanel3D.tsx`

Show:
- 3D escalation ladder (4 levels)
- Current error status
- Fix attempt history
- Success rate visualization

**Backend connection**: `/api/automation/escalation`, existing error-escalation.ts

### P2.7: Debug Panel

**File**: `src/components/developer-bar/panels/DebugPanel3D.tsx`

Show:
- 3D call stack visualization
- Variable state tree
- Runtime context
- Breakpoint visualization

**Backend connection**: existing debug/runtime-debug-context.ts

---

## Phase 3: Panel-to-Backend Wiring

### P3.1: Update DeveloperBarPanel.tsx

Replace GenericPanel references with new premium panels:

```tsx
// In FEATURE_PANELS record, update:
const FEATURE_PANELS: Record<string, PanelConfig> = {
  // Keep existing working panels
  'feature-agent': { ... },

  // Upgrade to 3D panels
  'quality-check': {
    title: 'Quality & Verification',
    icon: 'qualityCheck',
    component: QualityCheckPanel3D,
    fullWidth: true
  },
  'memory': {
    title: 'Learning Engine',
    icon: 'memory',
    component: MemoryPanel3D
  },
  'live-health': {
    title: 'System Health',
    icon: 'liveHealth',
    component: LiveHealthPanel3D
  },
  'predictive-engine': {
    title: 'Predictive Engine',
    icon: 'predictiveEngine',
    component: PredictivePanel3D
  },
  'ai-slop-catch': {
    title: 'Anti-Slop Detection',
    icon: 'aiSlopCatch',
    component: AntiSlopPanel3D
  },
  'self-heal': {
    title: 'Self-Healing',
    icon: 'selfHeal',
    component: SelfHealPanel3D
  },
  'live-debug': {
    title: 'Debug Context',
    icon: 'liveDebug',
    component: DebugPanel3D
  },
  // ... continue for all panels
};
```

### P3.2: Add SSE Hooks for Real-Time Data

**File**: `src/hooks/useRealtimeData.ts`

```tsx
export function useVerificationStream(buildId: string) {
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/verification/stream/${buildId}`);

    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    return () => eventSource.close();
  }, [buildId]);

  return data;
}

export function useHealthStream() {
  // Similar SSE connection to health monitoring
}

export function useLearningStream() {
  // Similar SSE connection to learning engine
}
```

---

## Phase 4: Configuration Integration

### P4.1: Per-Panel Config Options

Each panel should have a collapsible config section at the bottom:

```tsx
function PanelConfigSection({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="panel-config">
      <button
        className="panel-config__toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <IconSettings size={14} />
        <span>Configure</span>
        <IconChevron direction={isOpen ? 'up' : 'down'} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="panel-config__content"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### P4.2: Config Options per Panel

| Panel | Config Options |
|-------|---------------|
| Quality Check | Verification mode (Quick/Standard/Thorough), agent toggles, thresholds |
| Memory/Learning | Share experiences toggle, evolution frequency, pattern retention |
| Live Health | Refresh rate, alert thresholds, metric selection |
| Predictive | Enable/disable, confidence threshold, pattern sources |
| Anti-Slop | Score threshold, blocker selection, custom rules |
| Self-Heal | Max retries per level, auto-escalate toggle, model preferences |
| Debug | Variable depth, stack trace length, auto-capture |

---

## Phase 5: Missing Panel Implementations

### P5.1: Panels That Need Full Implementation

These toolbar buttons have backends but no premium panel:

| Button | Backend | Panel Needed |
|--------|---------|--------------|
| `integrations` | credentials.ts | CredentialVaultPanel3D |
| `database` | schema.ts | DatabaseSchemaPanel3D |
| `deployment` | deploy.ts, smart-deploy.ts | DeploymentPanel3D |
| `cloud-deploy` | cloud.ts | CloudDeployPanel3D |
| `zero-trust-sec` | security.ts | SecurityPanel3D |
| `test-gen` | testing/ | TestGenPanel3D |
| `developer-settings` | developer-settings.ts | SettingsPanel3D |

### P5.2: Panels with No Backend (Lower Priority)

These can show informational content or "Coming Soon":

| Button | Status |
|--------|--------|
| `dna` | No backend - show app DNA visualization |
| `rules` | No backend - show custom rules editor |
| `agent-builder` | No backend - show agent creation wizard |
| `living-docs` | No backend - show documentation generator |
| `multiplayer` | No backend - show collaboration features |
| `publish` | No backend - show publishing options |
| `share` | No backend - show sharing options |

---

## Implementation Order

### Week 1: Foundation
1. **P1.1-P1.4**: Create 3D visualization library
2. **P2.1**: Quality Check Panel 3D (most visible impact)

### Week 2: Core Panels
3. **P2.2**: Memory/Learning Panel 3D
4. **P2.3**: Live Health Panel 3D
5. **P2.4**: Predictive Engine Panel 3D

### Week 3: More Panels
6. **P2.5**: Anti-Slop Panel 3D
7. **P2.6**: Self-Heal Panel 3D
8. **P2.7**: Debug Panel 3D

### Week 4: Wiring & Config
9. **P3.1-P3.2**: Panel-to-backend wiring, SSE hooks
10. **P4.1-P4.2**: Configuration sections

### Week 5: Remaining Panels
11. **P5.1**: Missing panel implementations
12. Testing & polish

---

## Success Criteria

- [ ] All toolbar buttons open premium 3D panels (no more GenericPanel)
- [ ] Real-time data streams to all monitoring panels
- [ ] Config options accessible in each panel
- [ ] Smooth 60fps animations on 3D visualizations
- [ ] Consistent liquid glass styling throughout
- [ ] All panels connected to existing backend services
- [ ] No redundant features created

---

## DO NOT CREATE (Already Exist)

- Soft Interrupt (FloatingSoftInterrupt.tsx)
- Notifications (NotificationsSection.tsx)
- Ghost Mode (GhostModePanel.tsx, GhostModeConfig.tsx)
- Feature Agent (FeatureAgentCommandCenter.tsx)
- Speed Dial (SpeedDialSelector.tsx)
- Tournament Mode (TournamentPanel.tsx)
- Verification Swarm 3D (VerificationSwarm3D.tsx)
- Time Machine (TimeMachinePanel.tsx)
- Clone Mode (CloneModePanel.tsx)
- Market Fit (MarketFitDashboard.tsx)
- Voice Architect (VoiceArchitectPanel.tsx)
- API Autopilot (APIAutopilotPanel.tsx)

---

*This plan upgrades existing infrastructure without creating redundancies.*

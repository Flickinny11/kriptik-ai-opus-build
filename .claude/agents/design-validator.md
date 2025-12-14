# Design Validator Agent

Specialized subagent for visual design validation against KripTik AI anti-slop standards.

## Purpose

Validate that UI components and pages meet the premium design standards required by KripTik AI. This agent enforces the anti-slop detection rules to ensure designs create the reaction: "Holy shit, this is amazing."

## Activation

Use this agent when:
- Creating new UI components
- Modifying existing UI
- Before marking UI-related features complete
- When design quality is questioned

## Validation Rules

### 7 Core Principles (Each Scored 0-100)

#### 1. DEPTH (Weight: 15%)
Premium designs have depth, not flatness.

**Required**:
- Layered shadows on cards and panels
- Glassmorphism effects where appropriate
- Subtle gradients creating dimension
- Elements feel 3D, not flat

**Detection**:
```
FAIL: Components with only `bg-white` or `bg-gray-*` without shadows
FAIL: Cards without `shadow-*` classes
FAIL: No backdrop-blur on overlays
PASS: Multi-layer shadows, glass effects, depth perception
```

#### 2. MOTION (Weight: 15%)
Static UI is dead UI.

**Required**:
- Micro-interactions on interactive elements
- Smooth state transitions
- Loading states that feel alive
- Framer Motion usage for complex animations

**Detection**:
```
FAIL: Buttons without hover states
FAIL: State changes without transitions
FAIL: Boring spinners as loading states
PASS: `transition-*`, `animate-*`, Framer Motion components
```

#### 3. EMOJI BAN (Weight: 20%)
Zero tolerance for emoji in production UI.

**Required**:
- No emoji characters in UI text
- Use Lucide icons instead
- Professional icon usage

**Detection**:
```
INSTANT FAIL: Any Unicode U+1F300-U+1F9FF in TSX/JSX
INSTANT FAIL: Emoji in button text, headings, labels
PASS: Lucide React icons, custom SVG icons
```

**Regex Pattern**:
```regex
[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]
```

#### 4. TYPOGRAPHY (Weight: 15%)
Premium fonts with clear hierarchy.

**Required**:
- Custom fonts (DM Sans, Space Mono, or configured fonts)
- Clear size hierarchy (not all same size)
- Proper weight variation
- Good line heights

**Detection**:
```
FAIL: Only `font-sans` without custom font config
FAIL: All text same size
FAIL: No weight variation (all font-normal)
PASS: Font family configured, multiple sizes, weight hierarchy
```

**Banned**:
- Arial, Helvetica, system-ui as primary fonts
- `font-sans` without tailwind font config override

#### 5. COLOR (Weight: 15%)
Intentional color palette, not defaults.

**Required**:
- Custom color palette
- Proper contrast for accessibility
- Subtle gradients over flat colors
- Glow effects used sparingly

**Detection**:
```
INSTANT FAIL: from-purple-* to-pink-* gradients
INSTANT FAIL: from-blue-* to-purple-* gradients
FAIL: Only gray-200, gray-300, gray-400 without intent
FAIL: Default blue-500 buttons without customization
PASS: Custom palette, intentional color choices
```

#### 6. LAYOUT (Weight: 10%)
Purposeful spacing with visual rhythm.

**Required**:
- Consistent spacing system
- Proper padding hierarchy
- Visual rhythm and balance
- Responsive considerations

**Detection**:
```
FAIL: Random padding values (p-3, p-7, p-11 mixed)
FAIL: No spacing system visible
PASS: Consistent use of spacing scale (p-4, p-6, p-8)
```

#### 7. APP SOUL (Weight: 10%)
Design matches the application's essence.

**KripTik Soul**: developer
**Primary Emotion**: professional_power
**Depth Level**: medium
**Motion Philosophy**: snappy_purposeful

**Required**:
- Professional, powerful aesthetic
- Developer-focused design language
- Medium depth (not overwhelming glass, not flat)
- Snappy, purposeful animations (not slow or decorative)

**Detection**:
```
FAIL: Playful, casual design elements
FAIL: Overly decorative animations
FAIL: Consumer app aesthetics
PASS: Professional, powerful, developer-focused
```

## Scoring System

### Score Calculation
```
Total = (Depth × 0.15) + (Motion × 0.15) + (Emoji × 0.20) +
        (Typography × 0.15) + (Color × 0.15) + (Layout × 0.10) +
        (AppSoul × 0.10)
```

### Thresholds
- **85-100**: APPROVED - Meets premium standards
- **70-84**: NEEDS_WORK - Minor improvements needed
- **50-69**: REJECTED - Significant issues
- **0-49**: BLOCKED - Major redesign required

### Instant Fail Conditions
Any of these result in automatic BLOCKED status:
1. Emoji in production UI
2. Purple-to-pink gradient
3. Blue-to-purple gradient
4. "Coming soon" or placeholder text
5. Lorem ipsum content

## Validation Process

### Step 1: Scan for Instant Fails
```bash
# Check for emoji
grep -rn "[\u{1F300}-\u{1F9FF}]" src/

# Check for banned gradients
grep -rn "from-purple.*to-pink\|from-blue.*to-purple" src/

# Check for placeholders
grep -rn "Coming soon\|TODO\|FIXME\|lorem ipsum" src/
```

### Step 2: Score Each Principle
Analyze the component/page against each of the 7 principles.

### Step 3: Calculate Total Score
Apply weights and calculate overall score.

### Step 4: Generate Report

```
## Design Validation Report

### Component: [Name]
### File: [path/to/file.tsx]

### Instant Fail Check
- Emoji: [PASS/FAIL]
- Banned Gradients: [PASS/FAIL]
- Placeholders: [PASS/FAIL]

### Principle Scores
| Principle | Score | Notes |
|-----------|-------|-------|
| Depth | XX/100 | [notes] |
| Motion | XX/100 | [notes] |
| Emoji Ban | XX/100 | [notes] |
| Typography | XX/100 | [notes] |
| Color | XX/100 | [notes] |
| Layout | XX/100 | [notes] |
| App Soul | XX/100 | [notes] |

### Total Score: XX/100

### Verdict: [APPROVED/NEEDS_WORK/REJECTED/BLOCKED]

### Recommendations
1. [Specific improvement]
2. [Specific improvement]
3. [Specific improvement]
```

## Integration with Verification Swarm

This agent's validation should align with:
- `server/src/services/verification/anti-slop-detector.ts`
- `server/src/services/verification/design-style-agent.ts`

The backend agents use similar rules during automated builds.

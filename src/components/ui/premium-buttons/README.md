# Premium 3D Buttons

A set of 5 premium, 3D animated buttons for React applications. Features real depth with X/Y/Z transforms, sophisticated hover animations, and a cohesive dark theme with red accents.

## Installation

1. Copy these files to your project:
   - `Premium3DButtons.tsx` (or `.jsx` if not using TypeScript)
   - `Premium3DButtons.css`
   - `index.ts` (optional, for cleaner imports)

2. Add the required fonts to your `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

Or import in your CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Space+Grotesk:wght@500;600;700&display=swap');
```

## Usage

### Named Imports (Recommended)

```tsx
import { 
  GenerateButton, 
  NewProjectButton, 
  FixBrokenAppButton,
  UploadButton,
  ImageToCodeButton 
} from './premium-3d-buttons';

function App() {
  return (
    <div>
      <GenerateButton onClick={() => console.log('Generate!')} />
      <NewProjectButton onClick={() => console.log('New project!')} />
      <FixBrokenAppButton onClick={() => console.log('Fixing...')} />
      <UploadButton onClick={() => console.log('Upload!')} />
      <ImageToCodeButton onClick={() => console.log('Converting...')} />
    </div>
  );
}
```

### Default Import

```tsx
import Premium3DButtons from './premium-3d-buttons/Premium3DButtons';

function App() {
  return (
    <div>
      <Premium3DButtons.Generate onClick={handleGenerate} />
      <Premium3DButtons.NewProject onClick={handleNewProject} />
      <Premium3DButtons.FixBrokenApp onClick={handleFix} />
      <Premium3DButtons.Upload onClick={handleUpload} />
      <Premium3DButtons.ImageToCode onClick={handleConvert} />
    </div>
  );
}
```

## Props

All buttons accept these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClick` | `() => void` | - | Click handler |
| `disabled` | `boolean` | `false` | Disables the button |
| `className` | `string` | `''` | Additional CSS classes |
| `children` | `React.ReactNode` | (varies) | Custom button text |

### Custom Text Example

```tsx
<GenerateButton>Create Magic</GenerateButton>
<UploadButton>Import Design</UploadButton>
```

## Button Styles

| Button | Font | Texture | Hover Effect |
|--------|------|---------|--------------|
| **Generate** | Space Grotesk | Obsidian black | Icon spins 360°, lifts |
| **New Project** | Inter | Graphite steel | Plus rotates 90°, turns red |
| **Fix Broken App** | JetBrains Mono | Carbon fiber | Wrench rotates, accent glows |
| **Upload** | Space Grotesk Bold | Slate monolith | Arrow rises, icon turns red |
| **Image to Code** | Inter | Dual panel | Panels rotate apart in 3D |

## Customization

### Changing the Accent Color

Find and replace in `Premium3DButtons.css`:
- `#dc2626` → your primary accent
- `#b91c1c` → your darker accent shade
- `#ef4444` → your lighter accent shade
- `rgba(220, 38, 38, ...)` → your accent with alpha

### Adjusting Button Size

Add custom padding via className:

```tsx
<GenerateButton className="!py-4 !px-8" />
```

Or modify the base `.btn-3d` class in CSS.

## Accessibility

- Full keyboard navigation support
- Focus-visible outline styling
- Disabled state handling
- Respects `prefers-reduced-motion`

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

Requires support for:
- CSS `transform-style: preserve-3d`
- CSS `mask-composite`
- CSS custom properties

## License

MIT - Use freely in personal and commercial projects.

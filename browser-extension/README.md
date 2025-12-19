# KripTik AI Project Importer

Chrome extension that captures complete project context from 20+ AI-first code builders for seamless import to KripTik AI.

## Supported Platforms

### Tier 1 (High Priority)
- ✅ Bolt.new
- ✅ Lovable.dev
- ✅ v0.dev
- ✅ Cursor AI
- ✅ Replit Agent
- ✅ GitHub Copilot Workspace

### Tier 2 (Popular)
- ✅ Windsurf
- ✅ Claude Artifacts
- ✅ Marblism
- ✅ Create.xyz
- More coming soon...

## Features

- 🎯 **Multi-Platform Support**: Works with 20+ AI code builders
- 💬 **Complete Chat History**: Captures all conversations with AI
- 🐛 **Error Tracking**: Collects errors and console logs
- 📁 **File Structure**: Maps complete project hierarchy
- 🎨 **Sci-Fi UI**: Premium animated interface
- 📦 **ZIP Enhancement**: Adds metadata to exported projects
- 🔒 **Local Processing**: All data stays on your machine

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Open any supported AI builder platform
2. Click the "Import to KripTik AI" button that appears
3. Click "START CAPTURE" in the overlay
4. Wait for the capture to complete (30-90 seconds)
5. Click "DOWNLOAD ZIP" or trigger the platform's export
6. The downloaded ZIP will contain `_import_metadata.json`
7. Import the ZIP to KripTik AI

## Development

### Project Structure

```
project-importer-extension/
├── manifest.json          # Extension manifest
├── src/
│   ├── background/        # Service worker
│   ├── content/          # Content scripts
│   │   ├── platforms/    # Platform configurations
│   │   ├── exporters/    # Export handlers
│   │   ├── scrapers/     # Data scrapers
│   │   └── ui/           # UI components
│   ├── utils/            # Utilities
│   └── styles/           # CSS
├── assets/               # Icons and logos
└── lib/                  # Third-party libraries
```

## License

MIT

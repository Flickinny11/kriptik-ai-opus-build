# Claude Code Browser Integration Guide

> This document explains how to use the browser feedback loop with Claude Code for KripTik AI development.

---

## Overview

As of December 18, 2025, Claude Code can integrate with Chrome via the MCP (Model Context Protocol) to provide the same "constant browser feedback" capability that Cursor has built-in. This dramatically improves:

- **Visual verification** - Claude sees exactly what you see
- **Error debugging** - Console errors are read directly
- **DOM inspection** - Understand page structure without screenshots
- **Interactive testing** - Click, fill forms, navigate

---

## Quick Start

### 1. Start Chrome with Remote Debugging

```bash
~/bin/chrome-dev
# Or with custom port: ~/bin/chrome-dev 9223
# Or with initial URL: ~/bin/chrome-dev 9222 http://localhost:5173
```

### 2. Restart Claude Code

After adding/updating MCP configuration, restart Claude Code to pick up the new servers.

### 3. Navigate to Your App

In the debugging Chrome instance, go to your running KripTik dev server (usually `http://localhost:5173`).

### 4. Ask Claude to Verify

Claude can now:
- "Take a screenshot of the current page"
- "What errors are in the console?"
- "Click the Login button"
- "Fill in the email field with test@example.com"
- "What's the structure of the navigation component?"

---

## Configuration Files

### Global (all projects)

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

### Project-specific

**Location**: `.mcp.json` in project root

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

---

## Available MCP Tools

When chrome-devtools MCP is active, Claude has access to:

### Page Management
- `list_pages` - List all open tabs
- `navigate` - Go to a URL
- `open_tab` / `close_tab` - Tab management
- `resize_window` - Change viewport size

### Page Inspection
- `snapshot` - Get page content with element UIDs
- `screenshot` - Take a visual screenshot
- `execute_script` - Run JavaScript in page context

### Interaction
- `click` - Click elements (by UID)
- `fill` - Fill form fields
- `hover` - Hover over elements
- `upload_file` - Upload files to inputs

### Console & Network
- `get_console_logs` - Read console output
- `get_network_requests` - See API calls

### Performance
- `get_performance_metrics` - Core Web Vitals
- `start_trace` / `stop_trace` - Performance recording

---

## Development Workflow

### Build Loop with Browser Verification

1. **Code Change** → Make edits in Claude Code
2. **Hot Reload** → Vite refreshes the browser
3. **Visual Check** → "Claude, take a screenshot"
4. **Error Check** → "Claude, any console errors?"
5. **Iterate** → Fix issues based on direct feedback

### Debugging Flow

```
User: "The Ghost Mode panel isn't showing"
Claude: *takes screenshot, checks console*
Claude: "I see a TypeError in useGhostModeStore.ts:45 -
        'Cannot read property 'enabled' of undefined'"
Claude: *reads the file, fixes the bug*
Claude: *takes another screenshot to verify*
```

---

## Comparison: Before vs After

### Before (Manual)
1. Make code change
2. Switch to browser
3. Manually refresh
4. Check if it works
5. Open DevTools
6. Copy error messages
7. Paste into chat
8. Wait for response

### After (Browser MCP)
1. Make code change
2. "Claude, check if it works"
3. Claude takes screenshot, reads errors, suggests fix
4. Single conversation, no context switching

---

## Tips for Optimal Use

### 1. Keep Chrome with Debug Profile Separate
The `~/bin/chrome-dev` script uses a separate profile (`~/.chrome-debug-profile`). Your regular Chrome browsing won't interfere.

### 2. Use Specific Selectors
When asking Claude to interact:
- "Click the button with class 'submit-btn'"
- "Fill the input with id 'email-field'"

### 3. Combine with Verification Swarm
KripTik's verification swarm + browser feedback = comprehensive validation:
```
1. Anti-slop detector runs on code
2. Claude takes screenshot for visual check
3. Console logs checked for runtime errors
4. All in one automated loop
```

### 4. For E2E Testing
Use browser MCP to manually test user flows:
- "Navigate to /login"
- "Fill email with test@test.com, password with test123"
- "Click Login"
- "Take a screenshot - did we get redirected to dashboard?"

---

## Troubleshooting

### MCP Not Available
- Restart Claude Code after config changes
- Check `claude mcp list` for active servers
- Verify Node.js v22+ is installed

### Chrome Not Connecting
- Ensure `~/bin/chrome-dev` is running
- Check port 9222 is not blocked: `lsof -i :9222`
- Try killing and restarting: `killall "Google Chrome" && ~/bin/chrome-dev`

### Tool Permission Denied
- Claude Code may ask for permission to use new tools
- Accept when prompted for MCP tools

---

## Sources

- [Claude for Chrome Announcement](https://claude.com/blog/claude-for-chrome)
- [Chrome DevTools MCP Setup](https://github.com/haasonsaas/claude-code-browser-mcp-setup)
- [MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Addy Osmani's DevTools MCP Guide](https://addyosmani.com/blog/devtools-mcp/)

---

*Last updated: 2025-12-19*

# OpenCode Browser Agent

<p align="center">
  <img src="extension/icons/icon-96.svg" alt="OpenCode Browser Agent Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Browser Automation Plugin for OpenCode</strong>
</p>

<p align="center">
  <a href="https://github.com/code-yeongyu/opencode-browser-agent">GitHub</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#firefox-extension">Firefox Extension</a>
</p>

---

## Overview

OpenCode Browser Agent is a bun package that adds browser automation capabilities to OpenCode. It provides:

- **browser-agent**: An AI agent specialized for web browsing tasks
- **MCP Server**: Model Context Protocol server for browser automation (Playwright)
- **Context Injection**: Automatic injection of browser context (URL, title) from Firefox extension

### Key Features

- ✅ **Non-conflicting**: Uses unique names to avoid conflicts with existing OpenCode setup
- ✅ **Self-contained**: Bundles everything (MCP server, plugins, agents)
- ✅ **Plugin-based**: Uses OpenCode's plugin system properly
- ✅ **Firefox Integration**: Works with the Firefox extension for browser context

---

## Installation

### Prerequisites

1. **OpenCode** installed locally
   ```bash
   bun add -g opencode
   ```

2. **Bun** 1.0 or higher
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Playwright** browsers (for MCP server)
   ```bash
   bun playwright install
   ```

### Install the Package

```bash
# Add to your project
bun add opencode-browser-agent

# Or install globally
bun add -g opencode-browser-agent
```

### Run Installation Script

```bash
# From your project directory
npx opencode-browser-agent install

# Or with bun run
bun run node_modules/.bin/opencode-browser-agent install

# Or directly
node node_modules/opencode-browser-agent/bin/install.js
```

---

## Usage

### With Firefox Extension

1. **Load the Firefox Extension**
   - Go to `about:debugging`
   - Click "Load Temporary Add-on"
   - Select `extension/manifest.json` from this repository

2. **Use in OpenCode**
   - Start OpenCode with the browser-agent:
     ```bash
     opencode --agent browser-agent
     ```
   - Or select "browser-agent" from the agent list

3. **Test**
   - Navigate to a webpage in Firefox
   - Click the extension icon
   - Ask: "What's the title of this page?"

### Available Tools

The browser-agent has access to these MCP tools:

| Tool | Description | Example |
|------|-------------|---------|
| `navigate` | Go to a URL | `navigate({url: "https://example.com"})` |
| `click` | Click element by selector | `click({selector: "#submit-btn"})` |
| `click_with_index` | Click by element index | `click_with_index({index: 5})` |
| `fill` | Fill form field | `fill({selector: "input[name=email]", value: "test@example.com"})` |
| `extract` | Extract page content | `extract({selector: ".pricing"})` |
| `screenshot` | Take page screenshot | `screenshot({filename: "page.png"})` |
| `get_html` | Get full HTML | `get_html({})` |
| `scroll` | Scroll page | `scroll({direction: "down"})` |
| `wait` | Wait seconds | `wait({seconds: 5})` |
| `get_page_info` | Get page info | `get_page_info({})` |
| `search` | Search page text | `search({text: "pricing"})` |

### Example Queries

- "Search for competitor websites and extract their pricing"
- "Fill this form with: name=John, email=john@example.com"
- "Navigate to example.com and analyze the pricing structure"
- "Click through the navigation and find all service pages"
- "Extract all contact information from these pages"

---

## Firefox Extension Setup

For full browser context injection, use the Firefox extension from this repository:

### Load Extension (Temporary)

1. Open Firefox and navigate to `about:debugging`
2. Click **This Firefox** in the sidebar
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file in the `extension/` directory

### Load Extension (Permanent)

```bash
cd extension
web-ext build
```

Then install the generated `.zip` file via `about:addons`.

---

## Configuration

### Customize Agent

Create `~/.config/opencode/browser-agent.json`:

```json
{
  "browserAgent": {
    "model": "openrouter/x-ai/grok-4.1-fast",
    "temperature": 0.7,
    "maxTokens": 4096,
    "allowedTools": [
      "mcp__opencode-browser-agent__navigate",
      "mcp__opencode-browser-agent__click",
      "mcp__opencode-browser-agent__fill",
      "mcp__opencode-browser-agent__extract",
      "context",
      "read",
      "grep"
    ],
    "forbiddenTools": [
      "shell_execute",
      "file_edit",
      "file_write",
      "git_commit",
      "git_push"
    ]
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSER_HEADLESS` | Run browser in headless mode | `false` |

---

## Architecture

```
opencode-browser-agent/
├── src/
│   ├── index.ts              # Main plugin export
│   ├── agent/
│   │   └── browser-agent.ts  # Agent configuration
│   └── context/
│       └── browser-context.ts # Context injection hooks
├── mcp-servers/
│   └── playwright/
│       ├── index.ts          # MCP server entry point
│       └── package.json      # MCP server dependencies
├── bin/
│   └── install.js            # Installation script
└── plugin/
    └── browser-context.js    # Standalone context plugin
```

### How It Works

1. **Plugin Entry Point** (`src/index.ts`):
   - Exports a default function that OpenCode calls
   - Injects `browser-agent` into the agent list
   - Registers `opencode-browser-agent` MCP server
   - Provides context injection hooks

2. **MCP Server** (`mcp-servers/playwright/index.ts`):
   - Model Context Protocol server using Playwright
   - Provides browser automation tools
   - Communicates via stdin/stdout

3. **Browser Context** (`src/context/browser-context.ts`):
   - Extracts browser context from extension messages
   - Injects URL, title, etc. into AI context
   - Triggered by web-related queries

---

## Troubleshooting

### MCP Server Not Starting

1. **Check dependencies**:
   ```bash
   bun run node_modules/.bin/opencode-browser-agent install
   ```

2. **Install Playwright browsers**:
   ```bash
   bun playwright install
   ```

3. **Check logs**:
   ```bash
   bun run opencode --debug
   ```

### Extension Not Connecting

1. **Verify OpenCode is running**:
   ```bash
   opencode --version
   ```

2. **Check Firefox console** (Ctrl+Shift+J):
   - Look for native messaging errors

3. **Verify port 4096**:
   ```bash
   curl http://127.0.0.1:4096/health
   ```

### Permission Issues

Ensure the MCP server has execute permissions:
```bash
chmod +x node_modules/opencode-browser-agent/mcp-servers/playwright/index.js
```

---

## Development

### Building

```bash
bun run build
```

### Testing

```bash
# Test MCP server standalone
echo '{"url":"https://example.com"}' | bun run mcp-servers/playwright/index.ts
```

### Publishing

```bash
bun publish
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by Rikllo
</p>

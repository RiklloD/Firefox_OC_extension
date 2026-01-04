# OpenCode Browser Agent

<p align="center">
  <img src="extension/icons/icon-96.svg" alt="OpenCode Browser Agent Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI Coding Assistant in Your Browser</strong>
</p>

<p align="center">
  <a href="https://github.com/code-yeongyu/opencode">OpenCode</a> • 
  <a href="#features">Features</a> • 
  <a href="#installation">Installation</a> • 
  <a href="#usage">Usage</a> • 
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

OpenCode Browser Agent is a Firefox extension that brings OpenCode's powerful AI coding capabilities directly into your browser. Just like Comet browser provides agentic automation, this extension creates a seamless bridge between web browsing and AI-powered code generation.

### Why OpenCode Browser Agent?

- **Local AI Processing**: All code generation happens locally on your machine—no data sent to external servers
- **Full Context Awareness**: OpenCode understands the current web page you're viewing
- **Privacy First**: Your browsing data and code stay on your machine
- **Unlimited Usage**: No API limits, no subscription tiers
- **Works Offline**: After initial setup, functions without internet connectivity

---

## Features

### 🔗 Seamless Browser Integration
- One-click access to OpenCode from Firefox toolbar
- Automatic capture of current page URL and title
- Context-aware AI responses based on your browsing

### 🤖 Powerful AI Assistance
- Generate code snippets from documentation pages
- Explain and analyze code on GitHub
- Get solutions for Stack Overflow errors
- Refactor and improve code with AI guidance

### 🛡️ Privacy & Security
- All processing happens locally with your own API keys
- No external servers involved in data processing
- You control your LLM provider (OpenAI, Anthropic, Ollama, etc.)

### 🔧 Developer-Friendly
- Modern popup UI with syntax highlighting
- Copy responses with one click
- Supports multiple LLM backends
- Extensible plugin system

---

## Installation

### Prerequisites

1. **Firefox** (version 109.0 or higher)
2. **OpenCode** installed locally
   ```bash
   bun add -g opencode
   ```
3. **Python 3** with requests library
   ```bash
   pip install requests
   ```

### Step 1: Install Native Messaging Manifest

#### Linux/macOS
```bash
chmod +x install.sh
./install.sh
```

#### Windows
```batch
install.bat
```

### Step 2: Load Extension in Firefox

#### Option A: Temporary Installation (Development)
1. Open Firefox and navigate to `about:debugging`
2. Click **This Firefox** in the sidebar
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file in the `extension/` directory

#### Option B: Using web-ext (Recommended for Development)
```bash
bun add -g web-ext
cd extension
web-ext run
```

#### Option C: Permanent Installation
1. Package the extension: `cd extension && web-ext build`
2. Go to `about:addons`
3. Click the gear icon → **Install Add-on From File**
4. Select the generated `.zip` file`

### Step 3: Copy Browser Context Plugin (Optional)

For enhanced browser context awareness, copy the plugin to OpenCode's config:

#### Linux/macOS
```bash
cp opencode-config/plugin/opencode-browser-context.js ~/.config/opencode/plugin/
```

#### Windows
```batch
copy opencode-config\plugin\opencode-browser-context.js %USERPROFILE%\.config\opencode\plugin\
```

---

## WebAgency Edition

This extension includes a **specialized WebAgent** for web browsing tasks, perfect for webagency workflows.

### WebAgent Capabilities

- **Research**: Search and analyze multiple pages (5-10+ pages in one task)
- **Automation**: Click, fill forms, navigate, scroll
- **Extraction**: Extract structured data, tables, forms
- **Analysis**: Take screenshots, analyze page content

### WebAgent Setup

#### Step 1: Configure MCP Server (Browser Automation)

Install the Playwright MCP server with Bun:

```bash
cd mcp-servers/webagency-browser-bun
bun install
```

#### Step 2: Add MCP to OpenCode Config

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "servers": {
      "webagency-playwright": {
        "command": "bun",
        "args": ["C:\\dev\\firefox opencode extension\\mcp-servers\\webagency-browser-bun\\index.ts"],
        "disabled": false
      }
    }
  }
}
```

**Note**: Update the path to match your installation directory.

#### Step 3: Create WebAgent Configuration

Create `~/.config/opencode/agents/webagent.json`:

```json
{
  "name": "webagent",
  "description": "WebAgency browser automation agent",
  "systemPrompt": "You are WebAgent, specialized in web browsing and webagency tasks.\n\nYour strengths:\n- Searching and researching across multiple pages\n- Filling forms and completing web actions\n- Extracting structured data from websites\n- Taking actions on behalf of the user\n- Analyzing page content and structure\n\nWorkflow for research tasks:\n1. Navigate to relevant pages\n2. Extract key information\n3. Synthesize findings\n4. Provide actionable insights\n\nAlways confirm before taking irreversible actions (form submissions, purchases, etc.)",
  "model": "gpt-4o",
  "temperature": 0.7,
  "allowedTools": [
    "mcp__webagency-playwright*",
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
```

#### Step 4: Install WebAgency Context Plugin

Copy the WebAgency plugin to OpenCode:

```bash
# Linux/macOS
cp opencode-config/plugin/webagency-context.js ~/.config/opencode/plugin/

# Windows
copy opencode-config\plugin\webagency-context.js %USERPROFILE%\.config\opencode\plugin\
```

### Available MCP Tools

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
| `search` | Search page text | `search({text: "pricing"})` |
| `get_page_info` | Get current page info | `get_page_info({})` |

### Example WebAgent Queries

- "Search for 5 competitor websites and extract their pricing"
- "Fill this form with: name=John, email=john@example.com"
- "Navigate to example.com and analyze the pricing structure"
- "Click through the navigation and find all service pages"
- "Extract all contact information from these 10 pages"

---

## Usage

1. **Click the extension icon** in your Firefox toolbar
2. **Type your query** about the current page or any coding question
3. **Press Enter** (or click Send) to get AI-powered assistance
4. **Copy the response** with one click if needed

### Example Queries

- "Analyze this code structure on GitHub"
- "Generate a TypeScript client for this API documentation"
- "Explain this algorithm"
- "Help me complete this form"
- "What does this error message mean?"

---

## Architecture

The OpenCode Browser Agent uses a three-tier architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Firefox Extension                      │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ Popup   │───▶│ Background   │───▶│ Native Host    │  │
│  │ UI      │    │ Service      │    │ Connection     │  │
│  └─────────┘    │ Worker       │    └────────┬───────┘  │
│                 └──────────────┘             │          │
└─────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
                    ┌─────────────────────────────────────┐
                    │       Native Messaging Host          │
                    │   Python Bridge (stdin/stdout)       │
                    │                                     │
                    │  • Protocol handling                │
                    │  • Server lifecycle management      │
                    │  • Error handling                   │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │       OpenCode Server                │
                    │   http://127.0.0.1:4096             │
                    │                                     │
                    │  • AI processing                    │
                    │  • Plugin system                    │
                    │  • Tool execution                   │
                    └─────────────────────────────────────┘
```

### Components

#### Extension Layer (`extension/`)
- **manifest.json**: Extension configuration (Manifest V3)
- **background.js**: Service worker for native messaging
- **popup.html/css/js**: User interface

#### Native Messaging Host (`native-host/`)
- **opencode_bridge.py**: Python bridge script
- **opencode_agent.json**: Native messaging manifest

#### OpenCode Configuration (`opencode-config/`)
- **plugin/opencode-browser-context.js**: Browser context plugin

---

## Troubleshooting

### Extension Not Connecting

1. **Check OpenCode installation**:
   ```bash
   opencode --version
   ```

2. **Verify native messaging manifest**:
   - Linux/macOS: `~/.mozilla/native-messaging-hosts/opencode_agent.json`
   - Windows: Registry key at `HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\opencode_agent`

3. **Check Firefox console** (Ctrl+Shift+J):
   - Look for native messaging errors
   - Verify extension ID matches manifest

### OpenCode Server Issues

1. **Check if port 4096 is available**:
   ```bash
   # Linux/macOS
   lsof -i :4096

   # Windows
   netstat -ano | findstr :4096
   ```

2. **Test OpenCode server directly**:
   ```bash
   curl http://127.0.0.1:4096/health
   ```

3. **Manual server start**:
   ```bash
   opencode serve --port 4096
   ```

### Permission Issues

Ensure the native messaging host script has execute permissions:
```bash
chmod +x native-host/opencode_bridge.py
```

---

## Development

### Project Structure

```
opencode-browser-agent/
├── extension/
│   ├── manifest.json          # Firefox extension manifest
│   ├── background.js          # Background service worker
│   ├── popup.html             # Popup UI
│   ├── popup.css              # Popup styles
│   ├── popup.js               # Popup logic
│   ├── sidebar.html           # Sidebar UI
│   ├── sidebar.js             # Sidebar logic
│   └── icons/                 # Extension icons
├── native-host/
│   ├── opencode_bridge.py     # Native messaging bridge
│   └── opencode_agent.json    # Native manifest
├── opencode-config/
│   ├── agents/
│   │   └── webagent.json      # WebAgent configuration
│   └── plugin/
│       ├── opencode-browser-context.js  # Browser context plugin
│       └── webagency-context.js         # WebAgency plugin
├── mcp-servers/
│   └── webagency-browser-bun/   # Bun MCP server
├── install.sh                   # Base installer
├── install.bat                  # Base installer (Windows)
├── install-webagency-bun.sh     # WebAgency setup (Bun, Linux/macOS)
├── install-webagency-bun.bat    # WebAgency setup (Bun, Windows)
└── README.md                    # This file
```

### Testing

```bash
# Test native host standalone
echo '{"prompt":"test"}' | python native-host/opencode_bridge.py

# Run extension with web-ext
cd extension
web-ext run

# Lint extension
web-ext lint
```

---

## Contributing

Contributions are welcome! Please read our [contributing guidelines](https://github.com/code-yeongyu/opencode/blob/main/CONTRIBUTING.md) before submitting PRs.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [OpenCode](https://github.com/code-yeongyu/opencode) - The amazing terminal-based AI coding agent
- [Mozilla Firefox](https://www.mozilla.org/firefox/) - The browser that respects your privacy
- [WebExtension API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) - Standard browser extension API

---

<p align="center">
  Made with ❤️ by Rikllo
</p>

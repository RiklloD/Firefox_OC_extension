# OpenCode WebAgency Plugin

This plugin adds powerful web browsing and research capabilities to OpenCode.

## Features

- **WebAgent**: A specialized AI agent for web research, automation, and extraction.
- **Browser Context**: Automatically injects current browser page info (URL, title) into the AI context.
- **Playwright MCP**: Provides tools for navigating, clicking, filling forms, and taking screenshots.

## Installation

1.  Add the plugin to OpenCode:
    ```bash
    opencode plugin add ./opencode-webagency
    ```
    (Or point to the git repo/npm package when published)

2.  Ensure you have Bun installed for the MCP server.

## Configuration

The plugin registers the `webagent` and the `webagency-playwright` MCP server automatically.

## Development

1.  Install dependencies:
    ```bash
    bun install
    ```

2.  Build the plugin:
    ```bash
    bun run build
    ```

## Structure

- `src/agents`: Agent definitions
- `src/context`: Browser context injection logic
- `src/mcp`: MCP server integration
- `mcp-servers`: Bundled MCP servers (Playwright)

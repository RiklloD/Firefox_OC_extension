#!/bin/bash
# WebAgency Quick Setup Script for Linux/macOS (Bun Version)
# Run this script after installing the extension

echo "============================================"
echo "WebAgency Browser Agent - Quick Setup (Bun)"
echo "============================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_PATH="$SCRIPT_DIR/mcp-servers/webagency-browser-bun"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "[ERROR] Bun is not installed."
    echo "Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "[OK] Bun is installed"

# Check if OpenCode is installed
if ! command -v opencode &> /dev/null; then
    echo "[ERROR] OpenCode is not installed."
    echo "Install with: bun add -g opencode"
    exit 1
fi
echo "[OK] OpenCode is installed"

# Create config directories
mkdir -p ~/.config/opencode/agents
mkdir -p ~/.config/opencode/plugin

# Check if MCP server exists
if [ ! -f "$MCP_PATH/index.ts" ]; then
    echo "[ERROR] MCP server not found at: $MCP_PATH"
    echo "Please run: cd mcp-servers/webagency-browser-bun && bun install"
    exit 1
fi
echo "[OK] MCP server found"

# Install MCP dependencies with Bun
echo "Installing MCP dependencies with Bun..."
cd "$MCP_PATH" && bun install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi
echo "[OK] Dependencies installed"

# Update opencode.json (Merging config)
echo "Updating ~/.config/opencode/opencode.json..."
bun "$SCRIPT_DIR/setup/merge-config.js" "$MCP_PATH/index.ts"
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to update configuration"
    exit 1
fi
echo "[OK] Updated opencode.json"

# Copy WebAgent config
echo "Copying webagent.json..."
cp "$SCRIPT_DIR/opencode-config/agents/webagent.json" ~/.config/opencode/agents/
echo "[OK] Copied webagent.json"

# Copy WebAgency plugin
echo "Copying webagency-context.js..."
cp "$SCRIPT_DIR/opencode-config/plugin/webagency-context.js" ~/.config/opencode/plugin/
echo "[OK] Copied webagency-context.js"

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Restart OpenCode if it's running"
echo "2. Load the extension in Firefox"
echo "3. Test with: 'Navigate to example.com and extract pricing'"
echo ""

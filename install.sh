#!/bin/bash
#
# OpenCode Browser Agent - Installation Script
#
# This script installs the native messaging manifest for the OpenCode Browser Agent
# on Linux and macOS systems.
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  OpenCode Browser Agent Installer${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_HOST_DIR="${SCRIPT_DIR}/native-host"
MANIFEST_SOURCE="${NATIVE_HOST_DIR}/opencode_agent.json"
PYTHON_SCRIPT="${NATIVE_HOST_DIR}/opencode_bridge.py"

# Main installation
main() {
    print_header

    # Check if running on supported OS
    OS=$(detect_os)
    if [[ "$OS" == "unknown" ]]; then
        print_error "Unsupported operating system: $OSTYPE"
        echo "This script supports Linux and macOS only."
        echo "For Windows, use install.bat instead."
        exit 1
    fi

    print_info "Detected OS: $([[ "$OS" == "linux" ]] && echo "Linux" || echo "macOS")"
    echo ""

    # Step 1: Check for OpenCode
    print_step "Checking for OpenCode installation..."
    if command -v opencode &> /dev/null; then
        OPENCODE_VERSION=$(opencode --version 2>&1 || echo "unknown")
        print_success "OpenCode is installed (version: $OPENCODE_VERSION)"
    else
        print_error "OpenCode is not installed"
        echo ""
        echo "Please install OpenCode first:"
        echo "  npm install -g opencode"
        echo ""
        echo "Or visit: https://github.com/code-yeongyu/opencode"
        echo ""
        read -p "Do you want to install OpenCode now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "Installing OpenCode..."
            npm install -g opencode
            print_success "OpenCode installed successfully"
        else
            print_info "You can install OpenCode later and run this script again"
        fi
    fi
    echo ""

    # Step 2: Check for Python and requests
    print_step "Checking Python installation..."
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1)
        print_success "Python is installed ($PYTHON_VERSION)"
    else
        print_error "Python 3 is not installed"
        echo "Please install Python 3 to use the native messaging host."
        exit 1
    fi

    print_step "Checking requests library..."
    if python3 -c "import requests" 2>/dev/null; then
        print_success "requests library is installed"
    else
        print_error "requests library is not installed"
        echo ""
        print_info "Installing requests library..."
        pip3 install requests
        if [ $? -eq 0 ]; then
            print_success "requests library installed successfully"
        else
            print_error "Failed to install requests library"
            exit 1
        fi
    fi
    echo ""

    # Step 3: Verify manifest file
    print_step "Verifying native messaging manifest..."
    if [[ ! -f "$MANIFEST_SOURCE" ]]; then
        print_error "Manifest file not found: $MANIFEST_SOURCE"
        exit 1
    fi
    print_success "Manifest file found: $MANIFEST_SOURCE"
    echo ""

    # Step 4: Verify Python script
    print_step "Verifying native host script..."
    if [[ ! -f "$PYTHON_SCRIPT" ]]; then
        print_error "Python script not found: $PYTHON_SCRIPT"
        exit 1
    fi
    print_success "Python script found: $PYTHON_SCRIPT"
    echo ""

    # Step 5: Update manifest with absolute path
    print_step "Updating manifest with absolute path..."
    ABSOLUTE_PATH="$(cd "$NATIVE_HOST_DIR" && pwd)"
    MANIFEST_TEMP="${SCRIPT_DIR}/.manifest_temp.json"

    # Create updated manifest with absolute path
    sed "s|/absolute/path/to/native-host|${ABSOLUTE_PATH}|g" "$MANIFEST_SOURCE" > "$MANIFEST_TEMP"
    print_success "Manifest updated with path: $ABSOLUTE_PATH"
    echo ""

    # Step 6: Create Mozilla directory
    print_step "Creating Mozilla native messaging hosts directory..."
    MOZILLA_DIR="$HOME/.mozilla/native-messaging-hosts"
    mkdir -p "$MOZILLA_DIR"
    print_success "Directory created: $MOZILLA_DIR"
    echo ""

    # Step 7: Copy manifest
    print_step "Installing native messaging manifest..."
    MANIFEST_DEST="${MOZILLA_DIR}/opencode_agent.json"
    cp "$MANIFEST_TEMP" "$MANIFEST_DEST"
    chmod 644 "$MANIFEST_DEST"

    # Cleanup temp file
    rm -f "$MANIFEST_TEMP"

    print_success "Manifest installed: $MANIFEST_DEST"
    echo ""

    # Step 8: Make Python script executable
    print_step "Setting Python script permissions..."
    chmod +x "$PYTHON_SCRIPT"
    print_success "Python script is now executable"
    echo ""

    # Summary
    print_header
    echo -e "${GREEN}Installation Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Load the extension in Firefox:"
    echo "     - Open Firefox and navigate to about:debugging"
    echo "     - Click 'This Firefox' in the sidebar"
    echo "     - Click 'Load Temporary Add-on'"
    echo "     - Select the manifest.json file in the extension/ directory"
    echo ""
    echo "  2. Or install web-ext for development:"
    echo "     npm install -g web-ext"
    echo "     cd extension && web-ext run"
    echo ""
    echo "  3. Copy the browser context plugin to OpenCode:"
    echo "     cp opencode-config/plugin/opencode-browser-context.js ~/.config/opencode/plugin/"
    echo ""
    print_info "For more information, see README.md"
    echo ""
}

# Run main function
main "$@"

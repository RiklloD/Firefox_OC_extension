@echo off
REM WebAgency Quick Setup Script for Windows (Bun Version)
REM Run this script after installing the extension

echo ============================================
echo WebAgency Browser Agent - Quick Setup (Bun)
echo ============================================
echo.

REM Check if Bun is installed
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Bun is not installed.
    echo Install with: powershell -c "irm bun.sh/install.ps1 | iex"
    pause
    exit /b 1
)
echo [OK] Bun is installed

REM Check if OpenCode is installed
where opencode >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] OpenCode is not installed.
    echo Install with: bun add -g opencode
    pause
    exit /b 1
)
echo [OK] OpenCode is installed

REM Create config directory
mkdir "%USERPROFILE%\.config\opencode" 2>nul
mkdir "%USERPROFILE%\.config\opencode\agents" 2>nul
mkdir "%USERPROFILE%\.config\opencode\plugin" 2>nul

REM Set MCP path
set MCP_PATH=%~dp0mcp-servers\webagency-browser-bun

REM Check if MCP server exists
if exist "%MCP_PATH%\index.ts" (
    echo [OK] MCP server found
) else (
    echo [ERROR] MCP server not found at: %MCP_PATH%
    echo Please run: cd mcp-servers\webagency-browser-bun ^&^& bun install
    pause
    exit /b 1
)

REM Install MCP dependencies with Bun
echo Installing MCP dependencies with Bun...
cd /d "%MCP_PATH%" && bun install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

REM Update opencode.json (Merging config)
echo Updating ~/.config/opencode/opencode.json...
bun "%~dp0setup\merge-config.js" "%MCP_PATH:\=\\%\\index.ts"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to update configuration
    pause
    exit /b 1
)

echo [OK] Updated opencode.json

REM Copy WebAgent config
echo Copying webagent.json...
copy "%~dp0opencode-config\agents\webagent.json" "%USERPROFILE%\.config\opencode\agents\" >nul
echo [OK] Copied webagent.json

REM Copy WebAgency plugin
echo Copying webagency-context.js...
copy "%~dp0opencode-config\plugin\webagency-context.js" "%USERPROFILE%\.config\opencode\plugin\" >nul
echo [OK] Copied webagency-context.js

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Restart OpenCode if it's running
echo 2. Load the extension in Firefox
echo 3. Test with: "Navigate to example.com and extract pricing"
echo.
pause

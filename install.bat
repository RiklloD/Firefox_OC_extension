@echo off
REM OpenCode Browser Agent - Windows Installation Script
REM This script installs the native messaging manifest for Windows systems

setlocal enabledelayedexpansion

REM Colors for output (Windows CMD compatible)
set "BLUE=[94m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

set "SCRIPT_DIR=%~dp0"
set "NATIVE_HOST_DIR=%SCRIPT_DIR%native-host"
set "MANIFEST_SOURCE=%NATIVE_HOST_DIR%\opencode_agent.json"
set "PYTHON_SCRIPT=%NATIVE_HOST_DIR%\opencode_bridge.py"

REM Clear screen
cls

echo ======================================
echo   OpenCode Browser Agent Installer
echo ======================================
echo.

REM Check for OpenCode
echo [94m→ Checking for OpenCode installation...[0m
where /q opencode
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('opencode --version 2^>^&1') do set "OPENCODE_VERSION=%%i"
    echo [92m✓ OpenCode is installed[0m
) else (
    echo [91m✗ OpenCode is not installed[0m
    echo.
    echo Please install OpenCode first:
    echo   npm install -g opencode
    echo.
    echo Or visit: https://github.com/code-yeongyu/opencode
    set /p INSTALL_OPENCODE="Do you want to install OpenCode now? (y/n) "
    if /i "!INSTALL_OPENCODE!"=="y" (
        echo [93m→ Installing OpenCode...[0m
        npm install -g opencode
        if !errorlevel! equ 0 (
            echo [92m✓ OpenCode installed successfully[0m
        ) else (
            echo [91m✗ Failed to install OpenCode[0m
            exit /b 1
        )
    )
)
echo.

REM Check for Python
echo [94m→ Checking Python installation...[0m
where /q python
if %errorlevel% neq 0 (
    where /q python3
    if %errorlevel% neq 0 (
        echo [91m✗ Python 3 is not installed[0m
        echo Please install Python 3 from https://python.org
        exit /b 1
    ) else (
        set "PYTHON_CMD=python3"
    )
) else (
    set "PYTHON_CMD=python"
)

for /f "tokens=*" %%i in ('%PYTHON_CMD% --version 2^>^&1') do set "PYTHON_VERSION=%%i"
echo [92m✓ Python is installed (%PYTHON_VERSION%)[0m

REM Check for requests library
echo [94m→ Checking requests library...[0m
%PYTHON_CMD% -c "import requests" 2>nul
if %errorlevel% equ 0 (
    echo [92m✓ requests library is installed[0m
) else (
    echo [91m✗ requests library is not installed[0m
    echo [93m→ Installing requests library...[0m
    pip install requests
    if !errorlevel! equ 0 (
        echo [92m✓ requests library installed successfully[0m
    ) else (
        echo [91m✗ Failed to install requests library[0m
        exit /b 1
    )
)
echo.

REM Verify manifest file
echo [94m→ Verifying native messaging manifest...[0m
if not exist "%MANIFEST_SOURCE%" (
    echo [91m✗ Manifest file not found: %MANIFEST_SOURCE%[0m
    exit /b 1
)
echo [92m✓ Manifest file found[0m
echo.

REM Verify Python script
echo [94m→ Verifying native host script...[0m
if not exist "%PYTHON_SCRIPT%" (
    echo [91m✗ Python script not found: %PYTHON_SCRIPT%[0m
    exit /b 1
)
echo [92m✓ Python script found[0m
echo.

REM Get absolute path
for %%i in ("%NATIVE_HOST_DIR%") do set "ABSOLUTE_PATH=%%~fi"

REM Update manifest with absolute path
echo [94m→ Updating manifest with absolute path...[0m
set "MANIFEST_TEMP=%SCRIPT_DIR%.manifest_temp.json"
powershell -Command "(Get-Content '%MANIFEST_SOURCE%').Replace('/absolute/path/to/native-host', '%ABSOLUTE_PATH%') | Set-Content '%MANIFEST_TEMP%'"
echo [92m✓ Manifest updated with path: %ABSOLUTE_PATH%[0m
echo.

REM Create Mozilla directory
echo [94m→ Creating Mozilla native messaging hosts directory...[0m
set "MOZILLA_DIR=%APPDATA%\Mozilla\NativeMessagingHosts"
if not exist "%MOZILLA_DIR%" mkdir "%MOZILLA_DIR%"
echo [92m✓ Directory created: %MOZILLA_DIR%[0m
echo.

REM Copy manifest
echo [94m→ Installing native messaging manifest...[0m
set "MANIFEST_DEST=%MOZILLA_DIR%\opencode_agent.json"
copy /Y "%MANIFEST_TEMP%" "%MANIFEST_DEST%" >nul
echo [92m✓ Manifest installed: %MANIFEST_DEST%[0m

REM Cleanup temp file
del /Q "%MANIFEST_TEMP%" 2>nul
echo.

REM Create registry entry (required for Firefox on Windows)
echo [94m→ Creating registry entry for Firefox...[0m
set "REG_KEY=HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\opencode_agent"
set "REG_PATH=%ABSOLUTE_PATH%\opencode_agent.json"

reg add "%REG_KEY%" /ve /d "%REG_PATH%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [92m✓ Registry entry created[0m
) else (
    echo [91m⚠ Warning: Could not create registry entry[0m
    echo   You may need to manually create:
    echo   HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\opencode_agent
    echo   with value: %REG_PATH%
)
echo.

REM Summary
echo ======================================
echo [92mInstallation Complete![0m
echo.
echo Next steps:
echo   1. Load the extension in Firefox:
echo      - Open Firefox and navigate to about:debugging
echo      - Click 'This Firefox' in the sidebar
echo      - Click 'Load Temporary Add-on'
echo      - Select the manifest.json file in the extension\ directory
echo.
echo   2. Or install web-ext for development:
echo      npm install -g web-ext
echo      cd extension && web-ext run
echo.
echo   3. Copy the browser context plugin to OpenCode:
echo      copy opencode-config\plugin\opencode-browser-context.js %%USERPROFILE%%\.config\opencode\plugin\
echo.
echo [94mℹ For more information, see README.md[0m
echo.

endlocal
pause

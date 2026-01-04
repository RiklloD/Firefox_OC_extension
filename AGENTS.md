# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-03
**Project:** OpenCode Browser Agent - Firefox Extension

## OVERVIEW

Firefox WebExtension (Manifest V3) that bridges browser context to local OpenCode AI server via native messaging. Three-tier architecture: Extension → Python Native Host → OpenCode Server (port 4096).

## STRUCTURE

```
./
├── extension/           # Firefox extension (manifest, popup, background)
│   └── icons/           # Extension toolbar icons (SVG)
├── native-host/         # Python bridge (stdin/stdout JSON protocol)
└── opencode-config/plugin/  # OpenCode plugin for context injection
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Extension UI | `extension/popup.{html,css,js}` | User input, response display |
| Native messaging | `extension/background.js` | Service worker, port management |
| Bridge protocol | `native-host/opencode_bridge.py` | 4-byte length prefix + JSON |
| OpenCode integration | `opencode-config/plugin/opencode-browser-context.js` | Context injection plugin |
| Installers | `install.{sh,bat}` | Native manifest registration |

## CONVENTIONS

- **ESLint**: `prefer-const`, `no-var`, `eqeqeq: always`, `curly: all`
- **JSDoc**: All functions documented
- **Async**: `async/await` patterns, no `Promise` executor
- **Error handling**: `try/catch` with troubleshooting arrays
- **Console**: `console.log` prefixed with `[OpenCode Agent]`

## ANTI-PATTERNS (THIS PROJECT)

- No `TODO`/`FIXME` comments in production code
- No `console.error` without accompanying user-facing error message
- No synchronous XHR or blocking operations
- No inline event handlers (all in `popup.js`)

## COMMANDS

```bash
# Test native host
echo '{"prompt":"test"}' | python native-host/opencode_bridge.py

# Run extension (dev)
cd extension && web-ext run

# Lint extension
cd extension && web-ext lint

# Install native manifest
./install.sh          # Linux/macOS
install.bat           # Windows
```

## NATIVE MESSAGING PROTOCOL

```
Extension → Native: 4-byte LE length + UTF-8 JSON
Native → Extension: 4-byte LE length + UTF-8 JSON
```

Messages include `prompt`, `context: {url, title, timestamp, userAgent}`.

## NOTES

- OpenCode server auto-starts on first request (`opencode serve --port 4096`)
- Extension ID: `opencode-browser-agent@opencode.dev`
- Firefox min version: 109.0
- No external data transmission - all processing local

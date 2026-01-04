# EXTENSION KNOWLEDGE BASE

**Scope:** `extension/` - Firefox WebExtension (Manifest V3)

## OVERVIEW

Firefox extension UI and service worker. Handles user input, native messaging connection, and tab context collection.

## STRUCTURE

```
extension/
├── manifest.json    # Extension config, permissions, nativeMessaging
├── background.js    # Service worker (276 lines)
├── popup.html       # UI structure
├── popup.css        # Styles
├── popup.js         # UI logic (382 lines)
└── icons/
    ├── icon-48.svg
    └── icon-96.svg
```

## WHERE TO LOOK

| Task | File | Key Functions |
|------|------|---------------|
| Connection lifecycle | `background.js` | `connectToNativeHost()`, `sendToNativeHost()` |
| Message routing | `background.js` | `handleNativeMessage()`, `onMessage` listener |
| Tab context | `background.js` | `getTabContext()` |
| UI events | `popup.js` | `initEventListeners()`, `sendToOpenCode()` |
| Response formatting | `popup.js` | `formatResponse()` |

## MESSAGES

### Extension → Background
```js
browser.runtime.sendMessage({
  type: 'send_to_opencode',
  prompt: string,
  context: { url, title, ... }
})
```

### Background → Native Host
```js
nativePort.postMessage({
  prompt: string,
  context: { url, title, timestamp, userAgent }
})
```

## PERMISSIONS

- `nativeMessaging` - Connect to native host
- `activeTab` - Access current tab URL/title
- `tabs` - Query tab information

## CONSTANTS

| Constant | Value | Location |
|----------|-------|----------|
| Native app name | `opencode_agent` | `background.js:30` |
| Extension ID | `opencode-browser-agent@opencode.dev` | `manifest.json` |
| Min Firefox | `109.0` | `manifest.json` |

## CONVENTIONS

- **Module type**: Background uses ES modules (`"type": "module"`)
- **DOM ready**: `document.readyState` check before `init()`
- **Keyboard**: Ctrl/Meta+Enter = newline, Enter = send
- **Response limit**: 2000 characters shown in UI
- **Status states**: `connected`, `loading`, `error`, `disconnected`

## UI STATES

```
Loading: Overlay visible, input disabled
Error: Red section with troubleshooting steps
Success: Response with copy button
Connected: Green status indicator
```

Create project directory structure

    bash
    mkdir opencode-browser-agent
    cd opencode-browser-agent
    mkdir extension
    mkdir native-host
    mkdir opencode-config

Phase 2: Native Messaging Host

    Create native host script (native-host/opencode_bridge.py)

python
#!/usr/bin/env python3
import sys, json, struct, subprocess, requests, shutil

OPENCODE_PORT = 4096
opencode_process = None

def check_opencode():
    return shutil.which('opencode') is not None

def start_opencode():
    global opencode_process
    opencode_process = subprocess.Popen(['opencode', 'serve', '--port', str(OPENCODE_PORT)])

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0: return None
    length = struct.unpack('=I', raw_length)
    message = sys.stdin.buffer.read(length).decode('utf-8')
    return json.loads(message)

def send_message(msg):
    encoded = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

if not check_opencode():
    send_message({"error": "OpenCode not installed"})
    sys.exit(1)

start_opencode()

while True:
    msg = read_message()
    if not msg: break
    # Forward to OpenCode server
    response = requests.post(f'http://127.0.0.1:{OPENCODE_PORT}/tui', 
                             json={"prompt": msg.get("prompt")})
    send_message({"result": response.json()})

Make executable

​

bash
chmod +x native-host/opencode_bridge.py

Create native messaging manifest (native-host/opencode_agent.json)

json
{
  "name": "opencode_agent",
  "description": "OpenCode bridge for browser extension",
  "path": "/absolute/path/to/native-host/opencode_bridge.py",
  "type": "stdio",
  "allowed_extensions": ["opencode-agent@yourdomain.com"]
}

Replace /absolute/path/to/ with actual path

​

Install native manifest

    Linux/Mac: cp native-host/opencode_agent.json ~/.mozilla/native-messaging-hosts/

    Windows: Add registry key at HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\opencode_agent pointing to manifest

        ​

Phase 3: Firefox Extension

    Create manifest.json (extension/manifest.json)

json
{
  "manifest_version": 2,
  "name": "OpenCode Browser Agent",
  "version": "0.1.0",
  "description": "AI coding agent in your browser",
  "browser_specific_settings": {
    "gecko": {
      "id": "opencode-agent@yourdomain.com"
    }
  },
  "permissions": ["nativeMessaging", "activeTab", "tabs"],
  "background": {
    "scripts": ["background.js"]
  },
  "browser_action": {
    "default_popup": "popup.html",
    "default_title": "OpenCode Agent"
  }
}

Create background script (extension/background.js)

javascript
let port = null;

function connectToNativeHost() {
  port = browser.runtime.connectNative("opencode_agent");
  
  port.onMessage.addListener((response) => {
    console.log("From OpenCode:", response);
    browser.runtime.sendMessage({type: "opencode_response", data: response});
  });

  port.onDisconnect.addListener(() => {
    console.error("Native host disconnected:", browser.runtime.lastError);
    port = null;
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "send_to_opencode") {
    if (!port) connectToNativeHost();
    port.postMessage({
      prompt: message.prompt,
      context: message.context
    });
  }
});

Create popup UI (extension/popup.html)

xml
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 400px; padding: 20px; }
    #input { width: 100%; height: 100px; }
    #output { margin-top: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <textarea id="input" placeholder="Ask OpenCode..."></textarea>
  <button id="send">Send</button>
  <div id="output"></div>
  <script src="popup.js"></script>
</body>
</html>

Create popup script (extension/popup.js)

    javascript
    document.getElementById('send').addEventListener('click', async () => {
      const input = document.getElementById('input').value;
      const tabs = await browser.tabs.query({active: true, currentWindow: true});
      const context = {
        url: tabs.url,
        title: tabs.title
      };
      
      browser.runtime.sendMessage({
        type: "send_to_opencode",
        prompt: input,
        context: context
      });
    });

    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "opencode_response") {
        document.getElementById('output').textContent = 
          JSON.stringify(message.data, null, 2);
      }
    });

Phase 4: OpenCode Configuration

    Create OpenCode plugin directory

bash
mkdir -p opencode-config/plugin

Create browser context plugin (opencode-config/plugin/browser-context.js)

javascript
export default function browserPlugin({ client, $ }) {
  return {
    'session.created': async (event) => {
      console.log('Browser agent session started');
    },
    'tool.execute.before': async (event) => {
      // Inject browser context before tool execution
      if (event.context?.browserContext) {
        return {
          context: `Browser: ${event.context.browserContext.url}`
        };
      }
    }
  };
}

Copy plugin to OpenCode config

    bash
    cp opencode-config/plugin/browser-context.js ~/.config/opencode/plugin/

Phase 5: Testing & Development

    Test native host standalone

​

bash
echo '{"prompt":"test"}' | python native-host/opencode_bridge.py

Run extension in development mode

​

bash
cd extension
web-ext run

Firefox launches with your extension loaded temporarily

​

Test the full flow

    Click extension icon

    Type a prompt

    Check browser console for messages

    Verify OpenCode server is running: curl http://127.0.0.1:4096

Debug issues

​

    bash
    web-ext lint  # Validate extension

    Check native host logs: tail -f ~/.mozilla/native-messaging-hosts/*.log

Phase 6: Build & Package

    Build extension for distribution

​

bash
cd extension
web-ext build

Creates .zip file in web-ext-artifacts/

​

Create installation script (install.sh)

    bash
    #!/bin/bash
    # Install OpenCode if not present
    if ! command -v opencode &> /dev/null; then
        npm install -g opencode
    fi

    # Install native manifest
    mkdir -p ~/.mozilla/native-messaging-hosts/
    cp native-host/opencode_agent.json ~/.mozilla/native-messaging-hosts/

    Document installation (README.md)

        Prerequisites: OpenCode, Python 3

        Installation steps for native host

        How to load extension in Firefox

        Configuration options

Phase 7: Enhancement (Optional)

    Add MCP servers to OpenCode config

​
Edit ~/.config/opencode/opencode.json:

json
{
  "mcp": {
    "servers": {
      "browser-automation": {
        "command": "npx",
        "args": ["-y", "@your/browser-mcp-server"]
      }
    }
  }
}

Create custom agents

​
Define specialized agents in your plugin for specific browser tasks

Add hot reload

    ​
    web-ext run --reload automatically reloads on code changes

This workflow gives you a fully functional browser extension that automatically launches OpenCode locally and processes user queries through your configured plugins and agents.

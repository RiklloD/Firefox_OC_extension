OpenCode Browser Agent: Comprehensive Project Overview
Project Concept

The OpenCode Browser Agent is a Firefox extension that transforms OpenCode—a terminal-based AI coding agent—into a browser-integrated development tool. The project creates a seamless bridge between web browsing and AI-powered code generation by embedding OpenCode's capabilities directly into the Firefox browser interface, similar to how Comet browser provides agentic automation.

​
Core Architecture

The system implements a three-tier architecture that maintains separation of concerns while enabling real-time communication between the browser and local AI processing.

Tier 1: Browser Extension Layer runs entirely within Firefox's WebExtension environment. This layer captures user interactions, extracts contextual information from web pages (URLs, DOM structure, selected text, form data), and presents OpenCode's responses in an intuitive UI. The extension utilizes Firefox's activeTab and tabs permissions to access current page context and nativeMessaging permission to communicate with local applications. The popup interface provides a text input area where users describe their coding needs, and results are displayed directly within the browser without switching contexts.

​

Tier 2: Native Messaging Host acts as the critical bridge between the sandboxed browser environment and local system processes. Firefox extensions cannot directly spawn or communicate with local applications for security reasons, so the Native Messaging API provides a controlled communication channel using stdin/stdout with a specific binary protocol. The native host is a Python or Node.js script that Firefox automatically launches when the extension first attempts to connect via browser.runtime.connectNative(). This host receives JSON messages from the extension (encoded with a 4-byte length prefix followed by UTF-8 JSON), manages the OpenCode server lifecycle (checking if it's running, spawning new instances when needed), forwards requests to OpenCode's HTTP API, and returns responses back through the same stdin/stdout channel.

​

Tier 3: OpenCode Server is the AI processing engine that runs locally on the user's machine. OpenCode's built-in opencode serve command starts a headless HTTP server (default port 4096, localhost binding for security) that exposes RESTful endpoints, particularly /tui which accepts prompts and returns AI-generated responses. The server maintains the same powerful capabilities as the terminal version: file system access, code editing, git operations, shell command execution, and integration with multiple LLM providers. Running locally ensures data privacy, low latency, and access to the full system context that cloud-based solutions cannot provide.

​
Communication Flow

When a user opens the extension popup and types a prompt, a sophisticated data flow begins. The popup script immediately queries Firefox's tabs API to capture the active tab's context—URL, title, and optionally DOM elements or selected text. This browser context is packaged with the user's prompt into a JSON message and sent to the background script via browser.runtime.sendMessage(). The background script maintains a persistent connection to the native messaging host through browser.runtime.connectNative(), which Firefox automatically spawns if not already running.

​

The native host receives the message through stdin, deserializes it from the length-prefixed JSON format, and checks if the OpenCode server is running by attempting a connection to http://127.0.0.1:4096. If the server isn't running, the host spawns it using subprocess.Popen(['opencode', 'serve', '--port', '4096']). The host then forwards the request to OpenCode's /tui endpoint via HTTP POST, including both the user's prompt and the browser context as metadata.

​

OpenCode receives the request and processes it through its AI pipeline. The browser context can be intercepted by custom plugins using hooks like onContextPrime or tool.execute.before. These plugins inject the browser-specific information into the AI's context window, enabling OpenCode to generate responses that are aware of the current web page. For example, if the user is on a GitHub repository page and asks "analyze this code structure," the plugin ensures the DOM context containing the repository information is available to the AI.

​

OpenCode's response—whether code snippets, explanations, or actionable suggestions—flows back through the same channel: HTTP response to native host, serialized to length-prefixed JSON on stdout, received by the extension's background script through the port.onMessage listener, and finally displayed in the popup UI via another browser.runtime.sendMessage() to update the interface.

​
Extensibility Through Plugins

OpenCode's plugin system is the key to customizing behavior for browser-specific use cases. Plugins are TypeScript or JavaScript modules placed in .opencode/plugin/ (project-level) or ~/.config/opencode/plugin/ (user-level) that automatically load when OpenCode starts. Each plugin exports hooks that subscribe to lifecycle events: session.created when a new coding session begins, file.edited when OpenCode modifies a file, tool.execute.before and tool.execute.after for intercepting tool calls, and many others.

​

For browser integration, a custom plugin might implement onContextPrime to inject extracted DOM information, current URL, or page metadata before the AI processes each request. The plugin receives rich context including the current project path, an OpenCode SDK client for programmatic AI interactions, and Bun's shell API for executing system commands. This allows sophisticated behaviors like automatically extracting form schemas from web pages, analyzing CSS styles, or capturing network requests visible in the browser's developer tools.

​

Plugins can also define custom tools using Zod schemas that become available to OpenCode's AI agent. For instance, a browser_navigate tool could instruct the extension to change tabs or follow links, or a extract_table_data tool could parse HTML tables and return structured JSON. These tools execute with custom permission boundaries, preventing unauthorized file system access while enabling browser-specific operations.

​
MCP Server Integration

The Model Context Protocol (MCP) provides another extensibility layer. OpenCode natively supports connecting to local and remote MCP servers, which expose tools and resources that the AI can utilize. For browser automation, you might integrate MCP servers that understand web accessibility trees, provide Playwright-like browser control, or interface with web APIs. These servers are configured in ~/.config/opencode/opencode.json with command and arguments specifications, and OpenCode automatically makes their tools available to the LLM during inference.

​

MCP servers run as separate processes communicating via JSON-RPC, providing isolation and the ability to use any programming language. A browser-focused MCP server could expose tools like click_element, fill_form, or screenshot_region that the AI invokes when users request browser automation tasks. The native messaging host could forward these tool execution results back to the extension for actual DOM manipulation.

​
Specialized Agent Architecture

For advanced use cases, you can implement specialized agents within OpenCode. Instead of a single general-purpose agent handling all requests, you create focused agents with specific roles: a page_analyzer that examines web page structure, a code_extractor that pulls code snippets from documentation sites, or a form_assistant that helps fill complex web forms. Each agent has a custom system prompt optimized for its task, whitelisted tools relevant to its domain, and programmatically loaded context.

​

The native messaging host can route different types of user requests to appropriate agents by analyzing the prompt or browser context. For example, if the user is on a form-heavy page and asks for help completing it, route to the form_assistant agent. If they're viewing source code on GitHub and request a refactoring suggestion, route to the code_extractor and refactoring_specialist agents in sequence. This multi-agent approach maintains focused, efficient prompts while enabling complex workflows.

​
Technical Implementation Details

The native messaging manifest is a critical component that Firefox uses to locate and validate the native host. This JSON file must specify the absolute path to the executable, the communication type (always stdio for browser extensions), and the exact extension ID in allowed_extensions. On Linux and macOS, the manifest lives in ~/.mozilla/native-messaging-hosts/, while Windows requires registry entries. Any mismatch in extension IDs or incorrect paths causes immediate connection failures with cryptic error messages.

​

The binary protocol for native messaging is strict: every message must start with a 4-byte unsigned integer (little-endian) indicating the UTF-8 JSON payload length, followed immediately by the JSON bytes. Responses follow the same format. Newlines, additional whitespace, or attempting to send raw JSON without the length prefix breaks communication silently. Python's struct.pack('=I', length) and JavaScript's Buffer APIs handle this encoding correctly.

​

Process management in the native host requires care. The host should check if OpenCode is already running (via port availability tests or PID tracking) before spawning new instances to avoid resource conflicts. When the extension unloads or Firefox closes, the native host receives EOF on stdin and should gracefully terminate the OpenCode server process. Zombie processes occur if cleanup isn't implemented properly.

​

Security considerations include CORS configuration for OpenCode server if accessing from web contexts beyond localhost, though the native messaging architecture keeps everything local. OpenCode binds to 127.0.0.1 by default, preventing remote access, but you can configure alternative hostnames with --hostname flag. The native host should validate all messages from the extension before forwarding to OpenCode to prevent injection attacks.

​
Development Workflow

Development begins by installing web-ext, Firefox's official extension development tool that provides hot-reloading, validation, and packaging capabilities. Running web-ext run launches a temporary Firefox instance with your extension pre-loaded, development console open, and automatic reloading on file changes. The web-ext lint command validates your manifest and code against WebExtension standards before distribution.

​

Testing the native messaging layer separately is crucial. You can manually test the host by echoing JSON to stdin: echo '{"prompt":"test"}' | python native_host.py and verifying proper length-prefixed output

​. Browser console logging in the extension's background script reveals connection states and message flow. OpenCode server logs (configurable via environment variables) show received requests and AI interactions.

Debugging native messaging issues often involves checking Firefox's Browser Console (Ctrl+Shift+J) for native messaging errors, verifying manifest paths are absolute (not relative), ensuring the native host script has execute permissions on Unix systems, and confirming the extension ID matches exactly between manifest.json and the native manifest.

​
Use Cases and Benefits

This architecture enables powerful browser-based development workflows. A user browsing API documentation can highlight an endpoint, click the extension, and ask "generate a TypeScript client for this API" with OpenCode having full context of the documentation page structure. On GitHub, selecting a code snippet and requesting "explain this algorithm" provides instant analysis. When encountering errors on Stack Overflow, the extension can extract the problem and suggest solutions based on your local codebase that OpenCode already understands.

The system maintains privacy since all AI processing happens locally with your own API keys. Browser context is never sent to third-party services—only to the locally-running OpenCode instance. This contrasts with cloud-based coding assistants where your browsing data and code traverse external servers.

​

Performance benefits from local execution include low latency (no network round-trips to cloud AI services), offline functionality (works without internet after models are configured), and unlimited usage (no token limits or subscription tiers). The persistent OpenCode server maintains context across multiple extension interactions within a session, enabling follow-up questions that reference previous responses.

​
Installation Requirements and User Experience

End users must have OpenCode installed locally since the extension cannot bundle or download it automatically. Installation varies by platform: Homebrew on macOS, npm globally on any platform, Chocolatey on Windows, or platform-specific package managers. The native messaging host can detect if OpenCode is missing and display installation instructions through the extension UI.

​

First-time setup requires users to manually copy the native messaging manifest to the correct location or run an install script that automates this. This is similar to how password manager extensions require companion applications. After initial setup, the extension works transparently—clicking the icon, typing a prompt, and receiving results requires no knowledge of the underlying architecture.

​

The user experience mimics integrated AI tools like Comet but with full control over the AI backend. Users choose their preferred LLM provider (OpenAI, Anthropic, local models via Ollama), configure custom plugins for domain-specific behavior, and adjust context window sizes based on their needs. The extension becomes a personal AI coding assistant that understands web context and has direct access to local file systems for implementing suggestions.

​

This OpenCode Browser Agent represents a new paradigm where powerful terminal-based AI tools extend into everyday browsing workflows, maintaining the flexibility and privacy of local execution while providing the convenience of browser-integrated interfaces

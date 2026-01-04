import type { Plugin } from "@opencode-ai/plugin";
import type { AgentConfig } from "@opencode-ai/sdk";
import { createBrowserContext } from "./context/browser-context";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

// Resolve MCP server path robustly using ESM-compatible method
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mcpServerPath = join(__dirname, "..", "mcp-servers", "playwright", "index.js");

/**
 * Browser Agent configuration
 */
export const browserAgent = {
  name: "browser-agent",
  description: "Browser automation agent - specialized for web browsing, research, form filling, and page analysis",
  systemPrompt: `You are BrowserAgent, an AI assistant specialized in web browsing tasks.

## Your Core Capabilities

### 1. Research & Discovery
- Search across multiple pages and extract key information
- Synthesize findings into actionable insights
- Compare content across different websites

### 2. Browser Automation
- Navigate to URLs
- Click buttons, links, and interactive elements
- Fill forms with user-provided data
- Extract structured data from pages
- Take screenshots for visual verification
- Get full HTML for deep analysis

### 3. Analysis & Recommendations
- Analyze website structure and content
- Identify key information on pages
- Provide actionable recommendations

## Workflow Guidelines

### For Research Tasks
1. Plan which pages to visit based on the research goal
2. Navigate to each page systematically
3. Extract relevant information using appropriate tools
4. Synthesize into a comprehensive response

### For Form Filling Tasks
1. Analyze the form structure
2. Ask the user for any missing required information
3. Fill fields systematically
4. Verify before submitting

### For Action Tasks
1. Understand the desired outcome
2. Break down into steps
3. Execute each step with confirmation for irreversible actions

## Important Rules
- Always confirm before taking irreversible actions
- If a page doesn't load, try alternatives or report the issue
- Use screenshots to verify visual elements when needed
`,
  model: "openrouter/x-ai/grok-4.1-fast",
  temperature: 0.7,
  maxTokens: 4096,
  allowedTools: [
    "mcp__opencode-browser-agent__navigate",
    "mcp__opencode-browser-agent__click",
    "mcp__opencode-browser-agent__click_with_index",
    "mcp__opencode-browser-agent__fill",
    "mcp__opencode-browser-agent__extract",
    "mcp__opencode-browser-agent__screenshot",
    "mcp__opencode-browser-agent__get_html",
    "mcp__opencode-browser-agent__scroll",
    "mcp__opencode-browser-agent__wait",
    "mcp__opencode-browser-agent__get_page_info",
    "mcp__opencode-browser-agent__search",
    "context",
    "read",
    "grep"
  ],
  forbiddenTools: [
    "shell_execute",
    "shell_execute_bat",
    "file_edit",
    "file_write",
    "file_delete",
    "git_commit",
    "git_push",
    "git_pull",
    "git_clone",
    "git_branch",
    "git_checkout"
  ],
  contextLimit: 32000,
  historyLimit: 50
};

/**
 * Load optional user configuration
 */
function loadBrowserAgentConfig(): Record<string, any> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const configPaths = [
    join(homeDir, ".config", "opencode", "browser-agent.json"),
    join(homeDir, ".opencode", "browser-agent.json"),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content);
        console.log(`[Browser Agent] Loaded config from ${configPath}`);
        return parsed;
      }
    } catch (error) {
      console.error(`[Browser Agent] Error loading config from ${configPath}:`, error);
    }
  }

  return {};
}

/**
 * Main plugin export for OpenCode
 * 
 * This plugin injects:
 * - browser-agent: Agent configuration for web browsing
 * - opencode-browser-agent MCP server: Browser automation tools
 * - Browser context injection: URL, title, etc. from Firefox extension
 */
export default async function browserAgentPlugin(options: any): Promise<Plugin> {
  const { context } = options;
  
  // Load optional user config
  const userConfig = loadBrowserAgentConfig();

  // Merge user config with defaults
  const finalAgent = {
    ...browserAgent,
    ...userConfig.browserAgent,
    allowedTools: userConfig.browserAgent?.allowedTools ?? browserAgent.allowedTools,
    forbiddenTools: userConfig.browserAgent?.forbiddenTools ?? browserAgent.forbiddenTools,
  };

  // MCP server configuration - uses unique name to avoid conflicts
  const mcpConfig = {
    name: "opencode-browser-agent",
    command: "bun",
    args: [mcpServerPath],
    enabled: true
  };

  // Browser Context Hooks
  const contextHooks = createBrowserContext(context);

  return {
    name: "opencode-browser-agent",
    
    // Use the 'config' hook to inject the agent and MCP server
    config: async (config: any) => {
      // Inject browser-agent into the agent list
      if (!config.agent) {
        config.agent = {};
      }
      config.agent["browser-agent"] = finalAgent as unknown as AgentConfig;
      
      // Inject MCP server into the mcp list - use unique key
      if (!config.mcp) {
        config.mcp = {};
      }
      config.mcp["opencode-browser-agent"] = mcpConfig;
    },

    // Return hooks for context injection
    ...contextHooks
  };
}

// Export individual components for advanced usage
export { createBrowserContext } from "./context/browser-context";

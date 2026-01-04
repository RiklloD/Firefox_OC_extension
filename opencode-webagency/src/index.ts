import type { Plugin } from "@opencode-ai/plugin";
import type { AgentConfig } from "@opencode-ai/sdk";
import { webagent } from "./agents/webagent";
import { createBrowserContext } from "./context/browser-context";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

// Resolve MCP server path robustly using ESM-compatible method
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mcpServerPath = join(__dirname, "../mcp-servers/webagency-browser-bun/index.ts");

interface WebAgencyConfig {
  webagent?: Partial<typeof webagent>;
}

function loadWebAgencyConfig(): WebAgencyConfig {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const configPaths = [
    join(homeDir, ".config", "opencode", "webagency.json"),
    join(homeDir, ".opencode", "webagency.json"),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content);
        console.log(`[WebAgency] Loaded config from ${configPath}`);
        return parsed;
      }
    } catch (error) {
      console.error(`[WebAgency] Error loading config from ${configPath}:`, error);
    }
  }

  return {};
}

export default async function(options: any): Promise<Plugin> {
  const { context } = options;
  
  // Load config from file at runtime
  const userConfig = loadWebAgencyConfig();

  // Merge user config with defaults
  const finalWebAgent = {
    ...webagent,
    ...userConfig.webagent,
    allowedTools: userConfig.webagent?.allowedTools ?? webagent.allowedTools,
    forbiddenTools: userConfig.webagent?.forbiddenTools ?? webagent.forbiddenTools,
  };

  const mcpConfig = {
    name: "webagency-playwright",
    command: "bun",
    args: [mcpServerPath],
    enabled: true
  };

  // Browser Context Hooks
  const contextHooks = createBrowserContext(context);

  return {
    name: "opencode-webagency",
    
    // Use the 'config' hook to inject the agent
    config: async (config: any) => {
      // Inject webagent into the agent list
      if (!config.agent) {
        config.agent = {};
      }
      config.agent.webagent = finalWebAgent as unknown as AgentConfig;
      
      // Inject MCP server into the mcp list
      if (!config.mcp) {
        config.mcp = {};
      }
      config.mcp["webagency-playwright"] = mcpConfig;
    },

    // Return hooks for context injection
    ...contextHooks
  };
}

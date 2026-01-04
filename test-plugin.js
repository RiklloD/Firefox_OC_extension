// Test script to verify the plugin loads correctly with config file
import plugin from "./opencode-webagency/dist/index.js";

async function test() {
  try {
    console.log("Loading plugin...");
    const pluginInstance = await plugin({ context: {} });
    console.log("✅ Plugin loaded successfully!");
    console.log("Has config hook:", typeof pluginInstance.config === 'function');

    // Test the config hook
    if (pluginInstance.config) {
      const mockConfig = { agent: {}, mcp: {} };
      await pluginInstance.config(mockConfig);
      console.log("✅ Config hook executed successfully!");
      console.log("WebAgent model:", mockConfig.agent.webagent?.model);
      console.log("MCP injected:", 'webagency-playwright' in mockConfig.mcp);
    }
  } catch (error) {
    console.error("❌ Plugin failed to load:", error);
    process.exit(1);
  }
}

test();

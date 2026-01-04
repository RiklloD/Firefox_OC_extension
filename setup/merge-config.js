const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to user's config
const configPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');

// Path to our MCP server
// In Bun, process.argv[2] is the first argument
const mcpPath = process.argv[2];

if (!mcpPath) {
  console.error('Usage: bun run merge-config.js <path-to-mcp-index.ts>');
  process.exit(1);
}

// Ensure directory exists
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Load existing config or start fresh
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Loaded existing configuration.');
  } catch (e) {
    console.error('Error reading existing config, starting fresh:', e.message);
  }
} else {
  console.log('No existing configuration found. Creating new.');
}

// Ensure structure exists
if (!config.mcp) config.mcp = {};
if (!config.mcp.servers) config.mcp.servers = {}; // Support newer structure if needed
// Or if the user's config structure is flat under "mcp" (like in the example provided)
// The user's provided config showed: "mcp": { "zread": {...}, "blender": {...} }
// So we should add directly to config.mcp if it's an object of servers

// Check schema of existing mcp block
// If config.mcp has a "servers" key, use it. If not, assume config.mcp IS the map of servers.
let serversObj = config.mcp;
if (config.mcp.servers) {
    serversObj = config.mcp.servers;
}

// Add our WebAgency server
serversObj['webagency-playwright'] = {
  type: 'local', // Explicitly marking as local based on user's pattern
  command: 'bun',
  args: [mcpPath],
  disabled: false,
  enabled: true // Adding enabled: true based on user's pattern
};

// Write back
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Successfully updated configuration at: ${configPath}`);
} catch (e) {
  console.error('Failed to write configuration:', e.message);
  process.exit(1);
}

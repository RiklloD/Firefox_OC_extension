#!/usr/bin/env node
/**
 * OpenCode Browser Agent Installation Script
 * 
 * This script installs the opencode-browser-agent package and sets up
 * the MCP server for browser automation.
 * 
 * It is designed to NOT conflict with existing OpenCode configuration.
 * Instead of modifying ~/.config/opencode/opencode.json directly, it uses
 * the plugin system which is the proper way to extend OpenCode.
 * 
 * Usage:
 *   npx opencode-browser-agent install
 *   bun run bin/install.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_NAME = 'opencode-browser-agent';
const MCP_SERVER_DIR = 'mcp-servers/playwright';

function log(message, type = 'info') {
  const prefix = {
    info: '[INFO]',
    ok: '[OK]',
    error: '[ERROR]',
    warn: '[WARN]',
  }[type] || '[INFO]';
  console.log(`${prefix} ${message}`);
}

function getPackageDir() {
  // Get the directory where this package is installed
  // For local development, use __dirname (parent of bin)
  // For installed package, resolve from the package root
  
  // Check if we're in a development environment (package.json exists in parent)
  const parentDir = path.dirname(__dirname);
  const parentPackageJson = path.join(parentDir, 'package.json');
  
  if (fs.existsSync(parentPackageJson)) {
    return parentDir;
  }
  
  // For installed package, resolve from index.js or package.json
  try {
    const packagePath = require.resolve(PACKAGE_NAME + '/package.json');
    return path.dirname(packagePath);
  } catch (e) {
    // Last resort: use __dirname
    return __dirname;
  }
}

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`, 'info');
  }
}

function installDependencies() {
  log('Installing MCP server dependencies...', 'info');
  
  const packageDir = getPackageDir();
  const mcpServerPath = path.join(packageDir, MCP_SERVER_DIR);
  
  // Check if MCP server exists in the package
  if (!fs.existsSync(mcpServerPath)) {
    log(`MCP server not found at: ${mcpServerPath}`, 'error');
    log('Please ensure the package is properly installed', 'error');
    process.exit(1);
  }
  
  // Install MCP server dependencies
  try {
    execSync('bun install', {
      cwd: mcpServerPath,
      stdio: 'inherit',
    });
    log('Dependencies installed successfully', 'ok');
  } catch (error) {
    log(`Failed to install dependencies: ${error.message}`, 'error');
    process.exit(1);
  }
}

function createConfigFile() {
  log('Creating default configuration file...', 'info');
  
  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, '.config', 'opencode');
  const configPath = path.join(configDir, 'browser-agent.json');
  
  ensureDir(configDir);
  
  const defaultConfig = {
    browserAgent: {
      // Custom agent configuration can be added here
      // Example:
      // model: "gpt-4",
      // temperature: 0.7,
      // allowedTools: [...],
    }
  };
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log(`Created config: ${configPath}`, 'ok');
    log('You can customize the agent in this file', 'info');
  } catch (error) {
    log(`Failed to create config: ${error.message}`, 'error');
  }
}

function printInstructions() {
  console.log('');
  console.log('==============================================');
  console.log('OpenCode Browser Agent - Installation Complete!');
  console.log('==============================================');
  console.log('');
  console.log('USAGE:');
  console.log('');
  console.log('1. Use the browser-agent in OpenCode:');
  console.log('   Select "browser-agent" when starting a session');
  console.log('');
  console.log('2. With Firefox Extension:');
  console.log('   - Load the Firefox extension');
  console.log('   - The extension will inject browser context');
  console.log('');
  console.log('3. MCP Server (Browser Automation):');
  console.log('   The MCP server is bundled and will be used');
  console.log('   automatically when the agent is active.');
  console.log('');
  console.log('TOOLS AVAILABLE:');
  console.log('   - navigate(url): Go to a URL');
  console.log('   - click(selector): Click an element');
  console.log('   - fill(selector, value): Fill a form field');
  console.log('   - extract(selector): Extract page content');
  console.log('   - screenshot(filename): Take a screenshot');
  console.log('   - scroll(direction): Scroll the page');
  console.log('   - get_page_info(): Get current page info');
  console.log('');
  console.log('For more information, see:');
  console.log('   https://github.com/code-yeongyu/opencode-browser-agent');
  console.log('');
}

function main() {
  console.log('');
  console.log('==============================================');
  console.log('OpenCode Browser Agent - Installation');
  console.log('==============================================');
  console.log('');
  
  // Install MCP dependencies
  installDependencies();
  
  // Create default config file
  createConfigFile();
  
  // Print usage instructions
  printInstructions();
}

main();

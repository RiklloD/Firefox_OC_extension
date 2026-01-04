/**
 * WebAgency MCP Server - Bun Version
 *
 * Model Context Protocol server for browser automation.
 * Provides tools for navigation, interaction, extraction, and analysis.
 *
 * Requirements:
 * - Bun 1.0+
 * - bun add @modelcontextprotocol/sdk playwright
 *
 * Usage:
 *   bun install
 *   bun run index.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

const SERVER_NAME = "webagency-browser";
const SERVER_VERSION = "1.0.0";

// MCP Server instance
const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

// Browser state
let browser = null;
let page = null;

/**
 * Initialize browser if not already running
 */
async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: false, // Set to true for headless mode
    });
  }

  if (!page || page.isClosed()) {
    const context = await browser.newContext();
    page = await context.newPage();
  }

  return page;
}

/**
 * Clean up browser resources
 */
async function cleanup() {
  if (page) {
    await page.close();
    page = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// =========================================
// Tool Implementations
// =========================================

async function navigateTo(url) {
  const p = await ensureBrowser();
  await p.goto(url, { waitUntil: "domcontentloaded" });
  const title = p.title();
  return `Navigated to: ${url}\nPage title: ${title}`;
}

async function clickElement(selector, index = 0) {
  const p = await ensureBrowser();
  
  const elements = await p.locator(selector).all();
  
  if (elements.length === 0) {
    throw new Error(`No elements found matching selector: ${selector}`);
  }

  if (index >= elements.length) {
    throw new Error(
      `Index ${index} out of range. Found ${elements.length} elements.`
    );
  }

  await elements[index].click();
  return `Clicked element at index ${index} with selector: ${selector}`;
}

async function clickWithIndex(index, selector = null) {
  const p = await ensureBrowser();
  
  if (selector) {
    return clickElement(selector, index);
  }
  
  const elements = await p.locator("a, button, [role='button'], input, select").all();
  
  if (index >= elements.length) {
    throw new Error(
      `Index ${index} out of range. Found ${elements.length} clickable elements.`
    );
  }

  await elements[index].click();
  return `Clicked clickable element at index ${index}`;
}

async function fillForm(selector, value) {
  const p = await ensureBrowser();
  const element = p.locator(selector);
  await element.fill(value);
  return `Filled ${selector} with: "${value}"`;
}

async function extractContent(selector = null) {
  const p = await ensureBrowser();
  
  if (selector) {
    const elements = await p.locator(selector).all();
    
    if (elements.length === 0) {
      return `No elements found matching selector: ${selector}`;
    }

    const contents = await Promise.all(elements.map((el) => el.textContent()));
    return contents.filter((c) => c !== null).join("\n---\n");
  }

  return await p.evaluate(() => document.body.innerText);
}

async function getPageHtml() {
  const p = await ensureBrowser();
  return await p.content();
}

async function takeScreenshot(filename = null) {
  const p = await ensureBrowser();
  const screenshotPath = filename || `screenshot-${Date.now()}.png`;
  await p.screenshot({ path: screenshotPath });
  return `Screenshot saved to: ${screenshotPath}`;
}

async function scrollPage(direction) {
  const p = await ensureBrowser();
  
  switch (direction) {
    case "up":
      await p.evaluate(() => window.scrollBy(0, -window.innerHeight));
      return "Scrolled up one page";
    case "down":
      await p.evaluate(() => window.scrollBy(0, window.innerHeight));
      return "Scrolled down one page";
    case "top":
      await p.evaluate(() => window.scrollTo(0, 0));
      return "Scrolled to top";
    case "bottom":
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return "Scrolled to bottom";
    default:
      return `Unknown direction: ${direction}`;
  }
}

async function waitSeconds(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  return `Waited for ${seconds} second(s)`;
}

async function getPageInfo() {
  const p = await ensureBrowser();
  const url = p.url();
  const title = p.title();
  
  return `Current Page:\nURL: ${url}\nTitle: ${title}`;
}

async function searchPage(text) {
  const p = await ensureBrowser();
  
  const count = await p.evaluate((searchText) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    let foundCount = 0;
    
    while ((node = walker.nextNode())) {
      if (node.textContent?.toLowerCase().includes(searchText.toLowerCase())) {
        foundCount++;
      }
    }
    
    return foundCount;
  }, text);

  return `Found "${text}" ${count} time(s) on the page`;
}

// =========================================
// Tool Registration
// =========================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "navigate",
        description: "Navigate to a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to navigate to" },
          },
          required: ["url"],
        },
      },
      {
        name: "click",
        description: "Click an element by CSS selector",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the element" },
            index: { type: "number", description: "Index if selector matches multiple" },
          },
          required: ["selector"],
        },
      },
      {
        name: "click_with_index",
        description: "Click an element by its index in clickable elements",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "Index of clickable element (0-based)" },
            selector: { type: "string", description: "Optional CSS selector to narrow down" },
          },
          required: ["index"],
        },
      },
      {
        name: "fill",
        description: "Fill a form field with a value",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the input field" },
            value: { type: "string", description: "Value to fill" },
          },
          required: ["selector", "value"],
        },
      },
      {
        name: "extract",
        description: "Extract content from the page",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Optional CSS selector" },
          },
        },
      },
      {
        name: "get_html",
        description: "Get the full HTML content of the page",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "screenshot",
        description: "Take a screenshot of the current page",
        inputSchema: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Optional filename" },
          },
        },
      },
      {
        name: "scroll",
        description: "Scroll the page",
        inputSchema: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["up", "down", "top", "bottom"] },
          },
          required: ["direction"],
        },
      },
      {
        name: "wait",
        description: "Wait for a specified number of seconds",
        inputSchema: {
          type: "object",
          properties: {
            seconds: { type: "number", description: "Seconds to wait" },
          },
          required: ["seconds"],
        },
      },
      {
        name: "get_page_info",
        description: "Get information about the current page",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "search",
        description: "Search for text on the current page",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to search for" },
          },
          required: ["text"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "navigate":
        result = await navigateTo(args.url);
        break;
      case "click":
        result = await clickElement(args.selector, args.index);
        break;
      case "click_with_index":
        result = await clickWithIndex(args.index, args.selector);
        break;
      case "fill":
        result = await fillForm(args.selector, args.value);
        break;
      case "extract":
        result = await extractContent(args.selector);
        break;
      case "get_html":
        result = await getPageHtml();
        break;
      case "screenshot":
        result = await takeScreenshot(args.filename);
        break;
      case "scroll":
        result = await scrollPage(args.direction);
        break;
      case "wait":
        result = await waitSeconds(args.seconds);
        break;
      case "get_page_info":
        result = await getPageInfo();
        break;
      case "search":
        result = await searchPage(args.text);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// =========================================
// Server Lifecycle
// =========================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("WebAgency MCP Server started");

  // Cleanup hook: ensure browser is closed if OpenCode crashes/exits
  process.on("exit", async () => {
    await cleanup();
  });

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

/**
 * WebAgency Context Plugin
 *
 * This plugin injects browser context information into OpenCode's AI context
 * when requests come from the Firefox extension. It enables WebAgent to:
 * - Understand the current page URL and title
 * - Access timestamp of the request
 * - Handle browser-specific commands and queries
 *
 * Installation:
 *   Copy this file to ~/.config/opencode/plugin/ or .opencode/plugin/ in your project
 */

// Plugin metadata
const PLUGIN_INFO = {
  name: 'webagency-context',
  version: '1.0.0',
  description: 'WebAgency browser context injection plugin',
  author: 'Rikllo',
};

/**
 * WebAgency context plugin factory
 * @param {Object} options - Plugin options
 * @param {Object} options.client - OpenCode SDK client
 * @param {Object} options.$ - Bun shell API
 * @param {Object} options.context - Request context
 */
export default function webagencyPlugin({ client, $, context }) {
  // Extract browser context from the incoming request
  const browserContext = context?.browserContext || {};
  const currentUrl = browserContext.url || '';
  const pageTitle = browserContext.title || '';
  const timestamp = browserContext.timestamp || '';

  /**
   * Format browser context for AI injection
   * @returns {string} Formatted context string
   */
  function formatBrowserContext() {
    const parts = [];

    if (pageTitle) {
      parts.push(`Page Title: ${pageTitle}`);
    }

    if (currentUrl) {
      parts.push(`Current URL: ${currentUrl}`);
    }

    if (timestamp) {
      const date = new Date(timestamp);
      parts.push(`Captured At: ${date.toLocaleString()}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `\n\n${parts.join('\n')}`;
  }

  /**
   * Check if this is a web-related query
   * @param {string} prompt - User prompt
   * @returns {boolean}
   */
  function isWebQuery(prompt) {
    const webPatterns = [
      /this\s*page/i,
      /current\s*page/i,
      /current\s*website/i,
      /this\s*website/i,
      /this\s*site/i,
      /the\s*page/i,
      /analyze\s*(?:this|web|html)/i,
      /extract/i,
      /navigate/i,
      /go\s*to/i,
      /visit/i,
      /search/i,
      /browse/i,
      /click/i,
      /fill/i,
      /form/i,
      /research/i,
      /competitor/i,
      /pricing/i,
      /service/i,
      /extract/i,
      /scrape/i,
    ];

    return webPatterns.some((pattern) => pattern.test(prompt));
  }

  return {
    // Called when a new session is created
    'session.created': async (event) => {
      console.log('[WebAgency] Session created');
      console.log('[WebAgency] Current URL:', currentUrl || 'No active page');
      console.log('[WebAgency] Using WebAgent for web browsing tasks');
    },

    // Called before each tool execution - inject context here
    'tool.execute.before': async (event) => {
      // Only inject context if there's browser context available
      if (!currentUrl && !pageTitle) {
        return;
      }

      // Check if we should inject context based on the prompt
      const prompt = event.prompt || event.args?.[0] || '';
      if (!prompt) {
        return;
      }

      // For web-related queries, inject the browser context
      if (isWebQuery(prompt)) {
        const browserContextStr = formatBrowserContext();
        if (browserContextStr) {
          // Modify the event to include browser context
          return {
            context: {
              ...event.context,
              browserContext: browserContextStr,
            },
          };
        }
      }
    },

    // Called after tool execution - useful for logging
    'tool.execute.after': async (event) => {
      // Could be used for logging or post-processing
    },

    // Called when the context is being primed for AI processing
    'context.prime': async (event) => {
      const browserContextStr = formatBrowserContext();

      // Add browser-specific system instructions for web tasks
      if (browserContextStr) {
        return {
          systemPrompt: event.systemPrompt
            ? `${event.systemPrompt}\n\n--- BROWSER CONTEXT ---\n${browserContextStr}\n\nYou are currently working in a web browsing context. Use the browser tools available to you (navigate, click, fill, extract, screenshot) to accomplish the user's request.\nFor research tasks, be thorough and check multiple pages.\nFor form tasks, ensure all required fields are filled before submitting.\nFor action tasks, confirm with the user before irreversible actions.`
            : `You are WebAgent, a powerful AI web browsing assistant.\n\n--- BROWSER CONTEXT ---\n${browserContextStr}\n\nYou are currently working in a web browsing context. Use the browser tools available to you (navigate, click, fill, extract, screenshot) to accomplish the user's request.\nFor research tasks, be thorough and check multiple pages.\nFor form tasks, ensure all required fields are filled before submitting.\nFor action tasks, confirm with the user before irreversible actions.`,
        };
      }

      // No browser context, still add web browsing guidance
      return {
        systemPrompt: event.systemPrompt
          ? `${event.systemPrompt}\n\nYou are currently working in a web browsing context. Use browser tools to accomplish the user's request.`
          : `You are WebAgent, a powerful AI web browsing assistant.\n\nYou are currently working in a web browsing context. Use browser tools to accomplish the user's request.`,
      };
    },

    // Handle custom browser commands
    'command.execute': async (event) => {
      const command = event.command;
      const args = event.args || [];

      // Handle browser-specific commands
      if (command === 'navigate' || command === 'goto') {
        return {
          result: 'Navigation commands are handled via MCP Playwright tools. Use navigate() tool.',
          hint: 'Use mcp__webagency-playwright__navigate tool',
        };
      }

      if (command === 'extract-page-info') {
        return {
          url: currentUrl,
          title: pageTitle,
          hasContext: !!currentUrl,
        };
      }

      if (command === 'get-context') {
        return {
          browserContext: formatBrowserContext(),
        };
      }

      return { handled: false };
    },
  };
}

// Export plugin info for debugging
export { PLUGIN_INFO };

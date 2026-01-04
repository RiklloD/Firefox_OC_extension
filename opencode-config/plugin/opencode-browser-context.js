/**
 * OpenCode Browser Context Plugin
 *
 * This plugin injects browser context information into OpenCode's AI context
 * when requests come from the Firefox extension. It enables OpenCode to:
 * - Understand the current page URL and title
 * - Access selected text from web pages
 * - Handle browser-specific commands and queries
 *
 * Installation:
 *   Copy this file to ~/.config/opencode/plugin/ or .opencode/plugin/ in your project
 */

// Plugin metadata
const PLUGIN_INFO = {
  name: 'opencode-browser-context',
  version: '1.0.0',
  description: 'Browser context injection plugin for OpenCode Browser Agent',
  author: 'OpenCode Team',
};

/**
 * Browser context plugin factory
 * @param {Object} options - Plugin options
 * @param {Object} options.client - OpenCode SDK client
 * @param {Object} options.$ - Bun shell API
 * @param {Object} options.context - Request context
 */
export default function browserContextPlugin({ client, $, context }) {
  // Extract browser context from the incoming request
  const browserContext = context?.browserContext || {};
  const currentUrl = browserContext.url || '';
  const pageTitle = browserContext.title || '';
  const userAgent = browserContext.userAgent || '';

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

    if (parts.length === 0) {
      return '';
    }

    return `\n\n${parts.join('\n')}`;
  }

  /**
   * Check if this appears to be a GitHub-related query
   * @param {string} prompt - User prompt
   * @returns {boolean}
   */
  function isGitHubQuery(prompt) {
    const githubPatterns = [
      /github/i,
      /repo(?:sitory)?/i,
      /pull\s*request/i,
      /commit/i,
      /issue/i,
      /github\.com/i,
    ];

    return githubPatterns.some((pattern) => pattern.test(prompt));
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
      /this\s*website/i,
      /this\s*site/i,
      /the\s*page/i,
      /analyze\s*(?:this|web|html)/i,
      /extract/i,
    ];

    return webPatterns.some((pattern) => pattern.test(prompt));
  }

  return {
    // Called when a new session is created
    'session.created': async (event) => {
      console.log('[Browser Context] Session created with browser plugin');
      console.log('[Browser Context] Current URL:', currentUrl || 'No active page');
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
      if (isWebQuery(prompt) || isGitHubQuery(prompt)) {
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
      // Add browser-specific system instructions
      const browserContextStr = formatBrowserContext();

      if (browserContextStr) {
        return {
          systemPrompt: event.systemPrompt
            ? `${event.systemPrompt}\n\n${browserContextStr}`
            : `You are OpenCode, a powerful AI coding assistant.\n\nBrowser Context:${browserContextStr}`,
        };
      }
    },

    // Handle custom browser commands
    'command.execute': async (event) => {
      const command = event.command;
      const args = event.args || [];

      // Handle browser-specific commands
      if (command === 'navigate') {
        // This would require MCP or browser automation integration
        return {
          result: 'Navigation commands require browser automation MCP server',
          requiresMCP: true,
        };
      }

      if (command === 'extract-page-info') {
        return {
          url: currentUrl,
          title: pageTitle,
          hasContext: !!currentUrl,
        };
      }

      return { handled: false };
    },
  };
}

// Export plugin info for debugging
export { PLUGIN_INFO };

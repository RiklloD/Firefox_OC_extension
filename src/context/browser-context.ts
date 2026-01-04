/**
 * Browser Context Module
 * 
 * Handles injection of browser context (URL, title, etc.) from the Firefox extension
 * into OpenCode's AI context.
 */

/**
 * Create browser context hooks
 * @param context - OpenCode request context containing browserContext
 */
export function createBrowserContext(context: any) {
  // Extract browser context from the incoming request
  const browserContext = context?.browserContext || {};
  const currentUrl = browserContext.url || '';
  const pageTitle = browserContext.title || '';
  const timestamp = browserContext.timestamp || '';

  /**
   * Format browser context for AI injection
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
   * Check if this appears to be a GitHub-related query
   */
  function isGitHubQuery(prompt: string) {
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
   */
  function isWebQuery(prompt: string) {
    const webPatterns = [
      /this\s*page/i,
      /current\s*page/i,
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
    ];

    return webPatterns.some((pattern) => pattern.test(prompt));
  }

  return {
    /**
     * Called when a new session is created
     */
    'session.created': async () => {
      console.log('[Browser Agent] Session created with browser plugin');
      console.log('[Browser Agent] Current URL:', currentUrl || 'No active page');
    },

    /**
     * Called before each tool execution - inject context here
     */
    'tool.execute.before': async (event: any) => {
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

    /**
     * Called after tool execution
     */
    'tool.execute.after': async () => {
      // Could be used for logging or post-processing
    },

    /**
     * Called when the context is being primed for AI processing
     */
    'context.prime': async (event: any) => {
      // Add browser-specific system instructions
      const browserContextStr = formatBrowserContext();

      if (browserContextStr) {
        return {
          systemPrompt: event.systemPrompt
            ? `${event.systemPrompt}\n\n--- BROWSER CONTEXT ---${browserContextStr}`
            : `You are OpenCode, a powerful AI coding assistant.\n\n--- BROWSER CONTEXT ---${browserContextStr}\n\nYou are currently working in a web browsing context. Use browser tools to accomplish the user's request.`,
        };
      }

      // No browser context, still add web browsing guidance
      return {
        systemPrompt: event.systemPrompt
          ? `${event.systemPrompt}\n\nYou are currently working in a web browsing context.`
          : `You are OpenCode, a powerful AI coding assistant.\n\nYou are currently working in a web browsing context.`,
      };
    },

    /**
     * Handle custom browser commands
     */
    'command.execute': async (event: any) => {
      const command = event.command;

      // Handle browser-specific commands
      if (command === 'navigate' || command === 'goto') {
        return {
          result: 'Navigation commands are handled via MCP browser tools.',
          hint: 'Use mcp__opencode-browser-agent__navigate tool',
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

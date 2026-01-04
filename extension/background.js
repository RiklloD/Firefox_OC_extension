/**
 * OpenCode Browser Agent - Background Service Worker (WebAgency Edition)
 *
 * This service worker manages the native messaging connection between
 * the Firefox extension and the OpenCode AI server. It handles:
 * - Native host connection lifecycle
 * - Message routing between popup and native host
 * - Error handling and reconnection logic
 * - Tab context collection for AI prompts
 * - Agent routing to specialized WebAgent for web browsing tasks
 *
 * WebAgent Capabilities:
 * - Research across multiple pages (5-10+ pages)
 * - Browser automation (click, fill, navigate)
 * - Data extraction and analysis
 * - Form filling and web actions
 */

// Native messaging port reference
let nativePort = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1000;

// Track pending requests to forward responses to specific tabs
const pendingRequests = new Map();
let requestIdCounter = 0;

/**
 * Connect to the native messaging host
 * @returns {boolean} True if connection successful
 */
function connectToNativeHost() {
  try {
    // Close existing connection if any
    if (nativePort) {
      nativePort.disconnect();
    }

    // Attempt new connection
    nativePort = browser.runtime.connectNative("opencode_agent");

    // Set up message listener
    nativePort.onMessage.addListener(handleNativeMessage);

    // Handle disconnection
    nativePort.onDisconnect.addListener(handleNativeDisconnect);

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;

    console.log("[OpenCode Agent] Connected to native host");
    return true;

  } catch (error) {
    console.error("[OpenCode Agent] Failed to connect to native host:", error);
    return false;
  }
}

/**
 * Handle incoming messages from the native host
 * @param {Object} message - The message from native host
 */
function handleNativeMessage(message) {
  console.log("[OpenCode Agent] Received from native host:", message);

  // Handle streaming events - forward to sidebar without creating invalid opencode_response
  if (message.type === "stream_event") {
    const { event, requestId } = message;
    if (requestId !== undefined && pendingRequests.has(requestId)) {
      const request = pendingRequests.get(requestId);
      browser.tabs.sendMessage(request.tabId, {
        type: "streaming_event",
        event: event,
      }).catch(() => {
        // Fallback if tab is closed
      });
    }
    return;
  }

  // Handle stream completion
  if (message.type === "stream_complete") {
    const { requestId } = message;
    if (requestId !== undefined) {
      pendingRequests.delete(requestId);
    }
    return;
  }

  // Check if this is a response to a pending request
  if (message.requestId && pendingRequests.has(message.requestId)) {
    const request = pendingRequests.get(message.requestId);
    pendingRequests.delete(message.requestId);

    // Forward response to the specific sidebar tab
    const responseMessage = {
      type: "opencode_response",
      success: message.success,
      data: message.data || null,
      error: message.error || null,
      details: message.details || null,
      troubleshooting: message.troubleshooting || null,
    };

    // Try to send to specific tab first, then fallback to broadcast
    if (request.tabId !== undefined) {
      browser.tabs.sendMessage(request.tabId, responseMessage).catch(() => {
        // Fallback to broadcast if tab-specific fails
        browser.runtime.sendMessage(responseMessage).catch(() => {});
      });
    } else {
      browser.runtime.sendMessage(responseMessage).catch(() => {});
    }
    return;
  }

  // Legacy: broadcast for backwards compatibility (only for actual responses, not streaming events)
  if (message.type !== "stream_event" && message.type !== "stream_complete") {
    browser.runtime.sendMessage({
      type: "opencode_response",
      success: message.success,
      data: message.data || null,
      error: message.error || null,
      details: message.details || null,
      troubleshooting: message.troubleshooting || null,
    }).catch((error) => {
      console.log("[OpenCode Agent] Could not send response to popup (may be closed):", error.message);
    });
  }
}

/**
 * Handle native host disconnection
 */
function handleNativeDisconnect() {
  console.warn(
    "[OpenCode Agent] Native host disconnected:",
    browser.runtime.lastError?.message || "Unknown error"
  );

  nativePort = null;

  // Attempt reconnection
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(
      `[OpenCode Agent] Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`
    );

    setTimeout(() => {
      if (!nativePort) {
        connectToNativeHost();
      }
    }, RECONNECT_DELAY_MS);
  } else {
    console.error(
      "[OpenCode Agent] Max reconnection attempts reached. Please reload the extension."
    );

    // Notify popup about permanent failure
    browser.runtime.sendMessage({
      type: "opencode_response",
      success: false,
      error: "Connection to OpenCode failed. Please reload the extension.",
      troubleshooting: [
        "Check if OpenCode is installed: run 'opencode --version' in terminal",
        "Verify native messaging manifest is installed correctly",
        "Check Firefox browser console for more details",
      ],
    });
  }
}

/**
 * Send a message to the native host
 * @param {Object} message - Message to send
 * @returns {boolean} True if message was sent
 */
function sendToNativeHost(message) {
  if (!nativePort) {
    const connected = connectToNativeHost();
    if (!connected) {
      return false;
    }
  }

  try {
    nativePort.postMessage(message);
    return true;
  } catch (error) {
    console.error("[OpenCode Agent] Failed to send message:", error);
    nativePort = null;
    return false;
  }
}

/**
 * Get current tab context information
 * @returns {Promise<Object>} Tab context with URL, title, etc.
 */
async function getTabContext() {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tabs.length === 0) {
      return { url: "", title: "" };
    }

    const tab = tabs[0];
    return {
      url: tab.url || "",
      title: tab.title || "",
      faviconUrl: tab.favIconUrl || "",
      incognito: tab.incognito,
    };
  } catch (error) {
    console.error("[OpenCode Agent] Failed to get tab context:", error);
    return { url: "", title: "" };
  }
}

// ===========================================
// Message Listeners
// ===========================================

/**
 * Listen for messages from popup script
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ping message (connection check)
  if (message.type === "ping") {
    sendResponse({
      type: "pong",
      connected: nativePort !== null,
    });
    return true;
  }

  // Handle send_to_opencode message
  if (message.type === "send_to_opencode") {
    const requestId = ++requestIdCounter;

    // Store sender info for response forwarding
    pendingRequests.set(requestId, { tabId: sender.tab?.id, frameId: sender.frameId });

    (async () => {
      try {
        // Get current tab context
        const context = await getTabContext();

        // Prepare the message - enable streaming for real-time thinking
        const nativeMessage = {
          requestId: requestId,
          prompt: message.prompt,
          context: {
            ...context,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
          },
          stream: true, // Enable streaming mode for real-time events
        };

        // Send to native host
        const sent = sendToNativeHost(nativeMessage);

        if (!sent) {
          pendingRequests.delete(requestId);
          sendResponse({
            type: "opencode_response",
            success: false,
            error: "Failed to connect to OpenCode. Please try again.",
          });
          return;
        }

        // Acknowledge that request was sent
        sendResponse({
          type: "send_acknowledged",
          requestId: requestId,
          message: "Request sent to OpenCode",
        });
      } catch (error) {
        console.error("[OpenCode Agent] Error processing message:", error);
        pendingRequests.delete(requestId);
        sendResponse({
          type: "opencode_response",
          success: false,
          error: `Error: ${error.message}`,
        });
      }
    })();

    // Keep message channel open for async response
    return true;
  }

  // Handle streaming events from native host
  if (message.type === "stream_event") {
    const { event, requestId } = message;

    // Forward streaming event to the sidebar
    if (requestId !== undefined && pendingRequests.has(requestId)) {
      const request = pendingRequests.get(requestId);

      browser.tabs.sendMessage(request.tabId, {
        type: "streaming_event",
        event: event,
      }).catch(() => {
        // Fallback if tab is closed
      });
    }
    return false;
  }

  // Handle stream completion
  if (message.type === "stream_complete") {
    const { requestId } = message;
    if (requestId !== undefined) {
      pendingRequests.delete(requestId);
    }
    return false;
  }

  // Handle cancel request
  if (message.type === "cancel_request") {
    // For future: implement request cancellation
    sendResponse({
      type: "cancel_acknowledged",
      message: "Request cancellation noted",
    });
    return true;
  }

  return false;
});

// ===========================================
// Extension Installation
// ===========================================

/**
 * Handle extension installation
 */
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("[OpenCode Agent] Extension installed:", details.reason);

  if (details.reason === "install") {
    console.log(
      "[OpenCode Agent] Thank you for installing! Make sure OpenCode is installed locally."
    );

    // Open sidebar on first install
    setTimeout(() => {
      toggleSidebar();
    }, 1000);
  }
});

/**
 * Open sidebar on startup (optional - comment out if unwanted)
 */
browser.runtime.onStartup.addListener(async () => {
  console.log("[OpenCode Agent] Browser started");

  // Uncomment the next line to auto-open sidebar on browser start:
  // toggleSidebar();
});

// ===========================================
// Command Handler (keyboard shortcuts)
// ===========================================

/**
 * Handle commands from manifest.json
 */
browser.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    toggleSidebar();
  }
});

/**
 * Toggle sidebar open/close
 */
async function toggleSidebar() {
  try {
    console.log("[OpenCode Agent] Attempting to toggle sidebar...");

    // Try sidebar_action API first (Firefox)
    if (browser.sidebarAction) {
      console.log("[OpenCode Agent] Using sidebar_action API");
      const windows = await browser.windows.getCurrent();
      console.log("[OpenCode Agent] Window ID:", windows.id);

      if (browser.sidebarAction.isOpen) {
        const isOpen = await browser.sidebarAction.isOpen({ windowId: windows.id });
        console.log("[OpenCode Agent] Sidebar currently open:", isOpen);

        if (isOpen) {
          await browser.sidebarAction.close();
        } else {
          await browser.sidebarAction.open();
        }
      } else if (browser.sidebarAction.open) {
        await browser.sidebarAction.open();
      }
    }
    // Try sidePanel API (Chrome/modern browsers)
    else if (browser.sidePanel) {
      console.log("[OpenCode Agent] Using sidePanel API");
      const windowId = (await browser.windows.getCurrent()).id;
      await browser.sidePanel.open({ windowId });
    }
    // Fallback: open in new tab
    else {
      console.log("[OpenCode Agent] No sidebar API available, opening in new tab");
      await browser.tabs.create({ url: browser.runtime.getURL("sidebar.html") });
    }
  } catch (error) {
    console.error("[OpenCode Agent] Failed to toggle sidebar:", error);

    // Fallback: open in new tab
    try {
      await browser.tabs.create({ url: browser.runtime.getURL("sidebar.html") });
    } catch (tabError) {
      console.error("[OpenCode Agent] Fallback also failed:", tabError);
    }
  }
}

// ===========================================
// Action Click Handler
// ===========================================

/**
 * Handle toolbar icon click - toggle sidebar
 */
browser.action.onClicked.addListener((tab) => {
  console.log("[OpenCode Agent] Toolbar button clicked");
  
  // Synchronous call to preserve user gesture context
  if (browser.sidebarAction && browser.sidebarAction.open) {
    browser.sidebarAction.open();
  } else {
    // Fallback for other environments
    toggleSidebar();
  }
});

// ===========================================
// Idle Detection (optional, may not be available in all Firefox versions)
// ===========================================

/**
 * Handle extension idle state
 */
if (typeof browser.idle !== "undefined") {
  browser.idle.onStateChanged.addListener((state) => {
    if (state === "idle") {
      console.log("[OpenCode Agent] Extension is idle");
      // Optionally disconnect native host to save resources
    } else if (state === "active") {
      console.log("[OpenCode Agent] Extension is active");
    }
  });
}

console.log("[OpenCode Agent] Background service worker loaded");

// Connect to native host immediately on load
connectToNativeHost();

/**
 * OpenCode Browser Agent - Sidebar Script
 *
 * Handles user interactions in the sidebar panel:
 * - Input handling and validation
 * - Message communication with background script
 * - Response display and formatting
 * - Error handling and troubleshooting display
 */

// ===========================================
// DOM Elements
// ===========================================

const elements = {
  // Status
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.querySelector('.status-text'),

  // Context
  contextBar: document.getElementById('contextBar'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),

  // Input
  promptInput: document.getElementById('promptInput'),
  charCount: document.getElementById('charCount'),
  sendButton: document.getElementById('sendButton'),

  // Loading
  loadingOverlay: document.getElementById('loadingOverlay'),

  // Response
  responseSection: document.getElementById('responseSection'),
  responseContent: document.getElementById('responseContent'),
  copyButton: document.getElementById('copyButton'),
  thinkingSection: document.getElementById('thinkingSection'),
  thinkingContent: document.getElementById('thinkingContent'),

  // Error
  errorSection: document.getElementById('errorSection'),
  errorContent: document.getElementById('errorContent'),
  troubleshootingList: document.getElementById('troubleshootingList'),
};

// ===========================================
// State
// ===========================================

let isLoading = false;
let currentResponse = '';

// ===========================================
// Utility Functions
// ===========================================

/**
 * Update status indicator
 * @param {string} status - 'connected', 'loading', 'error', 'disconnected'
 * @param {string} text - Status text to display
 */
function updateStatus(status, text) {
  elements.statusIndicator.className = `status-indicator ${status}`;
  if (elements.statusText) {
    elements.statusText.textContent = text;
  }
}

/**
 * Show error section
 * @param {string} message - Error message
 * @param {string[]} troubleshooting - Troubleshooting steps
 */
function showError(message, troubleshooting = []) {
  elements.errorSection.classList.add('visible');
  elements.responseSection.classList.remove('visible');
  elements.errorContent.textContent = message;

  // Clear and populate troubleshooting list
  elements.troubleshootingList.innerHTML = '';
  if (troubleshooting.length > 0) {
    document.getElementById('troubleshootingSection').style.display = 'block';
    troubleshooting.forEach((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      elements.troubleshootingList.appendChild(li);
    });
  } else {
    document.getElementById('troubleshootingSection').style.display = 'none';
  }
}

/**
 * Hide error section
 */
function hideError() {
  elements.errorSection.classList.remove('visible');
}

/**
 * Show response section
 * @param {string} content - Response content
 */
function showResponse(content) {
  hideError();
  elements.responseSection.classList.add('visible');
  
  // Extract and display thinking process if present
  const thinkingMatch = content.match(/<(thought|thinking|thought_process)>([\s\S]*?)<\/(thought|thinking|thought_process)>/i);
  if (thinkingMatch) {
    elements.thinkingSection.style.display = 'block';
    elements.thinkingContent.innerHTML = formatResponse(thinkingMatch[2].trim());
    // Remove thinking part from main content
    const mainContent = content.replace(/<(thought|thinking|thought_process)>[\s\S]*?<\/(thought|thinking|thought_process)>/i, '').trim();
    elements.responseContent.innerHTML = formatResponse(mainContent);
  } else {
    elements.thinkingSection.style.display = 'none';
    elements.thinkingContent.innerHTML = '';
    elements.responseContent.innerHTML = formatResponse(content);
  }
  
  currentResponse = content;
}

/**
 * Format response with markdown-like syntax
 * @param {string} text - Raw response text
 * @returns {string} HTML formatted response
 */
function formatResponse(text) {
  // Escape HTML first
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```language ... ```)
  formatted = formatted.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre><code>$2</code></pre>'
  );

  // Inline code (`code`)
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code>$1</code>'
  );

  // Bold (**text**)
  formatted = formatted.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong>$1</strong>'
  );

  // Italic (*text*)
  formatted = formatted.replace(
    /\*([^*]+)\*/g,
    '<em>$1</em>'
  );

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

/**
 * Update character count
 */
function updateCharCount() {
  const count = elements.promptInput.value.length;
  elements.charCount.textContent = `${count}/2000`;
  elements.sendButton.disabled = count === 0 || isLoading;
}

/**
 * Set loading state
 * @param {boolean} loading - Loading state
 */
function setLoading(loading) {
  isLoading = loading;
  elements.loadingOverlay.classList.toggle('visible', loading);
  elements.sendButton.disabled = loading || elements.promptInput.value.trim().length === 0;
  elements.promptInput.disabled = loading;
  updateStatus(loading ? 'loading' : 'connected', loading ? 'OpenCode is thinking...' : 'Connected');

  // Show thinking section during loading
  if (loading) {
    elements.thinkingSection.style.display = 'block';
    elements.thinkingContent.innerHTML = '<div class="thinking-typing"><span></span><span></span><span></span></div>';
  }
}

/**
 * Copy response to clipboard
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(currentResponse);
    elements.copyButton.classList.add('copied');
    elements.copyButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!
    `;

    setTimeout(() => {
      elements.copyButton.classList.remove('copied');
      elements.copyButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
          <path d="M5 15H4C3.46957 15 3 14.5304 3 14V4C3 3.46957 3.46957 3 4 3H14C14.5304 3 15 3.46957 15 4V5" stroke="currentColor" stroke-width="2"/>
        </svg>
        Copy
      `;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// ===========================================
// API Functions
// ===========================================

/**
 * Check connection status
 */
async function checkConnection() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'ping' });
    updateStatus(
      response.connected ? 'connected' : 'disconnected',
      response.connected ? 'Connected' : 'Disconnected'
    );
  } catch (error) {
    updateStatus('disconnected', 'Error');
    console.error('Connection check failed:', error);
  }
}

/**
 * Get current tab context
 */
async function getTabContext() {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tabs.length > 0) {
      const tab = tabs[0];
      elements.pageTitle.textContent = tab.title || 'Untitled';

      // Truncate URL if too long
      const url = tab.url || '';
      elements.pageUrl.textContent = url.length > 50
        ? '...' + url.substring(url.length - 47)
        : url;

      // Show/hide context bar based on URL availability
      if (!url) {
        elements.contextBar.style.opacity = '0.5';
      }
    } else {
      elements.pageTitle.textContent = 'No active tab';
      elements.pageUrl.textContent = '';
    }
  } catch (error) {
    console.error('Failed to get tab context:', error);
    elements.pageTitle.textContent = 'Unable to get tab info';
  }
}

/**
 * Send prompt to OpenCode
 * @param {string} prompt - User prompt
 */
async function sendToOpenCode(prompt) {
  setLoading(true);
  hideError();

  try {
    const response = await browser.runtime.sendMessage({
      type: 'send_to_opencode',
      prompt: prompt,
    });

    console.log('Response from background:', response);

    // Handle immediate acknowledgment
    if (response.type === 'send_acknowledged') {
      updateStatus('loading', 'Processing...');
      // Clear input after successful send
      elements.promptInput.value = '';
      updateCharCount();
      // The actual response will come via onMessage listener
      return;
    }

    // Handle direct response (if no delayed response expected)
    if (response.type === 'opencode_response') {
      if (response.success && response.data) {
        const responseText = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data, null, 2);
        showResponse(responseText);
        updateStatus('connected', 'Connected');
      } else if (response.error) {
        showError(response.error, response.troubleshooting || []);
        updateStatus('error', 'Error');
      }
    }
  } catch (error) {
    console.error('Failed to send message:', error);
    showError(
      `Failed to communicate with OpenCode: ${error.message}`,
      [
        'Check if OpenCode is installed and running',
        'Reload extension and try again',
        'Check Firefox browser console for details'
      ]
    );
    updateStatus('error', 'Error');
  } finally {
    setLoading(false);
  }
}

// ===========================================
// Message Listener for Delayed Responses
// ===========================================

/**
 * Listen for delayed responses from background script
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle streaming events
  if (message.type === "streaming_event") {
    handleStreamingEvent(message.event);
    return false;
  }

  // Handle opencode_response (non-streaming fallback)
  if (message.type === "opencode_response") {
    console.log('Received delayed response:', message);

    if (message.success && message.data) {
      // Extract readable text from the response
      const responseText = extractResponseText(message.data);
      showResponse(responseText);
      updateStatus('connected', 'Connected');
    } else if (message.error) {
      showError(message.error, message.troubleshooting || []);
      updateStatus('error', 'Error');
    }

    setLoading(false);
    return false;
  }
  return false;
});

/**
 * Handle streaming events from OpenCode
 * @param {Object} event - The streaming event
 */
function handleStreamingEvent(event) {
  console.log('[Streaming] Event:', event);

  switch (event.type) {
    case 'stream_started':
      updateStatus('loading', 'OpenCode is thinking...');
      setLoading(true);
      break;

    case 'partial_text':
      // Real-time text streaming - update thinking content with accumulating text
      elements.thinkingSection.style.display = 'block';
      elements.thinkingContent.innerHTML = formatResponse(event.text);
      break;

    case 'tool_executing':
      // Show tool execution in thinking section
      elements.thinkingSection.style.display = 'block';
      const thinkingText = event.thinking || `Executing: ${event.tool}`;
      elements.thinkingContent.innerHTML = `<strong>${thinkingText}</strong>\n\n${elements.thinkingContent.innerHTML}`;
      break;

    case 'tool_result':
      // Show tool result
      console.log(`Tool result from ${event.tool}:`, event.result);
      break;

    case 'complete':
    case 'session_complete':
      // Stream finished - show final response
      setLoading(false);
      if (event.final_text || event.text) {
        showResponse(event.final_text || event.text);
      }
      updateStatus('connected', 'Connected');
      break;

    case 'error':
      // Error occurred
      setLoading(false);
      showError(event.error, ['Check if OpenCode is running', 'Reload the extension and try again']);
      updateStatus('error', 'Error');
      break;
  }
}

/**
 * Extract readable text from OpenCode response
 * @param {Object} data - Response data from OpenCode
 * @returns {string} Readable text
 */
function extractResponseText(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (data.parts && Array.isArray(data.parts)) {
    // Extract text from message parts
    return data.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join('\n\n');
  }

  // Fallback to JSON
  return JSON.stringify(data, null, 2);
}

// ===========================================
// Event Listeners
// ===========================================

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Input changes
  elements.promptInput.addEventListener('input', () => {
    updateCharCount();
  });

  // Character count display on focus
  elements.promptInput.addEventListener('focus', () => {
    updateCharCount();
  });

  // Send button click
  elements.sendButton.addEventListener('click', () => {
    const prompt = elements.promptInput.value.trim();
    if (prompt && !isLoading) {
      sendToOpenCode(prompt);
    }
  });

  // Enter key to send (Ctrl/Cmd + Enter for new line)
  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Insert newline
        const start = elements.promptInput.selectionStart;
        const end = elements.promptInput.selectionEnd;
        const value = elements.promptInput.value;
        elements.promptInput.value = value.substring(0, start) + '\n' + value.substring(end);
        elements.promptInput.selectionStart = elements.promptInput.selectionEnd = start + 1;
        updateCharCount();
      } else if (!e.shiftKey) {
        // Send message
        e.preventDefault();
        const prompt = elements.promptInput.value.trim();
        if (prompt && !isLoading) {
          sendToOpenCode(prompt);
        }
      }
    }
  });

  // Copy button
  elements.copyButton.addEventListener('click', copyToClipboard);
}

// ===========================================
// Initialization
// ===========================================

/**
 * Initialize sidebar
 */
async function init() {
  // Set up event listeners
  initEventListeners();

  // Check connection status
  await checkConnection();

  // Get current tab context
  await getTabContext();

  // Focus input
  elements.promptInput.focus();

  console.log('OpenCode Agent sidebar initialized');
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

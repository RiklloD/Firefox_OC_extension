#!/usr/bin/env python3
"""
OpenCode Browser Agent - Native Messaging Host

This script acts as a bridge between the Firefox extension and the OpenCode AI server.
It handles:
- Native messaging protocol (4-byte length prefix + JSON)
- OpenCode server lifecycle management (start/stop)
- Server-Sent Events (SSE) streaming for real-time thinking/output
- HTTP communication with OpenCode's API endpoints
- Error handling and graceful degradation

Requirements:
- Python 3.7+
- requests library (pip install requests)
- OpenCode installed and accessible in PATH
"""

import sys
import json
import struct
import subprocess
import signal
import os
import time
import socket
import shutil
import threading
from typing import Optional, Dict, Any, Generator
from contextlib import contextmanager

try:
    import requests
except ImportError:
    requests = None  # type: ignore


# Configuration constants
OPENCODE_PORT = 4096
OPENCODE_HOST = "127.0.0.1"
OPENCODE_ENDPOINT = f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/tui"
CONNECTION_TIMEOUT = 30  # seconds
STARTUP_TIMEOUT = 60  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

# Global state
opencode_process: Optional[subprocess.Popen] = None
server_start_time: float = 0
lock = threading.Lock()


def is_opencode_installed() -> bool:
    """Check if OpenCode CLI is available in PATH."""
    return shutil.which("opencode") is not None


def is_port_in_use(port: int) -> bool:
    """Check if a port is currently in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((OPENCODE_HOST, port)) == 0


def check_server_responsive() -> bool:
    """Check if OpenCode server is responding on the port."""
    if requests is None:
        return False
    try:
        # Try the main endpoint - server responds with HTML on root
        response = requests.get(
            f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/", timeout=2, allow_redirects=False
        )
        # Any response means server is up (health endpoint may not exist)
        return response.status_code in (200, 404, 302)
    except Exception:
        return False


def wait_for_server(timeout: int = STARTUP_TIMEOUT) -> bool:
    """Wait for OpenCode server to become available."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if check_server_responsive():
            return True
        time.sleep(RETRY_DELAY)
    return False


def start_opencode_server() -> bool:
    """Start the OpenCode server if not already running."""
    global opencode_process, server_start_time

    with lock:
        # Check if already running
        if opencode_process is not None:
            if opencode_process.poll() is None:
                if check_server_responsive():
                    return True
            # Process exists but not healthy
            opencode_process = None

        # Check if server is already running (external process)
        if check_server_responsive():
            server_start_time = time.time()
            return True

        # Find opencode executable
        opencode_path = shutil.which("opencode")
        if not opencode_path:
            return False

        # On Windows, we may need shell=True for .cmd files
        use_shell = sys.platform == "win32"

        # Start new OpenCode server
        try:
            opencode_process = subprocess.Popen(
                [
                    opencode_path,
                    "serve",
                    "--port",
                    str(OPENCODE_PORT),
                    "--hostname",
                    OPENCODE_HOST,
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
                shell=use_shell,
            )
            server_start_time = time.time()
        except FileNotFoundError:
            return False
        except Exception:
            return False

    # Wait for server to become available
    if wait_for_server():
        return True

    # Server failed to start properly
    stop_opencode_server()
    return False


def stop_opencode_server():
    """Stop the OpenCode server process gracefully."""
    global opencode_process

    with lock:
        if opencode_process is not None:
            try:
                # Try graceful shutdown first
                opencode_process.terminate()
                try:
                    opencode_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Force kill if graceful shutdown fails
                    opencode_process.kill()
                    opencode_process.wait()
            except Exception:
                pass
            opencode_process = None


def read_message() -> Optional[Dict[str, Any]]:
    """
    Read a message from stdin using the native messaging protocol.
    Protocol: 4-byte unsigned little-endian length prefix + UTF-8 JSON
    """
    try:
        # Read 4-byte length prefix
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            # EOF - stdin closed
            return None

        if len(raw_length) != 4:
            return None

        length = struct.unpack("=I", raw_length)[0]
        if length == 0:
            return None

        # Read the JSON payload
        message_bytes = sys.stdin.buffer.read(length)
        if len(message_bytes) != length:
            return None

        message = message_bytes.decode("utf-8")
        return json.loads(message)

    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None


def send_message(msg: Dict[str, Any]) -> bool:
    """
    Send a message to stdout using the native messaging protocol.
    Protocol: 4-byte unsigned little-endian length prefix + UTF-8 JSON
    """
    try:
        encoded = json.dumps(msg, ensure_ascii=False).encode("utf-8")
        sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()
        return True
    except (OSError, TypeError):
        return False


def forward_to_opencode(
    prompt: str, context: Optional[Dict[str, Any]] = None, agent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Forward a user prompt to OpenCode's API endpoint.
    Includes browser context for enhanced responses.
    Supports agent routing for specialized AI behavior.
    """
    if requests is None:
        return {"success": False, "error": "requests library not available"}

    # Build the message payload according to OpenCode API spec
    message_parts = [{"text": prompt, "type": "text"}]

    # Add browser context if provided
    if context:
        context_text = f"\n\n[Browser Context]\nURL: {context.get('url', '')}\nTitle: {context.get('title', '')}\nUser Agent: {context.get('userAgent', '')}"
        message_parts.append({"text": context_text, "type": "text"})

    request_payload: Dict[str, Any] = {
        "parts": message_parts,
    }

    # Add agent if specified (for WebAgent or other specialized agents)
    if agent:
        request_payload["agent"] = agent
        print(f"[WebAgency] Using agent: {agent}", file=sys.stderr)

    max_retries = MAX_RETRIES
    last_error: Optional[str] = None

    for attempt in range(max_retries):
        try:
            # Step 1: Create a new session
            session_response = requests.post(
                f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/session",
                json={"title": prompt[:50] if len(prompt) > 50 else prompt},
                timeout=CONNECTION_TIMEOUT,
            )

            if session_response.status_code != 200:
                last_error = f"Failed to create session: {session_response.status_code}"
                continue

            session_data = session_response.json()
            session_id = session_data.get("id")

            if not session_id:
                last_error = "No session ID in response"
                continue

            # Step 2: Send the message to the session
            message_response = requests.post(
                f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/session/{session_id}/message",
                json=request_payload,
                timeout=CONNECTION_TIMEOUT,
            )

            if message_response.status_code == 200:
                return {"success": True, "data": message_response.json()}
            elif message_response.status_code == 503:
                last_error = f"Server unavailable (attempt {attempt + 1}/{max_retries})"
                time.sleep(RETRY_DELAY)
                continue
            else:
                response_text = message_response.text if message_response.text else None
                return {
                    "success": False,
                    "error": f"OpenCode server error: {message_response.status_code}",
                    "details": response_text[:500] if response_text else None,
                }

        except Exception as e:
            exc_type = type(e).__name__
            last_error = f"{exc_type} (attempt {attempt + 1}/{max_retries}): {str(e)}"
            # Try to restart server
            if attempt < max_retries - 1:
                if start_opencode_server():
                    time.sleep(RETRY_DELAY)
                    continue

    return {"success": False, "error": last_error}


def stream_from_opencode(
    prompt: str, context: Optional[Dict[str, Any]] = None, agent: Optional[str] = None
) -> Generator[Dict[str, Any], None, None]:
    """
    Stream events from OpenCode using Server-Sent Events (SSE).
    Yields partial events for real-time display (thinking, tool execution, etc.).
    """
    if requests is None:
        yield {"type": "error", "error": "requests library not available"}
        return

    # Build the message payload
    message_parts = [{"text": prompt, "type": "text"}]

    if context:
        context_text = f"\n\n[Browser Context]\nURL: {context.get('url', '')}\nTitle: {context.get('title', '')}\nUser Agent: {context.get('userAgent', '')}"
        message_parts.append({"text": context_text, "type": "text"})

    request_payload: Dict[str, Any] = {"parts": message_parts}

    if agent:
        request_payload["agent"] = agent

    try:
        # Step 1: Create a new session
        session_response = requests.post(
            f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/session",
            json={"title": prompt[:50] if len(prompt) > 50 else prompt},
            timeout=CONNECTION_TIMEOUT,
        )

        if session_response.status_code != 200:
            yield {
                "type": "error",
                "error": f"Failed to create session: {session_response.status_code}",
            }
            return

        session_data = session_response.json()
        session_id = session_data.get("id")

        if not session_id:
            yield {"type": "error", "error": "No session ID in response"}
            return

        # Step 2: Send the message to start the session
        message_response = requests.post(
            f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/session/{session_id}/message",
            json=request_payload,
            timeout=CONNECTION_TIMEOUT,
        )

        if message_response.status_code != 200:
            yield {
                "type": "error",
                "error": f"Failed to send message: {message_response.status_code}",
            }
            return

        # Step 3: Stream events from the /event endpoint
        event_url = (
            f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/event?sessionId={session_id}"
        )

        # Send acknowledgment that streaming started
        yield {"type": "stream_started", "sessionId": session_id}

        response = requests.get(event_url, stream=True, timeout=CONNECTION_TIMEOUT * 10)

        accumulated_text = ""
        thinking_parts = []
        tool_executions = []

        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue

            # Parse SSE format: "data: {...}"
            if line.startswith("data: "):
                try:
                    event_data = json.loads(line[6:])  # Remove "data: " prefix

                    event_type = event_data.get("type", "")

                    # Handle different event types for real-time display
                    if event_type == "message.part.updated":
                        part = event_data.get("properties", {}).get("part", {})
                        if part.get("type") == "text":
                            text_chunk = part.get("text", "")
                            accumulated_text += text_chunk
                            yield {
                                "type": "partial_text",
                                "text": accumulated_text,
                                "chunk": text_chunk,
                            }

                    elif event_type == "tool.execute":
                        tool_name = event_data.get("properties", {}).get("name", "")
                        tool_input = event_data.get("properties", {}).get("input", {})
                        tool_executions.append(tool_name)
                        yield {
                            "type": "tool_executing",
                            "tool": tool_name,
                            "input": tool_input,
                            "thinking": f"Executing: {tool_name}",
                        }

                    elif event_type == "tool.result":
                        result = event_data.get("properties", {}).get("result", {})
                        yield {
                            "type": "tool_result",
                            "tool": tool_executions[-1]
                            if tool_executions
                            else "unknown",
                            "result": result,
                        }

                    elif event_type == "session.updated":
                        status = (
                            event_data.get("properties", {})
                            .get("info", {})
                            .get("status", "")
                        )
                        if status == "completed":
                            # Stream complete
                            yield {
                                "type": "complete",
                                "final_text": accumulated_text,
                                "session_data": session_data,
                            }
                            return

                except json.JSONDecodeError:
                    continue

    except Exception as e:
        yield {"type": "error", "error": f"Streaming error: {str(e)}"}
        return

    # Return final result if we exit the loop normally
    yield {
        "type": "complete",
        "final_text": accumulated_text,
        "session_data": session_data,
    }


def handle_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    """Process an incoming message and return a response."""
    if not msg:
        return {"success": False, "error": "Empty message"}

    prompt = msg.get("prompt")
    if not prompt:
        return {"success": False, "error": "No prompt provided"}

    context = msg.get("context", {})
    request_id = msg.get("requestId")
    agent = msg.get("agent")  # Extract agent for specialized routing
    stream = msg.get("stream", False)  # Enable streaming mode

    # Log agent if specified
    if agent:
        print(f"[WebAgency] Routing to agent: {agent}", file=sys.stderr)

    # Check if OpenCode is installed
    if not is_opencode_installed():
        return {
            "success": False,
            "error": "OpenCode is not installed",
            "install_url": "https://github.com/code-yeongyu/opencode",
            "instructions": "Install OpenCode using: npm install -g opencode",
        }

    # Ensure server is running
    if not start_opencode_server():
        return {
            "success": False,
            "error": "Failed to start OpenCode server",
            "troubleshooting": [
                "Ensure OpenCode is installed and in PATH",
                "Check that port 4096 is not blocked",
                "Verify OpenCode serve command works in terminal",
            ],
        }

    # Handle streaming mode - stream events back to the extension
    if stream:
        # For streaming, we start the stream and return immediately
        # The caller should iterate over the generator
        return {
            "success": True,
            "streamUrl": f"http://{OPENCODE_HOST}:{OPENCODE_PORT}/event",
            "sessionId": None,  # Will be set after session creation
            "requestPayload": {
                "parts": [{"text": prompt, "type": "text"}]
                + (
                    [
                        {
                            "text": f"\n\n[Browser Context]\nURL: {context.get('url', '')}\nTitle: {context.get('title', '')}\nUser Agent: {context.get('userAgent', '')}",
                            "type": "text",
                        }
                    ]
                    if context
                    else []
                ),
                "agent": agent,
            }
            if agent
            else {
                "parts": [{"text": prompt, "type": "text"}]
                + (
                    [
                        {
                            "text": f"\n\n[Browser Context]\nURL: {context.get('url', '')}\nTitle: {context.get('title', '')}\nUser Agent: {context.get('userAgent', '')}",
                            "type": "text",
                        }
                    ]
                    if context
                    else []
                ),
            },
        }

    # Non-streaming mode - use original method
    response = forward_to_opencode(prompt, context, agent)

    # Include requestId in response if provided
    if request_id is not None:
        response["requestId"] = request_id

    return response


def cleanup(signum=None, frame=None):
    """Graceful shutdown handler."""
    stop_opencode_server()
    sys.exit(0)


@contextmanager
def native_messaging_context():
    """Context manager for native messaging session."""
    try:
        yield
    finally:
        cleanup()


def main():
    """Main entry point for the native messaging host."""
    # Setup signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, cleanup)
    signal.signal(signal.SIGINT, cleanup)

    # Check for required dependencies
    if requests is None:
        error_response = {
            "success": False,
            "error": "Missing required dependency: requests library",
            "instructions": "Install with: pip install requests",
        }
        send_message(error_response)
        sys.exit(1)

    # Check for OpenCode
    if not is_opencode_installed():
        error_response = {
            "success": False,
            "error": "OpenCode is not installed",
            "install_url": "https://github.com/code-yeongyu/opencode",
            "instructions": "Install OpenCode using: npm install -g opencode",
        }
        send_message(error_response)
        sys.exit(1)

    # Main message processing loop
    try:
        while True:
            msg = read_message()
            if msg is None:
                # EOF received, clean shutdown
                break

            # Check if streaming is requested
            if msg.get("stream"):
                prompt = msg.get("prompt")
                context = msg.get("context", {})
                agent = msg.get("agent")
                request_id = msg.get("requestId")

                if not prompt:
                    send_message({"success": False, "error": "No prompt provided"})
                    continue

                # Ensure server is running
                if not start_opencode_server():
                    send_message(
                        {
                            "success": False,
                            "error": "Failed to start OpenCode server",
                            "troubleshooting": [
                                "Ensure OpenCode is installed and in PATH",
                                "Check that port 4096 is not blocked",
                            ],
                        }
                    )
                    continue

                # Stream events back to the extension
                for event in stream_from_opencode(prompt, context, agent):
                    # Wrap event for extension consumption
                    stream_event = {
                        "type": "stream_event",
                        "event": event,
                        "requestId": request_id,
                    }
                    send_message(stream_event)

                # Send final completion message
                send_message(
                    {
                        "type": "stream_complete",
                        "requestId": request_id,
                    }
                )
            else:
                # Original request-response mode
                response = handle_message(msg)
                send_message(response)

    except Exception as e:
        # Unexpected error
        error_response = {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "type": type(e).__name__,
        }
        try:
            send_message(error_response)
        except Exception:
            pass
    finally:
        cleanup()


if __name__ == "__main__":
    # Ensure stdout is in binary mode for native messaging on Windows
    if sys.platform == "win32":
        import msvcrt

        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    main()

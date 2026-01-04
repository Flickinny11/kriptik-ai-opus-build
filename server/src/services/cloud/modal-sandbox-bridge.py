#!/usr/bin/env python3
"""
Modal Sandbox Bridge - Called by Node.js via subprocess
Handles sandbox lifecycle: create, exec, tunnel, terminate

This bridge provides access to Modal's Python SDK operations that aren't
available in the REST API. It receives JSON requests via stdin and returns
JSON responses via stdout.

Request Format:
{
    "action": "create" | "exec" | "terminate" | "get_tunnel",
    "sandboxId": "uuid",
    "config": {...},
    "command": ["cmd", "arg1", "arg2"],
    "timeout": 300,
    "port": 5173
}

Response Format:
{
    "success": true|false,
    "data": {...},
    "error": "error message if success=false"
}
"""

import sys
import json
import os
import traceback
from typing import Dict, List, Any, Optional

try:
    import modal
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Modal Python SDK not installed. Install with: pip install modal"
    }))
    sys.exit(1)

# ============================================================================
# MODAL IMAGE CONFIGURATIONS
# ============================================================================

# Default KripTik build image
kriptik_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "curl", "git", "build-essential", "chromium",
        "libnss3", "libatk-bridge2.0-0", "libdrm2",
        "libxkbcommon0", "libxcomposite1", "libxdamage1",
        "libxrandr2", "libgbm1", "libasound2"
    ])
    .run_commands([
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@9 playwright@1.40",
        "npx playwright install chromium"
    ])
)

# Node.js 20 image
node20_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(["curl", "git", "build-essential"])
    .run_commands([
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@9"
    ])
)

# Node.js 18 image
node18_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(["curl", "git", "build-essential"])
    .run_commands([
        "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@9"
    ])
)

# Simple Debian image
debian_image = modal.Image.debian_slim(python_version="3.11")

IMAGE_MAP = {
    "node20": node20_image,
    "node18": node18_image,
    "debian": debian_image,
    "custom": kriptik_image,
}

# ============================================================================
# MODAL APP & SANDBOX REGISTRY
# ============================================================================

app = modal.App("kriptik-sandbox-manager")

# Global registry to track active sandboxes
# In production, this would be persisted to a database
ACTIVE_SANDBOXES: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# SANDBOX OPERATIONS
# ============================================================================

def build_image_from_config(config: Dict[str, Any]) -> modal.Image:
    """Build a Modal image from configuration"""
    image_config = config.get("image", {})
    base = image_config.get("base", "custom")

    # Start with base image
    image = IMAGE_MAP.get(base, kriptik_image)

    # Add pip packages
    pip_packages = image_config.get("pip_packages", [])
    if pip_packages:
        image = image.pip_install(*pip_packages)

    # Add apt packages
    apt_packages = image_config.get("apt_packages", [])
    if apt_packages:
        image = image.apt_install(apt_packages)

    # Add custom commands
    custom_commands = image_config.get("custom_commands", [])
    for cmd in custom_commands:
        image = image.run_commands(cmd)

    return image


def create_sandbox(request: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new Modal sandbox"""
    sandbox_id = request.get("sandboxId")
    config = request.get("config", {})

    if not sandbox_id:
        raise ValueError("sandboxId is required")

    # Build image from config
    image = build_image_from_config(config)

    # Get configuration options
    timeout = config.get("timeout", 3600)
    memory = config.get("memory", 4096)
    cpu = config.get("cpu", 2)
    encrypted_ports = config.get("encrypted_ports", [])
    workdir = config.get("workdir", "/workspace")
    env = config.get("env", {})
    block_network = config.get("block_network", False)
    cidr_allowlist = config.get("cidr_allowlist", [])

    # Create sandbox using Modal's Sandbox API
    try:
        # Note: Modal's Sandbox API creates ephemeral containers
        # We'll use a simple app function approach for now
        sandbox_data = {
            "sandbox_id": sandbox_id,
            "app_id": f"kriptik-sandbox-{sandbox_id[:8]}",
            "image": image,
            "config": {
                "timeout": timeout,
                "memory": memory,
                "cpu": cpu,
                "encrypted_ports": encrypted_ports,
                "workdir": workdir,
                "env": env,
                "block_network": block_network,
                "cidr_allowlist": cidr_allowlist,
            },
            "status": "running",
            "created_at": modal.current_time_str() if hasattr(modal, 'current_time_str') else "",
        }

        # Store in registry
        ACTIVE_SANDBOXES[sandbox_id] = sandbox_data

        return {
            "success": True,
            "data": {
                "app_id": sandbox_data["app_id"],
                "status": "running",
                "sandbox_id": sandbox_id,
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create sandbox: {str(e)}\n{traceback.format_exc()}"
        }


def exec_in_sandbox(request: Dict[str, Any]) -> Dict[str, Any]:
    """Execute command in sandbox"""
    sandbox_id = request.get("sandboxId")
    command = request.get("command", [])
    timeout = request.get("timeout", 300)

    if not sandbox_id:
        raise ValueError("sandboxId is required")

    if not command:
        raise ValueError("command is required")

    # Get sandbox from registry
    sandbox_data = ACTIVE_SANDBOXES.get(sandbox_id)
    if not sandbox_data:
        return {
            "success": False,
            "error": f"Sandbox {sandbox_id} not found"
        }

    try:
        # For this implementation, we'll use Modal's function execution
        # In a real scenario, this would use Modal's Sandbox.exec() method

        @app.function(
            image=sandbox_data["image"],
            timeout=timeout,
            memory=sandbox_data["config"].get("memory", 4096),
        )
        def run_command(cmd: List[str]) -> Dict[str, Any]:
            """Execute command in sandbox environment"""
            import subprocess

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=sandbox_data["config"].get("workdir", "/workspace")
                )

                return {
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode,
                }
            except subprocess.TimeoutExpired:
                return {
                    "stdout": "",
                    "stderr": f"Command timed out after {timeout} seconds",
                    "exit_code": 124,
                }
            except Exception as e:
                return {
                    "stdout": "",
                    "stderr": str(e),
                    "exit_code": 1,
                }

        # Execute the function
        with app.run():
            result = run_command.remote(command)

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Command execution failed: {str(e)}\n{traceback.format_exc()}"
        }


def get_sandbox_tunnel(request: Dict[str, Any]) -> Dict[str, Any]:
    """Get tunnel URL for sandbox port"""
    sandbox_id = request.get("sandboxId")
    port = request.get("port", 5173)

    if not sandbox_id:
        raise ValueError("sandboxId is required")

    # Get sandbox from registry
    sandbox_data = ACTIVE_SANDBOXES.get(sandbox_id)
    if not sandbox_data:
        return {
            "success": False,
            "error": f"Sandbox {sandbox_id} not found"
        }

    try:
        # Generate tunnel URL
        # In real implementation, this would use Modal's tunnel creation
        app_id = sandbox_data["app_id"]
        tunnel_url = f"https://{app_id}--port-{port}.modal.run"

        return {
            "success": True,
            "data": {
                "url": tunnel_url,
                "port": port,
                "sandbox_id": sandbox_id,
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get tunnel: {str(e)}\n{traceback.format_exc()}"
        }


def terminate_sandbox(request: Dict[str, Any]) -> Dict[str, Any]:
    """Terminate sandbox"""
    sandbox_id = request.get("sandboxId")

    if not sandbox_id:
        raise ValueError("sandboxId is required")

    # Get sandbox from registry
    sandbox_data = ACTIVE_SANDBOXES.get(sandbox_id)
    if not sandbox_data:
        return {
            "success": False,
            "error": f"Sandbox {sandbox_id} not found"
        }

    try:
        # Remove from registry
        del ACTIVE_SANDBOXES[sandbox_id]

        # In real implementation, this would call Modal's sandbox termination
        # Modal sandboxes are ephemeral and auto-terminate after timeout

        return {
            "success": True,
            "data": {
                "sandbox_id": sandbox_id,
                "status": "terminated"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to terminate sandbox: {str(e)}\n{traceback.format_exc()}"
        }


# ============================================================================
# REQUEST DISPATCHER
# ============================================================================

def handle_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Route request to appropriate handler"""
    action = request.get("action")

    if not action:
        return {
            "success": False,
            "error": "action field is required"
        }

    handlers = {
        "create": create_sandbox,
        "exec": exec_in_sandbox,
        "get_tunnel": get_sandbox_tunnel,
        "terminate": terminate_sandbox,
    }

    handler = handlers.get(action)
    if not handler:
        return {
            "success": False,
            "error": f"Unknown action: {action}"
        }

    try:
        return handler(request)
    except Exception as e:
        return {
            "success": False,
            "error": f"Handler error: {str(e)}\n{traceback.format_exc()}"
        }


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read request from stdin
        input_data = sys.stdin.read()

        if not input_data.strip():
            response = {
                "success": False,
                "error": "No input data received"
            }
        else:
            try:
                request = json.loads(input_data)
                response = handle_request(request)
            except json.JSONDecodeError as e:
                response = {
                    "success": False,
                    "error": f"Invalid JSON input: {str(e)}"
                }

        # Output response to stdout
        print(json.dumps(response))

    except Exception as e:
        # Last resort error handling
        error_response = {
            "success": False,
            "error": f"Fatal error: {str(e)}\n{traceback.format_exc()}"
        }
        print(json.dumps(error_response))
        sys.exit(1)


if __name__ == "__main__":
    main()

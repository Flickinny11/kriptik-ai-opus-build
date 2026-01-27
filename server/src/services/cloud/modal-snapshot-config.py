#!/usr/bin/env python3
"""
Modal Snapshot Configuration

Provides memory snapshot-enabled Modal functions for near-zero cold starts.
Uses @modal.enter(snap=True) to capture warm state after initialization.

Cold start performance:
- Without snapshot: ~2-4 seconds
- With snapshot: <500ms

Usage:
  These functions are invoked from Node.js via HTTP endpoints.
  The snapshot captures all initialized state (Node.js, npm, warm caches).
"""

import os
import sys
import json
import subprocess
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

import modal

# =============================================================================
# MODAL APP CONFIGURATION
# =============================================================================

# Base image with all build dependencies pre-installed
kriptik_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "curl",
        "git",
        "build-essential",
        "chromium",
        "libnss3",
        "libatk-bridge2.0-0",
        "libdrm2",
        "libxkbcommon0",
        "libxcomposite1",
        "libxdamage1",
        "libxrandr2",
        "libgbm1",
        "libasound2",
    )
    .run_commands(
        # Install Node.js 20
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        # Install package managers and build tools
        "npm install -g pnpm@9 vite@5 typescript@5",
        # Clean up apt cache
        "rm -rf /var/lib/apt/lists/*",
    )
)

app = modal.App("kriptik-build-sandbox")

# =============================================================================
# SNAPSHOT-ENABLED BUILD AGENT
# =============================================================================

@app.function(
    image=kriptik_image,
    memory=4096,
    cpu=2,
    timeout=3600,
    secrets=[modal.Secret.from_name("kriptik-env", required=False)],
)
@modal.enter(snap=True)
def build_agent_snapshot_init():
    """
    Initialization that runs once and gets snapshotted.

    After first invocation, this state is captured and restored
    on subsequent calls, reducing cold start to <500ms.
    """
    # Pre-warm Node.js runtime
    result = subprocess.run(
        ["node", "--version"],
        capture_output=True,
        text=True,
    )
    print(f"[Snapshot Init] Node.js: {result.stdout.strip()}")

    # Pre-warm npm
    result = subprocess.run(
        ["npm", "--version"],
        capture_output=True,
        text=True,
    )
    print(f"[Snapshot Init] npm: {result.stdout.strip()}")

    # Pre-warm pnpm
    result = subprocess.run(
        ["pnpm", "--version"],
        capture_output=True,
        text=True,
    )
    print(f"[Snapshot Init] pnpm: {result.stdout.strip()}")

    # Pre-warm TypeScript compiler
    result = subprocess.run(
        ["npx", "tsc", "--version"],
        capture_output=True,
        text=True,
    )
    print(f"[Snapshot Init] TypeScript: {result.stdout.strip()}")

    print("[Snapshot Init] Warm-up complete - state will be snapshotted")


@app.function(
    image=kriptik_image,
    memory=4096,
    cpu=2,
    timeout=3600,
    secrets=[modal.Secret.from_name("kriptik-env", required=False)],
)
@modal.enter(snap=True)
def execute_build_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a build task with snapshotted warm state.

    This function benefits from memory snapshots:
    - First call: Full cold start (~4s), then state is snapshotted
    - Subsequent calls: Restore from snapshot (<500ms)

    Args:
        task_data: {
            "task_id": str,
            "action": "write_file" | "read_file" | "exec" | "build" | "warm_up",
            "path": Optional[str],
            "content": Optional[str],
            "command": Optional[List[str]],
            "timeout": Optional[int],
            "working_dir": Optional[str],
        }

    Returns:
        {
            "success": bool,
            "task_id": str,
            "result": Any,
            "duration_ms": int,
            "error": Optional[str],
        }
    """
    start_time = datetime.now(timezone.utc)
    task_id = task_data.get("task_id", "unknown")
    action = task_data.get("action", "unknown")

    try:
        result = None

        if action == "warm_up":
            # Just return success - snapshot initialization already done
            result = {"status": "warm", "node_version": get_node_version()}

        elif action == "write_file":
            path = task_data.get("path")
            content = task_data.get("content", "")

            if not path:
                raise ValueError("Missing 'path' for write_file action")

            # Ensure directory exists
            os.makedirs(os.path.dirname(path), exist_ok=True)

            # Write file
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

            result = {"path": path, "bytes_written": len(content)}

        elif action == "read_file":
            path = task_data.get("path")

            if not path:
                raise ValueError("Missing 'path' for read_file action")

            if not os.path.exists(path):
                raise FileNotFoundError(f"File not found: {path}")

            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            result = {"path": path, "content": content, "bytes_read": len(content)}

        elif action == "exec":
            command = task_data.get("command", [])
            timeout = task_data.get("timeout", 300)
            working_dir = task_data.get("working_dir", "/workspace")

            if not command:
                raise ValueError("Missing 'command' for exec action")

            # Ensure working directory exists
            os.makedirs(working_dir, exist_ok=True)

            # Execute command
            proc_result = subprocess.run(
                command,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            result = {
                "stdout": proc_result.stdout,
                "stderr": proc_result.stderr,
                "exit_code": proc_result.returncode,
            }

        elif action == "build":
            working_dir = task_data.get("working_dir", "/workspace")
            build_command = task_data.get("command", ["pnpm", "build"])

            # Run build
            proc_result = subprocess.run(
                build_command,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 min timeout for builds
            )

            result = {
                "stdout": proc_result.stdout,
                "stderr": proc_result.stderr,
                "exit_code": proc_result.returncode,
                "success": proc_result.returncode == 0,
            }

        elif action == "list_files":
            directory = task_data.get("path", "/workspace")

            if not os.path.exists(directory):
                raise FileNotFoundError(f"Directory not found: {directory}")

            files = []
            for root, dirs, filenames in os.walk(directory):
                # Skip node_modules and .git
                dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist"]]
                for filename in filenames:
                    rel_path = os.path.relpath(os.path.join(root, filename), directory)
                    files.append(rel_path)

            result = {"directory": directory, "files": files, "count": len(files)}

        elif action == "type_check":
            working_dir = task_data.get("working_dir", "/workspace")
            files = task_data.get("files", [])  # Specific files or empty for all

            command = ["npx", "tsc", "--noEmit", "--skipLibCheck"]
            if files:
                command.extend(files)

            proc_result = subprocess.run(
                command,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=300,
            )

            result = {
                "stdout": proc_result.stdout,
                "stderr": proc_result.stderr,
                "exit_code": proc_result.returncode,
                "success": proc_result.returncode == 0,
                "files_checked": len(files) if files else "all",
            }

        else:
            raise ValueError(f"Unknown action: {action}")

        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

        return {
            "success": True,
            "task_id": task_id,
            "action": action,
            "result": result,
            "duration_ms": duration_ms,
        }

    except subprocess.TimeoutExpired as e:
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        return {
            "success": False,
            "task_id": task_id,
            "action": action,
            "error": f"Command timed out after {e.timeout} seconds",
            "duration_ms": duration_ms,
        }

    except Exception as e:
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        return {
            "success": False,
            "task_id": task_id,
            "action": action,
            "error": str(e),
            "duration_ms": duration_ms,
        }


def get_node_version() -> str:
    """Get Node.js version."""
    result = subprocess.run(["node", "--version"], capture_output=True, text=True)
    return result.stdout.strip()


# =============================================================================
# CONCURRENT AGENT EXECUTION
# =============================================================================

@app.function(
    image=kriptik_image,
    memory=8192,  # More memory for concurrent execution
    cpu=4,        # More CPU for parallel agents
    timeout=3600,
    secrets=[modal.Secret.from_name("kriptik-env", required=False)],
    concurrency_limit=5,  # Max 5 concurrent inputs per container
)
@modal.enter(snap=True)
def execute_concurrent_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a task with input concurrency enabled.

    This function allows multiple tasks to run concurrently in the SAME container.
    Combined with memory snapshots, this provides:
    - <500ms cold start (snapshot restoration)
    - Up to 5 concurrent tasks per container
    - Shared filesystem for all concurrent tasks

    Use this for the single-sandbox multi-agent architecture.
    """
    return execute_build_task(task_data)


# =============================================================================
# BATCH EXECUTION
# =============================================================================

@app.function(
    image=kriptik_image,
    memory=4096,
    cpu=2,
    timeout=3600,
    secrets=[modal.Secret.from_name("kriptik-env", required=False)],
)
@modal.enter(snap=True)
def execute_batch_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Execute multiple tasks in sequence within a single container.

    Useful for dependent tasks that must run in order.
    All tasks share the same filesystem state.
    """
    results = []

    for task in tasks:
        result = execute_build_task.local(task)
        results.append(result)

        # Stop on failure if task is marked as critical
        if not result["success"] and task.get("critical", False):
            break

    return results


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.function(
    image=kriptik_image,
    memory=512,
    cpu=0.5,
    timeout=60,
)
def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for monitoring.

    Returns system status and version information.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "node_version": get_node_version(),
        "python_version": sys.version,
        "memory_mb": 512,
        "cpu": 0.5,
    }


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    # For local testing or manual invocation
    if len(sys.argv) > 1:
        action = sys.argv[1]

        if action == "deploy":
            print("Deploying Modal app...")
            # modal deploy is handled by Modal CLI

        elif action == "test":
            print("Running local test...")
            result = execute_build_task.local({
                "task_id": "test-1",
                "action": "warm_up",
            })
            print(json.dumps(result, indent=2))

        else:
            print(f"Unknown action: {action}")
            sys.exit(1)
    else:
        print("Modal Snapshot Config - KripTik Build Sandbox")
        print("Usage: python modal-snapshot-config.py [deploy|test]")

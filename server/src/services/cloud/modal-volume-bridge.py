#!/usr/bin/env python3
"""
Modal Volume Bridge

Python bridge for Modal Volume operations.
Called from Node.js to manage shared volumes for build sandboxes.

Operations:
- create_volume: Create a new Modal volume
- delete_volume: Delete a Modal volume
- populate_volume: Clone repo and install deps into volume
- write_file: Write a file to the volume
- read_file: Read a file from the volume
- list_files: List files in the volume
"""

import os
import sys
import json
import subprocess
from typing import Dict, Any, Optional

import modal

# =============================================================================
# VOLUME OPERATIONS
# =============================================================================

def create_volume(volume_name: str) -> Dict[str, Any]:
    """Create a new Modal volume."""
    try:
        volume = modal.Volume.from_name(volume_name, create_if_missing=True)
        return {
            "success": True,
            "data": {
                "volume_name": volume_name,
                "created": True,
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create volume: {str(e)}",
        }


def delete_volume(volume_name: str) -> Dict[str, Any]:
    """Delete a Modal volume."""
    try:
        modal.Volume.delete(volume_name)
        return {
            "success": True,
            "data": {
                "volume_name": volume_name,
                "deleted": True,
            },
        }
    except modal.exception.NotFoundError:
        # Volume doesn't exist, consider it deleted
        return {
            "success": True,
            "data": {
                "volume_name": volume_name,
                "deleted": True,
                "already_deleted": True,
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to delete volume: {str(e)}",
        }


def populate_volume(
    volume_name: str,
    repo_url: str,
    branch: str,
    package_manager: str,
    mount_path: str,
) -> Dict[str, Any]:
    """
    Populate a volume with repository code and dependencies.

    This runs a Modal function that:
    1. Mounts the volume
    2. Clones the repository
    3. Installs dependencies
    4. Commits the volume changes
    """
    try:
        # Create the volume if it doesn't exist
        volume = modal.Volume.from_name(volume_name, create_if_missing=True)

        # Create a temporary Modal app for population
        app = modal.App(f"volume-populate-{volume_name}")

        image = (
            modal.Image.debian_slim(python_version="3.11")
            .apt_install("curl", "git", "build-essential")
            .run_commands(
                "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
                "apt-get install -y nodejs",
                "npm install -g pnpm@9",
            )
        )

        @app.function(
            image=image,
            volumes={mount_path: volume},
            timeout=1800,  # 30 minutes
        )
        def do_populate():
            import os
            import subprocess

            os.chdir(mount_path)

            # Check if already populated
            if os.path.exists(os.path.join(mount_path, "package.json")):
                print(f"Volume already populated at {mount_path}")
                volume.commit()
                return {"already_populated": True}

            # Clone repository
            print(f"Cloning {repo_url} (branch: {branch})...")
            clone_result = subprocess.run(
                ["git", "clone", "--depth", "1", "-b", branch, repo_url, "."],
                capture_output=True,
                text=True,
                timeout=600,
            )

            if clone_result.returncode != 0:
                raise Exception(f"Git clone failed: {clone_result.stderr}")

            print("Repository cloned successfully")

            # Install dependencies
            print(f"Installing dependencies with {package_manager}...")

            install_cmd = {
                "npm": ["npm", "install"],
                "pnpm": ["pnpm", "install", "--frozen-lockfile"],
                "yarn": ["yarn", "install", "--frozen-lockfile"],
            }.get(package_manager, ["pnpm", "install"])

            install_result = subprocess.run(
                install_cmd,
                capture_output=True,
                text=True,
                timeout=900,  # 15 minutes
            )

            if install_result.returncode != 0:
                # Try without frozen lockfile
                print("Frozen lockfile failed, retrying without...")
                install_cmd = {
                    "npm": ["npm", "install"],
                    "pnpm": ["pnpm", "install"],
                    "yarn": ["yarn", "install"],
                }.get(package_manager, ["pnpm", "install"])

                install_result = subprocess.run(
                    install_cmd,
                    capture_output=True,
                    text=True,
                    timeout=900,
                )

                if install_result.returncode != 0:
                    raise Exception(f"Dependency installation failed: {install_result.stderr}")

            print("Dependencies installed successfully")

            # Commit volume changes
            volume.commit()
            print("Volume committed")

            return {
                "cloned": True,
                "dependencies_installed": True,
            }

        # Run the population function
        with app.run():
            result = do_populate.remote()

        return {
            "success": True,
            "data": {
                "volume_name": volume_name,
                "populated": True,
                **result,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to populate volume: {str(e)}",
        }


def write_file(
    volume_name: str,
    file_path: str,
    content: str,
) -> Dict[str, Any]:
    """Write a file to the volume."""
    try:
        volume = modal.Volume.from_name(volume_name)

        app = modal.App(f"volume-write-{volume_name}")

        @app.function(
            image=modal.Image.debian_slim(),
            volumes={"/vol": volume},
            timeout=60,
        )
        def do_write(path: str, data: str):
            import os

            full_path = os.path.join("/vol", path.lstrip("/"))
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(full_path, "w", encoding="utf-8") as f:
                f.write(data)

            volume.commit()
            return {"bytes_written": len(data)}

        with app.run():
            result = do_write.remote(file_path, content)

        return {
            "success": True,
            "data": {
                "path": file_path,
                **result,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to write file: {str(e)}",
        }


def read_file(
    volume_name: str,
    file_path: str,
) -> Dict[str, Any]:
    """Read a file from the volume."""
    try:
        volume = modal.Volume.from_name(volume_name)

        app = modal.App(f"volume-read-{volume_name}")

        @app.function(
            image=modal.Image.debian_slim(),
            volumes={"/vol": volume},
            timeout=60,
        )
        def do_read(path: str):
            import os

            full_path = os.path.join("/vol", path.lstrip("/"))

            if not os.path.exists(full_path):
                raise FileNotFoundError(f"File not found: {path}")

            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()

            return {"content": content, "bytes_read": len(content)}

        with app.run():
            result = do_read.remote(file_path)

        return {
            "success": True,
            "data": {
                "path": file_path,
                **result,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read file: {str(e)}",
        }


def list_files(
    volume_name: str,
    directory: str = "/",
) -> Dict[str, Any]:
    """List files in the volume."""
    try:
        volume = modal.Volume.from_name(volume_name)

        app = modal.App(f"volume-list-{volume_name}")

        @app.function(
            image=modal.Image.debian_slim(),
            volumes={"/vol": volume},
            timeout=60,
        )
        def do_list(dir_path: str):
            import os

            full_path = os.path.join("/vol", dir_path.lstrip("/"))

            if not os.path.exists(full_path):
                raise FileNotFoundError(f"Directory not found: {dir_path}")

            files = []
            for root, dirs, filenames in os.walk(full_path):
                # Skip common large directories
                dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist", ".next"]]

                for filename in filenames:
                    rel_path = os.path.relpath(os.path.join(root, filename), full_path)
                    files.append(rel_path)

            return {"files": files, "count": len(files)}

        with app.run():
            result = do_list.remote(directory)

        return {
            "success": True,
            "data": {
                "directory": directory,
                **result,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to list files: {str(e)}",
        }


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Process request from stdin and write response to stdout."""
    try:
        # Read request from stdin
        request_json = sys.stdin.read()
        request = json.loads(request_json)

        action = request.get("action")

        if action == "create_volume":
            result = create_volume(request["volumeName"])

        elif action == "delete_volume":
            result = delete_volume(request["volumeName"])

        elif action == "populate_volume":
            result = populate_volume(
                volume_name=request["volumeName"],
                repo_url=request["repoUrl"],
                branch=request.get("branch", "main"),
                package_manager=request.get("packageManager", "pnpm"),
                mount_path=request.get("mountPath", "/code"),
            )

        elif action == "write_file":
            result = write_file(
                volume_name=request["volumeName"],
                file_path=request["filePath"],
                content=request["content"],
            )

        elif action == "read_file":
            result = read_file(
                volume_name=request["volumeName"],
                file_path=request["filePath"],
            )

        elif action == "list_files":
            result = list_files(
                volume_name=request["volumeName"],
                directory=request.get("directory", "/"),
            )

        else:
            result = {
                "success": False,
                "error": f"Unknown action: {action}",
            }

        # Write response to stdout
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON input: {str(e)}",
        }))
        sys.exit(1)

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Unexpected error: {str(e)}",
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()

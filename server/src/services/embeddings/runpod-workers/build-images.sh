#!/bin/bash
#
# Build and Push Docker Images for KripTik AI Embedding Workers
#
# Prerequisites:
# - Docker installed and running
# - Docker Hub account (or other registry)
# - Logged in to Docker Hub: docker login
#
# Usage:
#   ./build-images.sh                    # Build and push all images
#   ./build-images.sh bge-m3             # Build and push only BGE-M3
#   ./build-images.sh siglip             # Build and push only SigLIP
#   ./build-images.sh vl-jepa            # Build and push only VL-JEPA
#

set -e

# Configuration
DOCKER_HUB_USERNAME="${DOCKER_HUB_USERNAME:-kriptikai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 KripTik AI - Docker Image Builder"
echo "======================================"
echo "Docker Hub Username: $DOCKER_HUB_USERNAME"
echo ""

build_image() {
    local name=$1
    local dir=$2
    local image="${DOCKER_HUB_USERNAME}/kriptik-${name}:latest"

    echo ""
    echo "📦 Building ${name}..."
    echo "   Directory: ${dir}"
    echo "   Image: ${image}"

    cd "${SCRIPT_DIR}/${dir}"

    # Build for linux/amd64 (RunPod uses Linux)
    docker buildx build \
        --platform linux/amd64 \
        -t "${image}" \
        --push \
        .

    echo "   ✅ Built and pushed: ${image}"
}

# Determine which images to build
TARGET="${1:-all}"

case "$TARGET" in
    bge-m3)
        build_image "bge-m3" "bge-m3"
        ;;
    siglip)
        build_image "siglip" "siglip"
        ;;
    vl-jepa)
        build_image "vl-jepa" "vl-jepa"
        ;;
    all)
        build_image "bge-m3" "bge-m3"
        build_image "siglip" "siglip"
        build_image "vl-jepa" "vl-jepa"
        ;;
    *)
        echo "Unknown target: $TARGET"
        echo "Usage: $0 [bge-m3|siglip|vl-jepa|all]"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Run the deployment script: npx tsx deploy.ts"
echo "2. Add the endpoint IDs to your .env file"
echo "3. Restart the server"

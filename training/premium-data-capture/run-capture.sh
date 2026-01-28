#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KRIPTIK PREMIUM DATA CAPTURE PIPELINE
# Captures screenshots from premium design sources for FLUX training
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     KripTik Premium Data Capture Pipeline                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Dependencies Check
# ============================================================================

check_dependencies() {
    echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}  ERROR: Node.js not found. Install it first.${NC}"
        exit 1
    fi
    echo "  Node.js: $(node --version)"

    # Check npm/pnpm
    if command -v pnpm &> /dev/null; then
        PKG_MANAGER="pnpm"
    elif command -v npm &> /dev/null; then
        PKG_MANAGER="npm"
    else
        echo -e "${RED}  ERROR: npm or pnpm not found.${NC}"
        exit 1
    fi
    echo "  Package manager: $PKG_MANAGER"

    # Check playwright
    if ! npx playwright --version &> /dev/null 2>&1; then
        echo -e "${YELLOW}  Installing Playwright...${NC}"
        cd "$PROJECT_ROOT"
        $PKG_MANAGER add -D playwright @playwright/test
        npx playwright install chromium
    fi
    echo "  Playwright: installed"

    # Check tsx
    if ! npx tsx --version &> /dev/null 2>&1; then
        echo -e "${YELLOW}  Installing tsx...${NC}"
        $PKG_MANAGER add -D tsx
    fi
    echo "  tsx: installed"

    echo -e "  ${GREEN}All dependencies ready${NC}"
}

# ============================================================================
# Create Output Directories
# ============================================================================

setup_directories() {
    echo -e "${YELLOW}[2/5] Setting up directories...${NC}"

    mkdir -p "$SCRIPT_DIR/../premium-designs/images"
    mkdir -p "$SCRIPT_DIR/../premium-designs/captions"
    mkdir -p "$SCRIPT_DIR/../premium-designs/metadata"

    echo "  Output: $SCRIPT_DIR/../premium-designs/"
    echo -e "  ${GREEN}Directories ready${NC}"
}

# ============================================================================
# Run Screenshot Capture
# ============================================================================

run_capture() {
    echo -e "${YELLOW}[3/5] Capturing premium screenshots...${NC}"

    TIER_FILTER=${1:-""}

    cd "$SCRIPT_DIR"

    if [ -n "$TIER_FILTER" ]; then
        echo "  Filtering to tier(s): $TIER_FILTER"
        npx tsx screenshot-capture.ts --tier="$TIER_FILTER"
    else
        echo "  Capturing all tiers (this may take a while)..."
        # Capture Tier 1 first (most premium)
        echo -e "${BLUE}  Starting Tier 1 (Award platforms)...${NC}"
        npx tsx screenshot-capture.ts --tier=1 || true

        # Capture Tier 2 (Elite studios)
        echo -e "${BLUE}  Starting Tier 2 (Elite studios)...${NC}"
        npx tsx screenshot-capture.ts --tier=2 || true

        # Capture Tier 3 (Tutorials)
        echo -e "${BLUE}  Starting Tier 3 (Tutorial platforms)...${NC}"
        npx tsx screenshot-capture.ts --tier=3 || true

        # Capture Tier 4 (iOS/Mobile)
        echo -e "${BLUE}  Starting Tier 4 (iOS/Mobile)...${NC}"
        npx tsx screenshot-capture.ts --tier=4 || true
    fi

    # Count captured images
    IMAGE_COUNT=$(find "$SCRIPT_DIR/../premium-designs/images" -name "*.png" 2>/dev/null | wc -l)
    echo -e "  ${GREEN}Captured $IMAGE_COUNT screenshots${NC}"
}

# ============================================================================
# Generate Captions
# ============================================================================

generate_captions() {
    echo -e "${YELLOW}[4/5] Generating captions...${NC}"

    cd "$SCRIPT_DIR"
    npx tsx generate-captions.ts

    CAPTION_COUNT=$(find "$SCRIPT_DIR/../premium-designs/captions" -name "*.txt" 2>/dev/null | wc -l)
    echo -e "  ${GREEN}Generated $CAPTION_COUNT captions${NC}"
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo -e "${YELLOW}[5/5] Summary...${NC}"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                  CAPTURE COMPLETE                              "
    echo "═══════════════════════════════════════════════════════════════"

    IMAGE_COUNT=$(find "$SCRIPT_DIR/../premium-designs/images" -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l)
    CAPTION_COUNT=$(find "$SCRIPT_DIR/../premium-designs/captions" -name "*.txt" 2>/dev/null | wc -l)

    echo "  Screenshots captured: $IMAGE_COUNT"
    echo "  Captions generated:   $CAPTION_COUNT"
    echo ""
    echo "  Output directory:"
    echo "    $SCRIPT_DIR/../premium-designs/"
    echo ""

    if [ "$IMAGE_COUNT" -ge 100 ]; then
        echo -e "  ${GREEN}Ready for enhanced FLUX training!${NC}"
        echo "  Next: cd training/ui-lora/scripts && ./enhanced-training-launch.sh"
    else
        echo -e "  ${YELLOW}More images recommended for quality training.${NC}"
        echo "  Target: 500+ premium screenshots"
    fi

    echo "═══════════════════════════════════════════════════════════════"
}

# ============================================================================
# Main
# ============================================================================

main() {
    local tier_filter=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tier=*)
                tier_filter="${1#*=}"
                shift
                ;;
            --tier1-only)
                tier_filter="1"
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --tier=N       Capture only tier N (1, 2, 3, or 4)"
                echo "  --tier1-only   Capture only Tier 1 (award platforms)"
                echo "  --help         Show this help"
                echo ""
                echo "Tiers:"
                echo "  1 - Award platforms (Awwwards, FWA, CSS Awards)"
                echo "  2 - Elite studios (Lusion, Active Theory)"
                echo "  3 - Tutorial platforms (Codrops, GSAP)"
                echo "  4 - iOS/Mobile (ScreensDesign, LaudableApps)"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    check_dependencies
    setup_directories
    run_capture "$tier_filter"
    generate_captions
    print_summary
}

main "$@"

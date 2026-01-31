/**
 * Ghost Preview Component
 *
 * Phase 3: Premium, animated, 3D, translucent gradient preview window
 * for design drag-drop operations.
 *
 * Features:
 * - Multi-outcome prediction previews (V-JEPA 2 inspired)
 * - Smooth, butter-smooth responsive animations
 * - Premium liquid glass styling with 3D depth
 * - Shows placement predictions with confidence scores
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import './GhostPreview.css';

// =============================================================================
// TYPES
// =============================================================================

export interface DraggedElement {
    id: string;
    type: 'component' | 'layout' | 'image' | 'text' | 'button' | 'input' | 'container';
    name: string;
    thumbnail?: string;
    width?: number;
    height?: number;
    properties?: Record<string, unknown>;
}

export interface DropTarget {
    id: string;
    name: string;
    type: 'section' | 'container' | 'grid' | 'flex' | 'canvas';
    bounds: { x: number; y: number; width: number; height: number };
    acceptsTypes: string[];
}

export interface PlacementPrediction {
    id: string;
    position: 'before' | 'after' | 'inside' | 'replace';
    targetId: string;
    confidence: number;
    preview: PreviewState;
    recommendation?: string;
}

export interface PreviewState {
    layout: 'optimized' | 'current' | 'alternative';
    styling: 'auto' | 'inherit' | 'custom';
    animation: 'fade' | 'slide' | 'scale' | 'none';
    warnings?: string[];
}

export interface GhostPreviewProps {
    element: DraggedElement | null;
    dropTargets: DropTarget[];
    mousePosition: { x: number; y: number };
    isDropping: boolean;
    predictions: PlacementPrediction[];
    onPredictionSelect?: (prediction: PlacementPrediction) => void;
    onDrop?: (element: DraggedElement, target: DropTarget, prediction: PlacementPrediction) => void;
}

// =============================================================================
// GHOST PREVIEW COMPONENT
// =============================================================================

export function GhostPreview({
    element,
    dropTargets,
    mousePosition,
    isDropping,
    predictions,
    onPredictionSelect,
    onDrop: _onDrop,
}: GhostPreviewProps) {
    // Note: _onDrop is available for integration when drop is executed via useDragPreview hook
    void _onDrop;

    const containerRef = useRef<HTMLDivElement>(null);
    const [activePrediction, setActivePrediction] = useState<PlacementPrediction | null>(null);
    const [hoveredTarget, setHoveredTarget] = useState<DropTarget | null>(null);
    const [showPredictions, setShowPredictions] = useState(false);

    // Smooth spring-based motion
    const mouseX = useMotionValue(mousePosition.x);
    const mouseY = useMotionValue(mousePosition.y);
    const springX = useSpring(mouseX, { stiffness: 600, damping: 30 });
    const springY = useSpring(mouseY, { stiffness: 600, damping: 30 });

    // 3D rotation based on velocity
    const velocityX = useMotionValue(0);
    const velocityY = useMotionValue(0);
    const rotateX = useTransform(velocityY, [-500, 500], [15, -15]);
    const rotateY = useTransform(velocityX, [-500, 500], [-15, 15]);

    // Update mouse position with velocity tracking
    useEffect(() => {
        const dx = mousePosition.x - mouseX.get();
        const dy = mousePosition.y - mouseY.get();
        velocityX.set(dx * 10);
        velocityY.set(dy * 10);
        mouseX.set(mousePosition.x);
        mouseY.set(mousePosition.y);
    }, [mousePosition.x, mousePosition.y, mouseX, mouseY, velocityX, velocityY]);

    // Find hovered target
    useEffect(() => {
        const target = dropTargets.find(t => {
            const { x, y, width, height } = t.bounds;
            return mousePosition.x >= x && mousePosition.x <= x + width &&
                   mousePosition.y >= y && mousePosition.y <= y + height;
        });
        setHoveredTarget(target || null);

        // Show predictions when hovering a target
        if (target && predictions.length > 0) {
            setShowPredictions(true);
            // Auto-select highest confidence prediction
            const best = predictions.reduce((a, b) => a.confidence > b.confidence ? a : b);
            setActivePrediction(best);
        } else {
            setShowPredictions(false);
            setActivePrediction(null);
        }
    }, [mousePosition, dropTargets, predictions]);

    // Handle prediction selection
    const handlePredictionClick = useCallback((prediction: PlacementPrediction) => {
        setActivePrediction(prediction);
        onPredictionSelect?.(prediction);
    }, [onPredictionSelect]);

    if (!element) return null;

    return (
        <div className="ghost-preview-container" ref={containerRef}>
            {/* Main ghost preview - follows cursor */}
            <AnimatePresence>
                <motion.div
                    className="ghost-preview"
                    style={{
                        x: springX,
                        y: springY,
                        rotateX,
                        rotateY,
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                        opacity: 1,
                        scale: isDropping ? 0.95 : 1,
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                    {/* Ghost element preview */}
                    <div className="ghost-preview__element">
                        {element.thumbnail ? (
                            <img
                                src={element.thumbnail}
                                alt={element.name}
                                className="ghost-preview__thumbnail"
                            />
                        ) : (
                            <div className="ghost-preview__placeholder">
                                <ElementIcon type={element.type} />
                                <span>{element.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Type indicator */}
                    <div className="ghost-preview__type-badge">
                        {element.type}
                    </div>

                    {/* Confidence indicator when hovering target */}
                    {activePrediction && (
                        <motion.div
                            className="ghost-preview__confidence"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="ghost-preview__confidence-bar">
                                <motion.div
                                    className="ghost-preview__confidence-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${activePrediction.confidence * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <span>{Math.round(activePrediction.confidence * 100)}% match</span>
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Drop target highlights */}
            {dropTargets.map(target => (
                <motion.div
                    key={target.id}
                    className={cn(
                        "ghost-preview__target",
                        hoveredTarget?.id === target.id && "ghost-preview__target--active"
                    )}
                    style={{
                        left: target.bounds.x,
                        top: target.bounds.y,
                        width: target.bounds.width,
                        height: target.bounds.height,
                    }}
                    animate={{
                        borderColor: hoveredTarget?.id === target.id
                            ? 'rgba(245, 168, 108, 0.8)'
                            : 'rgba(245, 168, 108, 0.2)',
                        backgroundColor: hoveredTarget?.id === target.id
                            ? 'rgba(245, 168, 108, 0.1)'
                            : 'transparent',
                    }}
                >
                    <span className="ghost-preview__target-label">
                        {target.name}
                    </span>
                </motion.div>
            ))}

            {/* Multi-outcome prediction panel */}
            <AnimatePresence>
                {showPredictions && predictions.length > 1 && (
                    <motion.div
                        className="ghost-preview__predictions"
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        style={{
                            left: springX,
                            top: springY,
                        }}
                    >
                        <div className="ghost-preview__predictions-header">
                            <span>Placement Options</span>
                            <span className="ghost-preview__predictions-count">
                                {predictions.length}
                            </span>
                        </div>

                        <div className="ghost-preview__predictions-list">
                            {predictions.map((prediction, index) => (
                                <motion.button
                                    key={prediction.id}
                                    className={cn(
                                        "ghost-preview__prediction",
                                        activePrediction?.id === prediction.id && "ghost-preview__prediction--active"
                                    )}
                                    onClick={() => handlePredictionClick(prediction)}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <div className="ghost-preview__prediction-info">
                                        <span className="ghost-preview__prediction-position">
                                            {prediction.position}
                                        </span>
                                        <span className="ghost-preview__prediction-layout">
                                            {prediction.preview.layout}
                                        </span>
                                    </div>

                                    <div className="ghost-preview__prediction-confidence">
                                        <div className="ghost-preview__prediction-bar">
                                            <motion.div
                                                className="ghost-preview__prediction-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${prediction.confidence * 100}%` }}
                                            />
                                        </div>
                                        <span>{Math.round(prediction.confidence * 100)}%</span>
                                    </div>

                                    {prediction.preview.warnings && prediction.preview.warnings.length > 0 && (
                                        <div className="ghost-preview__prediction-warning">
                                            {prediction.preview.warnings[0]}
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        {activePrediction?.recommendation && (
                            <div className="ghost-preview__recommendation">
                                <span>Recommended:</span>
                                {activePrediction.recommendation}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drop indicator line */}
            {hoveredTarget && activePrediction && (
                <DropIndicator
                    target={hoveredTarget}
                    prediction={activePrediction}
                />
            )}
        </div>
    );
}

// =============================================================================
// ELEMENT ICON COMPONENT
// =============================================================================

function ElementIcon({ type }: { type: DraggedElement['type'] }) {
    const icons: Record<DraggedElement['type'], string> = {
        component: 'M4 4h16v16H4z',
        layout: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
        image: 'M4 4h16v16H4zM9 9l3 3 3-3',
        text: 'M4 7h16M4 12h16M4 17h10',
        button: 'M4 8h16v8H4z',
        input: 'M4 9h16v6H4z',
        container: 'M3 3h18v18H3zM7 7h10v10H7z',
    };

    return (
        <svg
            className="ghost-preview__element-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path d={icons[type]} />
        </svg>
    );
}

// =============================================================================
// DROP INDICATOR COMPONENT
// =============================================================================

function DropIndicator({
    target,
    prediction,
}: {
    target: DropTarget;
    prediction: PlacementPrediction;
}) {
    const { bounds } = target;

    // Calculate indicator position based on prediction
    const getIndicatorStyle = () => {
        switch (prediction.position) {
            case 'before':
                return {
                    left: bounds.x,
                    top: bounds.y - 2,
                    width: bounds.width,
                    height: 4,
                };
            case 'after':
                return {
                    left: bounds.x,
                    top: bounds.y + bounds.height - 2,
                    width: bounds.width,
                    height: 4,
                };
            case 'inside':
                return {
                    left: bounds.x + bounds.width / 4,
                    top: bounds.y + bounds.height / 4,
                    width: bounds.width / 2,
                    height: bounds.height / 2,
                };
            case 'replace':
                return {
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                };
            default:
                return {};
        }
    };

    return (
        <motion.div
            className={cn(
                "ghost-preview__drop-indicator",
                `ghost-preview__drop-indicator--${prediction.position}`
            )}
            style={getIndicatorStyle()}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
    );
}

// =============================================================================
// DRAG CONTEXT HOOK
// =============================================================================

export interface DragState {
    isDragging: boolean;
    element: DraggedElement | null;
    mousePosition: { x: number; y: number };
    dropTargets: DropTarget[];
    predictions: PlacementPrediction[];
}

export function useDragPreview(options: {
    onDragStart?: (element: DraggedElement) => void;
    onDragEnd?: (element: DraggedElement, success: boolean) => void;
    onDrop?: (element: DraggedElement, target: DropTarget, prediction: PlacementPrediction) => void;
}) {
    const [state, setState] = useState<DragState>({
        isDragging: false,
        element: null,
        mousePosition: { x: 0, y: 0 },
        dropTargets: [],
        predictions: [],
    });

    const startDrag = useCallback((element: DraggedElement, targets: DropTarget[]) => {
        setState(prev => ({
            ...prev,
            isDragging: true,
            element,
            dropTargets: targets,
            predictions: [],
        }));
        options.onDragStart?.(element);
    }, [options]);

    const updatePosition = useCallback((x: number, y: number) => {
        setState(prev => ({
            ...prev,
            mousePosition: { x, y },
        }));
    }, []);

    const updatePredictions = useCallback((predictions: PlacementPrediction[]) => {
        setState(prev => ({
            ...prev,
            predictions,
        }));
    }, []);

    const endDrag = useCallback((success: boolean = false) => {
        if (state.element) {
            options.onDragEnd?.(state.element, success);
        }
        setState({
            isDragging: false,
            element: null,
            mousePosition: { x: 0, y: 0 },
            dropTargets: [],
            predictions: [],
        });
    }, [state.element, options]);

    const drop = useCallback((target: DropTarget, prediction: PlacementPrediction) => {
        if (state.element) {
            options.onDrop?.(state.element, target, prediction);
            endDrag(true);
        }
    }, [state.element, options, endDrag]);

    return {
        state,
        startDrag,
        updatePosition,
        updatePredictions,
        endDrag,
        drop,
    };
}

export default GhostPreview;

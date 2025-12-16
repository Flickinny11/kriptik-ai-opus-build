/**
 * NetworkGraph3D - Premium 3D network visualization
 *
 * Features:
 * - Nodes as glass spheres
 * - Edges as glowing lines
 * - Force-directed layout (spring physics)
 * - Hover highlights connections
 * - Node size by importance
 * - Real-time layout animation
 */

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, MeshTransmissionMaterial, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ============================================================================
// TYPES
// ============================================================================

export interface NetworkNode {
    id: string;
    label: string;
    value?: number;
    color?: string;
    size?: number;
    group?: string;
    metadata?: Record<string, unknown>;
}

export interface NetworkEdge {
    source: string;
    target: string;
    weight?: number;
    color?: string;
    label?: string;
}

export interface NetworkGraph3DProps {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    onNodeClick?: (node: NetworkNode) => void;
    onNodeHover?: (node: NetworkNode | null) => void;
    onEdgeClick?: (edge: NetworkEdge) => void;
    width?: number;
    height?: number;
    depth?: number;
    nodeScale?: number;
    edgeOpacity?: number;
    showLabels?: boolean;
    animate?: boolean;
    autoLayout?: boolean;
    centerNode?: string;
}

interface NodePosition {
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
}

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

const PHYSICS = {
    repulsion: 2.5,
    attraction: 0.02,
    damping: 0.85,
    minDistance: 0.8,
    maxVelocity: 0.3,
    centerGravity: 0.005,
};

// ============================================================================
// NODE COMPONENT
// ============================================================================

function GraphNode({
    node,
    position,
    isHovered,
    isConnected,
    onHover,
    onClick,
    showLabel,
    baseScale,
}: {
    node: NetworkNode;
    position: [number, number, number];
    isHovered: boolean;
    isConnected: boolean;
    onHover: (hovered: boolean) => void;
    onClick: () => void;
    showLabel: boolean;
    baseScale: number;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const nodeSize = (node.size || 1) * baseScale;
    const nodeColor = node.color || '#F5A86C';

    // Animation for hover/selection
    const { scale, emissiveIntensity } = useSpring({
        scale: isHovered ? 1.3 : isConnected ? 1.1 : 1,
        emissiveIntensity: isHovered ? 0.6 : isConnected ? 0.3 : 0.1,
        config: { tension: 300, friction: 20 },
    });

    // Gentle floating animation
    useFrame((state) => {
        if (meshRef.current && !isHovered) {
            meshRef.current.position.y =
                position[1] + Math.sin(state.clock.elapsedTime + node.id.charCodeAt(0)) * 0.05;
        }
    });

    return (
        <group position={position}>
            <animated.mesh
                ref={meshRef}
                scale={scale.to((s) => s * nodeSize)}
                onPointerOver={() => {
                    onHover(true);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    onHover(false);
                    document.body.style.cursor = 'default';
                }}
                onClick={onClick}
            >
                <sphereGeometry args={[0.25, 32, 32]} />
                <MeshTransmissionMaterial
                    backside
                    samples={4}
                    resolution={256}
                    transmission={0.95}
                    roughness={0.1}
                    thickness={0.5}
                    ior={1.5}
                    chromaticAberration={0.02}
                    distortion={0.1}
                    distortionScale={0.2}
                    color={nodeColor}
                    attenuationDistance={0.5}
                    attenuationColor={nodeColor}
                />
            </animated.mesh>

            {/* Inner glow */}
            <animated.mesh scale={scale.to((s) => s * nodeSize * 0.6)}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <animated.meshStandardMaterial
                    color={nodeColor}
                    emissive={nodeColor}
                    emissiveIntensity={emissiveIntensity}
                    transparent
                    opacity={0.5}
                />
            </animated.mesh>

            {/* Outer glow for hovered state */}
            {isHovered && (
                <mesh scale={nodeSize * 1.8}>
                    <sphereGeometry args={[0.25, 16, 16]} />
                    <meshBasicMaterial
                        color={nodeColor}
                        transparent
                        opacity={0.15}
                    />
                </mesh>
            )}

            {/* Label */}
            {showLabel && (
                <Html
                    position={[0, nodeSize * 0.4, 0]}
                    center
                    distanceFactor={5}
                    style={{ pointerEvents: 'none' }}
                >
                    <div
                        style={{
                            background: isHovered
                                ? 'rgba(20, 20, 20, 0.95)'
                                : 'rgba(20, 20, 20, 0.7)',
                            backdropFilter: 'blur(8px)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${isHovered ? nodeColor : 'rgba(255,255,255,0.2)'}`,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <span
                            style={{
                                color: isHovered ? nodeColor : 'rgba(255, 255, 255, 0.8)',
                                fontFamily: 'var(--font-sans, system-ui)',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}
                        >
                            {node.label}
                        </span>
                        {isHovered && node.value !== undefined && (
                            <span
                                style={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: '10px',
                                    marginLeft: '6px',
                                }}
                            >
                                {node.value}
                            </span>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
}

// ============================================================================
// EDGE COMPONENT
// ============================================================================

function GraphEdge({
    start,
    end,
    edge,
    isHighlighted,
    onClick,
}: {
    start: [number, number, number];
    end: [number, number, number];
    edge: NetworkEdge;
    isHighlighted: boolean;
    onClick: () => void;
}) {
    const edgeColor = edge.color || '#F5A86C';
    const weight = edge.weight || 1;

    // Create curved path
    const curve = useMemo(() => {
        const startVec = new THREE.Vector3(...start);
        const endVec = new THREE.Vector3(...end);
        const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);

        // Add slight curve
        const direction = endVec.clone().sub(startVec).normalize();
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, direction.z * 0.5);
        midPoint.add(perpendicular.multiplyScalar(0.2));

        return new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    }, [start, end]);

    const points = useMemo(() => curve.getPoints(20), [curve]);

    return (
        <Line
            points={points}
            color={edgeColor}
            lineWidth={isHighlighted ? 3 : 1.5 * weight}
            transparent
            opacity={isHighlighted ? 0.9 : 0.3}
            onClick={onClick}
        />
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NetworkGraph3D({
    nodes,
    edges,
    onNodeClick,
    onNodeHover,
    onEdgeClick,
    width = 10,
    height = 10,
    depth = 5,
    nodeScale = 1,
    showLabels = true,
    animate = true,
    autoLayout = true,
    centerNode: _centerNode,
}: NetworkGraph3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());

    // Initialize node positions
    useEffect(() => {
        const positions = new Map<string, NodePosition>();

        nodes.forEach((node, index) => {
            // Arrange nodes in a sphere initially
            const phi = Math.acos(-1 + (2 * index) / nodes.length);
            const theta = Math.sqrt(nodes.length * Math.PI) * phi;
            const radius = 2;

            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);

            positions.set(node.id, {
                id: node.id,
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(0, 0, 0),
            });
        });

        setNodePositions(positions);
    }, [nodes]);

    // Force-directed layout simulation
    useFrame(() => {
        if (!autoLayout || !animate) return;

        setNodePositions((prevPositions) => {
            const newPositions = new Map(prevPositions);

            // Apply forces
            nodes.forEach((nodeA) => {
                const posA = newPositions.get(nodeA.id);
                if (!posA) return;

                const force = new THREE.Vector3(0, 0, 0);

                // Repulsion from other nodes
                nodes.forEach((nodeB) => {
                    if (nodeA.id === nodeB.id) return;

                    const posB = newPositions.get(nodeB.id);
                    if (!posB) return;

                    const diff = posA.position.clone().sub(posB.position);
                    const distance = Math.max(diff.length(), PHYSICS.minDistance);
                    const repulsionForce = diff
                        .normalize()
                        .multiplyScalar(PHYSICS.repulsion / (distance * distance));
                    force.add(repulsionForce);
                });

                // Attraction from connected edges
                edges.forEach((edge) => {
                    let connectedId: string | null = null;
                    if (edge.source === nodeA.id) connectedId = edge.target;
                    else if (edge.target === nodeA.id) connectedId = edge.source;

                    if (connectedId) {
                        const posB = newPositions.get(connectedId);
                        if (posB) {
                            const diff = posB.position.clone().sub(posA.position);
                            const attractionForce = diff.multiplyScalar(
                                PHYSICS.attraction * (edge.weight || 1)
                            );
                            force.add(attractionForce);
                        }
                    }
                });

                // Center gravity
                const centerForce = posA.position
                    .clone()
                    .negate()
                    .multiplyScalar(PHYSICS.centerGravity);
                force.add(centerForce);

                // Update velocity with damping
                posA.velocity.add(force).multiplyScalar(PHYSICS.damping);

                // Clamp velocity
                if (posA.velocity.length() > PHYSICS.maxVelocity) {
                    posA.velocity.normalize().multiplyScalar(PHYSICS.maxVelocity);
                }

                // Update position
                posA.position.add(posA.velocity);

                // Bound to space
                posA.position.x = Math.max(-width / 2, Math.min(width / 2, posA.position.x));
                posA.position.y = Math.max(-height / 2, Math.min(height / 2, posA.position.y));
                posA.position.z = Math.max(-depth / 2, Math.min(depth / 2, posA.position.z));
            });

            return newPositions;
        });
    });

    // Get connected nodes for highlighting
    const connectedNodes = useMemo(() => {
        if (!hoveredNode) return new Set<string>();

        const connected = new Set<string>();
        edges.forEach((edge) => {
            if (edge.source === hoveredNode) connected.add(edge.target);
            if (edge.target === hoveredNode) connected.add(edge.source);
        });
        return connected;
    }, [hoveredNode, edges]);

    // Handle node hover
    const handleNodeHover = useCallback(
        (node: NetworkNode, hovered: boolean) => {
            setHoveredNode(hovered ? node.id : null);
            onNodeHover?.(hovered ? node : null);
        },
        [onNodeHover]
    );

    return (
        <group ref={groupRef}>
            {/* Edges */}
            {edges.map((edge, index) => {
                const startPos = nodePositions.get(edge.source);
                const endPos = nodePositions.get(edge.target);

                if (!startPos || !endPos) return null;

                const isHighlighted =
                    hoveredNode === edge.source || hoveredNode === edge.target;

                return (
                    <GraphEdge
                        key={`edge-${index}`}
                        start={startPos.position.toArray() as [number, number, number]}
                        end={endPos.position.toArray() as [number, number, number]}
                        edge={edge}
                        isHighlighted={isHighlighted}
                        onClick={() => onEdgeClick?.(edge)}
                    />
                );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;

                const isHovered = hoveredNode === node.id;
                const isConnected = connectedNodes.has(node.id);

                return (
                    <GraphNode
                        key={node.id}
                        node={node}
                        position={pos.position.toArray() as [number, number, number]}
                        isHovered={isHovered}
                        isConnected={isConnected}
                        onHover={(hovered) => handleNodeHover(node, hovered)}
                        onClick={() => onNodeClick?.(node)}
                        showLabel={showLabels}
                        baseScale={nodeScale}
                    />
                );
            })}
        </group>
    );
}

export default NetworkGraph3D;

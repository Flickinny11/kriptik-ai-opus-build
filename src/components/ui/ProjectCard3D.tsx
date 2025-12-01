import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ProjectCard3DProps {
    onClick: () => void;
    isHovered?: boolean;
}

// Typing animation hook
function useTypingAnimation(lines: string[], speed: number = 50) {
    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);

    useEffect(() => {
        if (currentLineIndex >= lines.length) {
            const resetTimer = setTimeout(() => {
                setDisplayedLines([]);
                setCurrentLineIndex(0);
                setCurrentCharIndex(0);
            }, 3000);
            return () => clearTimeout(resetTimer);
        }

        const currentLine = lines[currentLineIndex];

        if (currentCharIndex < currentLine.length) {
            const timer = setTimeout(() => {
                setDisplayedLines(prev => {
                    const newLines = [...prev];
                    newLines[currentLineIndex] = currentLine.slice(0, currentCharIndex + 1);
                    return newLines;
                });
                setCurrentCharIndex(prev => prev + 1);
            }, speed + Math.random() * 30);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => {
                setCurrentLineIndex(prev => prev + 1);
                setCurrentCharIndex(0);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentLineIndex, currentCharIndex, lines, speed]);

    return { displayedLines, isTyping: currentLineIndex < lines.length };
}

// The 3D Tablet Card - matches Remotion reference exactly
function TabletCard3D({ isHovered, onClick }: { isHovered: boolean; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);

    // Dimensions matching reference image proportions
    const width = 3.6;
    const height = 2.7;
    const depth = 0.18; // Visible thickness for the edges
    const cornerRadius = 0.08;

    // Code lines matching the reference image
    const codeLines = useMemo(() => [
        'const MyVideo = () => {',
        '  return (',
        '    <AbsoluteFill>',
        '      <Video',
        "        src={staticFile('video.mp4')}",
        '      />',
        '      <Sequence from={60}>',
        '        <BRoll',
        '      </Sequence>',
        '      <AbsoluteFill>',
        '        <Captions />',
        '      </AbsoluteFill>',
    ], []);

    const { displayedLines, isTyping } = useTypingAnimation(codeLines, 35);

    // Rotation matching reference: tilted back, rotated left showing bottom+left edges
    // Reference shows: looking down at ~30deg, slight left rotation
    useFrame((state) => {
        if (groupRef.current) {
            // Target rotation: X tilts back (positive = top away), Y rotates (negative = left side forward)
            const baseX = 0.45; // ~26 degrees tilt back
            const baseY = -0.25; // ~14 degrees rotation showing left edge
            const baseZ = 0.05; // slight roll

            const targetX = isHovered ? baseX - 0.1 : baseX;
            const targetY = isHovered ? baseY + 0.08 : baseY;
            const targetZ = isHovered ? baseZ - 0.02 : baseZ;

            groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.08;
            groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.08;
            groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.08;

            // Subtle float
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.015;
        }
    });

    const getLineColor = (text: string) => {
        if (text.includes('const') || text.includes('return')) return '#c792ea';
        if (text.includes('<') || text.includes('>') || text.includes('/')) return '#89ddff';
        if (text.includes("'") || text.includes('"')) return '#c3e88d';
        if (text.includes('from=') || text.includes('src=')) return '#f78c6c';
        return '#d4d4d4';
    };

    return (
        <group ref={groupRef} onClick={onClick} position={[0, 0, 0]}>
            {/* Main tablet body - the thick slab */}
            <RoundedBox
                args={[width, height, depth]}
                radius={cornerRadius}
                smoothness={4}
                position={[0, 0, 0]}
            >
                <meshStandardMaterial
                    color="#2d313a"
                    metalness={0.15}
                    roughness={0.75}
                />
            </RoundedBox>

            {/* Screen bezel - slightly inset darker area */}
            <RoundedBox
                args={[width - 0.15, height - 0.15, 0.01]}
                radius={cornerRadius - 0.02}
                smoothness={4}
                position={[0, 0, depth / 2 + 0.005]}
            >
                <meshStandardMaterial
                    color="#1a1d23"
                    metalness={0.05}
                    roughness={0.95}
                />
            </RoundedBox>

            {/* Screen surface with code */}
            <RoundedBox
                args={[width - 0.25, height - 0.25, 0.005]}
                radius={cornerRadius - 0.03}
                smoothness={4}
                position={[0, 0, depth / 2 + 0.015]}
            >
                <meshStandardMaterial
                    color="#1e1e1e"
                    metalness={0}
                    roughness={1}
                    emissive="#1e1e1e"
                    emissiveIntensity={0.1}
                />
            </RoundedBox>

            {/* Code content */}
            <Html
                transform
                occlude
                position={[0, 0.1, depth / 2 + 0.025]}
                style={{
                    width: '320px',
                    height: '220px',
                    pointerEvents: 'none',
                }}
            >
                <div style={{
                    width: '320px',
                    height: '220px',
                    padding: '20px',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', monospace",
                    fontSize: '11px',
                    lineHeight: '1.6',
                    color: '#d4d4d4',
                    background: 'transparent',
                    overflow: 'hidden',
                }}>
                    {displayedLines.map((line, i) => (
                        <div key={i} style={{
                            whiteSpace: 'pre',
                            color: getLineColor(line),
                        }}>
                            {line}
                            {i === displayedLines.length - 1 && isTyping && (
                                <span style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '14px',
                                    background: '#528bff',
                                    marginLeft: '2px',
                                    animation: 'blink 1s infinite',
                                    verticalAlign: 'text-bottom',
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            </Html>

            {/* Bottom edge - visible due to tilt */}
            <mesh position={[0, -height/2 + 0.02, -depth/4]}>
                <boxGeometry args={[width - 0.02, 0.04, depth/2]} />
                <meshStandardMaterial
                    color="#0c0d0f"
                    metalness={0.2}
                    roughness={0.8}
                />
            </mesh>

            {/* Left edge - visible due to rotation */}
            <mesh position={[-width/2 + 0.02, 0, -depth/4]}>
                <boxGeometry args={[0.04, height - 0.02, depth/2]} />
                <meshStandardMaterial
                    color="#08090a"
                    metalness={0.2}
                    roughness={0.8}
                />
            </mesh>

            {/* Subtle screen reflection/glare */}
            <mesh position={[0.3, 0.3, depth / 2 + 0.02]} rotation={[0, 0, -0.2]}>
                <planeGeometry args={[1.5, 0.15]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.03}
                />
            </mesh>
        </group>
    );
}

// Ground shadow component
function GroundShadow() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, -1.8, -0.5]}>
            <planeGeometry args={[4, 2.5]} />
            <meshBasicMaterial
                color="#000000"
                transparent
                opacity={0.25}
            />
        </mesh>
    );
}

// Main component with Canvas
export function ProjectCard3D({ onClick, isHovered = false }: ProjectCard3DProps) {
    const [hovered, setHovered] = useState(isHovered);

    return (
        <div
            className="w-full cursor-pointer relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                height: '220px',
                marginBottom: '20px',
            }}
        >
            <Canvas
                camera={{
                    position: [0, 0.5, 5],
                    fov: 35,
                }}
                style={{ background: 'transparent' }}
                gl={{ alpha: true, antialias: true }}
            >
                {/* Lighting setup for realistic shadows */}
                <ambientLight intensity={0.4} />
                <directionalLight
                    position={[4, 6, 4]}
                    intensity={0.9}
                    castShadow
                />
                <directionalLight
                    position={[-2, 3, 2]}
                    intensity={0.3}
                />
                <pointLight position={[0, 2, 3]} intensity={0.2} />

                <TabletCard3D
                    isHovered={hovered}
                    onClick={onClick}
                />
                <GroundShadow />
            </Canvas>

            {/* Hover overlay */}
            {hovered && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%)',
                    }}
                >
                    <span className="flex items-center gap-2 text-sm text-white font-semibold px-5 py-2.5 rounded-full shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}>
                        Open Project →
                    </span>
                </div>
            )}

            <style>{`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}

export default ProjectCard3D;


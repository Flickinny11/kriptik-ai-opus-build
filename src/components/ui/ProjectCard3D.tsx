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
            // Reset after a pause
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
            // Move to next line
            const timer = setTimeout(() => {
                setCurrentLineIndex(prev => prev + 1);
                setCurrentCharIndex(0);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentLineIndex, currentCharIndex, lines, speed]);

    return { displayedLines, isTyping: currentLineIndex < lines.length };
}

// The 3D Card mesh
function Card3D({ isHovered, onClick }: { isHovered: boolean; onClick: () => void }) {
    const meshRef = useRef<THREE.Group>(null);

    // Code lines for typing animation
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

    const { displayedLines, isTyping } = useTypingAnimation(codeLines, 40);

    // Smooth rotation animation
    useFrame((state) => {
        if (meshRef.current) {
            const target = isHovered 
                ? { x: 0.15, y: -0.08, z: 0.02 }
                : { x: 0.25, y: -0.15, z: 0.03 };
            
            meshRef.current.rotation.x += (target.x - meshRef.current.rotation.x) * 0.1;
            meshRef.current.rotation.y += (target.y - meshRef.current.rotation.y) * 0.1;
            meshRef.current.rotation.z += (target.z - meshRef.current.rotation.z) * 0.1;

            // Subtle floating animation
            meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
        }
    });

    // Get syntax color for a line
    const getLineColor = (text: string) => {
        if (text.includes('const') || text.includes('return')) return '#c792ea';
        if (text.includes('<')) return '#4fc1ff';
        if (text.includes("'")) return '#c3e88d';
        return '#d4d4d4';
    };

    return (
        <group ref={meshRef} onClick={onClick} rotation={[0.25, -0.15, 0.03]}>
            {/* Main body - the tablet */}
            <RoundedBox
                args={[3.2, 2.4, 0.12]} // width, height, depth
                radius={0.06}
                smoothness={4}
            >
                <meshStandardMaterial
                    color="#282c34"
                    metalness={0.1}
                    roughness={0.8}
                />
            </RoundedBox>

            {/* Screen surface - slightly raised */}
            <RoundedBox
                args={[3.0, 2.2, 0.02]}
                radius={0.04}
                smoothness={4}
                position={[0, 0, 0.07]}
            >
                <meshStandardMaterial
                    color="#1e1e1e"
                    metalness={0}
                    roughness={0.9}
                />
            </RoundedBox>

            {/* Code content overlay using Html */}
            <Html
                transform
                occlude
                position={[0, 0, 0.09]}
                style={{
                    width: '280px',
                    height: '200px',
                    pointerEvents: 'none',
                }}
            >
                <div style={{
                    width: '280px',
                    height: '200px',
                    padding: '16px',
                    fontFamily: "'Fira Code', 'Monaco', monospace",
                    fontSize: '10px',
                    lineHeight: '1.5',
                    color: '#d4d4d4',
                    background: 'transparent',
                    overflow: 'hidden',
                }}>
                    {displayedLines.map((line, i) => (
                        <div key={i} style={{ 
                            whiteSpace: 'pre',
                            color: getLineColor(line)
                        }}>
                            {line}
                            {i === displayedLines.length - 1 && isTyping && (
                                <span style={{
                                    display: 'inline-block',
                                    width: '6px',
                                    height: '12px',
                                    background: '#528bff',
                                    marginLeft: '2px',
                                    animation: 'blink 1s infinite',
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            </Html>

            {/* Bottom edge highlight */}
            <mesh position={[0, -1.14, -0.03]}>
                <boxGeometry args={[3.2, 0.08, 0.06]} />
                <meshStandardMaterial color="#0f1012" metalness={0.3} roughness={0.7} />
            </mesh>

            {/* Left edge highlight */}
            <mesh position={[-1.54, 0, -0.03]}>
                <boxGeometry args={[0.08, 2.4, 0.06]} />
                <meshStandardMaterial color="#0a0b0d" metalness={0.3} roughness={0.7} />
            </mesh>
        </group>
    );
}

// Main component with Canvas
export function ProjectCard3D({ onClick, isHovered = false }: ProjectCard3DProps) {
    const [hovered, setHovered] = useState(isHovered);

    return (
        <div 
            className="w-full aspect-[4/3] cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ minHeight: '200px' }}
        >
            <Canvas
                camera={{ position: [0, 0, 4], fov: 45 }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <directionalLight position={[-3, -3, 2]} intensity={0.3} />
                
                <Card3D 
                    isHovered={hovered} 
                    onClick={onClick}
                />
            </Canvas>

            {/* Hover overlay */}
            {hovered && (
                <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ 
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '8px',
                    }}
                >
                    <span className="flex items-center gap-2 text-sm text-white font-medium px-4 py-2 rounded-full bg-red-600">
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


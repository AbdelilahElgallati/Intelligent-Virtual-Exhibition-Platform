'use client';

import React, { memo, useRef, useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Stand } from '@/types/stand';

/* ── Booth dimensions ── */
const BOOTH_W = 3.4;   // width  (X)
const BOOTH_D = 2.8;   // depth  (Z)
const WALL_H = 2.2;    // wall height
const WALL_T = 0.08;   // wall thickness
const FLOOR_T = 0.05;
/* Extra space in front of booth for the floor label */
const LABEL_OFFSET_Z = BOOTH_D / 2 + 0.9;

interface BoothProps {
    stand: Stand;
    position: [number, number, number];
    onClick: (id: string) => void;
}

/* ── Booth style variant derived from stand index ── */
type BoothVariant = 0 | 1 | 2 | 3;

function getVariant(stand: Stand): BoothVariant {
    const id = stand.id || (stand as any)._id || '';
    const hash = id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    return (hash % 4) as BoothVariant;
}

/* ── Truncate name to first line (~22 chars) for label safety ── */
function truncateName(name: string, max = 24): string {
    if (name.length <= max) return name;
    return name.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Booth — A richly furnished isometric exhibition stand with 4 visual variants:
 *   Variant 0 — Classic: desk + monitor + chair + shelf + plant
 *   Variant 1 — Lounge:  round table + 2 stools + tall banner + plant
 *   Variant 2 — Kiosk:   L-counter + display stand + brochure rack
 *   Variant 3 — Stage:   podium + projector screen + seating row
 *
 * All share: themed back wall, side walls, screen, floor label
 */
function BoothInner({ stand, position, onClick }: BoothProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    const standId = stand.id || (stand as any)._id;
    const themeColor = stand.theme_color || '#6366f1';
    const variant = getVariant(stand);

    // Load logo texture safely
    const logoTexture = useMemo(() => {
        if (!stand.logo_url) return null;
        try {
            const loader = new THREE.TextureLoader();
            return loader.load(stand.logo_url);
        } catch {
            return null;
        }
    }, [stand.logo_url]);

    const wallColor = '#e8e8ec';
    const floorColor = '#f0f0f4';
    const displayName = truncateName(stand.name || 'Stand');

    return (
        <group
            ref={groupRef}
            position={position}
            scale={hovered ? [1.05, 1.05, 1.05] : [1, 1, 1]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            onClick={(e) => { e.stopPropagation(); onClick(standId); }}
        >
            {/* ══════════════════════════════════════════════════════════
                SHARED SHELL: floor, walls, screen, banner stripe
               ══════════════════════════════════════════════════════════ */}

            {/* ── Floor plate ── */}
            <mesh position={[0, FLOOR_T / 2, 0]}>
                <boxGeometry args={[BOOTH_W, FLOOR_T, BOOTH_D]} />
                <meshStandardMaterial color={floorColor} roughness={0.55} />
            </mesh>
            {/* Carpet strip */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_T + 0.002, 0]}>
                <planeGeometry args={[BOOTH_W - 0.4, BOOTH_D - 0.4]} />
                <meshStandardMaterial color={themeColor} transparent opacity={0.08} roughness={0.9} />
            </mesh>
            {/* Front accent strip */}
            <mesh position={[0, FLOOR_T + 0.005, BOOTH_D / 2 - 0.06]}>
                <boxGeometry args={[BOOTH_W, 0.02, 0.14]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={hovered ? 0.7 : 0.3} roughness={0.3} />
            </mesh>

            {/* ── Back wall (themed) ── */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T / 2]}>
                <boxGeometry args={[BOOTH_W, WALL_H, WALL_T]} />
                <meshStandardMaterial color={themeColor} roughness={0.6} metalness={0.05} />
            </mesh>
            {/* Inner panel */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T + 0.005]}>
                <planeGeometry args={[BOOTH_W - 0.3, WALL_H - 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>

            {/* ── Screen bezel ── */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.008]}>
                <boxGeometry args={[BOOTH_W * 0.55, WALL_H * 0.36, 0.025]} />
                <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.2} />
            </mesh>
            {/* Screen display */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.025]}>
                <planeGeometry args={[BOOTH_W * 0.5, WALL_H * 0.32]} />
                {logoTexture ? (
                    <meshStandardMaterial map={logoTexture} roughness={0.5} />
                ) : (
                    <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.5} />
                )}
            </mesh>

            {/* Name on back wall */}
            <Text
                position={[0, WALL_H * 0.28, -BOOTH_D / 2 + WALL_T + 0.02]}
                fontSize={0.17}
                maxWidth={BOOTH_W * 0.85}
                textAlign="center"
                color="#333"
                anchorX="center"
                anchorY="middle"
                font={undefined}
            >
                {displayName}
            </Text>

            {/* Top banner stripe */}
            <mesh position={[0, WALL_H - 0.08, -BOOTH_D / 2 + WALL_T / 2 - 0.001]}>
                <boxGeometry args={[BOOTH_W, 0.16, WALL_T + 0.01]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>

            {/* ── Left wall ── */}
            <mesh position={[-BOOTH_W / 2 + WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.005, WALL_H * 0.85, 0]}>
                <boxGeometry args={[0.01, 0.12, BOOTH_D - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.25} roughness={0.4} />
            </mesh>

            {/* ── Right wall (partial) ── */}
            <mesh position={[BOOTH_W / 2 - WALL_T / 2, WALL_H / 2, -BOOTH_D / 4]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D / 2]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>
            <mesh position={[BOOTH_W / 2 - WALL_T - 0.005, WALL_H * 0.85, -BOOTH_D / 4]}>
                <boxGeometry args={[0.01, 0.12, BOOTH_D / 2 - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.25} roughness={0.4} />
            </mesh>

            {/* ══════════════════════════════════════════════════════════
                VARIANT FURNITURE
               ══════════════════════════════════════════════════════════ */}

            {variant === 0 && (
                /* ── Variant 0 — Classic: desk + monitor + chair + shelf + plant ── */
                <group>
                    {/* Desk */}
                    <mesh position={[0, 0.48, 0.2]}>
                        <boxGeometry args={[BOOTH_W * 0.55, 0.07, 0.65]} />
                        <meshStandardMaterial color={themeColor} roughness={0.45} metalness={0.1} />
                    </mesh>
                    {[[-BOOTH_W * 0.22, 0.22, -0.05], [BOOTH_W * 0.22, 0.22, -0.05], [-BOOTH_W * 0.22, 0.22, 0.45], [BOOTH_W * 0.22, 0.22, 0.45]].map(([x, y, z], i) => (
                        <mesh key={`dl-${i}`} position={[x, y, z]}><boxGeometry args={[0.05, 0.44, 0.05]} /><meshStandardMaterial color="#444" roughness={0.5} /></mesh>
                    ))}
                    {/* Monitor */}
                    <mesh position={[0.35, 0.55, 0.15]}><boxGeometry args={[0.06, 0.14, 0.06]} /><meshStandardMaterial color="#333" /></mesh>
                    <mesh position={[0.35, 0.68, 0.15]}><boxGeometry args={[0.5, 0.35, 0.03]} /><meshStandardMaterial color="#1a1a22" roughness={0.3} metalness={0.15} /></mesh>
                    <mesh position={[0.35, 0.68, 0.17]}><planeGeometry args={[0.44, 0.29]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.15} /></mesh>
                    {/* Chair */}
                    <mesh position={[-0.4, 0.34, -0.4]}><boxGeometry args={[0.36, 0.06, 0.36]} /><meshStandardMaterial color="#222" /></mesh>
                    <mesh position={[-0.4, 0.55, -0.56]}><boxGeometry args={[0.34, 0.4, 0.05]} /><meshStandardMaterial color="#222" /></mesh>
                    <mesh position={[-0.4, 0.16, -0.4]}><cylinderGeometry args={[0.04, 0.04, 0.3, 6]} /><meshStandardMaterial color="#555" metalness={0.3} /></mesh>
                    {/* Shelf */}
                    <mesh position={[-BOOTH_W / 2 + WALL_T + 0.18, 1.1, -0.6]}><boxGeometry args={[0.32, 0.04, 0.22]} /><meshStandardMaterial color="#ddd" /></mesh>
                    <mesh position={[-BOOTH_W / 2 + WALL_T + 0.18, 1.2, -0.6]}><boxGeometry args={[0.12, 0.16, 0.1]} /><meshStandardMaterial color={themeColor} transparent opacity={0.6} /></mesh>
                    {/* Plant */}
                    <group position={[BOOTH_W / 2 - 0.35, 0, BOOTH_D / 2 - 0.35]}>
                        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.1, 0.13, 0.36, 6]} /><meshStandardMaterial color="#8B6914" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.45, 0]}><sphereGeometry args={[0.18, 6, 6]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {variant === 1 && (
                /* ── Variant 1 — Lounge: round table + 2 stools + tall banner + plant ── */
                <group>
                    {/* Round table */}
                    <mesh position={[0, 0.44, 0.05]}>
                        <cylinderGeometry args={[0.45, 0.45, 0.06, 16]} />
                        <meshStandardMaterial color="#ddd" roughness={0.4} metalness={0.1} />
                    </mesh>
                    <mesh position={[0, 0.2, 0.05]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
                        <meshStandardMaterial color="#555" metalness={0.3} />
                    </mesh>
                    {/* Stools */}
                    {[[-0.55, 0.05], [0.55, 0.05]].map(([x, z], i) => (
                        <group key={`stool-${i}`} position={[x, 0, z]}>
                            <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 10]} /><meshStandardMaterial color={themeColor} roughness={0.5} /></mesh>
                            <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.04, 0.04, 0.28, 6]} /><meshStandardMaterial color="#444" metalness={0.3} /></mesh>
                        </group>
                    ))}
                    {/* Tall banner stand (right side) */}
                    <group position={[BOOTH_W / 2 - 0.4, 0, -0.5]}>
                        <mesh position={[0, 0.8, 0]}><boxGeometry args={[0.04, 1.6, 0.04]} /><meshStandardMaterial color="#777" metalness={0.3} /></mesh>
                        <mesh position={[0, 1.1, 0.04]}><boxGeometry args={[0.5, 0.9, 0.02]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.15} /></mesh>
                    </group>
                    {/* Coffee cups on table */}
                    {[[-0.15, 0.5], [0.15, 0.5]].map(([x, y], i) => (
                        <mesh key={`cup-${i}`} position={[x, y, 0.05]}><cylinderGeometry args={[0.04, 0.035, 0.08, 6]} /><meshStandardMaterial color="#f5f5f0" /></mesh>
                    ))}
                    {/* Plant */}
                    <group position={[-BOOTH_W / 2 + 0.35, 0, BOOTH_D / 2 - 0.35]}>
                        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.1, 0.13, 0.36, 6]} /><meshStandardMaterial color="#8B6914" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.45, 0]}><sphereGeometry args={[0.18, 6, 6]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {variant === 2 && (
                /* ── Variant 2 — Kiosk: L-counter + display stand + brochure rack ── */
                <group>
                    {/* L-shaped counter (horizontal segment) */}
                    <mesh position={[0.2, 0.48, 0.35]}>
                        <boxGeometry args={[BOOTH_W * 0.5, 0.08, 0.45]} />
                        <meshStandardMaterial color={themeColor} roughness={0.45} metalness={0.1} />
                    </mesh>
                    {/* L vertical segment */}
                    <mesh position={[-BOOTH_W * 0.15, 0.48, 0.0]}>
                        <boxGeometry args={[0.4, 0.08, 0.75]} />
                        <meshStandardMaterial color={themeColor} roughness={0.45} metalness={0.1} />
                    </mesh>
                    {/* Counter legs */}
                    {[[0.6, 0.2, 0.12], [0.6, 0.2, 0.55], [-0.35, 0.2, -0.33], [-0.35, 0.2, 0.33]].map(([x, y, z], i) => (
                        <mesh key={`cl-${i}`} position={[x, y, z]}><boxGeometry args={[0.04, 0.44, 0.04]} /><meshStandardMaterial color="#444" /></mesh>
                    ))}
                    {/* Product display stand */}
                    <group position={[BOOTH_W / 2 - 0.35, 0, -0.5]}>
                        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.04, 1.1, 0.04]} /><meshStandardMaterial color="#888" metalness={0.3} /></mesh>
                        <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.4, 0.04, 0.25]} /><meshStandardMaterial color="#ddd" /></mesh>
                        <mesh position={[0, 0.45, 0]}><boxGeometry args={[0.35, 0.04, 0.22]} /><meshStandardMaterial color="#ddd" /></mesh>
                        {/* Display items */}
                        <mesh position={[-0.08, 0.94, 0]}><boxGeometry args={[0.1, 0.14, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.7} /></mesh>
                        <mesh position={[0.1, 0.94, 0]}><boxGeometry args={[0.08, 0.12, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.5} /></mesh>
                    </group>
                    {/* Brochure rack (left rear) */}
                    <group position={[-BOOTH_W / 2 + 0.3, 0, -0.65]}>
                        <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.28, 1.2, 0.12]} /><meshStandardMaterial color="#ccc" roughness={0.6} /></mesh>
                        {[0.3, 0.55, 0.8, 1.05].map((y, i) => (
                            <mesh key={`br-${i}`} position={[0, y, 0.08]}><boxGeometry args={[0.22, 0.02, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.4} /></mesh>
                        ))}
                    </group>
                </group>
            )}

            {variant === 3 && (
                /* ── Variant 3 — Stage: podium + projector screen + seating row ── */
                <group>
                    {/* Podium */}
                    <mesh position={[0.5, 0.42, -0.15]}>
                        <boxGeometry args={[0.55, 0.84, 0.4]} />
                        <meshStandardMaterial color={themeColor} roughness={0.5} metalness={0.08} />
                    </mesh>
                    {/* Podium accent */}
                    <mesh position={[0.5, 0.42, 0.06]}>
                        <planeGeometry args={[0.4, 0.5]} />
                        <meshStandardMaterial color="#fff" transparent opacity={0.15} />
                    </mesh>
                    {/* Microphone */}
                    <mesh position={[0.5, 0.92, -0.1]}>
                        <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
                        <meshStandardMaterial color="#333" metalness={0.4} />
                    </mesh>
                    <mesh position={[0.5, 1.01, -0.04]}>
                        <sphereGeometry args={[0.03, 6, 6]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    {/* Projector screen (left side) */}
                    <group position={[-0.5, 0, -0.5]}>
                        <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.04, 1.8, 0.04]} /><meshStandardMaterial color="#777" metalness={0.3} /></mesh>
                        <mesh position={[0, 1.15, 0.04]}><boxGeometry args={[0.8, 0.6, 0.02]} /><meshStandardMaterial color="#f8f8f8" /></mesh>
                        <mesh position={[0, 1.15, 0.055]}><planeGeometry args={[0.7, 0.5]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.1} /></mesh>
                    </group>
                    {/* Seating row (3 chairs) */}
                    {[-0.5, 0, 0.5].map((x, i) => (
                        <group key={`seat-${i}`} position={[x, 0, 0.55]}>
                            <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.3, 0.05, 0.3]} /><meshStandardMaterial color="#333" /></mesh>
                            <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.035, 0.035, 0.2, 6]} /><meshStandardMaterial color="#555" metalness={0.3} /></mesh>
                        </group>
                    ))}
                    {/* Tall plant */}
                    <group position={[-BOOTH_W / 2 + 0.3, 0, BOOTH_D / 2 - 0.3]}>
                        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.1, 0.13, 0.36, 6]} /><meshStandardMaterial color="#8B6914" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.45, 0]}><sphereGeometry args={[0.18, 6, 6]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {/* ══════════════════════════════════════════════════════════
                FLOOR NAME PLATE (in front of booth)
                — Name anchored to TOP of plate, category below with gap
               ══════════════════════════════════════════════════════════ */}
            {/* Accent border plate */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, LABEL_OFFSET_Z + 0.1]}>
                <planeGeometry args={[BOOTH_W * 1.12, 1.3]} />
                <meshStandardMaterial
                    color={hovered ? themeColor : '#333340'}
                    emissive={hovered ? themeColor : '#222230'}
                    emissiveIntensity={hovered ? 0.35 : 0.08}
                    roughness={0.5}
                    transparent
                    opacity={0.95}
                />
            </mesh>
            {/* Background plate */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, LABEL_OFFSET_Z + 0.1]}>
                <planeGeometry args={[BOOTH_W * 1.06, 1.18]} />
                <meshStandardMaterial
                    color={hovered ? themeColor : '#1a1a22'}
                    emissive={hovered ? themeColor : '#000000'}
                    emissiveIntensity={hovered ? 0.5 : 0}
                    roughness={0.6}
                    transparent
                    opacity={0.95}
                />
            </mesh>
            {/* Name text — single line, anchored top of plate */}
            <Text
                position={[0, 0.02, LABEL_OFFSET_Z - 0.15]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.3}
                maxWidth={BOOTH_W * 1.0}
                textAlign="center"
                color={hovered ? '#ffffff' : themeColor}
                anchorX="center"
                anchorY="top"
                outlineWidth={0.016}
                outlineColor="#000000"
                letterSpacing={0.02}
                font={undefined}
            >
                {displayName}
            </Text>
            {/* Separator line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, LABEL_OFFSET_Z + 0.12]}>
                <planeGeometry args={[BOOTH_W * 0.7, 0.025]} />
                <meshStandardMaterial
                    color={themeColor}
                    emissive={themeColor}
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.6}
                />
            </mesh>
            {/* Category sub-label — always below the separator */}
            {stand.category && (
                <Text
                    position={[0, 0.02, LABEL_OFFSET_Z + 0.32]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.22}
                    maxWidth={BOOTH_W * 0.95}
                    textAlign="center"
                    color={hovered ? '#ffffff' : '#d4d4dc'}
                    anchorX="center"
                    anchorY="top"
                    outlineWidth={0.012}
                    outlineColor="#000000"
                    letterSpacing={0.015}
                    font={undefined}
                >
                    {stand.category}
                </Text>
            )}

            {/* ══════════ HOVER GLOW RING ══════════ */}
            {hovered && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                    <ringGeometry args={[Math.max(BOOTH_W, BOOTH_D) * 0.55, Math.max(BOOTH_W, BOOTH_D) * 0.59, 32]} />
                    <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.9} transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

export const Booth = memo(BoothInner);

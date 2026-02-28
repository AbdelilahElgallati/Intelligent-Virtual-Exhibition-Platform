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

/**
 * Booth — A richly furnished isometric exhibition stand:
 *   • Themed back wall with banner color & logo
 *   • Side walls with accent stripe
 *   • Desk, chair, monitor, shelf, plant
 *   • Floor‐level name plate in front (never occluded by other booths)
 */
function BoothInner({ stand, position, onClick }: BoothProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    const standId = stand.id || (stand as any)._id;
    const themeColor = stand.theme_color || '#6366f1';

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

    return (
        <group
            ref={groupRef}
            position={position}
            scale={hovered ? [1.05, 1.05, 1.05] : [1, 1, 1]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            onClick={(e) => { e.stopPropagation(); onClick(standId); }}
        >
            {/* ══════════ FLOOR PLATE ══════════ */}
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

            {/* ══════════ BACK WALL (themed) ══════════ */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T / 2]}>
                <boxGeometry args={[BOOTH_W, WALL_H, WALL_T]} />
                <meshStandardMaterial color={themeColor} roughness={0.6} metalness={0.05} />
            </mesh>
            {/* Back wall lighter inner panel */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T + 0.005]}>
                <planeGeometry args={[BOOTH_W - 0.3, WALL_H - 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>

            {/* ── Screen bezel on back wall ── */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.008]}>
                <boxGeometry args={[BOOTH_W * 0.55, WALL_H * 0.36, 0.025]} />
                <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.2} />
            </mesh>
            {/* ── Screen display (logo or accent) ── */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.025]}>
                <planeGeometry args={[BOOTH_W * 0.5, WALL_H * 0.32]} />
                {logoTexture ? (
                    <meshStandardMaterial map={logoTexture} roughness={0.5} />
                ) : (
                    <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.5} />
                )}
            </mesh>

            {/* ── Company name on back wall (below screen) ── */}
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
                {stand.name || 'Stand'}
            </Text>

            {/* ── Back wall top banner stripe ── */}
            <mesh position={[0, WALL_H - 0.08, -BOOTH_D / 2 + WALL_T / 2 - 0.001]}>
                <boxGeometry args={[BOOTH_W, 0.16, WALL_T + 0.01]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>

            {/* ══════════ LEFT WALL ══════════ */}
            <mesh position={[-BOOTH_W / 2 + WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>
            {/* Left wall accent stripe */}
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.005, WALL_H * 0.85, 0]}>
                <boxGeometry args={[0.01, 0.12, BOOTH_D - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.25} roughness={0.4} />
            </mesh>
            {/* Left wall small poster */}
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.005, WALL_H * 0.5, -0.3]}>
                <planeGeometry args={[0.01, 0.8]} />
                <meshStandardMaterial color={themeColor} roughness={0.5} transparent opacity={0.3} />
            </mesh>

            {/* ══════════ RIGHT WALL (partial — open entrance) ══════════ */}
            <mesh position={[BOOTH_W / 2 - WALL_T / 2, WALL_H / 2, -BOOTH_D / 4]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D / 2]} />
                <meshStandardMaterial color={wallColor} roughness={0.7} />
            </mesh>
            {/* Right wall accent */}
            <mesh position={[BOOTH_W / 2 - WALL_T - 0.005, WALL_H * 0.85, -BOOTH_D / 4]}>
                <boxGeometry args={[0.01, 0.12, BOOTH_D / 2 - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.25} roughness={0.4} />
            </mesh>

            {/* ══════════ FURNITURE: DESK ══════════ */}
            <mesh position={[0, 0.48, 0.2]}>
                <boxGeometry args={[BOOTH_W * 0.55, 0.07, 0.65]} />
                <meshStandardMaterial color={themeColor} roughness={0.45} metalness={0.1} />
            </mesh>
            {/* Desk legs */}
            {[
                [-BOOTH_W * 0.22, 0.22, -0.05],
                [BOOTH_W * 0.22, 0.22, -0.05],
                [-BOOTH_W * 0.22, 0.22, 0.45],
                [BOOTH_W * 0.22, 0.22, 0.45],
            ].map(([x, y, z], i) => (
                <mesh key={`dleg-${i}`} position={[x, y, z]}>
                    <boxGeometry args={[0.05, 0.44, 0.05]} />
                    <meshStandardMaterial color="#444" roughness={0.5} />
                </mesh>
            ))}

            {/* ══════════ FURNITURE: DESKTOP MONITOR ══════════ */}
            {/* Monitor stand */}
            <mesh position={[0.35, 0.55, 0.15]}>
                <boxGeometry args={[0.06, 0.14, 0.06]} />
                <meshStandardMaterial color="#333" roughness={0.4} />
            </mesh>
            {/* Monitor screen */}
            <mesh position={[0.35, 0.68, 0.15]}>
                <boxGeometry args={[0.5, 0.35, 0.03]} />
                <meshStandardMaterial color="#1a1a22" roughness={0.3} metalness={0.15} />
            </mesh>
            {/* Monitor glow */}
            <mesh position={[0.35, 0.68, 0.17]}>
                <planeGeometry args={[0.44, 0.29]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.15} roughness={0.5} />
            </mesh>

            {/* ══════════ FURNITURE: CHAIR ══════════ */}
            {/* Seat */}
            <mesh position={[-0.4, 0.34, -0.4]}>
                <boxGeometry args={[0.36, 0.06, 0.36]} />
                <meshStandardMaterial color="#222" roughness={0.6} />
            </mesh>
            {/* Backrest */}
            <mesh position={[-0.4, 0.55, -0.56]}>
                <boxGeometry args={[0.34, 0.4, 0.05]} />
                <meshStandardMaterial color="#222" roughness={0.6} />
            </mesh>
            {/* Chair leg (cylinder-like box) */}
            <mesh position={[-0.4, 0.16, -0.4]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
                <meshStandardMaterial color="#555" roughness={0.5} metalness={0.3} />
            </mesh>

            {/* ══════════ FURNITURE: SHELF (on left wall) ══════════ */}
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.18, 1.1, -0.6]}>
                <boxGeometry args={[0.32, 0.04, 0.22]} />
                <meshStandardMaterial color="#ddd" roughness={0.5} />
            </mesh>
            {/* Items on shelf */}
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.18, 1.2, -0.6]}>
                <boxGeometry args={[0.12, 0.16, 0.1]} />
                <meshStandardMaterial color={themeColor} roughness={0.5} transparent opacity={0.6} />
            </mesh>

            {/* ══════════ FURNITURE: SMALL PLANT ══════════ */}
            <group position={[BOOTH_W / 2 - 0.35, 0, BOOTH_D / 2 - 0.35]}>
                <mesh position={[0, 0.18, 0]}>
                    <cylinderGeometry args={[0.1, 0.13, 0.36, 6]} />
                    <meshStandardMaterial color="#8B6914" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.45, 0]}>
                    <sphereGeometry args={[0.18, 6, 6]} />
                    <meshStandardMaterial color="#2d8a4e" roughness={0.8} />
                </mesh>
            </group>

            {/* ══════════ FLOOR NAME PLATE (in front of booth) ══════════ */}
            {/* Accent border plate (slightly larger, behind main plate) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, LABEL_OFFSET_Z + 0.05]}>
                <planeGeometry args={[BOOTH_W * 1.12, 1.1]} />
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
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, LABEL_OFFSET_Z + 0.05]}>
                <planeGeometry args={[BOOTH_W * 1.06, 0.98]} />
                <meshStandardMaterial
                    color={hovered ? themeColor : '#1a1a22'}
                    emissive={hovered ? themeColor : '#000000'}
                    emissiveIntensity={hovered ? 0.5 : 0}
                    roughness={0.6}
                    transparent
                    opacity={0.95}
                />
            </mesh>
            {/* Name text on floor */}
            <Text
                position={[0, 0.02, LABEL_OFFSET_Z - 0.06]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.34}
                maxWidth={BOOTH_W * 1.0}
                textAlign="center"
                color={hovered ? '#ffffff' : themeColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.018}
                outlineColor="#000000"
                letterSpacing={0.03}
                font={undefined}
            >
                {stand.name || 'Stand'}
            </Text>
            {/* Category sub-label */}
            {stand.category && (
                <Text
                    position={[0, 0.02, LABEL_OFFSET_Z + 0.3]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.2}
                    maxWidth={BOOTH_W * 0.95}
                    textAlign="center"
                    color={hovered ? '#e0e0e0' : '#b0b0b8'}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.008}
                    outlineColor="#000000"
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

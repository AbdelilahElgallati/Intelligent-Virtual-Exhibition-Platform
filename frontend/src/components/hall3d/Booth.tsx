'use client';

import React, { memo, useRef, useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Stand } from '@/types/stand';
import type { HallTextures } from './useHallTextures';

/* ── Booth dimensions (enlarged for 3-per-row layout) ── */
const BOOTH_W = 4.5;   // width  (X)
const BOOTH_D = 3.4;   // depth  (Z)
const WALL_H = 2.8;    // wall height
const WALL_T = 0.10;   // wall thickness
const FLOOR_T = 0.05;
/* Extra space in front of booth for the floor label */
const LABEL_OFFSET_Z = BOOTH_D / 2 + 1.1;

/* ── Warm realistic booth palette ── */
const PARTITION_WHITE = '#f0eff5';     // Light white-blue partition panels
const PARTITION_INNER = '#e8e6ee';     // Inner panel face
const BOOTH_CARPET = '#d8d4e4';        // Light carpet inside booth
const WOOD_DESK = '#a07848';           // Warm wood
const METAL_GRAY = '#6a6a72';
const DARK_GRAY = '#3a3a40';
const SCREEN_BG = '#1a1a22';

interface BoothProps {
    stand: Stand;
    position: [number, number, number];
    onClick: (id: string) => void;
    textures: HallTextures;
}

/* ── Booth style variant derived from stand index ── */
type BoothVariant = 0 | 1 | 2 | 3;

function getVariant(stand: Stand): BoothVariant {
    const id = stand.id || (stand as any)._id || '';
    const hash = id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    return (hash % 4) as BoothVariant;
}

/* ── Truncate name to first line (~26 chars) for label safety ── */
function truncateName(name: string, max = 26): string {
    if (name.length <= max) return name;
    return name.slice(0, max - 1).trimEnd() + '…';
}

/* ── Pick readable text color based on background luminance ── */
function getContrastColor(hex: string): string {
    const c = hex.replace('#', '');
    const rMatch = parseInt(c.substring(0, 2), 16) / 255;
    const gMatch = parseInt(c.substring(2, 4), 16) / 255;
    const bMatch = parseInt(c.substring(4, 6), 16) / 255;

    // WCAG standard conversion for relative luminance
    const r = rMatch <= 0.03928 ? rMatch / 12.92 : Math.pow((rMatch + 0.055) / 1.055, 2.4);
    const g = gMatch <= 0.03928 ? gMatch / 12.92 : Math.pow((gMatch + 0.055) / 1.055, 2.4);
    const b = bMatch <= 0.03928 ? bMatch / 12.92 : Math.pow((bMatch + 0.055) / 1.055, 2.4);

    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Use black text on bright colors, white text on dark colors
    // Threshold adjusted to 0.179 based on W3C accessibility guidelines
    return L > 0.179 ? '#000000ff' : '#ffffff';
}

/**
 * Booth — Realistic exhibition stand with 4 visual variants.
 * Light-colored partition walls, warm wood furniture, themed accents.
 * Inspired by real virtual exhibition booths.
 */
function BoothInner({ stand, position, onClick, textures }: BoothProps) {
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
                SHARED SHELL: floor, partition walls, screen, banner
               ══════════════════════════════════════════════════════════ */}

            {/* ── Floor plate (raised platform, textured carpet) ── */}
            <mesh position={[0, FLOOR_T / 2, 0]}>
                <boxGeometry args={[BOOTH_W, FLOOR_T, BOOTH_D]} />
                <meshStandardMaterial map={textures.carpet} roughness={0.6} />
            </mesh>
            {/* Platform edge bevel */}
            <mesh position={[0, 0.005, 0]}>
                <boxGeometry args={[BOOTH_W + 0.06, 0.01, BOOTH_D + 0.06]} />
                <meshStandardMaterial color={METAL_GRAY} roughness={0.3} metalness={0.3} />
            </mesh>
            {/* Inner carpet accent */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_T + 0.002, 0]}>
                <planeGeometry args={[BOOTH_W - 0.3, BOOTH_D - 0.3]} />
                <meshStandardMaterial color={themeColor} transparent opacity={0.06} roughness={0.9} />
            </mesh>
            {/* Front accent strip — glowing theme line */}
            <mesh position={[0, FLOOR_T + 0.005, BOOTH_D / 2 - 0.06]}>
                <boxGeometry args={[BOOTH_W, 0.025, 0.12]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={hovered ? 0.7 : 0.3} roughness={0.3} />
            </mesh>

            {/* ── Back wall (themed color with white inner panel) ── */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T / 2]}>
                <boxGeometry args={[BOOTH_W, WALL_H, WALL_T]} />
                <meshStandardMaterial color={themeColor} roughness={0.55} metalness={0.05} />
            </mesh>
            {/* Inner white panel on back wall */}
            <mesh position={[0, WALL_H / 2, -BOOTH_D / 2 + WALL_T + 0.005]}>
                <planeGeometry args={[BOOTH_W - 0.25, WALL_H - 0.2]} />
                <meshStandardMaterial color={PARTITION_INNER} roughness={0.65} />
            </mesh>

            {/* ── Screen bezel (larger, more prominent) ── */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.01]}>
                <boxGeometry args={[BOOTH_W * 0.58, WALL_H * 0.38, 0.03]} />
                <meshStandardMaterial color={SCREEN_BG} roughness={0.3} metalness={0.2} />
            </mesh>
            {/* Screen display surface */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.03]}>
                <planeGeometry args={[BOOTH_W * 0.53, WALL_H * 0.34]} />
                {logoTexture ? (
                    <meshStandardMaterial map={logoTexture} roughness={0.5} />
                ) : (
                    <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.25} roughness={0.4} />
                )}
            </mesh>
            {/* Screen glow effect */}
            <mesh position={[0, WALL_H * 0.62, -BOOTH_D / 2 + WALL_T + 0.008]}>
                <planeGeometry args={[BOOTH_W * 0.62, WALL_H * 0.42]} />
                <meshStandardMaterial color={themeColor} transparent opacity={0.04} />
            </mesh>

            {/* Name on back wall (under screen) */}
            <Text
                position={[0, WALL_H * 0.26, -BOOTH_D / 2 + WALL_T + 0.02]}
                fontSize={0.22}
                maxWidth={BOOTH_W * 0.85}
                textAlign="center"
                color="#444"
                anchorX="center"
                anchorY="middle"
                font={undefined}
            >
                {displayName}
            </Text>

            {/* Top banner stripe */}
            <mesh position={[0, WALL_H - 0.06, -BOOTH_D / 2 + WALL_T / 2 - 0.001]}>
                <boxGeometry args={[BOOTH_W, 0.12, WALL_T + 0.015]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>

            {/* ── Left partition wall (textured panel) ── */}
            <mesh position={[-BOOTH_W / 2 + WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D]} />
                <meshStandardMaterial map={textures.partition} roughness={0.6} />
            </mesh>
            {/* Left wall accent trim */}
            <mesh position={[-BOOTH_W / 2 + WALL_T + 0.005, WALL_H * 0.88, 0]}>
                <boxGeometry args={[0.015, 0.1, BOOTH_D - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>

            {/* ── Right partition wall (partial, textured panel) ── */}
            <mesh position={[BOOTH_W / 2 - WALL_T / 2, WALL_H / 2, -BOOTH_D / 4]}>
                <boxGeometry args={[WALL_T, WALL_H, BOOTH_D / 2]} />
                <meshStandardMaterial map={textures.partition} roughness={0.6} />
            </mesh>
            <mesh position={[BOOTH_W / 2 - WALL_T - 0.005, WALL_H * 0.88, -BOOTH_D / 4]}>
                <boxGeometry args={[0.015, 0.1, BOOTH_D / 2 - 0.1]} />
                <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>

            {/* ══════════════════════════════════════════════════════════
                VARIANT FURNITURE (warm, realistic)
               ══════════════════════════════════════════════════════════ */}

            {variant === 0 && (
                /* ── Variant 0 — Classic: wood desk + monitor + office chair + shelf + plant ── */
                <group>
                    {/* Wood desk (textured) */}
                    <mesh position={[0, 0.5, 0.2]}>
                        <boxGeometry args={[BOOTH_W * 0.55, 0.06, 0.65]} />
                        <meshStandardMaterial map={textures.deskWood} roughness={0.5} metalness={0.05} />
                    </mesh>
                    {/* Desk legs (textured metal) */}
                    {[[-BOOTH_W * 0.22, 0.24, -0.05], [BOOTH_W * 0.22, 0.24, -0.05], [-BOOTH_W * 0.22, 0.24, 0.45], [BOOTH_W * 0.22, 0.24, 0.45]].map(([x, y, z], i) => (
                        <mesh key={`dl-${i}`} position={[x, y, z]}><boxGeometry args={[0.05, 0.46, 0.05]} /><meshStandardMaterial map={textures.metal} roughness={0.3} metalness={0.4} /></mesh>
                    ))}
                    {/* Desktop items — keyboard */}
                    <mesh position={[0, 0.54, 0.3]}>
                        <boxGeometry args={[0.4, 0.015, 0.14]} />
                        <meshStandardMaterial color={DARK_GRAY} roughness={0.4} />
                    </mesh>
                    {/* Monitor */}
                    <mesh position={[0.35, 0.56, 0.1]}><boxGeometry args={[0.06, 0.14, 0.06]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                    <mesh position={[0.35, 0.7, 0.1]}><boxGeometry args={[0.52, 0.38, 0.03]} /><meshStandardMaterial color={SCREEN_BG} roughness={0.3} metalness={0.15} /></mesh>
                    <mesh position={[0.35, 0.7, 0.12]}><planeGeometry args={[0.46, 0.32]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.12} /></mesh>
                    {/* Office chair */}
                    <mesh position={[-0.4, 0.36, -0.4]}><boxGeometry args={[0.38, 0.06, 0.38]} /><meshStandardMaterial color={DARK_GRAY} /></mesh>
                    <mesh position={[-0.4, 0.58, -0.58]}><boxGeometry args={[0.36, 0.42, 0.05]} /><meshStandardMaterial color={DARK_GRAY} /></mesh>
                    <mesh position={[-0.4, 0.17, -0.4]}><cylinderGeometry args={[0.04, 0.04, 0.3, 6]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                    {/* 5-star base */}
                    {[0, 72, 144, 216, 288].map((angle, i) => {
                        const rad = (angle * Math.PI) / 180;
                        return <mesh key={`cb-${i}`} position={[-0.4 + Math.cos(rad) * 0.12, 0.04, -0.4 + Math.sin(rad) * 0.12]}>
                            <boxGeometry args={[0.03, 0.02, 0.12]} />
                            <meshStandardMaterial color={METAL_GRAY} metalness={0.4} />
                        </mesh>;
                    })}
                    {/* Shelf */}
                    <mesh position={[-BOOTH_W / 2 + WALL_T + 0.2, 1.15, -0.6]}><boxGeometry args={[0.35, 0.04, 0.24]} /><meshStandardMaterial color="#eee" /></mesh>
                    <mesh position={[-BOOTH_W / 2 + WALL_T + 0.2, 1.28, -0.6]}><boxGeometry args={[0.14, 0.18, 0.1]} /><meshStandardMaterial color={themeColor} transparent opacity={0.6} /></mesh>
                    {/* Plant */}
                    <group position={[BOOTH_W / 2 - 0.38, 0, BOOTH_D / 2 - 0.38]}>
                        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.1, 0.14, 0.4, 8]} /><meshStandardMaterial color="#7a5c2e" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.48, 0]}><sphereGeometry args={[0.2, 7, 7]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                        <mesh position={[0.06, 0.58, 0.04]}><sphereGeometry args={[0.12, 5, 5]} /><meshStandardMaterial color="#3da85e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {variant === 1 && (
                /* ── Variant 1 — Lounge: round table + 2 stools + tall banner + plant ── */
                <group>
                    {/* Round table (white top, chrome leg) */}
                    <mesh position={[0, 0.46, 0.05]}>
                        <cylinderGeometry args={[0.48, 0.48, 0.05, 16]} />
                        <meshStandardMaterial color="#f5f5f5" roughness={0.35} metalness={0.08} />
                    </mesh>
                    <mesh position={[0, 0.22, 0.05]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.42, 8]} />
                        <meshStandardMaterial color={METAL_GRAY} metalness={0.5} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0.02, 0.05]}>
                        <cylinderGeometry args={[0.2, 0.2, 0.03, 12]} />
                        <meshStandardMaterial color={METAL_GRAY} metalness={0.5} roughness={0.2} />
                    </mesh>
                    {/* Stools (themed seats) */}
                    {[[-0.58, 0.05], [0.58, 0.05]].map(([x, z], i) => (
                        <group key={`stool-${i}`} position={[x, 0, z]}>
                            <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.17, 0.17, 0.05, 10]} /><meshStandardMaterial color={themeColor} roughness={0.45} /></mesh>
                            <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.04, 0.04, 0.3, 6]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.45} /></mesh>
                            <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.12, 0.12, 0.02, 8]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                        </group>
                    ))}
                    {/* Tall banner stand (right side) */}
                    <group position={[BOOTH_W / 2 - 0.4, 0, -0.5]}>
                        <mesh position={[0, 0.8, 0]}><boxGeometry args={[0.04, 1.6, 0.04]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                        <mesh position={[0, 1.15, 0.04]}><boxGeometry args={[0.55, 0.95, 0.02]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.1} /></mesh>
                        <mesh position={[0, 1.15, 0.055]}><planeGeometry args={[0.48, 0.88]} /><meshStandardMaterial color="#fff" transparent opacity={0.15} /></mesh>
                    </group>
                    {/* Coffee cups on table */}
                    {[[-0.15, 0.52], [0.15, 0.52]].map(([x, y], i) => (
                        <mesh key={`cup-${i}`} position={[x, y, 0.05]}><cylinderGeometry args={[0.04, 0.035, 0.08, 8]} /><meshStandardMaterial color="#f8f5f0" roughness={0.5} /></mesh>
                    ))}
                    {/* Laptop on table */}
                    <mesh position={[0, 0.505, -0.1]}><boxGeometry args={[0.3, 0.015, 0.2]} /><meshStandardMaterial color={DARK_GRAY} roughness={0.3} metalness={0.15} /></mesh>
                    <mesh position={[0, 0.55, -0.2]} rotation={[-0.3, 0, 0]}><boxGeometry args={[0.3, 0.2, 0.01]} /><meshStandardMaterial color={DARK_GRAY} roughness={0.3} metalness={0.15} /></mesh>
                    {/* Plant */}
                    <group position={[-BOOTH_W / 2 + 0.38, 0, BOOTH_D / 2 - 0.38]}>
                        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.1, 0.14, 0.4, 8]} /><meshStandardMaterial color="#7a5c2e" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.48, 0]}><sphereGeometry args={[0.2, 7, 7]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {variant === 2 && (
                /* ── Variant 2 — Kiosk: L-counter + display stand + brochure rack ── */
                <group>
                    {/* L-shaped counter (horizontal segment — textured wood top) */}
                    <mesh position={[0.2, 0.5, 0.35]}>
                        <boxGeometry args={[BOOTH_W * 0.5, 0.07, 0.48]} />
                        <meshStandardMaterial map={textures.deskWood} roughness={0.5} metalness={0.05} />
                    </mesh>
                    {/* Counter front panel (themed) */}
                    <mesh position={[0.2, 0.25, 0.59]}>
                        <boxGeometry args={[BOOTH_W * 0.5, 0.5, 0.03]} />
                        <meshStandardMaterial color={themeColor} roughness={0.5} />
                    </mesh>
                    {/* L vertical segment */}
                    <mesh position={[-BOOTH_W * 0.15, 0.5, 0.0]}>
                        <boxGeometry args={[0.42, 0.07, 0.75]} />
                        <meshStandardMaterial map={textures.deskWood} roughness={0.5} metalness={0.05} />
                    </mesh>
                    {/* Counter legs */}
                    {[[0.6, 0.22, 0.12], [0.6, 0.22, 0.55], [-0.35, 0.22, -0.33], [-0.35, 0.22, 0.33]].map(([x, y, z], i) => (
                        <mesh key={`cl-${i}`} position={[x, y, z]}><boxGeometry args={[0.04, 0.44, 0.04]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                    ))}
                    {/* Product display stand */}
                    <group position={[BOOTH_W / 2 - 0.38, 0, -0.5]}>
                        <mesh position={[0, 0.58, 0]}><boxGeometry args={[0.04, 1.15, 0.04]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                        <mesh position={[0, 0.88, 0]}><boxGeometry args={[0.42, 0.04, 0.28]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
                        <mesh position={[0, 0.48, 0]}><boxGeometry args={[0.38, 0.04, 0.24]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
                        {/* Display items */}
                        <mesh position={[-0.08, 0.97, 0]}><boxGeometry args={[0.1, 0.14, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.7} /></mesh>
                        <mesh position={[0.1, 0.97, 0]}><boxGeometry args={[0.08, 0.12, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.5} /></mesh>
                    </group>
                    {/* Brochure rack (left rear) */}
                    <group position={[-BOOTH_W / 2 + 0.32, 0, -0.65]}>
                        <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.3, 1.25, 0.14]} /><meshStandardMaterial color="#e8e8e8" roughness={0.55} /></mesh>
                        {[0.32, 0.58, 0.84, 1.1].map((y, i) => (
                            <mesh key={`br-${i}`} position={[0, y, 0.09]}><boxGeometry args={[0.24, 0.02, 0.08]} /><meshStandardMaterial color={themeColor} transparent opacity={0.45} /></mesh>
                        ))}
                    </group>
                </group>
            )}

            {variant === 3 && (
                /* ── Variant 3 — Stage: podium + projector screen + seating row ── */
                <group>
                    {/* Podium (themed with accent front) */}
                    <mesh position={[0.5, 0.44, -0.15]}>
                        <boxGeometry args={[0.55, 0.88, 0.42]} />
                        <meshStandardMaterial color={themeColor} roughness={0.45} metalness={0.08} />
                    </mesh>
                    <mesh position={[0.5, 0.44, 0.07]}>
                        <planeGeometry args={[0.42, 0.55]} />
                        <meshStandardMaterial color="#fff" transparent opacity={0.12} />
                    </mesh>
                    {/* Microphone */}
                    <mesh position={[0.5, 0.96, -0.1]}>
                        <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
                        <meshStandardMaterial color={DARK_GRAY} metalness={0.45} />
                    </mesh>
                    <mesh position={[0.5, 1.06, -0.04]}>
                        <sphereGeometry args={[0.035, 6, 6]} />
                        <meshStandardMaterial color="#2a2a2a" />
                    </mesh>
                    {/* Projector screen (left side) */}
                    <group position={[-0.5, 0, -0.5]}>
                        <mesh position={[0, 0.92, 0]}><boxGeometry args={[0.04, 1.84, 0.04]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                        <mesh position={[0, 1.18, 0.04]}><boxGeometry args={[0.85, 0.65, 0.02]} /><meshStandardMaterial color="#f8f8f8" /></mesh>
                        <mesh position={[0, 1.18, 0.056]}><planeGeometry args={[0.78, 0.55]} /><meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.08} /></mesh>
                    </group>
                    {/* Seating row (3 chairs) */}
                    {[-0.5, 0, 0.5].map((x, i) => (
                        <group key={`seat-${i}`} position={[x, 0, 0.55]}>
                            <mesh position={[0, 0.26, 0]}><boxGeometry args={[0.32, 0.05, 0.32]} /><meshStandardMaterial color={DARK_GRAY} /></mesh>
                            <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.035, 0.035, 0.22, 6]} /><meshStandardMaterial color={METAL_GRAY} metalness={0.4} /></mesh>
                        </group>
                    ))}
                    {/* Plant */}
                    <group position={[-BOOTH_W / 2 + 0.32, 0, BOOTH_D / 2 - 0.32]}>
                        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.1, 0.14, 0.4, 8]} /><meshStandardMaterial color="#7a5c2e" roughness={0.7} /></mesh>
                        <mesh position={[0, 0.48, 0]}><sphereGeometry args={[0.2, 7, 7]} /><meshStandardMaterial color="#2d8a4e" roughness={0.8} /></mesh>
                    </group>
                </group>
            )}

            {/* ══════════════════════════════════════════════════════════
                FLOOR NAME PLATE (in front of booth)
               ══════════════════════════════════════════════════════════ */}
            {/* Accent border plate — warm bronze */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, LABEL_OFFSET_Z + 0.1]}>
                <planeGeometry args={[BOOTH_W * 1.08, 1.7]} />
                <meshStandardMaterial
                    color={hovered ? themeColor : '#8B7355'}
                    emissive={hovered ? themeColor : '#6B5535'}
                    emissiveIntensity={hovered ? 0.3 : 0.1}
                    roughness={0.4}
                    metalness={0.15}
                    transparent
                    opacity={0.95}
                />
            </mesh>
            {/* Background plate — deep warm */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, LABEL_OFFSET_Z + 0.1]}>
                <planeGeometry args={[BOOTH_W * 1.02, 1.55]} />
                <meshStandardMaterial
                    color={hovered ? themeColor : '#2C2520'}
                    emissive={hovered ? themeColor : '#1A1510'}
                    emissiveIntensity={hovered ? 0.45 : 0.05}
                    roughness={0.6}
                    transparent
                    opacity={0.95}
                />
            </mesh>
            {/* Name text */}
            <Text
                position={[0, 0.045, LABEL_OFFSET_Z - 0.25]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.35}
                maxWidth={BOOTH_W * 0.95}
                textAlign="center"
                color={hovered ? getContrastColor(themeColor) : '#F0E6D0'}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
                outlineWidth={0.015}
                outlineColor={hovered ? (getContrastColor(themeColor) === '#ffffff' ? '#000000' : '#ffffff') : '#000000'}
                letterSpacing={0.02}
                font={undefined}
            >
                {displayName}
            </Text>
            {/* Separator line
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, LABEL_OFFSET_Z + 0.1]}>
                <planeGeometry args={[BOOTH_W * 0.65, 0.03]} />
                <meshStandardMaterial
                    color={themeColor}
                    emissive={themeColor}
                    emissiveIntensity={0.35}
                    transparent
                    opacity={0.7}
                />
            </mesh> */}
            {/* Category sub-label */}
            {stand.category && (
                <Text
                    position={[0, 0.045, LABEL_OFFSET_Z + 0.55]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.33}
                    maxWidth={BOOTH_W * 0.9}
                    textAlign="center"
                    color={hovered ? getContrastColor(themeColor) : '#C0B8A8'}
                    anchorX="center"
                    anchorY="middle"
                    fontWeight="bold"
                    outlineWidth={0.008}
                    outlineColor={hovered ? (getContrastColor(themeColor) === '#ffffff' ? '#000000' : '#ffffff') : '#000000'}
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

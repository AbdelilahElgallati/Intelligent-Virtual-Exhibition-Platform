'use client';

import React, { memo } from 'react';
import { Text } from '@react-three/drei';
import type { HallTextures } from './useHallTextures';

/* ── Hall size constants (exported for scene camera framing) ── */
export const HALL_WIDTH = 30;
export const HALL_DEPTH = 30;
const OUTER_EXTRA = 5;
const FLOOR_Y = -0.01;
const WALL_H = 4.2;
const WALL_T = 0.22;

/* ─── Color palette ─── */
const ACCENT = '#e67e22';
const ACCENT_GLOW = '#f39c12';
const WALL_TRIM = '#d4c4a8';

interface HallFloorProps {
    eventTitle?: string;
    textures: HallTextures;
}

/**
 * HallFloor – Realistic exhibition hall environment with procedural textures:
 *   • Textured wood-plank surround floor
 *   • Polished dark marble exhibition floor
 *   • Textured cream perimeter walls with event branding
 *   • Textured green hedge/vine walls on left & right
 *   • Corner pillars, decorative plants
 *   • Event title integrated on walls
 */
function HallFloorInner({ eventTitle, textures }: HallFloorProps) {
    const halfW = HALL_WIDTH / 2;
    const halfD = HALL_DEPTH / 2;
    const outerW = HALL_WIDTH + OUTER_EXTRA * 2;
    const outerD = HALL_DEPTH + OUTER_EXTRA * 2;



    return (
        <group>
            {/* ══════════ OUTER WOOD FLOOR (textured) ══════════ */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.02, 0]}>
                <planeGeometry args={[outerW, outerD]} />
                <meshStandardMaterial map={textures.wood} roughness={0.65} metalness={0.02} />
            </mesh>

            {/* ══════════ MAIN HALL FLOOR (dark polished marble) ══════════ */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
                <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
                <meshStandardMaterial map={textures.marble} roughness={0.35} metalness={0.18} />
            </mesh>

            {/* Center aisle carpet runner */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.004, 0]}>
                <planeGeometry args={[2.4, HALL_DEPTH - 3]} />
                <meshStandardMaterial color={ACCENT} roughness={0.85} transparent opacity={0.08} />
            </mesh>

            {/* ══════════ ORANGE ACCENT BORDER ══════════ */}
            {[
                { pos: [0, FLOOR_Y + 0.006, -halfD + 0.2] as [number, number, number], size: [HALL_WIDTH, 0.05, 0.4] as [number, number, number] },
                { pos: [0, FLOOR_Y + 0.006, halfD - 0.2] as [number, number, number], size: [HALL_WIDTH, 0.05, 0.4] as [number, number, number] },
                { pos: [-halfW + 0.2, FLOOR_Y + 0.006, 0] as [number, number, number], size: [0.4, 0.05, HALL_DEPTH] as [number, number, number] },
                { pos: [halfW - 0.2, FLOOR_Y + 0.006, 0] as [number, number, number], size: [0.4, 0.05, HALL_DEPTH] as [number, number, number] },
            ].map((b, i) => (
                <mesh key={`border-${i}`} position={b.pos}>
                    <boxGeometry args={b.size} />
                    <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.25} roughness={0.35} />
                </mesh>
            ))}

            {/* ══════════ PERIMETER WALLS ══════════ */}

            {/* ── Back wall (-Z) — Textured cream wall with event branding ── */}
            <mesh position={[0, WALL_H / 2, -halfD - WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH + WALL_T * 2, WALL_H, WALL_T]} />
                <meshStandardMaterial map={textures.wall} roughness={0.6} metalness={0.02} />
            </mesh>
            {/* Back wall baseboard */}
            <mesh position={[0, 0.15, -halfD - 0.01]}>
                <boxGeometry args={[HALL_WIDTH, 0.3, 0.04]} />
                <meshStandardMaterial color={WALL_TRIM} roughness={0.5} />
            </mesh>
            {/* Back wall accent stripe (orange) */}
            <mesh position={[0, WALL_H * 0.88, -halfD - 0.01]}>
                <boxGeometry args={[HALL_WIDTH, 0.2, 0.04]} />
                <meshStandardMaterial color={ACCENT} emissive={ACCENT_GLOW} emissiveIntensity={0.3} roughness={0.3} />
            </mesh>
            {/* ── Event title centered on back wall ── */}
            {eventTitle && (
                <Text
                    position={[0, WALL_H * 0.52, -halfD + 0.06]}
                    fontSize={0.8}
                    maxWidth={HALL_WIDTH * 0.85}
                    textAlign="center"
                    color="#1a1a1a"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.03}
                    outlineColor="#ffffff"
                    letterSpacing={0.05}
                    fontWeight="bold"
                    font={undefined}
                >
                    {eventTitle}
                </Text>
            )}

            {/* ── Left wall (-X) — GREEN HEDGE WALL (textured) ── */}
            <mesh position={[-halfW - WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, HALL_DEPTH + WALL_T * 2]} />
                <meshStandardMaterial map={textures.hedge} roughness={0.85} metalness={0} />
            </mesh>
            {/* Hedge leaf bumps — rows of tiny spheres simulate vine wall */}
            {Array.from({ length: 8 }).map((_, row) => {
                const y = 0.4 + row * (WALL_H - 0.6) / 7;
                return Array.from({ length: 10 }).map((_, col) => {
                    const z = -halfD + 1.2 + col * ((HALL_DEPTH - 2.4) / 9);
                    const isLight = (row + col) % 3 === 0;
                    return (
                        <mesh key={`lh-${row}-${col}`} position={[-halfW + 0.02, y, z]}>
                            <sphereGeometry args={[0.22 + (row * col % 3) * 0.04, 5, 5]} />
                            <meshStandardMaterial
                                color={isLight ? '#3d8a4e' : '#2d6b3a'}
                                roughness={0.9}
                            />
                        </mesh>
                    );
                });
            })}
            {/* Left wall event title (vertical) */}
            {eventTitle && (
                <Text
                    position={[-halfW + 0.15, WALL_H * 0.5, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    fontSize={0.45}
                    maxWidth={HALL_DEPTH * 0.7}
                    textAlign="center"
                    color="#f0f0f0"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.015}
                    outlineColor="#1a3d1a"
                    font={undefined}
                >
                    {eventTitle}
                </Text>
            )}

            {/* ── Right wall (+X) — GREEN HEDGE WALL (textured) ── */}
            <mesh position={[halfW + WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, HALL_DEPTH + WALL_T * 2]} />
                <meshStandardMaterial map={textures.hedge} roughness={0.85} metalness={0} />
            </mesh>
            {/* Hedge leaf bumps */}
            {Array.from({ length: 8 }).map((_, row) => {
                const y = 0.4 + row * (WALL_H - 0.6) / 7;
                return Array.from({ length: 10 }).map((_, col) => {
                    const z = -halfD + 1.2 + col * ((HALL_DEPTH - 2.4) / 9);
                    const isLight = (row + col) % 2 === 0;
                    return (
                        <mesh key={`rh-${row}-${col}`} position={[halfW - 0.02, y, z]}>
                            <sphereGeometry args={[0.22 + (row * col % 3) * 0.04, 5, 5]} />
                            <meshStandardMaterial
                                color={isLight ? '#3d8a4e' : '#2d6b3a'}
                                roughness={0.9}
                            />
                        </mesh>
                    );
                });
            })}
            {/* ── Front wall (+Z) — solid wall (no entrance) ── */}
            <mesh position={[0, WALL_H / 2, halfD + WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH + WALL_T * 2, WALL_H, WALL_T]} />
                <meshStandardMaterial map={textures.wall} roughness={0.6} metalness={0.02} />
            </mesh>
            {/* Front wall baseboard */}
            <mesh position={[0, 0.15, halfD + 0.01]}>
                <boxGeometry args={[HALL_WIDTH, 0.3, 0.04]} />
                <meshStandardMaterial color={WALL_TRIM} roughness={0.5} />
            </mesh>
            {/* Front wall accent stripe */}
            <mesh position={[0, WALL_H * 0.88, halfD + 0.01]}>
                <boxGeometry args={[HALL_WIDTH, 0.2, 0.04]} />
                <meshStandardMaterial color={ACCENT} emissive={ACCENT_GLOW} emissiveIntensity={0.3} roughness={0.3} />
            </mesh>

            {/* ══════════ CORNER PILLARS ══════════ */}
            {(
                [
                    [-halfW, -halfD],
                    [halfW, -halfD],
                    [-halfW, halfD],
                    [halfW, halfD],
                ] as [number, number][]
            ).map(([x, z], i) => (
                <group key={`col-${i}`} position={[x, 0, z]}>
                    <mesh position={[0, WALL_H / 2, 0]}>
                        <boxGeometry args={[0.55, WALL_H, 0.55]} />
                        <meshStandardMaterial color={ACCENT} roughness={0.4} metalness={0.1} />
                    </mesh>
                    <mesh position={[0, WALL_H + 0.12, 0]}>
                        <boxGeometry args={[0.72, 0.24, 0.72]} />
                        <meshStandardMaterial color="#c96b10" roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.68, 0.2, 0.68]} />
                        <meshStandardMaterial color="#c96b10" roughness={0.4} />
                    </mesh>
                </group>
            ))}

            {/* ══════════ DECORATIVE PLANTS ══════════ */}
            {[
                [-halfW + 1.5, halfD - 1.5],
                [halfW - 1.5, halfD - 1.5],
                [-halfW + 1.5, -halfD + 1.5],
                [halfW - 1.5, -halfD + 1.5],
            ].map(([x, z], i) => (
                <group key={`plant-${i}`} position={[x, 0, z]}>
                    {/* Pot */}
                    <mesh position={[0, 0.3, 0]}>
                        <cylinderGeometry args={[0.24, 0.3, 0.6, 8]} />
                        <meshStandardMaterial color="#7a5c2e" roughness={0.7} />
                    </mesh>
                    {/* Soil rim */}
                    <mesh position={[0, 0.61, 0]}>
                        <cylinderGeometry args={[0.26, 0.24, 0.04, 8]} />
                        <meshStandardMaterial color="#5a3e1e" roughness={0.8} />
                    </mesh>
                    {/* Main foliage */}
                    <mesh position={[0, 0.9, 0]}>
                        <sphereGeometry args={[0.38, 8, 8]} />
                        <meshStandardMaterial color="#2d8a4e" roughness={0.85} />
                    </mesh>
                    {/* Secondary foliage layer */}
                    <mesh position={[0.1, 1.1, 0.05]}>
                        <sphereGeometry args={[0.25, 6, 6]} />
                        <meshStandardMaterial color="#3da85e" roughness={0.85} />
                    </mesh>
                    <mesh position={[-0.08, 1.05, -0.08]}>
                        <sphereGeometry args={[0.2, 6, 6]} />
                        <meshStandardMaterial color="#268a42" roughness={0.85} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

export const HallFloor = memo(HallFloorInner);

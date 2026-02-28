'use client';

import React, { memo } from 'react';

/* ── Hall size constants (exported for scene camera framing) ── */
export const HALL_WIDTH = 30;
export const HALL_DEPTH = 24;
const OUTER_EXTRA = 5; // extra wood floor around the hall
const BORDER_THICKNESS = 0.4;
const FLOOR_Y = -0.01;
const WALL_H = 3.8;
const WALL_T = 0.18;

/**
 * HallFloor – Richly styled exhibition hall:
 *   • Outer wood-toned floor surrounding the venue
 *   • Dark main hall floor with accent border
 *   • 4 perimeter walls themed with banners & event decor
 *   • Corner columns, entrance arch, directional signs
 */
function HallFloorInner({ eventTitle }: { eventTitle?: string }) {
    const halfW = HALL_WIDTH / 2;
    const halfD = HALL_DEPTH / 2;
    const outerW = HALL_WIDTH + OUTER_EXTRA * 2;
    const outerD = HALL_DEPTH + OUTER_EXTRA * 2;

    return (
        <group>
            {/* ══════════ OUTER WOOD FLOOR ══════════ */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.02, 0]}>
                <planeGeometry args={[outerW, outerD]} />
                <meshStandardMaterial color="#8B6914" roughness={0.75} metalness={0.05} />
            </mesh>
            {/* Wood plank lines */}
            {Array.from({ length: 14 }).map((_, i) => {
                const z = -outerD / 2 + (i + 1) * (outerD / 15);
                return (
                    <mesh key={`plank-${i}`} position={[0, FLOOR_Y - 0.015, z]}>
                        <boxGeometry args={[outerW, 0.005, 0.04]} />
                        <meshStandardMaterial color="#7A5C10" roughness={0.9} />
                    </mesh>
                );
            })}

            {/* ══════════ MAIN HALL FLOOR ══════════ */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
                <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
                <meshStandardMaterial color="#1e1e24" roughness={0.85} metalness={0.05} />
            </mesh>

            {/* Inner lighter overlay */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.001, 0]}>
                <planeGeometry args={[HALL_WIDTH - 2, HALL_DEPTH - 2]} />
                <meshStandardMaterial color="#252530" roughness={0.9} metalness={0} />
            </mesh>

            {/* Center carpet runner (accent) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.003, 0]}>
                <planeGeometry args={[2.2, HALL_DEPTH - 3]} />
                <meshStandardMaterial color="#4f46e5" roughness={0.9} transparent opacity={0.08} />
            </mesh>

            {/* ══════════ ORANGE ACCENT BORDER ══════════ */}
            {/* Front */}
            <mesh position={[0, FLOOR_Y + 0.005, -halfD + BORDER_THICKNESS / 2]}>
                <boxGeometry args={[HALL_WIDTH, 0.04, BORDER_THICKNESS]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.35} roughness={0.3} />
            </mesh>
            {/* Back */}
            <mesh position={[0, FLOOR_Y + 0.005, halfD - BORDER_THICKNESS / 2]}>
                <boxGeometry args={[HALL_WIDTH, 0.04, BORDER_THICKNESS]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.35} roughness={0.3} />
            </mesh>
            {/* Left */}
            <mesh position={[-halfW + BORDER_THICKNESS / 2, FLOOR_Y + 0.005, 0]}>
                <boxGeometry args={[BORDER_THICKNESS, 0.04, HALL_DEPTH]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.35} roughness={0.3} />
            </mesh>
            {/* Right */}
            <mesh position={[halfW - BORDER_THICKNESS / 2, FLOOR_Y + 0.005, 0]}>
                <boxGeometry args={[BORDER_THICKNESS, 0.04, HALL_DEPTH]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.35} roughness={0.3} />
            </mesh>

            {/* ══════════ PERIMETER WALLS ══════════ */}
            {/* Back wall (far side, -Z) */}
            <mesh position={[0, WALL_H / 2, -halfD - WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH + WALL_T * 2, WALL_H, WALL_T]} />
                <meshStandardMaterial color="#2a2a36" roughness={0.7} metalness={0.1} />
            </mesh>
            {/* Back wall accent stripe */}
            <mesh position={[0, WALL_H * 0.85, -halfD - 0.01]}>
                <boxGeometry args={[HALL_WIDTH, 0.25, 0.01]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.3} roughness={0.3} />
            </mesh>
            {/* Back wall title banner */}
            {eventTitle && (
                <group position={[0, WALL_H * 0.55, -halfD + 0.02]}>
                    {/* Banner background */}
                    <mesh>
                        <planeGeometry args={[HALL_WIDTH * 0.6, 1.6]} />
                        <meshStandardMaterial color="#4f46e5" roughness={0.5} />
                    </mesh>
                </group>
            )}

            {/* Left wall (-X) */}
            <mesh position={[-halfW - WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, HALL_DEPTH + WALL_T * 2]} />
                <meshStandardMaterial color="#2a2a36" roughness={0.7} metalness={0.1} />
            </mesh>
            {/* Left wall accent stripe */}
            <mesh position={[-halfW - 0.01, WALL_H * 0.85, 0]}>
                <boxGeometry args={[0.01, 0.25, HALL_DEPTH]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.3} roughness={0.3} />
            </mesh>
            {/* Left wall decorative panels */}
            {[-halfD * 0.5, 0, halfD * 0.5].map((z, i) => (
                <mesh key={`lpanel-${i}`} position={[-halfW + 0.01, WALL_H * 0.45, z]}>
                    <planeGeometry args={[0.01, 1.8]} />
                    <meshStandardMaterial color="#3a3a4a" roughness={0.6} />
                </mesh>
            ))}

            {/* Right wall (+X) */}
            <mesh position={[halfW + WALL_T / 2, WALL_H / 2, 0]}>
                <boxGeometry args={[WALL_T, WALL_H, HALL_DEPTH + WALL_T * 2]} />
                <meshStandardMaterial color="#2a2a36" roughness={0.7} metalness={0.1} />
            </mesh>
            {/* Right wall accent stripe */}
            <mesh position={[halfW + 0.01, WALL_H * 0.85, 0]}>
                <boxGeometry args={[0.01, 0.25, HALL_DEPTH]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.3} roughness={0.3} />
            </mesh>
            {/* Right wall banner panel */}
            <mesh position={[halfW + 0.02, WALL_H * 0.45, 0]}>
                <planeGeometry args={[0.01, 2.0]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.1} roughness={0.5} />
            </mesh>

            {/* Front wall (+Z) — partial with entrance gap */}
            {/* Left segment */}
            <mesh position={[-halfW * 0.55, WALL_H / 2, halfD + WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH * 0.35, WALL_H, WALL_T]} />
                <meshStandardMaterial color="#2a2a36" roughness={0.7} metalness={0.1} />
            </mesh>
            {/* Right segment */}
            <mesh position={[halfW * 0.55, WALL_H / 2, halfD + WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH * 0.35, WALL_H, WALL_T]} />
                <meshStandardMaterial color="#2a2a36" roughness={0.7} metalness={0.1} />
            </mesh>
            {/* Entrance arch top */}
            <mesh position={[0, WALL_H - 0.2, halfD + WALL_T / 2]}>
                <boxGeometry args={[HALL_WIDTH * 0.32, 0.5, WALL_T]} />
                <meshStandardMaterial color="#4f46e5" emissive="#4f46e5" emissiveIntensity={0.4} roughness={0.3} />
            </mesh>

            {/* ══════════ CORNER COLUMNS ══════════ */}
            {[
                [-halfW, -halfD],
                [halfW, -halfD],
                [-halfW, halfD],
                [halfW, halfD],
            ].map(([x, z], i) => (
                <group key={`col-${i}`} position={[x, 0, z]}>
                    {/* Column body */}
                    <mesh position={[0, WALL_H / 2, 0]}>
                        <boxGeometry args={[0.5, WALL_H, 0.5]} />
                        <meshStandardMaterial color="#4f46e5" roughness={0.4} metalness={0.15} />
                    </mesh>
                    {/* Column cap */}
                    <mesh position={[0, WALL_H + 0.1, 0]}>
                        <boxGeometry args={[0.65, 0.2, 0.65]} />
                        <meshStandardMaterial color="#4338ca" roughness={0.4} />
                    </mesh>
                    {/* Column base */}
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.6, 0.2, 0.6]} />
                        <meshStandardMaterial color="#4338ca" roughness={0.4} />
                    </mesh>
                </group>
            ))}

            {/* ══════════ ENTRANCE FLOOR WELCOME MAT ══════════ */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.004, halfD + 1.2]}>
                <planeGeometry args={[6, 2]} />
                <meshStandardMaterial color="#4f46e5" roughness={0.9} transparent opacity={0.3} />
            </mesh>

            {/* ══════════ DECORATIVE PLANTS (simple green pillars) ══════════ */}
            {[
                [-halfW + 1.2, halfD - 1.2],
                [halfW - 1.2, halfD - 1.2],
            ].map(([x, z], i) => (
                <group key={`plant-${i}`} position={[x, 0, z]}>
                    {/* Pot */}
                    <mesh position={[0, 0.25, 0]}>
                        <cylinderGeometry args={[0.22, 0.28, 0.5, 8]} />
                        <meshStandardMaterial color="#8B6914" roughness={0.7} />
                    </mesh>
                    {/* Green foliage */}
                    <mesh position={[0, 0.7, 0]}>
                        <sphereGeometry args={[0.35, 8, 8]} />
                        <meshStandardMaterial color="#2d8a4e" roughness={0.8} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

export const HallFloor = memo(HallFloorInner);

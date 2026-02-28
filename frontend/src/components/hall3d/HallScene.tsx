'use client';

import React, { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Stand } from '@/types/stand';
import { HallFloor, HALL_WIDTH, HALL_DEPTH } from './HallFloor';
import { Booth } from './Booth';
import { useHallLayout } from './useHallLayout';

interface HallSceneProps {
    stands: Stand[];
    onStandClick: (standId: string) => void;
    eventTitle?: string;
}

/**
 * HallSceneContent – The 3D content rendered inside the Canvas.
 */
function HallSceneContent({ stands, onStandClick, eventTitle }: HallSceneProps) {
    const placements = useHallLayout(stands);

    return (
        <>
            {/* ── Fixed isometric lighting ── */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 20, 10]} intensity={0.5} />
            <directionalLight position={[-8, 15, -8]} intensity={0.25} />

            {/* ── Hall Floor (with event title on back wall) ── */}
            <HallFloor eventTitle={eventTitle} />

            {/* ── Booths ── */}
            {placements.map((p) => (
                <Booth key={p.id} stand={p.stand} position={p.position} onClick={onStandClick} />
            ))}

            {/* ── "Click a stand" prompt near entrance ── */}
            <Text
                position={[0, 0.15, HALL_DEPTH / 2 - 0.6]}
                fontSize={0.22}
                color="#818cf8"
                anchorX="center"
                anchorY="middle"
                font={undefined}
            >
                ▼  Click a stand to visit  ▼
            </Text>
        </>
    );
}

/**
 * HallScene – Wrapper that creates the Canvas with a fixed orthographic camera.
 * This is purely presentational. It receives stands and an onClick callback.
 */
function HallSceneInner({ stands, onStandClick, eventTitle }: HallSceneProps) {
    if (!stands || stands.length === 0) return null;

    return (
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-[#1a1a22]" style={{ height: '85vh', minHeight: 600 }}>
            <Canvas
                orthographic
                camera={{
                    position: [15, 22, 15],
                    zoom: 24,
                    near: 0.1,
                    far: 200,
                }}
                gl={{ antialias: true, alpha: false }}
                dpr={[1, 1.5]}
                style={{ width: '100%', height: '100%' }}
                onCreated={({ camera }) => {
                    camera.lookAt(0, 0, 0);
                }}
            >
                <Suspense fallback={null}>
                    <HallSceneContent stands={stands} onStandClick={onStandClick} eventTitle={eventTitle} />
                </Suspense>
            </Canvas>
        </div>
    );
}

export const HallScene = memo(HallSceneInner);

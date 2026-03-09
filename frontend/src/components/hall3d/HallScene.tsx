'use client';

import React, { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Stand } from '@/types/stand';
import { HallFloor, HALL_WIDTH, HALL_DEPTH } from './HallFloor';
import { Booth } from './Booth';
import { useHallLayout } from './useHallLayout';
import { useHallTextures } from './useHallTextures';

interface HallSceneProps {
    stands: Stand[];
    onStandClick: (standId: string) => void;
    eventTitle?: string;
}

/**
 * HallSceneContent – The 3D content rendered inside the Canvas.
 * Rich warm lighting inspired by real exhibition halls.
 */
function HallSceneContent({ stands, onStandClick, eventTitle }: HallSceneProps) {
    const placements = useHallLayout(stands);
    const textures = useHallTextures();

    return (
        <>
            {/* ── Warm realistic lighting rig ── */}
            <hemisphereLight args={['#ffeedd', '#8B7355', 0.45]} />
            <ambientLight intensity={0.5} color="#fff5eb" />
            <directionalLight position={[12, 25, 10]} intensity={0.7} color="#fff0d6" />
            <directionalLight position={[-10, 18, -6]} intensity={0.3} color="#e8e0f0" />
            <directionalLight position={[0, 12, -15]} intensity={0.2} color="#ffd6b0" />
            <pointLight position={[0, 6, 0]} intensity={0.3} color="#ffe8cc" distance={30} decay={2} />
            <pointLight position={[-8, 4, -5]} intensity={0.15} color="#ffe0b2" distance={20} decay={2} />
            <pointLight position={[8, 4, -5]} intensity={0.15} color="#ffe0b2" distance={20} decay={2} />

            {/* ── Fog for atmospheric depth ── */}
            <fog attach="fog" args={['#e8ddd0', 35, 70]} />

            {/* ── Hall Floor (with event branding + textures) ── */}
            <HallFloor eventTitle={eventTitle} textures={textures} />

            {/* ── Booths ── */}
            {placements.map((p) => (
                <Booth key={p.id} stand={p.stand} position={p.position} textures={textures} onClick={onStandClick} />
            ))}

            {/* ── "Click a stand" prompt ── */}
            <Text
                position={[0, 0.15, HALL_DEPTH / 2 - 0.6]}
                fontSize={0.22}
                color="#5b5040"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.01}
                outlineColor="#ffffff"
                font={undefined}
            >
                {'▼  Click a stand to visit  ▼'}
            </Text>
        </>
    );
}

/**
 * HallScene – Wrapper that creates the Canvas with a fixed orthographic camera.
 * Warm background to eliminate black void — resembles a real convention center.
 */
function HallSceneInner({ stands, onStandClick, eventTitle }: HallSceneProps) {
    if (!stands || stands.length === 0) return null;

    return (
        <div className="w-full rounded-xl overflow-hidden border border-amber-200/50 shadow-xl bg-[#d4c4a8]" style={{ height: '85vh', minHeight: 600 }}>
            <Canvas
                orthographic
                camera={{
                    position: [15,22,15],
                    zoom: 23,
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
                <color attach="background" args={['#d4c4a8']} />
                <Suspense fallback={null}>
                    <HallSceneContent stands={stands} onStandClick={onStandClick} eventTitle={eventTitle} />
                </Suspense>
            </Canvas>
        </div>
    );
}

export const HallScene = memo(HallSceneInner);

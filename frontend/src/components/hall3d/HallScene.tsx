'use client';

import React, { memo, Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Stand } from '@/types/stand';
import { HallFloor, HALL_WIDTH, HALL_DEPTH } from './HallFloor';
import { Booth } from './Booth';
import { useHallLayout } from './useHallLayout';
import { useHallTextures } from './useHallTextures';

interface HallSceneProps {
    stands: Stand[];
    onStandClick: (standId: string) => void;
    eventTitle?: string;
    eventBannerUrl?: string;
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
            {/* ── Responsive Camera Controller ── */}
            <ResponsiveCamera />

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
            <fog attach="fog" args={['#e8ddd0', 60, 100]} />

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
 * ResponsiveCamera — dynamically adjusts the orthographic zoom based on screen width
 * so that the exhibition hall doesn't look cut-off or oversized on mobile phones.
 */
function ResponsiveCamera() {
    const { camera, size } = useThree();

    useEffect(() => {
        if (!(camera instanceof THREE.OrthographicCamera)) return;

        // Base zoom calculation: scale zoom down for smaller screens
        // Default target is zoom 22 for standard desktop width (~1000px and up)
        const baseZoom = 22;
        let responsiveZoom;

        if (size.width < 600) {
            // Mobile (e.g. 375px) -> significantly zoom in more than before
            responsiveZoom = baseZoom * (size.width / 600);
            // Ensure a minimum clamp
            if (responsiveZoom < 12.5) responsiveZoom = 12.5;
        } else if (size.width < 1024) {
            // Tablet -> moderate scale down
            responsiveZoom = baseZoom * (size.width / 900);
            if (responsiveZoom < 18) responsiveZoom = 18;
        } else {
            // Desktop
            responsiveZoom = baseZoom;
        }

        camera.zoom = responsiveZoom;
        camera.updateProjectionMatrix();

    }, [camera, size.width]);

    return null;
}

/**
 * HallScene – Wrapper that creates the Canvas with a fixed orthographic camera.
 * Warm background to eliminate black void — resembles a real convention center.
 * Includes fullscreen toggle and responsive sizing.
 */
function HallSceneInner({ stands, onStandClick, eventTitle }: HallSceneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;
        try {
            if (!document.fullscreenElement) {
                await el.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    }, []);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    if (!stands || stands.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className="relative w-full rounded-xl overflow-hidden border border-amber-200/50 shadow-xl bg-[#d4c4a8] h-[45vh] sm:h-[60vh] md:h-[70vh] lg:h-[130vh]"
            style={{ minHeight: 320 }}
        >
            {/* Fullscreen toggle button */}
            <button
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm border border-amber-200 shadow-md hover:bg-white hover:shadow-lg transition-all text-xs font-medium text-zinc-700"
                title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            >
                {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 4 20 10 20" /><polyline points="20 10 20 4 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                )}
                <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            <Canvas
                orthographic
                camera={{
                    position: [18, 27, 16],
                    zoom: 22,
                    near: 0.1,
                    far: 200,
                }}
                gl={{ antialias: true, alpha: false }}
                dpr={[1, 1.5]}
                style={{ width: '100%', height: '100%' }}
                onCreated={({ camera }) => {
                    camera.lookAt(0, 1, 0);
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

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
import { useTranslation } from 'react-i18next';

interface HallSceneProps {
    stands: Stand[];
    onStandClick: (standId: string) => void;
    eventTitle?: string;
    eventBannerUrl?: string;
    onViewAllStands?: () => void;
}

/**
 * HallSceneContent – The 3D content rendered inside the Canvas.
 * Rich warm lighting inspired by real exhibition halls.
 */
function HallSceneContent({ stands, onStandClick, eventTitle, onViewAllStands }: HallSceneProps) {
    const { t } = useTranslation();
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

            {/* ── 3D floor CTA outside bottom-right wall ── */}
            {onViewAllStands && <HallFloorCta onClick={onViewAllStands} />}

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
                {t('visitor.hall3d.scene.clickStandPrompt')}
            </Text>
        </>
    );
}

function HallFloorCta({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    const { size } = useThree();
    const [hovered, setHovered] = useState(false);
    const responsiveScale = size.width < 640 ? 1.35 : size.width < 1024 ? 1.18 : 1;

    return (
        <group
            position={[HALL_WIDTH / 2 + 2.3, 0.03, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[responsiveScale, responsiveScale, responsiveScale]}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(false);
                document.body.style.cursor = 'auto';
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[5.6, 0.09, 2.35]} />
                <meshStandardMaterial
                    color={hovered ? '#d97706' : '#92400e'}
                    emissive={hovered ? '#f59e0b' : '#78350f'}
                    emissiveIntensity={hovered ? 0.42 : 0.18}
                    roughness={0.35}
                    metalness={0.15}
                />
            </mesh>

            <mesh position={[0, 0.04, 0]}>
                <boxGeometry args={[5.35, 0.025, 2.15]} />
                <meshStandardMaterial
                    color={hovered ? '#f59e0b' : '#b45309'}
                    emissive={hovered ? '#fbbf24' : '#92400e'}
                    emissiveIntensity={hovered ? 0.38 : 0.14}
                    roughness={0.28}
                    metalness={0.08}
                />
            </mesh>

            <Text
                position={[0, 0.079, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.62}
                color={hovered ? '#ffffff' : '#fef3c7'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#451a03"
                font={undefined}
            >
                {t('visitor.hall3d.scene.viewAllStands')}
            </Text>
        </group>
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
            // Mobile-only: zoom out a bit so hall corners and floor CTA remain visible.
            responsiveZoom = baseZoom * (size.width / 600) * 0.82;
            // Ensure a minimum clamp
            if (responsiveZoom < 11.8) responsiveZoom = 11.8;
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
function HallSceneInner({ stands, onStandClick, eventTitle, onViewAllStands }: HallSceneProps) {
    const { t } = useTranslation();
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
                title={isFullscreen ? t('visitor.hall3d.scene.actions.exitFullscreen') : t('visitor.hall3d.scene.actions.viewFullscreen')}
            >
                {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 4 20 10 20" /><polyline points="20 10 20 4 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                )}
                <span className="hidden sm:inline">{isFullscreen ? t('visitor.hall3d.scene.actions.exitFullscreen') : t('visitor.hall3d.scene.actions.fullscreen')}</span>
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
                    <HallSceneContent
                        stands={stands}
                        onStandClick={onStandClick}
                        eventTitle={eventTitle}
                        onViewAllStands={onViewAllStands}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}

export const HallScene = memo(HallSceneInner);

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Draw on an offscreen canvas and return a repeating Three.js texture.
 */
function canvasTexture(
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    repeatX = 1,
    repeatY = 1,
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/* ─────────── Procedural texture generators ─────────── */

/** Warm wood-plank floor texture with grain lines */
function createWoodTexture(repX = 4, repY = 4): THREE.CanvasTexture {
    return canvasTexture(512, 512, (ctx, w, h) => {
        // Base warm wood
        ctx.fillStyle = '#b8935a';
        ctx.fillRect(0, 0, w, h);
        // Plank rows
        const planks = 8;
        const pH = h / planks;
        for (let i = 0; i < planks; i++) {
            const y = i * pH;
            // alternate shade
            ctx.fillStyle = i % 2 === 0 ? '#c9a46c' : '#a67d42';
            ctx.fillRect(0, y, w, pH - 2);
            // Grain lines
            ctx.strokeStyle = 'rgba(100,65,20,0.18)';
            ctx.lineWidth = 1;
            for (let g = 0; g < 6; g++) {
                ctx.beginPath();
                const gy = y + 3 + g * (pH / 7);
                ctx.moveTo(0, gy);
                ctx.bezierCurveTo(w * 0.25, gy + (g % 2 ? 2 : -2), w * 0.75, gy + (g % 2 ? -1 : 1), w, gy);
                ctx.stroke();
            }
            // Plank gap
            ctx.fillStyle = 'rgba(70,45,15,0.35)';
            ctx.fillRect(0, y + pH - 2, w, 2);
        }
        // Vertical stagger lines
        for (let i = 0; i < planks; i++) {
            const y = i * pH;
            const xOff = i % 2 === 0 ? w * 0.5 : w * 0.3;
            ctx.fillStyle = 'rgba(70,45,15,0.3)';
            ctx.fillRect(xOff, y, 2, pH);
        }
    }, repX, repY);
}

/** Dark polished marble/tile floor */
function createMarbleFloorTexture(repX = 6, repY = 5): THREE.CanvasTexture {
    return canvasTexture(512, 512, (ctx, w, h) => {
        // Dark base
        ctx.fillStyle = '#3a3a42';
        ctx.fillRect(0, 0, w, h);
        // Subtle veins
        ctx.strokeStyle = 'rgba(100,100,115,0.15)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            const x0 = Math.random() * w;
            const y0 = Math.random() * h;
            ctx.moveTo(x0, y0);
            ctx.bezierCurveTo(
                x0 + (Math.random() - 0.5) * 200, y0 + (Math.random() - 0.5) * 200,
                x0 + (Math.random() - 0.5) * 300, y0 + (Math.random() - 0.5) * 300,
                x0 + (Math.random() - 0.5) * 400, y0 + (Math.random() - 0.5) * 400,
            );
            ctx.stroke();
        }
        // Tile grid
        const cols = 4;
        const rows = 4;
        const tw = w / cols;
        const th = h / rows;
        ctx.strokeStyle = 'rgba(80,80,92,0.35)';
        ctx.lineWidth = 2;
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * th); ctx.lineTo(w, r * th); ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath(); ctx.moveTo(c * tw, 0); ctx.lineTo(c * tw, h); ctx.stroke();
        }
        // Slight specular highlights
        for (let i = 0; i < 30; i++) {
            const gx = Math.random() * w;
            const gy = Math.random() * h;
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 15 + Math.random() * 30);
            grad.addColorStop(0, 'rgba(180,180,195,0.06)');
            grad.addColorStop(1, 'rgba(180,180,195,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx - 40, gy - 40, 80, 80);
        }
    }, repX, repY);
}

/** Cream/stucco wall texture */
function createWallTexture(repX = 3, repY = 2): THREE.CanvasTexture {
    return canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#f0e6d3';
        ctx.fillRect(0, 0, w, h);
        // Subtle stucco noise
        for (let i = 0; i < 8000; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            ctx.fillStyle = `rgba(${180 + Math.random() * 40},${170 + Math.random() * 40},${150 + Math.random() * 30},0.08)`;
            ctx.fillRect(x, y, 2, 2);
        }
        // Subtle horizontal mortar lines
        for (let i = 1; i < 6; i++) {
            ctx.fillStyle = 'rgba(200,185,165,0.2)';
            ctx.fillRect(0, i * (h / 6) - 1, w, 2);
        }
    }, repX, repY);
}

/** Green hedge/vine wall texture */
function createHedgeTexture(repX = 3, repY = 2): THREE.CanvasTexture {
    return canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#2d6b3a';
        ctx.fillRect(0, 0, w, h);
        // Leaf clusters
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 6 + Math.random() * 14;
            const shade = Math.random() > 0.5 ? '#3d8a4e' : '#1f5a2a';
            ctx.fillStyle = shade;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        // Vine lines
        ctx.strokeStyle = 'rgba(20,60,25,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * w, 0);
            ctx.bezierCurveTo(Math.random() * w, h * 0.33, Math.random() * w, h * 0.66, Math.random() * w, h);
            ctx.stroke();
        }
    }, repX, repY);
}

/** Booth carpet texture */
function createCarpetTexture(repX = 2, repY = 2): THREE.CanvasTexture {
    return canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#d8d4e4';
        ctx.fillRect(0, 0, w, h);
        // Fine carpet weave
        for (let y = 0; y < h; y += 3) {
            for (let x = 0; x < w; x += 3) {
                const v = 200 + Math.random() * 30;
                ctx.fillStyle = `rgb(${v},${v - 4},${v + 8})`;
                ctx.fillRect(x, y, 2, 2);
            }
        }
    }, repX, repY);
}

/** Warm wood desk / furniture top texture  */
function createDeskWoodTexture(repX = 1, repY = 1): THREE.CanvasTexture {
    return canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#a07848';
        ctx.fillRect(0, 0, w, h);
        // Wood grain
        ctx.strokeStyle = 'rgba(80,50,20,0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const y = Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 6, w * 0.7, y + (Math.random() - 0.5) * 6, w, y);
            ctx.stroke();
        }
    }, repX, repY);
}

/** Partition wall (light smooth panel) */
function createPartitionTexture(repX = 1, repY = 1): THREE.CanvasTexture {
    return canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f0eff5';
        ctx.fillRect(0, 0, w, h);
        // Very subtle panel grain
        for (let i = 0; i < 1500; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            ctx.fillStyle = `rgba(220,218,228,0.12)`;
            ctx.fillRect(x, y, 2, 1);
        }
        // Panel edge lines
        ctx.strokeStyle = 'rgba(200,198,210,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4, 4, w - 8, h - 8);
    }, repX, repY);
}

/** Brushed metal (for legs, trims, etc.) */
function createMetalTexture(repX = 1, repY = 1): THREE.CanvasTexture {
    return canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#6a6a72';
        ctx.fillRect(0, 0, w, h);
        // Horizontal brush lines
        for (let y = 0; y < h; y += 1) {
            const v = 95 + Math.random() * 25;
            ctx.fillStyle = `rgba(${v},${v},${v + 5},0.15)`;
            ctx.fillRect(0, y, w, 1);
        }
    }, repX, repY);
}

/* ─────────── Hook — create once, reuse everywhere ─────────── */

export interface HallTextures {
    wood: THREE.CanvasTexture;
    marble: THREE.CanvasTexture;
    wall: THREE.CanvasTexture;
    hedge: THREE.CanvasTexture;
    carpet: THREE.CanvasTexture;
    deskWood: THREE.CanvasTexture;
    partition: THREE.CanvasTexture;
    metal: THREE.CanvasTexture;
}

/**
 * useHallTextures — creates all procedural canvas textures once.
 * Memoised so they're never regenerated on re-render.
 */
export function useHallTextures(): HallTextures {
    return useMemo<HallTextures>(() => ({
        wood: createWoodTexture(),
        marble: createMarbleFloorTexture(),
        wall: createWallTexture(),
        hedge: createHedgeTexture(),
        carpet: createCarpetTexture(),
        deskWood: createDeskWoodTexture(),
        partition: createPartitionTexture(),
        metal: createMetalTexture(),
    }), []);
}

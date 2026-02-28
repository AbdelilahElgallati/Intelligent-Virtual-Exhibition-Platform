'use client';

import { useMemo } from 'react';
import type { Stand } from '@/types/stand';
import { HALL_WIDTH, HALL_DEPTH } from './HallFloor';

export interface BoothPlacement {
    id: string;
    stand: Stand;
    position: [number, number, number];
}

/* Space reserved around edges */
const MARGIN_X = 3.5;
const MARGIN_Z = 3.5;

/* Booth footprint + spacing (GAP_Z increased for front-of-booth floor labels) */
const BOOTH_W = 3.4;
const BOOTH_D = 2.8;
const GAP_X = 1.6;
const GAP_Z = 3.0;

/**
 * useHallLayout – Computes booth positions for the current page of stands.
 *
 * If a stand has `hall_position_x` / `hall_position_y` we respect those,
 * otherwise we auto-generate a centered, symmetrical grid.
 */
export function useHallLayout(stands: Stand[]): BoothPlacement[] {
    return useMemo(() => {
        if (!stands || stands.length === 0) return [];

        /* Usable area inside hall */
        const usableW = HALL_WIDTH - MARGIN_X * 2;
        const usableD = HALL_DEPTH - MARGIN_Z * 2;

        /* How many columns & rows fit */
        const cols = Math.max(1, Math.floor((usableW + GAP_X) / (BOOTH_W + GAP_X)));
        const rows = Math.max(1, Math.ceil(stands.length / cols));

        /* Actual grid dimensions for centering */
        const gridW = cols * BOOTH_W + (cols - 1) * GAP_X;
        const gridD = rows * BOOTH_D + (rows - 1) * GAP_Z;

        const originX = -gridW / 2 + BOOTH_W / 2;
        const originZ = -gridD / 2 + BOOTH_D / 2;

        return stands.map((stand, index) => {
            const id = stand.id || (stand as any)._id;

            // Check for explicit positioning (optional future fields)
            const hasExplicit =
                typeof (stand as any).hall_position_x === 'number' &&
                typeof (stand as any).hall_position_y === 'number';

            if (hasExplicit) {
                return {
                    id,
                    stand,
                    position: [(stand as any).hall_position_x, 0, (stand as any).hall_position_y] as [number, number, number],
                };
            }

            /* Auto-grid placement */
            const col = index % cols;
            const row = Math.floor(index / cols);

            const x = originX + col * (BOOTH_W + GAP_X);
            const z = originZ + row * (BOOTH_D + GAP_Z);

            return {
                id,
                stand,
                position: [x, 0, z] as [number, number, number],
            };
        });
    }, [stands]);
}

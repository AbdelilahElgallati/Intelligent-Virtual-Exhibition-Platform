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
const MARGIN_Z = 4.0;

/* Booth footprint + spacing — enlarged for 3-per-row layout */
const BOOTH_W = 4.5;
const BOOTH_D = 3.4;
const GAP_X = 2.2;
const GAP_Z = 4.0;
const FIXED_COLS = 3;

/* Shift grid slightly toward back wall to center booths+labels within hall */
const Z_OFFSET = -1.5;

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

        /* Fixed 3 columns for clearer, larger booths */
        const cols = FIXED_COLS;
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
            const z = originZ + row * (BOOTH_D + GAP_Z) + Z_OFFSET;

            return {
                id,
                stand,
                position: [x, 0, z] as [number, number, number],
            };
        });
    }, [stands]);
}

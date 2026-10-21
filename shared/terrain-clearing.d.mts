export interface TerrainClearing { squareFeetPerMinute: number }
export function validTerrainClearing(value: unknown): value is TerrainClearing
export interface TerrainClearingProgress { col: number; row: number; workedRounds: number; lastCombatId: string; lastRound: number }
export function validTerrainClearingProgress(value: unknown, cells: readonly { col: number; row: number }[]): value is TerrainClearingProgress[] | undefined

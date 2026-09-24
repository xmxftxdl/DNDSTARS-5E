import type { AbilityKey } from '../../lib/dnd'
import { cellsForAoe } from '../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'

export const SYMBOL_MODES = ['death', 'discord', 'fear', 'hopelessness', 'insanity', 'pain', 'sleep', 'stunning'] as const
export type SymbolMode = typeof SYMBOL_MODES[number]
export interface SymbolAreaState { mode: SymbolMode; activated: boolean }
export const SYMBOL_LABELS: Record<SymbolMode, string> = {
  death: '死亡', discord: '纷争', fear: '恐惧', hopelessness: '绝望',
  insanity: '疯狂', pain: '痛苦', sleep: '沉睡', stunning: '震慑',
}
export const SYMBOL_SAVES: Record<SymbolMode, AbilityKey> = {
  death: 'con', discord: 'con', fear: 'wis', hopelessness: 'cha',
  insanity: 'int', pain: 'con', sleep: 'wis', stunning: 'wis',
}
export function normalizeSymbolAreaState(value: unknown): SymbolAreaState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const state = value as SymbolAreaState
  return SYMBOL_MODES.includes(state.mode) && typeof state.activated === 'boolean'
    ? { mode: state.mode, activated: state.activated } : undefined
}

/** Only the DM activation command calls this; cast-time creation never resolves a save. */
export function activateSymbolArea(map: BattleMap, areaId: string, round: number, worldMinute: number): BattleMap | undefined {
  const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === areaId)
  if (!area || area.coreSpellId !== 'symbol' || !area.symbol || area.symbol.activated || !area.anchorCell || !area.sourceSpellSaveDc) return undefined
  const saveDc = area.sourceSpellSaveDc
  const mode = area.symbol.mode
  const triggers: Dnd5ePersistentAreaTriggerSnapshot[] = (['on-create', 'on-enter', 'turn-end'] as const).map(timing => ({
    id: `symbol-${mode}-${timing}`, label: `魔法徽记·${SYMBOL_LABELS[mode]}`,
    timing, oncePerRound: false, oncePerTurn: timing === 'on-enter',
    savingThrow: { ability: SYMBOL_SAVES[mode], dc: saveDc, onSuccess: mode === 'death' ? 'half' : 'none', magical: true },
    ...(mode === 'death' ? { damage: { count: 10, sides: 10, type: 'necrotic' as const } } : {}),
    ...(['fear', 'pain', 'sleep', 'stunning'].includes(mode) ? {
      condition: {
        condition: ({ fear: 'frightened', pain: 'incapacitated', sleep: 'unconscious', stunning: 'stunned' } as const)[mode as 'fear' | 'pain' | 'sleep' | 'stunning'],
        duration: { expiresAt: 'target-turn-end' as const, remainingRounds: mode === 'sleep' ? 100 : 10 },
      },
    } : {}),
  }))
  const activated: Dnd5ePluginArea = {
    ...area, symbol: { mode, activated: true }, label: `魔法徽记·${SYMBOL_LABELS[mode]}`,
    permanent: undefined, createdRound: round, expiresAfterRound: round + 100,
    createdWorldMinute: worldMinute, expiresAtWorldMinute: worldMinute + 10,
    hiddenFromPlayers: false,
    cells: cellsForAoe({ shape: 'circle', origin: 'point', radiusFeet: 60 * 5 / (map.feetPerCell ?? 5) }, area.anchorCell, area.anchorCell),
    vertical: { mode: 'volume', baseElevationFeet: (area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0) - 60, heightFeet: 120 },
    lighting: { kind: 'light', brightRadiusFeet: 0, dimRadiusFeet: 60, color: '#a78bfa', spellLevel: area.slotLevel ?? 7 },
    visual: { preset: 'arcane', intensity: 'strong' }, triggers,
  }
  return { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(candidate => candidate.id === areaId ? activated : candidate) }
}

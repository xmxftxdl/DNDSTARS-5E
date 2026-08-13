import type { GridCell } from '../../lib/gridCombat'
import type { Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5eMonsterAction, Dnd5eMonsterStatBlock } from './monsters'

type PersistentAreaRule = Extract<
  NonNullable<Dnd5eMonsterAction['rule']>,
  { kind: 'persistent-area' }
>

function boundedElevation(value: number): number {
  return Math.max(-1_000, Math.min(10_000, Math.round(value)))
}

/** Builds the immutable map snapshot consumed by the shared persistent-area runtime. */
export function createDnd5eMonsterPersistentArea(input: {
  combatId: string
  round: number
  sourceToken: Token
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction & { rule: PersistentAreaRule }
  cells: readonly GridCell[]
  anchorCell: GridCell
  baseElevationFeet: number
}): Dnd5ePluginArea {
  const { rule } = input.action
  const baseElevationFeet = boundedElevation(input.baseElevationFeet)
  const concentrationId = `monster:${input.monster.id}:${input.action.id}`
  return {
    id: `monster-area:${input.combatId}:${input.round}:${input.sourceToken.id}:${input.action.id}`,
    pluginId: 'srd-5.1',
    featureId: `monster:${input.monster.id}:${input.action.id}`,
    sourceKind: 'plugin-feature',
    label: input.action.name,
    color: rule.color,
    sourceCharacterId: input.sourceToken.characterId ?? input.sourceToken.id,
    sourceTokenId: input.sourceToken.id,
    cells: input.cells.map((cell) => ({ ...cell })),
    createdRound: input.round,
    expiresAfterRound: input.round + rule.durationRounds,
    expiresAtSourceTurnEndAfterRound: rule.expiresAtSourceNextTurnEnd
      ? input.round + 1
      : undefined,
    concentrationId: rule.concentration ? concentrationId : undefined,
    anchorMode: rule.anchorMode,
    anchorTokenId: rule.anchorMode === 'source-token' ? input.sourceToken.id : undefined,
    anchorCell: { ...input.anchorCell },
    vertical: rule.vertical?.mode === 'ground'
      ? { mode: 'ground' }
      : rule.vertical?.mode === 'volume'
        ? {
            mode: 'volume',
            baseElevationFeet: boundedElevation(
              baseElevationFeet + (rule.vertical.anchorOffsetFeet ?? 0),
            ),
            heightFeet: rule.vertical.heightFeet,
            ...(rule.vertical.anchorOffsetFeet == null
              ? {}
              : { anchorOffsetFeet: rule.vertical.anchorOffsetFeet }),
          }
        : undefined,
    movement: rule.movement ? { ...rule.movement } : undefined,
    movementCostMultiplier: rule.movementCostMultiplier,
    relation: rule.relation ?? 'any',
    includeSelf: rule.includeSelf === true,
    lighting: rule.lighting ? { ...rule.lighting } : undefined,
    obscuration: rule.obscuration ? { ...rule.obscuration } : undefined,
    visual: { ...rule.visual },
    triggers: rule.triggers.map((trigger) => structuredClone(trigger)),
  }
}

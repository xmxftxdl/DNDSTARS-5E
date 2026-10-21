import type { GridCell } from '../../lib/gridCombat'
import type { Character } from '../../types/character'
import { canSeeRecognizableArea } from './areaVisualRecognition'
import { cellsForAoe } from '../../lib/skillTargeting'
import { createDnd5eCoreSpellArea, getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'

/** One possible extra effect; the cast coordinator must enforce mutual exclusivity. */
export function prepareDnd5eDruidGroveSpikeGrowth(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0] & { center: GridCell; characters?: readonly Character[] }) {
  const validated = prepareDnd5eDruidGroveFog(input)
  if (!validated.ok) return validated
  const plan = prepareDnd5eDruidGroveMapPlacement(input)
  if (!plan.ok) return plan
  const key = (cell: GridCell) => `${cell.col},${cell.row}`
  const protectedCells = new Set(plan.protectedCells.map(key))
  if (!Number.isSafeInteger(input.center.col) || !Number.isSafeInteger(input.center.row) || !protectedCells.has(key(input.center))) {
    return { ok: false as const, reason: 'invalid-extra-effect-center' }
  }
  const declaration = getDnd5eCoreSpellAreaDeclaration('spike-growth')!
  const cells = cellsForAoe(declaration.template, input.center, input.center).filter(cell => protectedCells.has(key(cell)))
  const { source } = input
  const area = createDnd5eCoreSpellArea({ declaration, actionId: `${source.castId}:grove-spikes`,
    sourceCharacterId: source.characterId, sourceTokenId: source.tokenId, sourceSaveDc: source.saveDc,
    slotLevel: source.slotLevel, round: input.round, cells, anchorCell: input.center, excludedTargetIds: input.exemptTokenIds })
  // Reuse the declaration's damage/terrain, not the standalone spell's concentration contract.
  area.sourceKind = undefined
  area.coreSpellId = undefined
  area.pluginId = source.pluginId
  area.featureId = `${source.pluginId}:${source.spellId}`
  area.effectGroup = { castId: source.castId, effectId: 'additional-spike-growth' }
  area.label = '德鲁伊林地 · 荆棘丛生'
  area.concentrationId = undefined
  area.createdWorldMinute = input.worldMinute
  area.expiresAtWorldMinute = input.worldMinute + 1_440
  area.expiresAfterRound = input.round + 14_400 - 1
  area.expiresAtSourceTurnEndAfterRound = undefined
  area.triggers = area.triggers?.map(trigger => ({ ...trigger, dmAdjustable: false, excludedTokenIds: [...new Set(input.exemptTokenIds ?? [])] }))
  area.visualRecognition = { dc: source.saveDc, knownTokenIds: input.map.tokens.filter(token =>
    token.type !== 'obstacle' && canSeeRecognizableArea(input.map, area, token, input.characters ?? [], input.worldMinute, input.geometry))
    .map(token => token.id) }
  return { ok: true as const, areas: [area] }
}

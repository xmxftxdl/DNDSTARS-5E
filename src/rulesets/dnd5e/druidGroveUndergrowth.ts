import type { Dnd5ePluginArea } from '../../store/maps'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'

/** Host projection only. Casting authorization and material consumption happen separately. */
export function prepareDnd5eDruidGroveUndergrowth(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0]) {
  // Share all placement, source and exemption checks with the other grove subeffect.
  const validated = prepareDnd5eDruidGroveFog(input)
  if (!validated.ok) return validated
  const { source, round, worldMinute } = input
  const cells = input.placement.undergrowthCells.map(cell => ({ ...cell }))
  const areas: Dnd5ePluginArea[] = cells.length ? [{
    id: `${source.castId}:grove-undergrowth`, pluginId: source.pluginId, featureId: `${source.pluginId}:${source.spellId}`,
    effectGroup: { castId: source.castId, effectId: 'undergrowth' },
    label: '德鲁伊林地 · 纠缠灌木', color: '#4d7c0f',
    sourceCharacterId: source.characterId, sourceTokenId: source.tokenId,
    sourceSpellSaveDc: source.saveDc, slotLevel: source.slotLevel,
    cells, anchorCell: { ...input.placement.origin }, anchorMode: 'fixed',
    createdRound: round, expiresAfterRound: round + 14_400 - 1,
    createdWorldMinute: worldMinute, expiresAtWorldMinute: worldMinute + 1_440,
    vertical: { mode: 'ground' }, relation: 'any', includeSelf: true,
    movementCostMultiplier: 2, visual: { preset: 'entangle', intensity: 'normal' },
    excludedTargetIds: [...new Set(input.exemptTokenIds ?? [])],
    triggers: [{
      id: 'undergrowth-create', label: '纠缠灌木 · 植物缠绕', timing: 'on-create', oncePerTarget: true,
      excludedTokenIds: [...new Set(input.exemptTokenIds ?? [])],
      savingThrow: { ability: 'str', dc: source.saveDc, onSuccess: 'none' },
      condition: { condition: 'restrained', endsWithArea: true, duration: { expiresAt: 'permanent' },
        escapeCheck: { ability: 'str', dc: source.saveDc, economy: 'action' } },
    }],
  }] : []
  return { ok: true as const, areas }
}

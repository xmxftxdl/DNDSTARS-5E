import { expect, it } from 'vitest'
import { removePersistentAreaByDm } from './persistentAreaRemoval'
import { reconcileDnd5eEndedAreaCaptives, reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'
import { expireDnd5ePluginAreasAtWorldMinute } from './pluginAreas'
import { resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eDruidGroveUndergrowth } from './druidGroveUndergrowth'
import { collectDnd5ePersistentAreaTriggers, dnd5ePersistentAreaDifficultTerrainMultiplierAt } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})


it.each([1, 20])('settles creation STR save %i through Headless after reload', d20 => {
  const input = fixture()
  input.map.tokens[1] = { ...input.map.tokens[1], characterId: 'victim', type: 'player' }
  const projection = prepareDnd5eDruidGroveUndergrowth(input)
  if (!projection.ok) throw Error(projection.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: projection.areas }] }))).maps[0]
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 1, targetTokenId: 'target' })
  expect(candidates).toHaveLength(1)
  expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-enter', round: 2, targetTokenId: 'target' })).toHaveLength(0)
  const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 1,
    characters: [character({ id: 'owner' }), character({ id: 'victim' })],
    initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
  if (!prepared.ok) throw Error(JSON.stringify(prepared))
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20 })
  expect(resolved.result.ok).toBe(true)
  const victim = resolved.application?.characters.find(c => c.id === 'victim')
  expect(JSON.stringify(victim).includes('restrained')).toBe(d20 === 1)
  if (d20 === 1) {
    const actor = resolved.result.state.combatants.target
    const effect = actor.classState.activeEffects!.find(effect => effect.standardCondition === 'restrained')!
    expect(effect.areaLifetime).toEqual({ mapId: map.id, areaId: projection.areas[0].id, sourceActorId: 'caster' })
    const persisted = JSON.parse(JSON.stringify(resolved.application!))
    const remainsBound = (characters: readonly Character[]) => characters.find(c => c.id === 'victim')?.dnd5eCombatState?.activeEffects?.some(e => e.id === effect.id) ?? false
    expect(remainsBound(reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [persisted.map], characters: persisted.characters, round: 1 }).characters)).toBe(true)
    const deleted = removePersistentAreaByDm({ map: persisted.map, characters: persisted.characters, areaId: projection.areas[0].id })!
    expect(remainsBound(deleted.characters!)).toBe(false)
    const expired = expireDnd5ePluginAreasAtWorldMinute(persisted.map, 1540)
    const cleanup = reconcileDnd5eEndedAreaCaptives({ before: persisted.map, after: expired, characters: persisted.characters, round: 1 })
    expect(remainsBound(cleanup.characters)).toBe(false)
    expect(remainsBound(reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [expired], characters: persisted.characters, round: 1 }).characters)).toBe(false)
    expect(effect.escapeCheck).toMatchObject({ ability: 'str', dc: 17, economy: 'action' })
    for (const roll of [1, 20]) {
      const turn = startDnd5eHeadlessCombat('escape-grove', [{ ...actor, initiative: 20 },
        { ...resolved.result.state.combatants.caster, initiative: 10 }])
      const escaped = resolveDnd5eHeadlessAction(turn, { type: 'escape-active-effect', actorId: actor.id, effectId: effect.id, d20: roll })
      expect(escaped.ok).toBe(true)
      expect(escaped.state.combatants.target.turn.actionAvailable).toBe(false)
      expect(escaped.state.combatants.target.classState.activeEffects?.some(e => e.id === effect.id) ?? false).toBe(roll === 1)
    }
  }
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: map.tokens[1], position: { x: 125, y: 25 } })).toBe(2)
})

it('keeps exempt creatures immune to both terrain and creation trigger', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveUndergrowth({ ...input, exemptTokenIds: ['target'] })
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 1, targetTokenId: 'target' })).toHaveLength(0)
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: map.tokens[1], position: { x: 125, y: 25 } })).toBe(1)
})

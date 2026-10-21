import { dnd5eExecutableCompanionOrder } from './companionOrderExecution'
import { cellToPixel } from '../../lib/gridCombat'
import { dnd5eGroveCastIdentity } from './druidGroveCastIdentity'
import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { prepareDnd5eDruidGroveAreaBundle, normalizeDnd5eDruidGroveExtraEffect } from './druidGroveAreaBundle'
import { removePersistentAreaByDm } from './persistentAreaRemoval'
import { collectDnd5ePersistentAreaTriggers, expireDnd5ePluginAreasAtWorldMinute, reconcileDnd5ePluginAreasAfterSourceMove } from './pluginAreas'
import { dnd5eSummonAutomaticTargets } from './summonAutomaticTargets'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import { normalizeCharacter } from '../../store/characters'
import { prepareDnd5eGroveCommand } from './druidGroveCommand'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { resolveDnd5eMonsterHelp } from './monsterBasicAction'
import { prepareDnd5eCompanionHide } from './companionHideAction'
import { resolvePreparedDnd5ePlayerBasicAction } from './playerBasicAction'
import { resolveDnd5eCompanionReadyAction } from './companionReadyAction'
import { resolveDnd5eCompanionObjectAction } from './companionObjectAction'
import { resolveDnd5eReadiedObjectAction } from './readiedObjectAction'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { prepareDnd5eGrovePassword } from './druidGrovePassword'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
afterEach(() => setMapGeometryRuntime([]))

it.each([
  {kind:'none'},
  {kind:'spike-growth',center:{col:1,row:0}},
  {kind:'gusts',winds:[{origin:{col:1,row:2},aim:{col:1,row:0}},{origin:{col:4,row:2},aim:{col:4,row:0}}]},
  {kind:'wind-walls',walls:[{path:[{col:1,row:0}]},{path:[{col:4,row:0}]}]},
])('keeps partial outdoor ground and excludes structures in the persisted bundle: $kind', extra => {
  const input={...fixture(),extra}
  input.placement.undergrowthCells=[{col:1,row:0}]
  input.qualifications.structureObstacleIds=['house']
  input.geometry.obstacles.push({id:'house',kind:'obstacle',label:'House',
    points:[{x:0,y:0},{x:85,y:0},{x:85,y:50},{x:0,y:50}],baseHeightFeet:0,heightFeet:20,
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1})
  setMapGeometryRuntime([input.geometry])
  const prepared=prepareDnd5eDruidGroveAreaBundle(input)
  if(!prepared.ok)throw Error(prepared.reason)
  const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[prepared.preparedMap]}))).maps[0]
  const affected=map.dnd5ePluginAreas!.filter(area=>area.cells.some(cell=>cell.col===1&&cell.row===0))
  expect(affected.length).toBe(extra.kind==='none'?1:2)
  for(const area of affected){
    // Keep footprints wholly on either side of the edge so this tests the
    // classified volume rather than the policy for a creature straddling it.
    const token={...map.tokens[1],size:0.1,y:25}
    expect(dnd5eTokenIntersectsPersistentAreaAt(token,map,area,{x:60,y:25})).toBe(false)
    expect(dnd5eTokenIntersectsPersistentAreaAt(token,map,area,{x:95,y:25})).toBe(true)
  }
})
it.each([{ kind: 'none' }, { kind: 'spike-growth', center: { col: 2, row: 2 } },
  { kind: 'gusts', winds: [{ origin: { col: 2, row: 0 }, aim: { col: 2, row: 1 } }, { origin: { col: 5, row: 0 }, aim: { col: 5, row: 1 } }] },
  { kind: 'wind-walls', walls: [{ center: { col: 2, row: 2 }, aim: { col: 2, row: 3 }, lengthFeet: 10 }, { center: { col: 4, row: 4 }, aim: { col: 4, row: 5 }, lengthFeet: 10 }] },
])('authorizes a spoken password across only the matching Grove cast: $kind', async extra => {
  const input = { ...withTree(), extra, secretPhrase: 'Moon Rises' }
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [prepared.preparedMap] }))).maps[0]
  const character = normalizeCharacter({ id: 'owner', name: 'Caster', currentHp: 20, maxHp: 20 } as never)
  const original = JSON.stringify(map)
  const request = { map, characters: [character], actorTokenId: 'caster', areaId: map.dnd5ePluginAreas![0].id,
    spokenPassword: ' moon   rises ', round: 1, worldMinute: 100 }
  const bound = createDnd5eConditionEffect({ condition: 'restrained', targetId: 'caster', source: { kind: 'spell' }, duration: { type: 'permanent' } })
  bound.areaLifetime = { mapId: map.id, areaId: map.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'undergrowth')!.id, sourceActorId: 'caster' }
  const unrelated = { ...bound, id: 'other-restraint', areaLifetime: { ...bound.areaLifetime, areaId: 'unrelated-area' } }
  const restrainedCharacter = { ...character, dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: [bound, unrelated] } }
  const released = prepareDnd5eGrovePassword({ ...request, characters: [restrainedCharacter] })
  if (!released.ok) throw Error(released.reason)
  expect(released.characters[0].dnd5eCombatState?.activeEffects).toEqual([unrelated])
  const unconscious = { ...character, currentHp: 0 }
  expect(prepareDnd5eGrovePassword({ ...request, characters: [unconscious] })).toMatchObject({ ok: false, reason: 'cannot-speak' })
  const success = prepareDnd5eGrovePassword(request)
  if (!success.ok) throw Error(success.reason)
  expect(success.map.dnd5ePluginAreas!.every(a => a.excludedTargetIds?.includes('caster'))).toBe(true)
  expect(success.map.dnd5ePluginAreas!.flatMap(a => a.triggers ?? []).every(t => t.excludedTokenIds?.includes('caster'))).toBe(true)
  expect(success.map.dnd5ePluginAreas!.filter(a => a.obscuration).every(a => a.obscurationExcludedTokenIds?.includes('caster'))).toBe(true)
  if (extra.kind === 'spike-growth') {
    const movement = { token: map.tokens.find(t => t.id === 'caster')!, to: { x: 75, y: 25 }, path: [{ x: 75, y: 25 }] }
    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-move-distance', round: 2, movement }).length).toBeGreaterThan(0)
    const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [success.map] }))).maps[0]
    expect(collectDnd5ePersistentAreaTriggers({ map: reloaded, timing: 'on-move-distance', round: 2, movement })).toEqual([])
  }
  expect(JSON.stringify(success)).not.toContain('Moon Rises')
  expect(JSON.stringify(map)).toBe(original)
  expect(prepareDnd5eGrovePassword({ ...request, spokenPassword: 'wrong' }).ok).toBe(false)
  expect(prepareDnd5eGrovePassword({ ...request, worldMinute: 1540 }).ok).toBe(false)
  expect(prepareDnd5eGrovePassword({ ...request, actorTokenId: 'oak' })).toMatchObject({ ok: false, reason: 'cannot-speak' })
  const again = prepareDnd5eGrovePassword({ ...request, map: success.map })
  if (!again.ok) throw Error(again.reason)
  expect(again.map).toEqual(success.map)
  const { projectMapsForPlayer } = await import('../../../scripts/shared-server-core.mjs')
  expect(JSON.stringify(projectMapsForPlayer({ maps: [map] }, { maps: [] }, 'owner'))).not.toContain('grovePasswordDigest')
  const absentCaster = { ...map, tokens: map.tokens.filter(t => t.id !== 'caster') }
  const publicMap = projectMapsForPlayer({ maps: [absentCaster] }, { maps: [] }, null).maps[0]
  const publicAreas = publicMap.dnd5ePluginAreas ?? []
  expect(publicAreas.map((a: { id: string }) => a.id)).toEqual(map.dnd5ePluginAreas!.filter(a => !a.hiddenFromPlayers).map(a => a.id))
  expect(publicAreas.every((a: { grovePasswordAvailable?: boolean; grovePasswordDigest?: string }) => a.grovePasswordAvailable === true && a.grovePasswordDigest == null)).toBe(true)
  const boundary = map.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'guardians')!
  const guardianOnly = { ...absentCaster, dnd5ePluginAreas: [boundary] }
  const publicGuardian = projectMapsForPlayer({ maps: [guardianOnly] }, { maps: [] }, null).maps[0]
  expect(publicGuardian.dnd5ePluginAreas).toEqual([])
  expect(publicGuardian.dnd5eGrovePasswordPrompts).toEqual([{ areaId: boundary.id, castId: boundary.effectGroup!.castId,
    pluginId: boundary.pluginId, sourceTokenId: boundary.sourceTokenId }])
  expect(JSON.stringify(publicGuardian)).not.toContain('grovePasswordDigest')
  const loaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [publicGuardian] }))).maps[0]
  const [{ createElement }, { renderToStaticMarkup }, { DruidGrovePasswordPanel }] = await Promise.all([
    import('react'), import('react-dom/server'), import('../../components/map/DruidGrovePasswordPanel')])
  expect(renderToStaticMarkup(createElement(DruidGrovePasswordPanel, { map: loaded, onSpeak: async () => {} }))).toContain('林地口令')
  // Cached/forged interaction references cannot survive authoritative removal.
  const removed = projectMapsForPlayer({ maps: [{ ...guardianOnly, dnd5ePluginAreas: [], dnd5eGrovePasswordPrompts: publicGuardian.dnd5eGrovePasswordPrompts }] }, { maps: [] }, null).maps[0]
  expect(removed.dnd5eGrovePasswordPrompts).toEqual([])
  expect(prepareDnd5eGrovePassword({ ...request, map: { ...map, dnd5ePluginAreas: [] }, areaId: boundary.id }).ok).toBe(false)
  const other = { ...map.dnd5ePluginAreas![0], id: 'other-cast', effectGroup: { castId: 'other', effectId: 'solid-fog' } }
  const multiple = prepareDnd5eGrovePassword({ ...request, map: { ...map, dnd5ePluginAreas: [...map.dnd5ePluginAreas!, other] } })
  if (!multiple.ok) throw Error(multiple.reason)
  expect(multiple.map.dnd5ePluginAreas!.find(a => a.id === 'other-cast')).toEqual(other)
})
function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [{ col: 0, row: 1 }], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: [] as string[] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] as string[] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}


const gusts = { kind: 'gusts', winds: [{ origin: { col: 2, row: 0 }, aim: { col: 2, row: 1 } },
  { origin: { col: 5, row: 0 }, aim: { col: 5, row: 1 } }] }
const walls = { kind: 'wind-walls', walls: [{ center: { col: 2, row: 2 }, aim: { col: 2, row: 3 }, lengthFeet: 20 },
  { center: { col: 4, row: 4 }, aim: { col: 4, row: 5 }, lengthFeet: 10 }] }

it.each([{ kind: 'none' }, { kind: 'spike-growth', center: { col: 2, row: 2 } }, gusts, walls])('prepares one exclusive extra with all base areas: $kind', extra => {
  const input = { ...fixture(), extra }, before = JSON.stringify(input)
  const result = prepareDnd5eDruidGroveAreaBundle(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.areas).toHaveLength(extra.kind === 'none' ? 2 : extra.kind === 'spike-growth' ? 3 : 4)
  expect(result.areas[0].effectGroup?.effectId).toBe('solid-fog')
  expect(result.areas[1].effectGroup?.effectId).toBe('undergrowth')
  expect(new Set(result.areas.map(a => a.id)).size).toBe(result.areas.length)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(result.areas.length)
  expect(prepareDnd5eDruidGroveAreaBundle({ ...input, map })).toEqual({ ok: false, reason: 'grove-cast-already-present' })
  expect(JSON.stringify(input)).toBe(before)
})

it.each([null, [], 'gusts', { kind: 'unknown' }, { kind: 'none', winds: [] },
  { ...gusts, walls: walls.walls }, { ...walls, center: { col: 2, row: 2 } },
  { kind: 'gusts', winds: [null, null] }, { kind: 'wind-walls', walls: [null, null] },
  { kind: 'spike-growth', center: { col: NaN, row: 1 } }])('rejects malformed or mixed extra choices without partial areas: %j', extra => {
  const input = { ...fixture(), extra }, before = JSON.stringify(input)
  expect(normalizeDnd5eDruidGroveExtraEffect(extra)).toBeUndefined()
  expect(prepareDnd5eDruidGroveAreaBundle(input)).toEqual({ ok: false, reason: 'invalid-extra-effect' })
  expect(JSON.stringify(input)).toBe(before)
})

it('rejects a geometrically invalid extra even when base regions are valid', () => {
  const input = { ...fixture(), extra: { kind: 'spike-growth', center: { col: 19, row: 19 } } }
  const result = prepareDnd5eDruidGroveAreaBundle(input)
  expect(result.ok).toBe(false)
  expect('areas' in result).toBe(false)
  expect(input.map.dnd5ePluginAreas).toBeUndefined()
})

it('copies accepted choices instead of retaining mutable imported payload references', () => {
  const input = structuredClone(gusts), normalized = normalizeDnd5eDruidGroveExtraEffect(input)
  input.winds[0].origin.col = 100
  expect(normalized?.kind === 'gusts' && normalized.winds[0].origin.col).toBe(2)
})

function withTree() {
  const input = { ...fixture(), extra: { kind: 'none' } }
  input.map.tokens.push({ id: 'oak', label: 'Oak', type: 'obstacle', x: 175, y: 175, size: 1,
    color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } })
  input.placement.guardianTreeIds = ['oak']
  input.qualifications.treeTokenIds = ['oak']
  return input
}

it('retains long-cast areas, groups, guardians and annual history after save/reload', () => {
  const input = withTree()
  const castId = dnd5eGroveCastIdentity('authority-request:'.repeat(20) + ':maintain:100', 'grove')
  input.source.castId = castId
  input.round = 100
  const result = prepareDnd5eDruidGroveAreaBundle(input)
  if (!result.ok) throw Error(result.reason)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.preparedMap] }))).maps[0]
  expect(saved.dnd5ePluginAreas).toHaveLength(3)
  expect(saved.dnd5ePluginAreas!.every(area => area.effectGroup?.castId === castId)).toBe(true)
  expect(saved.tokens.find(token => token.id === 'oak')?.dnd5eGroveGuardian?.castId).toBe(castId)
  expect(saved.dnd5eGroveAnnualCasting?.[0].lastCastId).toBe(castId)
})

it('prepares guardians and all regions together, survives reload and independently ends subeffects', () => {
  const input = withTree(), before = JSON.stringify(input)
  const result = prepareDnd5eDruidGroveAreaBundle(input)
  if (!result.ok) throw Error(result.reason)
  expect(result.guardianPlans).toHaveLength(1)
  expect(result.areas).toHaveLength(3)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.preparedMap] }))).maps[0]
  expect(map.tokens.find(t => t.id === 'oak')).toMatchObject({ type: 'enemy', hp: 59,
    dnd5eGroveGuardian: { castId: 'cast-1' } })
  const fog = map.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'solid-fog')!
  const withoutFog = removePersistentAreaByDm({ map, characters: [], areaId: fog.id })!.map
  expect(withoutFog.tokens.find(t => t.id === 'oak')?.type).toBe('enemy')
  const boundary = withoutFog.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'guardians')!
  const withoutGuardians = removePersistentAreaByDm({ map: withoutFog, characters: [], areaId: boundary.id })!.map
  expect(withoutGuardians.tokens.find(t => t.id === 'oak')?.type).toBe('obstacle')
  expect(withoutGuardians.dnd5ePluginAreas!.map(a => a.effectGroup?.effectId)).toEqual(['undergrowth'])
  const expired = expireDnd5ePluginAreasAtWorldMinute(map, 1540)
  expect(expired.dnd5ePluginAreas ?? []).toHaveLength(0)
  expect(expired.tokens.find(t => t.id === 'oak')?.type).toBe('obstacle')
  expect(JSON.stringify(input)).toBe(before)
})

it('returns no partial map or areas when the selected guardian cannot fit', () => {
  const input = withTree()
  input.map.tokens.find(t => t.id === 'oak')!.x = 275
  const before = JSON.stringify(input), result = prepareDnd5eDruidGroveAreaBundle(input)
  expect(result).toEqual({ ok: false, reason: 'guardian-position-blocked' })
  expect(JSON.stringify(input)).toBe(before)
})

it.each(['separate-moves', 'return-path'])('restricts actual guardian turns and attacks after entry and reload: %s', route => {
  const input = { ...withTree(), exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens.find(t => t.id === 'target')!, { x: 175, y: 75, hp: 20, maxHp: 20, poolId: 'srd-5.1:goblin' })
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  let map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [prepared.preparedMap] }))).maps[0]
  const guardian = map.tokens.find(t => t.id === 'oak')!
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets).toEqual([])
  expect(planDnd5eMonsterTurn(map, guardian, [])).toMatchObject({ attacked: false, moved: false, dodged: false })
  const move = (x: number, y: number, path?: { x: number; y: number }[]) => {
    const afterMap = { ...map, tokens: map.tokens.map(t => t.id === 'target' ? { ...t, x, y } : t) }
    map = reconcileDnd5ePluginAreasAfterSourceMove({ beforeMap: map, afterMap, characters: [], round: 1, sourceTokenId: 'target', path }).map
    map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0]
  }
  move(175, 25)
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets).toEqual([])
  if (route === 'separate-moves') move(375, 75)
  else move(175, 75, [{ x: 175, y: 25 }, { x: 375, y: 75 }, { x: 175, y: 75 }])
  expect(map.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'guardians')!.groveInitialOccupantIds).not.toContain('target')
  move(175, 75)
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets.map(t => t.id)).toEqual(['target'])
  const plan = planDnd5eMonsterTurn(map, guardian, [])
  expect(plan).toMatchObject({ attacked: true, targetTokenId: 'target' })
  const attack = (targetTokenId: string) => prepareDnd5eMonsterAttack({ combatId: 'grove-combat', map, characters: [],
    initiativeOrder: map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ tokenId: t.id, label: t.label, color: '', emoji: '', roll: 10 })),
    actorTokenId: guardian.id, targetTokenId, actionIndex: plan.actionIndex })
  expect(attack('target').ok).toBe(true)
  expect(attack('caster').ok).toBe(false)
  map.tokens.find(t => t.id === 'target')!.elevationFeet = 40
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets).toEqual([])
  map.tokens.find(t => t.id === 'target')!.elevationFeet = 0
  map.tokens.find(t => t.id === 'target')!.x = 375
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets).toEqual([])
  expect(attack('target').ok).toBe(false)
  expect(planDnd5eMonsterTurn(map, guardian, [])).toMatchObject({ moved: false, attacked: false, dodged: false })
  Object.assign(map.tokens.find(t => t.id === 'target')!, { x: 175, hp: 0 })
  expect(dnd5eSummonAutomaticTargets(map, guardian, [])?.targets).toEqual([])
  const unconscious = normalizeCharacter({ id: 'fallen', name: 'Fallen', currentHp: 0, maxHp: 20, deathSaveFailures: 0 })
  Object.assign(map.tokens.find(t => t.id === 'target')!, { type: 'player', characterId: 'fallen', poolId: undefined })
  expect(dnd5eSummonAutomaticTargets(map, guardian, [unconscious])?.targets.map(t => t.id)).toEqual(['target'])
  expect(planDnd5eMonsterTurn(map, guardian, [unconscious])).toMatchObject({ attacked: true, targetTokenId: 'target' })
  unconscious.deathSaveFailures = 3
  expect(dnd5eSummonAutomaticTargets(map, guardian, [unconscious])?.targets).toEqual([])
  map.dnd5ePluginAreas = []
  expect(attack('target').ok).toBe(false)
})

it('accepts free spoken orders from the caster inside, persists them and rejects invalid batches', () => {
  const input = { ...withTree(), exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens[0], { type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  Object.assign(input.map.tokens.find(t => t.id === 'target')!, { x: 175, y: 75, poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  const map = prepared.preparedMap, before = JSON.stringify(map)
  const issue = (current: BattleMap, command: Parameters<typeof prepareDnd5eGroveCommand>[0]['command'], guardianIds = ['oak']) =>
    prepareDnd5eGroveCommand({ map: current, characters: [], sourceTokenId: 'caster', guardianIds, round: 1, command })
  const ordered = issue(map, { kind: 'attack', targetId: 'target' })
  if (!ordered.ok) throw Error(ordered.reason)
  const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [ordered.map] }))).maps[0]
  const guardian = reloaded.tokens.find(t => t.id === 'oak')!
  expect(planDnd5eMonsterTurn(reloaded, guardian, [])).toMatchObject({ attacked: true, targetTokenId: 'target' })
  expect(reloaded.tokens.find(t => t.id === 'caster')).toEqual(migrateMapsState({ maps: [map] }).maps[0].tokens.find(t => t.id === 'caster'))
  const dodge = issue(reloaded, { kind: 'dodge' })
  if (!dodge.ok) throw Error(dodge.reason)
  expect(planDnd5eMonsterTurn(dodge.map, dodge.map.tokens.find(t => t.id === 'oak')!, [])).toMatchObject({ attacked: false, dodged: true })
  const resume = issue(dodge.map, { kind: 'resume-guarding' })
  if (!resume.ok) throw Error(resume.reason)
  expect(planDnd5eMonsterTurn(resume.map, resume.map.tokens.find(t => t.id === 'oak')!, [])).toMatchObject({ attacked: false, dodged: false })
  expect(issue(map, { kind: 'attack', targetId: 'caster' }).ok).toBe(false)
  expect(issue(map, { kind: 'dodge' }, ['oak', 'missing']).ok).toBe(false)
  const foreign = { ...map, tokens: map.tokens.map(t => t.id === 'oak'
    ? { ...t, dnd5eGroveGuardian: { ...t.dnd5eGroveGuardian!, sourceTokenId: 'someone-else' } } : t) }
  expect(issue(foreign, { kind: 'dodge' }).ok).toBe(false)
  const outside = { ...map, tokens: map.tokens.map(t => t.id === 'caster' ? { ...t, x: 500 } : t) }
  expect(issue(outside, { kind: 'dodge' }).ok).toBe(false)
  const mute = { ...map, tokens: map.tokens.map(t => t.id === 'caster' ? { ...t, dnd5eCombatState: { activeEffects: [
    createDnd5eMechanicalEffect({ id: 'mute', definitionId: 'mute', label: 'Mute', targetId: t.id, source: { kind: 'spell' },
      duration: { type: 'permanent' }, modifiers: { actionRestriction: { prohibited: ['speech'] } } }),
  ] } } : t) }
  expect(issue(mute, { kind: 'dodge' }).ok).toBe(false)
  const deaf = { ...map, tokens: map.tokens.map(t => t.id === 'oak' ? { ...t,
    dnd5eCombatState: { ...t.dnd5eCombatState, activeEffects: [...(t.dnd5eCombatState?.activeEffects ?? []),
      createDnd5eConditionEffect({ condition: 'deafened', targetId: t.id, source: { kind: 'spell' }, duration: { type: 'permanent' } }),
    ] } } : t) }
  expect(issue(deaf, { kind: 'dodge' })).toEqual({ ok: false, reason: 'cannot-hear' })
  const assisting = issue(map, { kind: 'help', targetId: 'target', helpKind: 'ability-check' })
  if (!assisting.ok) throw Error(assisting.reason)
  const assistancePlan = planDnd5eMonsterTurn(assisting.map, assisting.map.tokens.find(t => t.id === 'oak')!, [])
  expect(assistancePlan).toMatchObject({ attacked: false, help: { targetTokenId: 'target', helpKind: 'ability-check' } })
  const initiativeOrder = map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ tokenId: t.id, label: t.label, color: '', emoji: '', roll: 10 }))
  const help = resolveDnd5eMonsterHelp({ combatId: 'grove-help', map: assisting.map, characters: [], initiativeOrder,
    actorTokenId: 'oak', targetTokenId: 'target', helpKind: 'ability-check' })
  expect(help.ok && help.result.ok).toBe(true)
  if (help.ok) expect(help.result.state.combatants.oak.turn.actionAvailable).toBe(false)
  const hiddenMap = { ...map, tokens: map.tokens.map(t => t.id === 'oak' ? { ...t,
    dnd5eCombatState: { ...t.dnd5eCombatState, activeEffects: [...(t.dnd5eCombatState?.activeEffects ?? []),
      createDnd5eConditionEffect({ condition: 'invisible', targetId: t.id, source: { kind: 'spell' }, duration: { type: 'permanent' } }),
    ] } } : t) }
  const hiding = issue(hiddenMap, { kind: 'hide' })
  if (!hiding.ok) throw Error(hiding.reason)
  expect(planDnd5eMonsterTurn(hiding.map, hiding.map.tokens.find(t => t.id === 'oak')!, []).commandedHide).toBe(true)
  const hide = prepareDnd5eCompanionHide({ combatId: 'grove-hide', map: hiding.map, characters: [], initiativeOrder, actorTokenId: 'oak' })
  expect(hide).toBeDefined()
  const hidden = resolvePreparedDnd5ePlayerBasicAction({ prepared: hide!, actorD20: 15, actorD20Second: 15 })
  expect(hidden.result.ok).toBe(true)
  expect(hidden.result.state.combatants.oak.turn.actionAvailable).toBe(false)
  const ready = issue(map, { kind: 'ready', ready: { trigger: 'When the target moves', actionKind: 'attack' }, targetId: 'target' })
  if (!ready.ok) throw Error(ready.reason)
  const savedReady = migrateMapsState(JSON.parse(JSON.stringify({ maps: [ready.map] }))).maps[0]
  expect(planDnd5eMonsterTurn(savedReady, savedReady.tokens.find(t => t.id === 'oak')!, []).commandedReady).toBe(true)
  const armed = resolveDnd5eCompanionReadyAction({ combatId: 'grove-ready', map: savedReady, characters: [], initiativeOrder, actorTokenId: 'oak' })
  expect(armed?.result.ok).toBe(true)
  expect(armed?.result.state.combatants.oak.turn.actionAvailable).toBe(false)
  expect(armed?.result.state.combatants.oak.turn.reactionAvailable).toBe(true)
  expect(armed?.result.state.combatants.oak.classState.readiedAction).toMatchObject({ actionKind: 'attack', targetId: 'target' })
  if (!armed?.application) throw Error('Ready did not produce an application')
  const armedMap = migrateMapsState(JSON.parse(JSON.stringify({ maps: [armed.application.map] }))).maps[0]
  const reaction = (current: BattleMap) => prepareDnd5eMonsterAttack({ combatId: 'grove-ready', map: current,
    characters: [], initiativeOrder, actorTokenId: 'oak', targetTokenId: 'target', readiedAttack: true, currentInitiativeIndex: 1 })
  const reacting = reaction(armedMap)
  if (!reacting.ok) throw Error(reacting.reason)
  const reacted = resolvePreparedDnd5eMonsterAttack({ prepared: reacting.prepared,
    rolls: reacting.prepared.attacks.map(() => ({ d20: 1, d20Second: 1, damageRolls: [] })) })
  expect(reacted.result.ok).toBe(true)
  expect(reacted.result.state.combatants.oak.turn.reactionAvailable).toBe(false)
  expect(reacted.result.state.combatants.oak.classState.readiedAction).toBeUndefined()
  expect(reaction({ ...armedMap, tokens: armedMap.tokens.map(t => t.id === 'target' ? { ...t, x: 375 } : t) }).ok).toBe(false)
  expect(reaction({ ...armedMap, dnd5ePluginAreas: armedMap.dnd5ePluginAreas!.map(a => a.effectGroup?.effectId === 'guardians'
    ? { ...a, excludedTargetIds: [...(a.excludedTargetIds ?? []), 'target'] } : a) }).ok).toBe(false)
  const quiet = { ...map, dnd5ePluginAreas: [...map.dnd5ePluginAreas!, {
    ...map.dnd5ePluginAreas![0], id: 'quiet', cells: [{ col: 3, row: 3 }], excludedTargetIds: [],
    occupantModifiers: { preventsVerbalComponents: true },
  }] }
  expect(issue(quiet, { kind: 'dodge' })).toEqual({ ok: false, reason: 'cannot-hear' })
  for (const kind of ['dodge', 'dash', 'disengage'] as const) {
    const moving = issue(map, { kind, movementDestination: { mapId: map.id, x: 225, y: 175 } })
    if (!moving.ok) throw Error(moving.reason)
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [moving.map] }))).maps[0]
    const plan = planDnd5eMonsterTurn(saved, saved.tokens.find(t => t.id === 'oak')!, [])
    expect(plan).toMatchObject({ moved: true, newPosition: { x: 225, y: 175 }, attacked: false })
    if (kind === 'dodge') expect(plan.dodged).toBe(true)
    if (kind === 'dash') expect(plan.dashed).toBe(true)
    if (kind === 'disengage') expect(plan.disengaged).toBe(true)
  }
  const limited = issue(map, { kind: 'dodge', movementDestination: { mapId: map.id, x: 75, y: 175 } })
  if (!limited.ok) throw Error(limited.reason)
  const economy = createDnd5eTurnEconomyCounts('grove-turn', 20)
  economy.movement.current = 5
  expect(planDnd5eMonsterTurn(limited.map, limited.map.tokens.find(t => t.id === 'oak')!, [], { turnEconomy: economy }))
    .toMatchObject({ moved: true, newPosition: { x: 125, y: 175 }, attacked: false, dodged: true })
  for (const destination of [{ mapId: map.id, x: 275, y: 175 }, { mapId: 'other-map', x: 225, y: 175 }]) {
    expect(issue(map, { kind: 'dash', movementDestination: destination }).ok).toBe(false)
  }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.doors.push({ id: 'gate', kind: 'door', label: 'Gate', secret: false, state: 'closed', openState: 'closed', lockState: 'unlocked',
    points: [{ x: 250, y: 150 }, { x: 250, y: 200 }], blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const object = issue(map, { kind: 'use-object', objectInteraction: { mapId: map.id, doorId: 'gate', operation: 'open' } })
  if (!object.ok) throw Error(object.reason)
  const savedObject = migrateMapsState(JSON.parse(JSON.stringify({ maps: [object.map] }))).maps[0]
  expect(planDnd5eMonsterTurn(savedObject, savedObject.tokens.find(t => t.id === 'oak')!, []).commandedObjectInteraction).toBe('open:gate')
  const opened = resolveDnd5eCompanionObjectAction({ combatId: 'grove-object', map: savedObject, characters: [], initiativeOrder, actorTokenId: 'oak' })
  expect(opened?.result.ok).toBe(true)
  expect(opened?.door?.openState).toBe('open')
  expect(opened?.result.state.combatants.oak.turn.objectInteractionAvailable).toBe(false)
  expect(issue(map, { kind: 'use-object', objectInteraction: { mapId: map.id, doorId: 'missing', operation: 'open' } }).ok).toBe(false)
  expect(JSON.stringify(map)).toBe(before)
})

it.each(['use-object', 'ready'] as const)('picks up physical items through %s and drops them once when animation ends', kind => {
  const input = { ...withTree(), exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens[0], { type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  const map = prepared.preparedMap
  map.tokens.push({ id: 'flask', label: 'Water', type: 'obstacle', x: 275, y: 175, size: 1, color: '', emoji: '',
    dnd5eObjectState: { schemaVersion: 1, inventoryItem: { templateId: 'srd-5.1:item:holy-water-flask', quantity: 1, receiptId: 'grove:flask' } } })
  const objectInteraction = { mapId: map.id, operation: 'pickup-item' as const, objectTokenId: 'flask', expectedReceiptId: 'grove:flask', expectedQuantity: 1 }
  const command = kind === 'ready' ? { kind, objectInteraction, ready: { trigger: 'On the signal', actionKind: 'interact-object' as const } } : { kind, objectInteraction }
  const ordered = prepareDnd5eGroveCommand({ map, characters: [], sourceTokenId: 'caster', guardianIds: ['oak'], round: 1, command })
  if (!ordered.ok) throw Error(ordered.reason)
  const action = { combatId: 'grove-pickup', map: ordered.map, characters: [], actorTokenId: 'oak',
    initiativeOrder: map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 })) }
  const armed = kind === 'ready' ? resolveDnd5eCompanionReadyAction(action) : undefined
  if (kind === 'ready' && !armed?.application) throw Error('Failed to arm pickup')
  const actualMap = migrateMapsState(JSON.parse(JSON.stringify({ maps: [armed?.application?.map ?? ordered.map] }))).maps[0]
  const picked = kind === 'ready'
    ? resolveDnd5eReadiedObjectAction({ ...action, map: actualMap, currentInitiativeIndex: 0 })
    : resolveDnd5eCompanionObjectAction({ ...action, map: actualMap })
  expect(picked?.result.ok).toBe(true)
  if (!picked?.application) throw Error('Missing pickup application')
  expect(picked.application.map.tokens.some(t => t.id === 'flask')).toBe(false)
  expect(picked.application.map.tokens.find(t => t.id === 'oak')?.dnd5eCarriedObjects).toHaveLength(1)
  expect(kind === 'ready' ? picked.result.state.combatants.oak.turn.reactionAvailable
    : picked.result.state.combatants.oak.turn.objectInteractionAvailable).toBe(false)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [picked.application.map] }))).maps[0]
  for (const hp of [0, 20]) {
    const finalMap = { ...saved, tokens: saved.tokens.map(t => t.id === 'oak' ? { ...t, hp, x: 225, y: 175 } : t) }
    const ended = expireDnd5ePluginAreasAtWorldMinute(finalMap, 1540)
    const tree = ended.tokens.find(t => t.id === 'oak')!
    expect(tree.type).toBe('obstacle')
    expect(tree.dnd5eCarriedObjects).toBeUndefined()
    const items = ended.tokens.filter(t => t.dnd5eObjectState?.inventoryItem)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ x: 225, y: 175, dnd5eObjectState: { wornOrCarried: false,
      inventoryItem: { templateId: 'srd-5.1:item:holy-water-flask', quantity: 1 } } })
    const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [ended] }))).maps[0]
    expect(expireDnd5ePluginAreasAtWorldMinute(reloaded, 1541).tokens.filter(t => t.dnd5eObjectState?.inventoryItem)).toHaveLength(1)
  }
})

it('executes a saved Ready movement with reaction while preserving ordinary movement and grove boundaries', () => {
  const input = { ...withTree(), exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens[0], { type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  const command = prepareDnd5eGroveCommand({ map: prepared.preparedMap, characters: [], sourceTokenId: 'caster', guardianIds: ['oak'],
    round: 1, command: { kind: 'ready', ready: { trigger: 'When the signal is given', actionKind: 'move' } } })
  if (!command.ok) throw Error(command.reason)
  const action = { combatId: 'grove-ready-move', map: command.map, characters: [], actorTokenId: 'oak', round: 1,
    initiativeOrder: command.map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 })) }
  const declared = resolveDnd5eCompanionReadyAction(action)
  if (!declared?.application) throw Error('Failed to declare Ready movement')
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [declared.application.map] }))).maps[0]
  const before = JSON.stringify(map)
  const economy = createDnd5eTurnEconomyCounts('ready-movement', 20)
  economy.action.current = 0
  economy.movement.current = 0
  const move = (to: { x: number; y: number }, current = map) => resolveDnd5eMonsterMapMove({ ...action, map: current,
    turnEconomy: economy, readiedMovement: { currentInitiativeIndex: 0 }, to })
  for (const to of [{ x: 375, y: 175 }, { x: 275, y: 175 }]) {
    const denied = move(to)
    expect(denied.ok && denied.result.ok).toBe(false)
  }
  const moved = move({ x: 75, y: 175 })
  expect(moved.ok && moved.result.ok).toBe(true)
  if (!moved.ok || !moved.application) throw Error('No movement application')
  expect(moved.application.map.tokens.find(t => t.id === 'oak')).toMatchObject({ x: 75, y: 175 })
  expect(moved.result.state.combatants.oak.turn).toMatchObject({ actionAvailable: false, reactionAvailable: false, movementRemaining: 0 })
  expect(moved.result.state.combatants.oak.classState.readiedAction).toBeUndefined()
  const replay = move({ x: 125, y: 175 }, moved.application.map)
  expect(replay.ok && replay.result.ok).toBe(false)
  expect(JSON.stringify(map)).toBe(before)
})


it('commands a prepared guardian through an exported and reimported generic Activity, enforcing live authority', async () => {
  const { exportDnd5eStarMod, readDnd5eStarMod } = await import('./starModAdapter')
  const { dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const { registerDnd5eRulesPlugin } = await import('./pluginApi')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { createDnd5eMapCombatSnapshot } = await import('./mapBridge')
  const { resolveRegisteredDnd5eActivityInCombatV1 } = await import('./activities/dnd5eActivityCombatAuthority')
  const automation = automationCapabilityFromLegacyStatus('full')
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod({
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: 'test.grove', name: 'Synthetic grove commands', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace: 'test.grove', version: '1.0.0', kind: 'feature', id: 'order', name: 'Order', automation,
      payload: { id: 'order', name: 'Order', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'order', name: 'Order', activation: { kind: 'free' },
        target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 120 }, automation,
        requirements: [{ kind: 'owned-companion', subject: 'target' }], legacySource: { kind: 'feature', id: 'order' },
        outcomes: [{ id: 'obey', when: { kind: 'always' }, operations: [{ id: 'obey', kind: 'command-owned-companion', target: 'target', command: 'dodge',
          sourceActivityId: 'test.grove:grove', requiresSpeech: false }] }] }],
    }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const input = withTree()
    input.map.tokens[0] = { ...input.map.tokens[0], type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 }
    const prepared = prepareDnd5eDruidGroveAreaBundle(input)
    if (!prepared.ok) throw Error(prepared.reason)
    const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [prepared.preparedMap] }))).maps[0]
    const { state } = createDnd5eMapCombatSnapshot({ combatId: 'generic-grove', map, characters: [], round: 1,
      initiativeOrder: map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 })) })
    state.combatants.caster.pluginFeatureIds = ['test.grove:order']
    const run = (current = state) => resolveRegisteredDnd5eActivityInCombatV1({ state: current, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'order-1', actorId: 'caster', packageId: 'test.grove', packageVersion: '1.0.0', activityId: 'order', targetIds: ['oak'], expectedRevision: 1 } })
    const { projectMapsForPlayer } = await import('../../../scripts/shared-server-core.mjs')
    const { dnd5eCompanionControlBinding } = await import('./companionControlBinding')
    const projectionMap = structuredClone(map)
    projectionMap.tokens.find(t => t.id === 'caster')!.type = 'player'
    const publicMaps = projectMapsForPlayer({ maps: [projectionMap] }, { maps: [] }, 'owner')
    const playerMap = migrateMapsState(JSON.parse(JSON.stringify(publicMaps))).maps[0]
    const playerGuardian = playerMap.tokens.find(t => t.id === 'oak')!
    expect(playerGuardian.dnd5eGroveGuardian).toBeUndefined()
    expect(playerGuardian.dnd5eGroveControl).toEqual({ schemaVersion: 1, castId: 'cast-1', boundaryAreaId: 'cast-1:guardian-boundary', sourceTokenId: 'caster' })
    expect(JSON.stringify(playerGuardian)).not.toContain('originalTree')
    expect(dnd5eCompanionControlBinding(playerMap, playerGuardian)).toBeUndefined()
    expect(dnd5eCompanionControlBinding(playerMap, playerGuardian, true)?.sourceTokenId).toBe('caster')
    const playerState = createDnd5eMapCombatSnapshot({ combatId: 'public-grove', map: playerMap, characters: [normalizeCharacter({ id: 'owner', name: 'Owner', currentHp: 20, maxHp: 20 })], round: 1,
      initiativeOrder: playerMap.tokens.map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 })) }).state
    expect(playerState.combatants.oak.summonedSourceCombatantId).toBe('caster')
    playerState.combatants.caster.pluginFeatureIds = ['test.grove:order']
    expect(run(playerState).result.ok).toBe(false) // Public selection data cannot commit Host commands.
    const stale = structuredClone(projectionMap)
    stale.dnd5ePluginAreas = []
    stale.tokens.find(t => t.id === 'oak')!.dnd5eGroveControl = playerGuardian.dnd5eGroveControl
    const stalePublic = projectMapsForPlayer({ maps: [stale] }, { maps: [] }, 'owner')
    expect(stalePublic.maps[0].tokens.find((t: Token) => t.id === 'oak')!.dnd5eGroveControl).toBeUndefined()
    const before = structuredClone(state)
    const success = run()
    expect(success.result.ok, JSON.stringify(success)).toBe(true)
    if (success.phase !== 'commit' || !success.result.ok) throw Error('Guardian command did not commit')
    expect(success.result.state.combatants.oak.classState.companionCommand).toMatchObject({ command: 'dodge', persistentOrder: true, sourceOwnerId: 'caster' })
    expect(success.result.state.combatants.caster.turn).toEqual(state.combatants.caster.turn)
    expect(state).toEqual(before)
    for (const patch of [
      (s: typeof state) => { s.combatants.caster.position = { x: 800, y: 800 } },
      (s: typeof state) => { s.combatants.caster.soundSuppressed = true },
      (s: typeof state) => { s.combatants.oak.conditions = [...s.combatants.oak.conditions, 'deafened'] },
      (s: typeof state) => { s.combatants.oak.summonedSourcePackageId = 'other' },
      (s: typeof state) => { s.companionScene!.map.dnd5ePluginAreas = [] },
    ]) {
      const invalid = structuredClone(state); patch(invalid)
      const original = structuredClone(invalid)
      expect(run(invalid).result.ok).toBe(false)
      expect(invalid).toEqual(original)
    }
  } finally { dispose() }
})


it('applies grove subareas and guardian replacements as one generic map handoff, rejecting bad selections atomically', async () => {
  const { applyDnd5eActivityMapHandoffsV1 } = await import('./activities/dnd5eActivityMapInteraction')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const input = withTree()
  setMapGeometryRuntime([input.geometry])
  const selection = { placement: input.placement, baseElevationFeet: 0, extra: { kind: 'none' }, exemptTokenIds: ['caster'] }
  const handoff: Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0] = {
    map: input.map, packageId: 'test.grove', actionId: 'cast-grove', actorId: 'caster', round: 1,
    worldMinute: 100, castLevel: 6, sourceSaveDc: 17, groveSelection: selection, groveQualifications: input.qualifications,
    activity: { schemaVersion: 1, id: 'grove', name: 'Grove', activation: { kind: 'action' },
      automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'spell', id: 'grove' },
      target: { kind: 'area', origin: 'point', shape: 'cube', relation: 'any', widthFeet: 30, lengthFeet: 30, heightFeet: 30, placeRangeFeet: 5 },
      outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'grove', kind: 'create-persistent-area',
        label: 'Grove', durationRounds: 14400, concentration: false, utilityProjectionId: 'druid-grove' }] }] },
    areaSelection: { anchorCell: { col: 0, row: 0 }, cells: Array.from({ length: 36 }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6) })),
      targetIds: [], areaPlacementDistanceFeet: 0, areaPlacement: { x: 25, y: 25, elevationFeet: 0, widthFeet: 30, lengthFeet: 30, heightFeet: 30 } },
    selection: {}, handoffs: { summons: [], movements: [], invocations: [], persistentAreas: [{ kind: 'create-persistent-area', operationId: 'grove',
      label: 'Grove', durationRounds: 14400, concentration: false, utilityProjectionId: 'druid-grove' }] },
  }
  const before = structuredClone(input.map)
  const result = applyDnd5eActivityMapHandoffsV1(handoff)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.map.dnd5ePluginAreas).toHaveLength(3)
  expect(result.createdAreaIds).toEqual(result.map.dnd5ePluginAreas!.map(area => area.id))
  const { collectDnd5ePersistentAreaTriggers } = await import('./pluginAreas')
  const creationCandidates = result.createdAreaIds.flatMap(areaId => collectDnd5ePersistentAreaTriggers({
    map: result.map, areaId, timing: 'on-create', round: 1, targetTokenId: 'target' }))
  expect(creationCandidates).toHaveLength(1)
  expect(creationCandidates[0].trigger.savingThrow).toMatchObject({ ability: 'str', dc: 17 })
  expect(collectDnd5ePersistentAreaTriggers({ map: result.map, areaId: 'activity-area:cast-grove:grove',
    timing: 'on-create', round: 1, targetTokenId: 'target' })).toHaveLength(0) // Previous base-ID lookup missed it.
  expect(result.changedTokenIds).toContain('oak')
  expect(result.map.tokens.find(t => t.id === 'oak')?.dnd5eGroveGuardian).toMatchObject({ castId: 'activity-area:cast-grove:grove' })
  expect(result.map.dnd5ePluginAreas?.every(a => a.expiresAtWorldMinute === 1540)).toBe(true)
  expect(input.map).toEqual(before)
  for (const bad of [null, { ...selection, source: input.source }, { ...selection, extra: { kind: 'invalid' } },
    { ...selection, placement: { ...selection.placement, origin: { col: 1, row: 0 } } },
    { ...selection, placement: { ...selection.placement, undergrowthCells: selection.placement.fogCells } },
    { ...selection, placement: { ...selection.placement, guardianTreeIds: ['missing'] } },
    { ...selection, exemptTokenIds: ['missing'] }]) {
    expect(applyDnd5eActivityMapHandoffsV1({ ...handoff, groveSelection: bad }).ok).toBe(false)
    expect(input.map).toEqual(before)
  }
  const noCreation = applyDnd5eActivityMapHandoffsV1({ ...handoff, map: result.map,
    handoffs: { summons: [], movements: [], invocations: [], persistentAreas: [] } })
  expect(noCreation.ok && noCreation.createdAreaIds).toEqual([])
  expect(result.initiativeEntries).toEqual([])
  for (const rolls of [undefined, [], [0], [21], [1.5], [10, 11]]) {
    expect(applyDnd5eActivityMapHandoffsV1({ ...handoff, combatId: 'combat', groveInitiativeD20s: rolls }).ok).toBe(false)
    expect(input.map).toEqual(before)
  }
  const combatCreation = applyDnd5eActivityMapHandoffsV1({ ...handoff, combatId: 'combat', groveInitiativeD20s: [12] })
  expect(combatCreation.ok).toBe(true)
  if (!combatCreation.ok) throw Error(combatCreation.reason)
  expect(combatCreation.initiativeEntries).toMatchObject([{ tokenId: 'oak', slotId: 'oak:normal', roll: 10,
    initiativeCalculation: { rolls: [12], d20: 12, modifier: -2, mode: 'normal' } }])
  expect(applyDnd5eActivityMapHandoffsV1({ ...handoff, groveQualifications: undefined }).ok).toBe(false)
  expect(applyDnd5eActivityMapHandoffsV1({ ...handoff, map: result.map }).ok).toBe(false)
})


it('commits annual history with the area bundle, persists it, and makes the 365th cast dispellable but permanent', async () => {
  const input = fixture()
  let map = input.map
  for (let day = 0; day < 365; day++) {
    const prepared = prepareDnd5eDruidGroveAreaBundle({ ...input, map, extra: { kind: 'none' },
      source: { ...input.source, castId: `annual-${day}` }, worldMinute: day * 1440 + 100 })
    if (!prepared.ok) throw Error(prepared.reason)
    expect(prepared.areas.every(area => area.permanent === true)).toBe(day === 364)
    if (day < 364) {
      // Prior day's area expires; its cast history must remain through expiry and reload.
      const { expireDnd5ePluginAreasAtWorldMinute } = await import('./pluginAreas')
      map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [expireDnd5ePluginAreasAtWorldMinute(prepared.preparedMap, (day + 1) * 1440 + 100)] }))).maps[0]
      expect(map.dnd5ePluginAreas).toEqual([])
    } else map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [prepared.preparedMap] }))).maps[0]
  }
  const { expireDnd5ePluginAreasAtWorldMinute, reconcileDnd5ePluginAreas } = await import('./pluginAreas')
  expect(map.dnd5ePluginAreas).toHaveLength(2)
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 9999999).dnd5ePluginAreas).toHaveLength(2)
  expect(reconcileDnd5ePluginAreas(map.dnd5ePluginAreas, [], 9999999, map.tokens)).toHaveLength(2)
  expect(map.dnd5eGroveAnnualCasting).toHaveLength(1)
  expect(map.dnd5ePluginAreas!.every(area => area.permanent && area.expiresAtWorldMinute == null)).toBe(true)
  const { projectMapsForPlayer } = await import('../../../scripts/shared-server-core.mjs')
  expect(projectMapsForPlayer({ maps: [map] }, { maps: [] }, null).maps[0].dnd5eGroveAnnualCasting).toBeUndefined()
  const removed = removePersistentAreaByDm({ map, characters: [], areaId: map.dnd5ePluginAreas![0].id })
  expect(removed?.map.dnd5ePluginAreas).toHaveLength(1)
  expect(removed?.map.dnd5eGroveAnnualCasting).toEqual(map.dnd5eGroveAnnualCasting)
})


it.each([{ kind: 'none' }, { kind: 'spike-growth', center: { col: 2, row: 2 } }, gusts, walls])('keeps permanent guardians and $kind active beyond the original duration', async extra => {
  const input = { ...withTree(), extra, exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens[0], { type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  const first = prepareDnd5eDruidGroveAreaBundle(input)
  if (!first.ok) throw Error(first.reason)
  const { prepareDnd5eGroveAnnualCast } = await import('./druidGroveAnnualCasting')
  let history = first.preparedMap.dnd5eGroveAnnualCasting
  for (let day = 1; day < 364; day++) {
    const cast = prepareDnd5eGroveAnnualCast({ history, source: { ...input.source, castId: `daily-${day}` },
      volume: first.areas[0].groveVolume!, worldMinute: day * 1440 + 100 })
    if (!cast.ok) throw Error(cast.reason)
    history = cast.history
  }
  const last = prepareDnd5eDruidGroveAreaBundle({ ...input, map: { ...input.map, dnd5eGroveAnnualCasting: history },
    source: { ...input.source, castId: 'permanent' }, worldMinute: 364 * 1440 + 100 })
  if (!last.ok) throw Error(last.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [expireDnd5ePluginAreasAtWorldMinute(last.preparedMap, 9999999)] }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(extra.kind === 'none' ? 3 : extra.kind === 'spike-growth' ? 4 : 5)
  expect(map.dnd5ePluginAreas!.every(a => a.permanent === true)).toBe(true)
  expect(map.tokens.find(t => t.id === 'oak')!.type).toBe('enemy')
  const order = (command: Parameters<typeof prepareDnd5eGroveCommand>[0]['command']) => prepareDnd5eGroveCommand({ map,
    characters: [], sourceTokenId: 'caster', guardianIds: ['oak'], round: 9999999, command })
  const dodge = order({ kind: 'dodge' })
  if (!dodge.ok) throw Error(dodge.reason)
  expect(planDnd5eMonsterTurn(dodge.map, dodge.map.tokens.find(t => t.id === 'oak')!, [])).toMatchObject({ attacked: false, dodged: true })
  expect(order({ kind: 'dash', movementDestination: { mapId: map.id, x: 525, y: 525 } }).ok).toBe(false)
  const additional = map.dnd5ePluginAreas!.filter(a => a.effectGroup?.effectId.startsWith('additional-'))
  if (extra.kind === 'gusts' || extra.kind === 'spike-growth') {
    const area = additional[0], from = cellToPixel(area.cells[0], map), to = cellToPixel(area.cells[1], map)
    const target = { ...map.tokens.find(t => t.id === 'target')!, ...from }
    const current = { ...map, tokens: map.tokens.map(t => t.id === target.id ? target : t) }
    const candidates = collectDnd5ePersistentAreaTriggers({ map: current, areaId: area.id, round: 9999999,
      timing: extra.kind === 'gusts' ? 'turn-start' : 'on-move-distance', targetTokenId: target.id,
      turnKey: 'permanent-turn', movement: extra.kind === 'spike-growth' ? { token: target, to, path: [to] } : undefined })
    expect(candidates.length).toBeGreaterThan(0)
  }
  if (extra.kind === 'wind-walls') expect(additional.every(a => a.windBarrier)).toBe(true)
  if (additional.length) {
    const ended = removePersistentAreaByDm({ map, characters: [], areaId: additional[0].id })!.map
    expect(ended.dnd5ePluginAreas!.some(a => a.effectGroup?.effectId.startsWith('additional-'))).toBe(false)
    expect(ended.tokens.find(t => t.id === 'oak')!.type).toBe('enemy')
  }
  const boundary = map.dnd5ePluginAreas!.find(a => a.effectGroup?.effectId === 'guardians')!
  const ended = removePersistentAreaByDm({ map, characters: [], areaId: boundary.id })!.map
  expect(ended.tokens.find(t => t.id === 'oak')!.type).toBe('obstacle')
  expect(ended.dnd5ePluginAreas!.some(a => a.effectGroup?.effectId === 'solid-fog')).toBe(true)
})

it.each(['valid', 'removed-boundary', 'wrong-cast', 'wrong-owner', 'executed', 'player-hint'] as const)('automatic order entry validates the living grove binding: %s', variant => {
  const input = { ...withTree(), exemptTokenIds: ['caster'] }
  Object.assign(input.map.tokens[0], { type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20 })
  const prepared = prepareDnd5eDruidGroveAreaBundle(input)
  if (!prepared.ok) throw Error(prepared.reason)
  const command = prepareDnd5eGroveCommand({ map: prepared.preparedMap, characters: [], sourceTokenId: 'caster', guardianIds: ['oak'],
    round: 1, command: { kind: 'ready', ready: { trigger: 'Two bell rings', actionKind: 'move' } } })
  if (!command.ok) throw Error(command.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [command.map] }))).maps[0]
  const token = map.tokens.find(t => t.id === 'oak')!
  const key = 'grove:1:oak'
  if (variant === 'removed-boundary') map.dnd5ePluginAreas = []
  if (variant === 'wrong-cast') token.dnd5eGroveGuardian!.castId = 'forged'
  if (variant === 'wrong-owner') token.dnd5eCombatState!.companionCommand!.sourceOwnerId = 'forged'
  if (variant === 'executed') token.dnd5eCombatState!.companionCommand!.executedTurnKey = key
  if (variant === 'player-hint') {
    token.dnd5eGroveControl = { ...token.dnd5eGroveGuardian! }
    delete token.dnd5eGroveGuardian
  }
  const order = dnd5eExecutableCompanionOrder(token, key, map)
  if (variant === 'valid') expect(order?.ready).toEqual({ trigger: 'Two bell rings', actionKind: 'move' })
  else expect(order).toBeUndefined()
})

it.each(['attack','ability-check'] as const)('player-owned grove guardian can perform Help: %s', helpKind => {
  const input={...withTree(),exemptTokenIds:['caster']}
  const prepared=prepareDnd5eDruidGroveAreaBundle(input)
  if(!prepared.ok)throw Error(prepared.reason)
  const map=prepared.preparedMap
  map.tokens.push({id:'intruder',label:'Intruder',type:'enemy',poolId:'srd-5.1:goblin',x:275,y:175,size:1,hp:20,maxHp:20,color:'',emoji:''})
  const characters=[normalizeCharacter({id:'owner',name:'Caster',rulesetId:'dnd5e-2014-srd-5.1',currentHp:20,maxHp:20} as never)]
  const targetId=helpKind==='attack'?'intruder':'caster'
  const ordered=prepareDnd5eGroveCommand({map,characters,sourceTokenId:'caster',guardianIds:['oak'],round:1,command:{kind:'help',targetId,helpKind}})
  if(!ordered.ok)throw Error(ordered.reason)
  const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[ordered.map]}))).maps[0]
  const result=resolveDnd5eMonsterHelp({map:saved,characters,combatId:'grove-help-player',round:1,actorTokenId:'oak',targetTokenId:targetId,helpKind,
    initiativeOrder:saved.tokens.filter(t=>t.type!=='obstacle').map(t=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:10}))})
  expect(result.ok&&result.result.ok).toBe(true)
  if(!result.ok||!result.result.ok)throw Error('Help failed')
  expect(result.result.state.combatants.oak.controller).toBe('player')
  expect(result.result.state.combatants.oak.turn.actionAvailable).toBe(false)
  expect(result.result.state.combatants[targetId].classState[helpKind==='attack'?'helpedAttackSourceId':'helpedAbilityCheckSourceId']).toBe('oak')
  expect(saved.tokens.find(t=>t.id==='oak')?.type).toBe('enemy')
})

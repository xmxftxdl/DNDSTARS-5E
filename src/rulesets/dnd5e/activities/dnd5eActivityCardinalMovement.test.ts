import { beforeEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cellToPixel } from '../../../lib/gridCombat'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import type { BattleMap, Token } from '../../../store/maps'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const directions = ['north', 'east', 'south', 'west'] as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  armorClass: 10, currentHp: 20, maxHp: 20, conditions: [],
}
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'random-movement', name: 'Synthetic random movement',
  activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
  checks: [{ id: 'direction', kind: 'random-roll', rollId: 'direction', count: 1, sides: 4, scope: 'shared' }],
  outcomes: directions.map((cardinalDirection, index) => ({
    id: cardinalDirection, when: { kind: 'check-total', checkId: 'direction', minimum: index + 1, maximum: index + 1 },
    operations: [{ id: cardinalDirection, kind: 'move', target: 'target', mode: 'forced', cardinalDirection,
      distanceFeet: { kind: 'constant', value: 5 } }],
  })), automation: automationCapabilityFromLegacyStatus('full'),
}
beforeEach(() => setMapGeometryRuntime([]))

function run(face: number, blocked: false | true | 'wall' = false) {
  const map: BattleMap = { id: 'cardinal-map', name: 'Cardinal map', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [] }
  const makeToken = (id: string, col: number, row: number): Token => ({ id, label: id, color: '#fff', emoji: '',
    size: 1, type: 'player', characterId: id, ...cellToPixel({ col, row }, map) })
  map.tokens = [makeToken('actor', 1, 1), makeToken('target', 4, 4)]
  if (blocked === true) map.tokens.push(makeToken('blocker', 5, 4))
  if (blocked === 'wall') {
    const geometry = createEmptyMapGeometry(map.id)
    geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 250, y: 100 }, { x: 250, y: 400 }],
      blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
    setMapGeometryRuntime([geometry])
  }
  const before = structuredClone(map)
  const resolved = resolveDnd5eActivity({ activity: JSON.parse(JSON.stringify(activity)), actor,
    targets: [{ ...actor, id: 'target' }], distanceFeetByTargetId: { target: 15 }, rolls: { direction: { values: [face] } } })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok) throw Error(resolved.reason)
  const movements = resolved.proposals.filter(p => p.kind === 'move')
  expect(movements).toHaveLength(1)
  const result = applyDnd5eActivityMapHandoffsV1({ map, activity, actorId: 'actor', packageId: 'test.cardinal',
    actionId: 'cast', round: 1, handoffs: { movements, persistentAreas: [], summons: [], invocations: [] },
    // A caster-supplied alternative must not override the Host table result.
    selection: { movementCellsByOperationId: { [directions[face - 1]]: { col: 3, row: 4 } } } })
  expect(map).toEqual(before)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.movementPaths).toHaveLength(1)
  expect(result.movementPaths[0].provokesOpportunityAttacks).toBe(false)
  return { map, result }
}

it.each([[1, 4, 3], [2, 5, 4], [3, 4, 5], [4, 3, 4]])('settles table face %s as an authoritative cardinal destination', (face, col, row) => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const { map, result } = run(face)
  expect(result.map.tokens.find(t => t.id === 'target')).toMatchObject(cellToPixel({ col, row }, map))
})

it.each([true, 'wall'] as const)('keeps a blocked direction in place without rejecting the cast or choosing another direction (%s)', blocked => {
  const { map, result } = run(2, blocked)
  expect(result.map.tokens.find(t => t.id === 'target')).toMatchObject(cellToPixel({ col: 4, row: 4 }, map))
})

it.each([{ cardinalDirection: 'diagonal' }, { mode: 'teleport' }, { provokesOpportunityAttacks: true },
  { usesTargetReactionIfAvailable: true }, { placement: 'host-automatic-maximum' }])('rejects incompatible cardinal movement %j', override => {
  const invalid = structuredClone(activity)
  Object.assign(invalid.outcomes[0].operations[0], override)
  expect(validateDnd5eActivityDefinitionV1(invalid).some(e => e.includes('cardinalDirection'))).toBe(true)
})

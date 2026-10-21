import { expect, it } from 'vitest'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { atomicMutateJsonStateLocked, mutateCampaignTimeState } from '../../../scripts/shared-server-core.mjs'
import { normalizeSharedCampaignTime } from '../../lib/campaignTime'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eCampaignInteractionIssue, prepareDnd5eCampaignInteractionStart } from './campaignInteractionAuthority'

function fixture() {
  const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, languages: ['Common'], proficiencyBonus: 2,
    armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('interaction', [actor('source', 20), actor('bearer', 10)])
  state.active = false
  state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 5 }
  state.combatants.bearer.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'prepare', definitionId: 'prepare', label: 'Prepare', targetId: 'bearer', source: { kind: 'feature', actorId: 'source', pluginId: 'test.interaction' },
    duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' }, completionGrant: { activityIds: ['finish'], availableRounds: 10, recipient: 'source', bindTarget: 'bearer' },
    removal: { sourceLink: { requiresSourceCommunication: true, requiresSharedLanguage: true, maximumDistanceFeet: 10 } } })]
  return state
}

it.each(['valid', 'combat', 'missing', 'dead', 'silent', 'range', 'language', 'suppressed', 'removed'] as const)('derives a noncombat start from Host effects and checks continuity (%s)', scenario => {
  const state = fixture()
  if (scenario === 'combat') state.active = true
  if (scenario === 'missing') delete state.combatants.source
  if (scenario === 'dead') state.combatants.source.currentHp = 0
  if (scenario === 'silent') state.combatants.source.soundSuppressed = true
  if (scenario === 'range') state.distanceFeetByCombatantPair!['bearer\u0000source'] = 20
  if (scenario === 'language') state.combatants.bearer.languages = ['Elvish']
  if (scenario === 'suppressed') state.combatants.bearer.classState.activeEffects![0].suspendedBy = ['blocked']
  if (scenario === 'removed') state.combatants.bearer.classState.activeEffects = []
  const before = structuredClone(state)
  const result = prepareDnd5eCampaignInteractionStart({ state, bearerId: 'bearer', effectId: 'prepare', interactionId: 'interaction-1', worldMinute: 480 })
  expect(result.ok, JSON.stringify(result)).toBe(scenario === 'valid')
  expect(state).toEqual(before)
  if (result.ok) expect(result.mutation).toMatchObject({ sourceId: 'source', packageId: 'test.interaction', requiredRounds: 10, expectedWorldMinute: 480 })
})

it('persists the prepared record atomically, reloads it, and does not write a new revision for retries', async () => {
  const state = fixture()
  const prepared = prepareDnd5eCampaignInteractionStart({ state, bearerId: 'bearer', effectId: 'prepare', interactionId: 'interaction-1', worldMinute: 480 })
  if (!prepared.ok) throw Error(prepared.reason)
  const host = { role: 'dm', memberId: 'host' }
  const context = { host, interactionEntities: Object.values(state.combatants).map(actor => ({ id: actor.id, effects: actor.classState.activeEffects ?? [] })) }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stars-interaction-'))
  const file = path.join(dir, 'campaign-time.json')
  try {
    const first = await atomicMutateJsonStateLocked(file, async current => mutateCampaignTimeState(current, prepared.mutation, 10, host, context))
    expect(first).toMatchObject({ ok: true, changed: true })
    const bytes = await readFile(file, 'utf8')
    const loaded = normalizeSharedCampaignTime(JSON.parse(bytes))
    expect(loaded.interactions?.[0]).toMatchObject({ id: 'interaction-1', effectId: 'prepare', status: 'active' })
    expect(dnd5eCampaignInteractionIssue(state, loaded.interactions![0])).toBeNull()
    expect(dnd5eCampaignInteractionIssue(state, { ...loaded.interactions![0], status: 'interrupted' })).toBe('interaction-not-active')
    const retry = await atomicMutateJsonStateLocked(file, async current => mutateCampaignTimeState(current, prepared.mutation, 11, host, context))
    expect(retry).toMatchObject({ ok: true, changed: false })
    expect(await readFile(file, 'utf8')).toBe(bytes)
    state.combatants.source.soundSuppressed = true
    expect(dnd5eCampaignInteractionIssue(state, loaded.interactions![0])).toBe('interaction-continuity-lost')
    const stopped = await atomicMutateJsonStateLocked(file, async current => mutateCampaignTimeState(current, { operation: 'interrupt-interaction', id: 'interaction-1', expectedWorldMinute: 480 }, 12, host, context))
    expect(stopped).toMatchObject({ ok: true, changed: true })
    expect(normalizeSharedCampaignTime(JSON.parse(await readFile(file, 'utf8'))).interactions?.[0].status).toBe('interrupted')
  } finally {
    await unlink(file).catch(() => undefined)
    await rmdir(dir)
  }
})

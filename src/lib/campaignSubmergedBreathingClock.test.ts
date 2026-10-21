import { expect, it } from 'vitest'
import { planCampaignSubmergedBreathing as plan } from '../../shared/campaign-submerged-breathing.mjs'

const held = { id: 'held', appliedAt: 1, modifiers: { submerged: true }, duration: { type: 'permanent' } }
const ward = { id: 'ward', appliedAt: 2, modifiers: { environmentalCapabilities: { breatheIn: ['water'] } },
  duration: { type: 'rounds', remainingRounds: 1 } }
const maps = [{ id: 'map', tokens: [{ id: 'token', characterId: 'hero' }] }]
const character = (state: Record<string, unknown>) => ({ id: 'hero', abilities: { con: 14 }, dnd5eCombatState: state })
const clock = (seconds: number, advances: unknown[] = []) => ({ worldMinute: Math.floor(seconds / 60), worldSecondRemainder: seconds % 60, advances })
const credit = { id: 'combat-1', combatRoundCredits: { '["character","hero"]': 1 } }

it('uses persisted Constitution reductions for exploration breath capacity', () => {
  const hero=character({activeEffects:[held],abilityScoreReductionLedger:[
    {id:'con-drain',ability:'con',amount:4,recovery:'restoration-magic'},
    {id:'str-drain',ability:'str',amount:8,recovery:'restoration-magic'},
  ]})
  const first=plan({maps,characters:[hero],previousClock:clock(0),nextClock:clock(6)}).updates[0]
  expect(first.state?.breathCapacitySeconds).toBe(60)
  expect(first.state?.breathSeconds).toBe(54)
  const reloaded=JSON.parse(JSON.stringify({...hero,dnd5eCombatState:{...hero.dnd5eCombatState,submergedBreathing:first.state}}))
  const completed=plan({maps,characters:[reloaded],previousClock:clock(6),nextClock:clock(66)}).updates[0]
  expect(completed.collapsedAt).toBe(66)
})

it('matches a long exploration jump with save/reload at nonaquatic form reversion', () => {
  const form = { activeEffects: [held], wildShapeFormId: 'srd-5.1:goblin',
    wildShapeOriginalStatBlockId: 'srd-5.1:goblin', wildShapeOriginalCurrentHp: 15 }
  const scene = [{ id: 'map', tokens: [{ id: 'token', characterId: 'hero', poolId: 'srd-5.1:goblin' }] }]
  const full = plan({ maps: scene, characters: [character(form)], previousClock: clock(0), nextClock: clock(120) }).updates[0]
  expect(full.revertedForm).toBe(true)
  expect(full.collapsedAt).toBe(72)
  const first = plan({ maps: scene, characters: [character(form)], previousClock: clock(0), nextClock: clock(66) }).updates[0]
  expect(first.collapsedAt).toBeUndefined()
  const restored = JSON.parse(JSON.stringify(character({ activeEffects: [held], submergedBreathing: first.state })))
  const second = plan({ maps: scene, characters: [restored], previousClock: clock(66), nextClock: clock(120) }).updates[0]
  expect(second.collapsedAt).toBe(full.collapsedAt)
  expect(second.state).toEqual(full.state)
})

it('accepts a campaign cursor bridged by already settled combat minutes without charging them again', () => {
  const past = { id: 'past-combat', kind: 'advance', fromWorldMinute: 0, toWorldMinute: 1, minutes: 1,
    combatRoundCredits: { '["character","hero"]': 10 } }
  const saved = { schemaVersion: 1, breathSeconds: 114, breathCapacitySeconds: 180,
    survivalSeconds: 12, collapsed: false, lastStepKey: 'combat:11', campaignClockSeconds: 0 }
  const input = { maps, characters: [character({ activeEffects: [held], submergedBreathing: saved })],
    previousClock: clock(60, [past]), nextClock: clock(66, [past]) }
  expect(plan(input).updates[0].state?.breathSeconds).toBe(108)
  expect(() => plan({ ...input, previousClock: clock(60), nextClock: clock(66) })).toThrow('stale-submerged-campaign-clock')
})

it('does not age an already combat-decremented protection a second time when the campaign clock catches up', () => {
  const result = plan({ maps, characters: [character({ activeEffects: [held, ward] })],
    previousClock: clock(0), nextClock: clock(6, [credit]) }).updates[0]
  expect(result.expiredEffectIds).not.toContain('ward')
  expect(result.effectDeadlines).toEqual([{ effectId: 'ward', appliedAt: 2, expiresAtSeconds: 12 }])
  const continued = plan({ maps, characters: [character({ activeEffects: [held, ward],
    submergedBreathingEffectDeadlines: result.effectDeadlines })], previousClock: clock(6, [credit]), nextClock: clock(12, [credit]) }).updates[0]
  expect(continued.expiredEffectIds).toContain('ward')
})

it('keeps a persisted absolute deadline when combat credits arrive later', () => {
  const result = plan({ maps, characters: [character({ activeEffects: [held, ward],
    submergedBreathingEffectDeadlines: [{ effectId: 'ward', appliedAt: 2, expiresAtSeconds: 12 }] })],
    previousClock: clock(6), nextClock: clock(12, [credit]) }).updates[0]
  expect(result.expiredEffectIds).toContain('ward')
  expect(result.effectDeadlines?.[0].expiresAtSeconds).toBe(12)
})

it('replaces a deadline for a refreshed instance but preserves it across ordinary reloads', () => {
  const state = { activeEffects: [held, { ...ward, appliedAt: 3, duration: { type: 'rounds', remainingRounds: 2 } }],
    submergedBreathingEffectDeadlines: [{ effectId: 'ward', appliedAt: 2, expiresAtSeconds: 12 }] }
  const first = plan({ maps, characters: [character(state)], previousClock: clock(6), nextClock: clock(12) }).updates[0]
  expect(first.effectDeadlines).toEqual([{ effectId: 'ward', appliedAt: 3, expiresAtSeconds: 18 }])
  expect(first.expiredEffectIds).not.toContain('ward')
  const reloaded = JSON.parse(JSON.stringify({ ...state, submergedBreathingEffectDeadlines: first.effectDeadlines }))
  const second = plan({ maps, characters: [character(reloaded)], previousClock: clock(12), nextClock: clock(18) }).updates[0]
  expect(second.expiredEffectIds).toContain('ward')
})

it('restores saved effective Constitution rather than the original stat block base after form collapse', () => {
  const form={activeEffects:[held],wildShapeFormId:'srd-5.1:goblin',
    wildShapeOriginalStatBlockId:'srd-5.1:goblin',wildShapeOriginalAbilities:{con:8},wildShapeOriginalCurrentHp:15}
  const first=plan({maps,characters:[character(form)],previousClock:clock(0),nextClock:clock(66)}).updates[0]
  expect(first.revertedForm).toBe(true)
  expect(first.state?.breathCapacitySeconds).toBe(30)
  expect(first.state?.pendingCollapseAtSeconds).toBe(72)
  const restored=JSON.parse(JSON.stringify({id:'hero',abilities:{con:10},dnd5eCombatState:{activeEffects:[held],
    abilityScoreReductionLedger:[{id:'drain',ability:'con',amount:2,recovery:'restoration-magic'}],submergedBreathing:first.state}}))
  const resumed=plan({maps,characters:[restored],previousClock:clock(66),nextClock:clock(72)}).updates[0]
  const full=plan({maps,characters:[character(form)],previousClock:clock(0),nextClock:clock(72)}).updates[0]
  expect(resumed.state).toEqual(full.state)
  expect(resumed.collapsedAt).toBe(full.collapsedAt)
})
import { advanceCampaignTimeSnapshot, validateSharedCampaignTime, type SharedCampaignTimeState } from '../../lib/campaignTime'
import { dnd5eCampaignInteractionIssue } from '../../rulesets/dnd5e/campaignInteractionAuthority'
import { settleDnd5eCampaignPreparationCompletion, type Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import { planDnd5eMapResultApplication } from '../../rulesets/dnd5e/mapBridge'
import { compensateDnd5eCompletedLongCastApplication } from './commitDnd5eCombatResult'

/** Unpublished result bundle. The caller must commit clock and application together with revision checks. */
export function planDnd5eCampaignInteractionCompletion(input: {
  state: Dnd5eHeadlessCombatState
  clock: SharedCampaignTimeState
  interactionId: string
  /** Host attestation for uninterrupted time, including narrative privacy when the source rule requires it. */
  continuityConfirmed: boolean
  now: number
} & Omit<Parameters<typeof planDnd5eMapResultApplication>[0], 'state' | 'events'>) {
  const fail = (reason: string) => ({ ok: false as const, reason })
  if (!input.continuityConfirmed) return fail('interaction-continuity-confirmation-required')
  if (!validateSharedCampaignTime(input.clock)) return fail('invalid-interaction-clock')
  const record = input.clock.interactions?.find(record => record.id === input.interactionId)
  if (!record || record.status !== 'active') return fail('interaction-not-active')
  if (record.startedAtWorldMinute !== input.clock.worldMinute) return fail('interaction-unverified-time')
  const issue = dnd5eCampaignInteractionIssue(input.state, record)
  if (issue) return fail(issue)
  if (!input.map.tokens.some(token => token.id === record.sourceId) || !input.map.tokens.some(token => token.id === record.bearerId)) return fail('interaction-map-participant-missing')
  const minutes = Math.ceil(record.requiredRounds / 10)
  const advanceId = `interaction:${record.id}`
  const clock = advanceCampaignTimeSnapshot({ state: input.clock, minutes, reason: '完成持续交互', now: input.now, advanceId })
  if (!clock) return fail('invalid-interaction-duration')
  clock.interactions = clock.interactions?.map(row => row.id === record.id ? {
    ...record, status: 'completed', completedAtWorldMinute: clock.worldMinute, completionAdvanceId: advanceId,
  } : row)
  if (!validateSharedCampaignTime(clock)) return fail('invalid-interaction-completion')
  const settled = settleDnd5eCampaignPreparationCompletion({ state: input.state, bearerId: record.bearerId, effectId: record.effectId, interactionId: record.id, overshootRounds: minutes * 10 - record.requiredRounds })
  const applied = settled.events.filter(event => event.type === 'active-effect-applied')
  const byCharacter = new Map<string, Set<string>>(), byToken = new Map<string, Set<string>>()
  for (const event of applied) {
    const characterId = input.characterIdByCombatantId[event.targetId]
    const selectors = characterId ? byCharacter : byToken
    const id = characterId ?? event.targetId
    const ids = selectors.get(id) ?? new Set<string>()
    ids.add(event.effectId)
    selectors.set(id, ids)
  }
  const map = { ...input.map, tokens: input.map.tokens.map(token => ({ ...token, dnd5eWorldTimeAppliedMinute: token.dnd5eWorldTimeAppliedMinute ?? input.clock.worldMinute })) }
  const characters = input.characters.map(character => ({ ...character, dnd5eWorldTimeAppliedMinute: character.dnd5eWorldTimeAppliedMinute ?? input.clock.worldMinute }))
  const application = compensateDnd5eCompletedLongCastApplication(
    planDnd5eMapResultApplication({ ...input, map, characters, state: settled.state, events: settled.events }),
    byCharacter, minutes, clock, new Map(), byToken, true,
  )
  return { ok: true as const, clock, application, events: settled.events, expectedWorldMinute: input.clock.worldMinute, interactionId: record.id }
}

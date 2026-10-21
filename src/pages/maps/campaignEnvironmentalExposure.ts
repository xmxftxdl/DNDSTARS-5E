import { appendCampaignEnvironmentalExposure, type CampaignEnvironmentalExposure } from '../../../shared/campaign-environmental-exposures.mjs'
import { validateSharedCampaignTime, type SharedCampaignTimeState } from '../../lib/campaignTime'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { commitDnd5eActivityExecution, dnd5eEffectiveMovementPoolSpeed } from '../../rulesets/dnd5e/headlessCombatEngine'
import type { SharedCombatState } from '../../lib/sharedCombatTypes'
import { planDnd5eMapResultApplication } from '../../rulesets/dnd5e/mapBridge'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity, type Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import { dnd5eSavingThrowMode } from '../../rulesets/dnd5e/passiveDefenses'

/** Host chooses the exposure interval/DC. Plan the actor changes and terminal receipt
 * together; caller must publish both with the original snapshot revision guards. */
export function planDnd5eCampaignEnvironmentalExposure(input: Omit<Parameters<typeof planDnd5eMapResultApplication>[0], 'events'> & {
  clock: SharedCampaignTimeState
  combat?: SharedCombatState
  targetId: string
  exposureId: string
  hazard: CampaignEnvironmentalExposure['hazard']
  fromWorldMinute: number
  toWorldMinute: number
  dc: number
  rolls: Dnd5eActivityExecutionInput['rolls']
  now: number
}) {
  const fail = (reason: string) => ({ ok: false as const, reason })
  if (!validateSharedCampaignTime(input.clock)) return fail('invalid-exposure-clock')
  if (input.state.active && (!input.combat?.active || input.combat.mapId !== input.map.id)) return fail('exposure-combat-snapshot-required')
  if (!Number.isSafeInteger(input.now) || input.now < 0) return fail('invalid-exposure-time')
  const target = input.state.combatants[input.targetId]
  if (!target || input.map.tokens.filter(token => token.id === input.targetId).length !== 1) return fail('exposure-target-unavailable')
  const characterId = input.characterIdByCombatantId[input.targetId]
  const receipt: CampaignEnvironmentalExposure = {
    id: input.exposureId, subjectId: characterId ? `character:${characterId}` : `map:${input.map.id}:token:${input.targetId}`,
    hazard: input.hazard, fromWorldMinute: input.fromWorldMinute, toWorldMinute: input.toWorldMinute, dc: input.dc, outcome: 'success',
  }
  const accepted = appendCampaignEnvironmentalExposure(input.clock.environmentalExposures, receipt, input.clock.worldMinute)
  if (!accepted.ok) return fail(accepted.reason)
  const actor = dnd5eActivityActorSnapshotFromCombatantV1(target)
  const resolution = resolveDnd5eActivity({
    activity: { schemaVersion: 1, id: 'environmental-exposure', name: input.hazard === 'extreme-heat' ? '极端炎热暴露' : '极端寒冷暴露',
      activation: { kind: 'free' }, target: { kind: 'self' },
      automation: automationCapabilityFromLegacyStatus('full'),
      checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'con', dc: { kind: 'constant', value: input.dc },
        rollMode: 'host-derived', scope: 'per-target', environmentalHazard: input.hazard }],
      outcomes: [{ id: 'failure', when: { kind: 'check', checkId: 'save', result: 'failure' },
        operations: [{ id: 'exhaustion', kind: 'adjust-exhaustion', target: 'target', amount: { kind: 'constant', value: 1 } }] }],
    }, actor, targets: [actor], rolls: input.rolls, checkRollModes: { [`save:${target.id}`]: dnd5eSavingThrowMode(target, 'con', { sourceIsSpell: false, sourceIsMagical: false }) },
  })
  if (!resolution.ok) return { ...fail('exposure-roll-invalid'), details: resolution.details }
  const check = resolution.checks[0]
  receipt.outcome = check.automaticOutcome === 'environmental-immunity-success' ? 'protected' : check.success ? 'success' : 'failure'
  const settled = commitDnd5eActivityExecution(input.state, { actorId: target.id, targetIds: [target.id],
    activityId: 'environmental-exposure', resolution, allowEnvironmentalExposureCommit: true,
    source: { kind: 'action', id: 'environmental-exposure' } })
  if (!settled.ok) return fail('exposure-settlement-failed')
  const clock = { ...input.clock, environmentalExposures: [...accepted.receipts.slice(0, -1), receipt], updatedAt: input.now }
  const application = planDnd5eMapResultApplication({ ...input, state: settled.state, events: [...settled.events] })
  const economy = input.combat?.dnd5eTurnEconomyByToken?.[target.id]
  const resolvedTarget = settled.state.combatants[target.id]
  // Keep exact counted action resources, extra slots and tracker metadata. Only the
  // affected movement pool changes when exhaustion changes effective speed.
  const combat = input.combat ? { ...input.combat, updatedAt: input.now,
    ...(economy ? { dnd5eTurnEconomyByToken: { ...input.combat.dnd5eTurnEconomyByToken,
      [target.id]: { ...economy, movement: { ...economy.movement,
        current: resolvedTarget.turn.movementRemaining, max: dnd5eEffectiveMovementPoolSpeed(resolvedTarget),
        spent: resolvedTarget.turn.movementSpent ?? economy.movement.spent ?? 0 } },
    } } : {}) } : undefined
  return { ok: true as const, clock, application, events: settled.events, state: settled.state, receipt, combat }
}

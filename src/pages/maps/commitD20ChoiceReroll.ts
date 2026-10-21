import type { Character } from '../../types/character'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import { COMBAT_INTERRUPT_RESOURCE, finishCombatInterrupt, type SharedCombatInterruptQueueState } from '../../lib/combatInterruptQueue'
import { isCombatInterruptKind, type RollConfirmationInterruptResponse } from '../../lib/combatInterruptProtocol'
import { settleD20RollConfirmation } from '../../lib/rollConfirmation'
import { spendClassResource } from '../../lib/classResources'
import { DND5E_CORE_INSPIRATION_RESOURCE_KEY } from '../../lib/d20InterruptPolicy'
import { getRoomSession } from '../../lib/roomSession'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import { consumeDnd5eStoredD20Replacement, dnd5eStoredD20ReplacementFeaturesForCharacter } from '../../rulesets/dnd5e/pluginApi'

type Snapshot<T> = T & { _sync?: { revision?: number } }
type Characters = Snapshot<{ characters: Character[]; selectedId?: string | null; updatedAt?: number }>
type Queue = Snapshot<SharedCombatInterruptQueueState>
type Gateway = Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>
function revision(value: Snapshot<object>, name: string): number {
  const rev = value._sync?.revision
  if (!Number.isSafeInteger(rev) || rev! < 0) throw Error(`reroll-snapshot-revision-required:${name}`)
  return rev!
}

/** Read the persisted Host offer and dice, then commit costs and completion together.
 * A missing/retired interrupt never creates a new spend. CAS failures do not retry
 * using newer revision watermarks or fall back to the original d20. */
export async function commitD20RollResourceSettlement(input: {
  mapId: string; interruptId: string; acceptedContributionId: string; now?: number
}, gateway: Gateway = {
  loadResource: browserSharedRoomService.loadSharedResource,
  saveResourcesAtomically: browserSharedRoomService.saveSharedResourcesAtomically,
}): Promise<RollConfirmationInterruptResponse> {
  const session = getRoomSession()
  const guard = () => {
    const current = getRoomSession()
    if (session && session.role !== 'dm' || current?.roomId !== session?.roomId || current?.memberId !== session?.memberId ||
      current && current.role !== 'dm') throw Error('reroll-host-room-required')
  }
  guard()
  const [characters, queue] = await Promise.all([
    gateway.loadResource<Characters>('characters'), gateway.loadResource<Queue>(COMBAT_INTERRUPT_RESOURCE),
  ])
  guard()
  if (!characters || !Array.isArray(characters.characters) || !queue || queue.mapId !== input.mapId) throw Error('reroll-snapshot-missing')
  const prompt = queue.interrupts.find(row => row.id === input.interruptId)
  if (!prompt || !isCombatInterruptKind(prompt, 'roll-confirmation')) throw Error('reroll-interrupt-missing')
  const contribution = prompt.contributions?.find(row => row.id === input.acceptedContributionId)
  if (!contribution || (contribution.kind !== 'replace-d20' &&
    (contribution.kind !== 'choice-reroll' || contribution.decision !== 'use'))) throw Error('reroll-contribution-mismatch')
  const prior = prompt.response
  if (prompt.status === 'done') {
    if (!prior || prior.acceptedContributionId !== contribution.id ||
      (contribution.kind === 'choice-reroll' && (prior.choiceReroll?.characterId !== contribution.characterId || prior.choiceReroll.featureId !== contribution.featureId)) ||
      (contribution.kind === 'replace-d20' && prior.finalValue !== contribution.replacementValue)) {
      throw Error('reroll-completed-response-mismatch')
    }
    return prior
  }
  if (prompt.status === 'rolled-back') throw Error('reroll-interrupt-rolled-back')
  if (contribution.kind === 'choice-reroll' && !prompt.payload.rollOptions) throw Error('reroll-dice-not-persisted')
  const now = input.now ?? Date.now()
  const response = settleD20RollConfirmation(prompt, contribution.id, now, undefined, undefined, undefined,
    contribution.kind === 'choice-reroll' ? contribution.selectedIndex : undefined)
  const choice = response.choiceReroll
  const owner = characters.characters.find(row => row.id === contribution.characterId)
  if (!owner) throw Error('reroll-character-missing')
  let changed: Character | null = owner
  if (contribution.kind === 'replace-d20') {
    const eligible = prompt.payload.eligibleModifiers?.find(option => option.characterId === owner.id &&
      option.featureId === contribution.featureId && (option.modifierKind ?? 'replace-d20') === 'replace-d20')
    const owned = dnd5eStoredD20ReplacementFeaturesForCharacter(owner).find(row => row.feature.id === contribution.featureId)
    if (!eligible?.replacementValues?.includes(contribution.replacementValue) || !owned?.values.includes(contribution.replacementValue) || !contribution.featureId) {
      throw Error('stored-d20-replacement-unavailable')
    }
    changed = consumeDnd5eStoredD20Replacement(owner, contribution.featureId, contribution.replacementValue) ?? null
  } else {
    if (!choice) throw Error('reroll-result-missing')
    if (new Set(choice.resourceCosts.map(cost => cost.resourceKey)).size !== choice.resourceCosts.length) throw Error('reroll-duplicate-resource-cost')
    for (const cost of choice.resourceCosts) {
      if (!changed) break
      if (cost.resourceKey === DND5E_CORE_INSPIRATION_RESOURCE_KEY) {
        changed = Number.isSafeInteger(changed.inspiration) && changed.inspiration >= cost.amount
          ? { ...changed, inspiration: changed.inspiration - cost.amount } : null
      } else changed = spendClassResource(changed, cost.resourceKey, cost.amount)
    }
  }
  if (!changed) throw Error('reroll-resources-unavailable')
  const nextQueue = finishCombatInterrupt(queue, prompt.id, response, now)
  if (!nextQueue) throw Error('reroll-interrupt-missing')
  const transactionId = `reroll-settlement:${prompt.id}`
  guard()
  try {
    await gateway.saveResourcesAtomically([
      { name: 'characters', expectedRevision: revision(characters, 'characters'),
        data: { ...characters, characters: characters.characters.map(row => row.id === changed!.id ? changed! : row), updatedAt: now } },
      { name: COMBAT_INTERRUPT_RESOURCE, expectedRevision: revision(queue, COMBAT_INTERRUPT_RESOURCE), data: nextQueue },
    ], { transactionId, undoGroupId: transactionId, undoLabel: '重骰与能力资源结算' })
    guard()
    return response
  } catch (error) {
    guard()
    // Only the exact persisted result proves an ambiguous write committed.
    if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|state-transaction-(?:conflict|unavailable|502|503|504)/i.test(String(error))) {
      try {
        const saved = await gateway.loadResource<Queue>(COMBAT_INTERRUPT_RESOURCE)
        guard()
        const done = saved?.mapId === input.mapId ? saved.interrupts.find(row => row.id === prompt.id) : undefined
        if (done?.status === 'done' && JSON.stringify(done.response) === JSON.stringify(response)) return response
      } catch { /* No evidence of success: retain the pending request for recovery. */ }
    }
    throw error
  }
}

/** Existing callers retain the same entry; both resource-bearing d20 paths share the transaction. */
export const commitD20ChoiceReroll = commitD20RollResourceSettlement

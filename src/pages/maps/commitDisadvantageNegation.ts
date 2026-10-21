import type { Character } from '../../types/character'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import { getRoomSession } from '../../lib/roomSession'
import { COMBAT_INTERRUPT_RESOURCE, type SharedCombatInterruptQueueState } from '../../lib/combatInterruptQueue'
import { isCombatInterruptKind } from '../../lib/combatInterruptProtocol'
import { planDnd5eDisadvantageNegation, type DisadvantageNegationRoll } from '../../rulesets/dnd5e/disadvantageNegation'

type Snapshot<T> = T & { _sync?: { revision?: number } }
type Characters = Snapshot<{ characters: Character[]; updatedAt: number }>
type Queue = Snapshot<SharedCombatInterruptQueueState>
type Gateway = Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>
interface Settlement { rollId: string; characterId: string; featureId: string; mode: 'normal' | 'disadvantage'; used: boolean }

function revision(value: Snapshot<object>): number {
  const rev = value._sync?.revision
  if (!Number.isSafeInteger(rev) || rev! < 0) throw Error('negation-revision-required')
  return rev!
}

/** Only the Host can debit the fresh character and seal the persisted pre-roll choice. */
export async function commitDisadvantageNegation(input: { mapId: string; interruptId: string }, gateway: Gateway = {
  loadResource: browserSharedRoomService.loadSharedResource,
  saveResourcesAtomically: browserSharedRoomService.saveSharedResourcesAtomically,
}): Promise<Settlement> {
  const initialSession = getRoomSession()
  const session = initialSession ? { ...initialSession } : undefined
  const guard = () => {
    const current = getRoomSession()
    if (!session || session.role !== 'dm' || current?.role !== 'dm' || current.roomId !== session.roomId || current.memberId !== session.memberId) {
      throw Error('negation-host-room-required')
    }
  }
  guard()
  const [characters, queue] = await Promise.all([
    gateway.loadResource<Characters>('characters'), gateway.loadResource<Queue>(COMBAT_INTERRUPT_RESOURCE),
  ])
  guard()
  const prompt = queue?.interrupts.find(row => row.id === input.interruptId)
  if (!characters || !queue || queue.mapId !== input.mapId || !prompt || prompt.mapId !== input.mapId ||
    !isCombatInterruptKind(prompt, 'plugin-choice') || prompt.phase !== 'before-action' ||
    !['answered', 'done'].includes(prompt.status)) throw Error('negation-choice-unavailable')
  const roll = prompt.payload.disadvantageNegation as DisadvantageNegationRoll | undefined
  if (!roll || roll.characterId !== prompt.actorCharId || roll.phase !== 'before-roll' || roll.mode !== 'disadvantage' ||
    !['attack', 'ability-check', 'saving-throw'].includes(roll.kind) || typeof roll.rollId !== 'string' || !roll.rollId.trim() ||
    !['actor', 'dm'].includes(prompt.payload.audience) || !['use', 'decline'].includes(String(prompt.response?.optionId)) ||
    !prompt.payload.options.some(option => option.id === prompt.response?.optionId)) throw Error('negation-choice-mismatch')
  const used = prompt.response?.optionId === 'use'
  const settled: Settlement = { rollId: roll.rollId, characterId: roll.characterId, featureId: prompt.payload.featureId,
    mode: used ? 'normal' : 'disadvantage', used }
  if (prompt.payload.negationSettlement != null) {
    if (prompt.status !== 'done' || JSON.stringify(prompt.payload.negationSettlement) !== JSON.stringify(settled)) throw Error('negation-receipt-mismatch')
    return settled
  }
  const owner = characters.characters.find(character => character.id === roll.characterId)
  if (!owner) throw Error('negation-character-missing')
  const plan = used ? planDnd5eDisadvantageNegation(owner, roll, prompt.payload.featureId) : undefined
  if (used && !plan) throw Error('negation-feature-unavailable')
  if (plan) {
    const receipts = plan.character.dnd5eCombatState?.disadvantageNegationReceipts ?? {}
    if (Object.keys(receipts).length >= 32 || receipts[roll.rollId]) throw Error('negation-receipt-conflict')
    plan.character = { ...plan.character, dnd5eCombatState: { ...plan.character.dnd5eCombatState,
      disadvantageNegationReceipts: { ...receipts, [roll.rollId]: { rollId: roll.rollId, transactionId: prompt.transactionId,
        featureId: prompt.payload.featureId, kind: roll.kind, occurrence: roll.occurrence, contextId: roll.contextId } },
    } }
  }
  const now = Date.now()
  const nextQueue = { ...queue, updatedAt: now, interrupts: queue.interrupts.map(row => row.id === prompt.id
    ? { ...row, status: 'done' as const, updatedAt: now, payload: { ...row.payload, negationSettlement: settled } } : row) }
  const writes = [
    { name: 'characters', expectedRevision: revision(characters), data: { ...characters, updatedAt: now,
      characters: characters.characters.map(character => character.id === owner.id ? plan?.character ?? character : character) } },
    { name: COMBAT_INTERRUPT_RESOURCE, expectedRevision: revision(queue), data: nextQueue },
  ]
  guard()
  try {
    await gateway.saveResourcesAtomically(writes, { transactionId: `negation:${prompt.id}`, undoGroupId: prompt.transactionId, undoLabel: '取消本次劣势' })
    guard()
    return settled
  } catch (error) {
    guard()
    const saved = await gateway.loadResource<Queue>(COMBAT_INTERRUPT_RESOURCE)
    guard()
    const receipt = saved?.mapId === input.mapId ? saved.interrupts.find(row => row.id === prompt.id) : undefined
    if (receipt?.status === 'done' && JSON.stringify(receipt.payload.negationSettlement) === JSON.stringify(settled)) return settled
    throw error
  }
}

import{secondChanceParentScopeMatches,assertSecondChanceSceneScope}from'./secondChanceParentScope'
import{advanceSecondChanceParentRevisions}from'./secondChanceParentGroup'
import type { Character } from '../../types/character'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import { getRoomSession } from '../../lib/roomSession'
import { spendClassResource } from '../../lib/classResources'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeatureCurrentEnvelopeFullV1, dnd5ePluginFeatureDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import { dnd5eDeclarativeResourceKey } from '../../rulesets/dnd5e/plugins/pluginDeclarativeCompiler'
import { prepareSecondChanceCommit, selectSecondChanceAttackDie, type SecondChanceCommit } from '../../lib/secondChanceIncomingAttack'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{secondChanceParentDefinitionSignature}from'../../lib/secondChanceParentSignature'

type Revisioned<T> = T & { _sync?: { revision?: number } }
/** These facts are written only by the suspended Host parent attack. Player requests
 * carry IDs and choices; they cannot construct, replace, or add this receipt. */
import type{SecondChanceCombat}from'../../lib/secondChanceHostState'
export type{PersistedSecondChanceAttack,SecondChanceCombat}from'../../lib/secondChanceHostState'
type Gateway = Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>
function revision(value: Revisioned<object>, name: string): number {
  const rev = value._sync?.revision
  if (!Number.isSafeInteger(rev) || rev! < 0) throw Error(`second-chance:revision-required:${name}`)
  return rev!
}

/** Actual persistence adapter. The only command arguments are existing receipt IDs.
 * Costs, dice, ownership and principals are reloaded from Host storage. This is
 * intentionally staged: parent attack and authenticated transport must populate
 * the persisted fields above before the product can expose this operation. */
export async function commitSecondChanceHostAttack(input: { mapId: string; attackReceiptId: string; now?: number }, gateway: Gateway): Promise<SecondChanceCommit> {
  const session = getRoomSession()
  const guard = () => {
    const current = getRoomSession()
    if (!session || session.role !== 'dm' || current?.roomId !== session.roomId || current.memberId !== session.memberId || current.role !== 'dm') throw Error('second-chance:host-room-required')
  }
  guard()
  const [characters, combat, maps, geometry] = await Promise.all([
    gateway.loadResource<Revisioned<{ characters: Character[] }>>('characters'),
    gateway.loadResource<Revisioned<SecondChanceCombat>>('combat'),
    gateway.loadResource<Revisioned<object>>('maps'),
    gateway.loadResource<Revisioned<object>>('map-geometry'),
  ])
  guard()
  if (!characters || !combat || !maps) throw Error('second-chance:snapshot-missing')
  const receipt = combat.secondChanceAttacks?.[input.attackReceiptId]
  if (!receipt || receipt.attack.id !== input.attackReceiptId || !secondChanceParentScopeMatches(combat,receipt,input.mapId)) throw Error('second-chance:attack-receipt-missing')
  if(!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('second-chance:invalid-persisted-receipts')
  if (receipt.committed) {
    if (receipt.committed.attackReceiptId !== receipt.attack.id || receipt.committed.transactionId !== receipt.attack.transactionId ||
      receipt.committed.featureId !== receipt.featureId || receipt.committed.ownerCharacterId !== receipt.attack.targetCharacterId ||
      JSON.stringify(receipt.committed.beforeDice) !== JSON.stringify(receipt.attack.dice) ||
      receipt.committed.replacedDieIndex !== receipt.rollerSelection?.dieIndex ||
      receipt.rollerD20?.dieIndex !== receipt.rollerSelection?.dieIndex ||
      receipt.committed.afterDice[receipt.committed.replacedDieIndex] !== (receipt.rollerConfirmation?.value??receipt.rollerD20?.value) ||
      receipt.reactionDecision?.authenticatedMemberId !== receipt.attack.targetControllerMemberId ||
      receipt.rollerSelection?.authenticatedMemberId !== receipt.attack.rollerControllerMemberId ||
      receipt.rollerD20?.authenticatedMemberId !== receipt.attack.rollerControllerMemberId ||
      receipt.parentContinuation?.transactionId !== receipt.attack.transactionId) throw Error('second-chance:completed-receipt-mismatch')
    return receipt.committed
  }
  if (revision(characters, 'characters') !== receipt.characterRevision || revision(maps, 'maps') !== receipt.mapRevision) throw Error('second-chance:stale-parent-snapshot')
  if(receipt.parentDefinitionSignature&&(!receipt.parentInput||receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(receipt.parentInput.state)))throw Error('second-chance:changed-parent-definitions')
  if(receipt.geometryRevision!=null&&(geometry?revision(geometry,'map-geometry'):0)!==receipt.geometryRevision)throw Error('second-chance:stale-parent-geometry')
  const owner = characters.characters.find(row => row.id === receipt.attack.targetCharacterId)
  const feature = dnd5ePluginFeatureDefinition(receipt.featureId)
  const ability = feature?.declarativeAbility
  if(receipt.featureDefinitionSignature!=null&&receipt.featureDefinitionSignature!==JSON.stringify(ability))throw Error('second-chance:changed-feature-definition')
  if (!owner || !feature || !dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id) || feature.automation !== 'full' || ability?.automation !== 'full' || ability?.mechanic?.kind !== 'incoming-hit-attack-die-reroll' ||
    ability.cost?.economy !== 'reaction' || ability.cost.resources?.length !== 1 || !dnd5eCharacterHasPluginFeature(owner, feature.id)) throw Error('second-chance:owned-feature-required')
  const cost = ability.cost.resources[0]
  if (cost.amount !== 1 || cost.scope === 'core') throw Error('second-chance:invalid-resource-cost')
  const resourceKey = dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost)
  const pool = owner.classResources?.[resourceKey]
  const sceneReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
  if(receipt.sceneScope){
    if(owner.dnd5eCombatState?.sceneReactionSpent||!receipt.parentInput?.state.combatants[receipt.attack.targetTokenId]?.turn.reactionAvailable)throw Error('second-chance:scene-reaction-unavailable')
    if(Object.values(combat.secondChanceAttacks??{}).some(row=>row.attack.id!==receipt.attack.id&&row.attack.targetCharacterId===owner.id&&row.attack.phase==='hit-confirmation'&&row.reactionDecision?.decision==='use'))throw Error('second-chance:scene-reaction-reserved')
    const decision=receipt.reactionDecision,selection=receipt.rollerSelection,raw=receipt.rollerD20,confirmed=receipt.rollerConfirmation
    if(decision?.decision!=='use'||!selection||!raw||!confirmed||confirmed.authenticatedMemberId!==session!.memberId||confirmed.rollRequestId!==receipt.rollRequestId||confirmed.rawValue!==raw.value||raw.authenticatedMemberId!==receipt.attack.rollerControllerMemberId||selection.authenticatedMemberId!==raw.authenticatedMemberId||selection.dieIndex!==raw.dieIndex)throw Error('second-chance:authenticated-decisions-required')
    const result=prepareSecondChanceCommit({attack:receipt.attack,owner:{featureId:feature.id,featureLabel:feature.name,ownerCharacterId:owner.id,ownerName:owner.name,ownerTokenId:receipt.attack.targetTokenId,ownedFeatureIds:[feature.id],canSeeRoller:receipt.canSeeRoller,reactionAvailable:true,reactionReserved:false,resourceKey,resourceCurrent:pool?.current??0,resourceMaximum:pool?.max??0},authenticatedReactionMemberId:decision.authenticatedMemberId,decision:'use',selection:selectSecondChanceAttackDie(receipt.attack,selection.authenticatedMemberId,selection.dieIndex),hostRerollD20:confirmed.value,now:input.now})
    if(!result)throw Error('second-chance:commit-result-missing')
    const next=advanceSecondChanceParentRevisions({...combat,secondChanceAttacks:{...combat.secondChanceAttacks,[receipt.attack.id]:{...receipt,committed:result,parentContinuation:{transactionId:receipt.attack.transactionId,phase:'ready',characterRevision:revision(characters,'characters'),combatRevision:revision(combat,'combat')+1}}}},receipt.attack.transactionId,revision(combat,'combat')+1)
    await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat,'combat'),data:next}],{transactionId:`second-chance-scene-ready:${receipt.attack.id}`,readRevisions:{characters:revision(characters,'characters'),maps:revision(maps,'maps'),...sceneReads,...(receipt.geometryRevision!=null?{'map-geometry':receipt.geometryRevision}:{})}});guard();return result
  }
  const economy = combat.dnd5eTurnEconomyByToken?.[receipt.attack.targetTokenId]
  if (!economy || economy.turnKey !== receipt.turnKey) throw Error('second-chance:stale-turn')
  const decision = receipt.reactionDecision, roller = receipt.rollerSelection, roll = receipt.rollerD20
  if (!decision || decision.decision !== 'use' || !roller || !roll || roller.authenticatedMemberId !== roll.authenticatedMemberId || roller.dieIndex !== roll.dieIndex) throw Error('second-chance:authenticated-decisions-required')
  if(receipt.hostControllerMemberId&&(!receipt.rollerConfirmation||receipt.rollerConfirmation.authenticatedMemberId!==receipt.hostControllerMemberId||receipt.rollerConfirmation.rollRequestId!==receipt.rollRequestId||receipt.rollerConfirmation.rawValue!==roll.value))throw Error('second-chance:original-roll-not-confirmed')
  const selection = selectSecondChanceAttackDie(receipt.attack, roller.authenticatedMemberId, roller.dieIndex)
  const result = prepareSecondChanceCommit({ attack: receipt.attack, owner: {
    featureId: feature.id, featureLabel: feature.name, ownerCharacterId: owner.id, ownerName: owner.name,
    ownerTokenId: receipt.attack.targetTokenId, ownedFeatureIds: [feature.id], canSeeRoller: receipt.canSeeRoller,
    reactionAvailable: receipt.canUseReaction && economy.reaction.current > 0, reactionReserved: receipt.reactionReserved,
    resourceKey, resourceCurrent: pool?.current ?? 0, resourceMaximum: pool?.max ?? 0,
  }, authenticatedReactionMemberId: decision.authenticatedMemberId, decision: 'use', selection, hostRerollD20: receipt.rollerConfirmation?.value??roll.value, now: input.now })
  if (!result) throw Error('second-chance:commit-result-missing')
  const changed = spendClassResource(owner, resourceKey, 1)
  if (!changed) throw Error('second-chance:resource-unavailable')
  let next: SecondChanceCombat = { ...combat,
    dnd5eTurnEconomyByToken: { ...combat.dnd5eTurnEconomyByToken, [receipt.attack.targetTokenId]: { ...economy, reaction: { ...economy.reaction, current: economy.reaction.current - 1 } } },
    secondChanceAttacks: { ...combat.secondChanceAttacks, [receipt.attack.id]: { ...receipt, committed: result, parentContinuation: { transactionId: receipt.attack.transactionId, phase: 'ready',characterRevision:revision(characters,'characters')+1,combatRevision:revision(combat,'combat')+1 } } },
  }
  next=advanceSecondChanceParentRevisions(next,receipt.attack.transactionId,revision(combat,'combat')+1,revision(characters,'characters')+1)
  guard()
  try {
    await gateway.saveResourcesAtomically([
      { name: 'characters', expectedRevision: revision(characters, 'characters'), data: { ...characters, characters: characters.characters.map(row => row.id === changed.id ? changed : row) } },
      { name: 'combat', expectedRevision: revision(combat, 'combat'), data: next },
    ], { transactionId: `second-chance:${receipt.attack.id}`, readRevisions: { maps: revision(maps, 'maps'),...(receipt.geometryRevision!=null?{'map-geometry':receipt.geometryRevision}:{}) }, undoLabel: '花开二度反应与原攻击重骰' })
    guard()
    return result
  } catch (error) {
    guard()
    if (/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))) {
      const saved = await gateway.loadResource<Revisioned<SecondChanceCombat>>('combat')
      guard()
      const persisted = saved?.secondChanceAttacks?.[receipt.attack.id]?.committed
      if (saved?.mapId === input.mapId && saved.combatId === receipt.attack.combatId && JSON.stringify(persisted) === JSON.stringify(result)) return result
    }
    throw error
  }
}

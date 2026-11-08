import{pactWeaponPendingSeparationInstance}from'./pactWeaponSeparation'
import type{SharedMapGeometryState}from'../../lib/mapGeometry'
import{reconcilePactHostClock}from'./pactWeaponClockSnapshot'
import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { SharedCombatState } from '../../lib/sharedCombatTypes'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import { validateSharedCampaignTime } from '../../lib/campaignTime'
import { getRoomSession } from '../../lib/roomSession'
import { normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import { pactWeaponHasImprovedInvocation } from './pactWeaponEntitlement'
import { emptyPactWeaponState, normalizePactWeaponState, type PactWeaponState } from './pactWeaponBinding.mjs'
import type { PactInventoryDocument } from './pactWeaponInventoryTransaction'
import { planPactWeaponSummon } from './pactWeaponSummonPlan'

type Revisioned<T> = T & { _sync?: { revision?: number } }
export type PactSummonCommand = { mapId: string; actorTokenId: string; templateId?: string; expectedPactRevision: number; transactionId: string }
type Receipt = { transactionId: string; command: string; inventoryInstanceId: string; pactRevision: number }
export type PactLifecycleReceipt={transactionId:string;command:string;pactRevision:number;bindingStatus:'present'|'dismissed'|'none'}
export type PactAuthorityCharacter = Character & {
  /** Staged persistence field. Character normalization/schema must explicitly retain it before UI integration. */
  dnd5ePactWeaponAuthority?: { schemaVersion: 1; state: PactWeaponState; inventory: PactInventoryDocument; summons: Receipt[]; lifecycle?:PactLifecycleReceipt[]; lifecycleTrace?:Parameters<typeof import('./pactWeaponLifecyclePlan').planPactWeaponLifecycle>[0]['lifecycleTrace'] }
}
type Gateway = Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>
const revision = (value: Revisioned<object>, name: string) => {
  const number = value._sync?.revision
  if (!Number.isSafeInteger(number) || number! < 0) throw Error(`pact:revision-required:${name}`)
  return number!
}
export function validPactWeaponAuthority(value: NonNullable<PactAuthorityCharacter['dnd5ePactWeaponAuthority']>, ownerId: string): boolean {
  const id = (text: unknown, maximum = 640): text is string => typeof text === 'string' && text.length > 0 && text.length <= maximum
  const nonnegative = (number: unknown) => Number.isSafeInteger(number) && Number(number) >= 0
  if (!value || value.schemaVersion !== 1 || !normalizePactWeaponState(value.state) || value.state.ownerId !== ownerId ||
    !value.inventory || value.inventory.ownerId !== ownerId || value.inventory.schemaVersion !== 1 || !nonnegative(value.inventory.revision) ||
    !Array.isArray(value.inventory.stowed) || value.inventory.stowed.length > 1 || !Array.isArray(value.inventory.receipts) ||
    !Array.isArray(value.summons) || value.summons.length > 10_000) return false
  if (value.inventory.stowed.some(entry => !entry || !id(entry.instanceId) || entry.quantity !== 1 || entry.item?.equipment?.dnd5e?.kind !== 'weapon') ||
    value.inventory.receipts.some(row => !row || !id(row.transactionId) || !id(row.operations, 10_000)) ||
    new Set(value.inventory.receipts.map(row => row.transactionId)).size !== value.inventory.receipts.length) return false
  if (value.summons.some(row => !row || !id(row.transactionId) || !id(row.command, 2500) || !id(row.inventoryInstanceId) ||
    !nonnegative(row.pactRevision) || row.pactRevision < 1 || row.pactRevision > value.state.revision) ||
    new Set(value.summons.map(row => row.transactionId)).size !== value.summons.length) return false
  const trace=value.lifecycleTrace
  if(trace){
   if(trace.instanceId!==value.state.binding?.inventoryInstanceId||!Array.isArray(trace.rows)||trace.rows.length>10000)return false
   let previous=-1
   for(const row of trace.rows){
    if(row.confirmedOwnerDeath!==undefined&&row.confirmedOwnerDeath!==true)return false
    if(!nonnegative(row.worldSecond)||row.worldSecond<previous||!row.versions||['characters','maps','map-geometry','campaign-time'].some(key=>!nonnegative(row.versions[key]))||!row.map||!id(row.map.id)||
      !['owner','carrier','ground','unknown'].includes(row.locationKind))return false
    for(const token of [row.owner,row.location])if(token&&![token.x,token.y,token.size,token.elevationFeet??0].every(Number.isFinite))return false
    if(![row.map.gridSize,row.map.gridOffsetX,row.map.gridOffsetY,row.map.feetPerCell??5].every(Number.isFinite))return false
    previous=row.worldSecond
   }
  }
  const lifecycle=value.lifecycle??[]
  if(!Array.isArray(lifecycle)||lifecycle.length>10_000||lifecycle.some(row=>!row||!id(row.transactionId)||!id(row.command,2500)||
   !nonnegative(row.pactRevision)||row.pactRevision<1||row.pactRevision>value.state.revision||!['present','dismissed','none'].includes(row.bindingStatus))||
   new Set(lifecycle.map(row=>row.transactionId)).size!==lifecycle.length)return false
  return true
}

/** Actual gateway adapter, staged until the durable Character field and registered
 * invocation schema land. Only a current DM authority can call it; player queue
 * routing/authentication is a separate required integration, never an input flag.
 */
export async function commitPactWeaponSummon(command: PactSummonCommand, gateway: Gateway): Promise<Receipt> {
  const initialSession = getRoomSession()
  const session = initialSession ? {roomId:initialSession.roomId,memberId:initialSession.memberId,role:initialSession.role} : null
  const guard = () => {
    const current = getRoomSession()
    if (!session || session.role !== 'dm' || current?.roomId !== session.roomId || current.memberId !== session.memberId || current.role !== 'dm')
      throw Error('pact:host-room-required')
  }
  guard()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(command.transactionId) || !Number.isSafeInteger(command.expectedPactRevision) || command.expectedPactRevision < 0)
    throw Error('pact:invalid-command')
  const [loadedCharacters, loadedMaps, combat, clock, geometry] = await Promise.all([
    gateway.loadResource<Revisioned<{ characters: PactAuthorityCharacter[] }>>('characters'),
    gateway.loadResource<Revisioned<{ maps: BattleMap[] }>>('maps'),
    gateway.loadResource<Revisioned<SharedCombatState>>('combat'),
    gateway.loadResource<Revisioned<SharedCampaignTimeState>>('campaign-time'),
    gateway.loadResource<Revisioned<SharedMapGeometryState>>('map-geometry'),
  ])
  guard()
  if (!loadedCharacters || !loadedMaps || !clock || !validateSharedCampaignTime(clock)) throw Error('pact:snapshot-unavailable')
 const synchronized=reconcilePactHostClock({characters:loadedCharacters.characters,maps:loadedMaps.maps,clock,geometry:geometry?.maps??[]})
 const characters={...loadedCharacters,characters:loadedCharacters.characters.map((actor,index)=>({...actor,...synchronized.characters[index]}))},maps={...loadedMaps,maps:synchronized.maps}
  const map = maps.maps.find(row => row.id === command.mapId), token = map?.tokens.find(row => row.id === command.actorTokenId)
  const owner = characters.characters.find(row => row.id === token?.characterId)
  if (!map || !token || !owner) throw Error('pact:owner-unavailable')
  const fingerprint = JSON.stringify([command.mapId, command.actorTokenId, command.templateId ?? null, command.expectedPactRevision])
  const authority = owner.dnd5ePactWeaponAuthority
  if (authority && !validPactWeaponAuthority(authority, owner.id)) throw Error('pact:invalid-authority-record')
  const prior = authority?.summons.find(receipt => receipt.transactionId === command.transactionId)
  if (prior) {
    if (prior.command !== fingerprint) throw Error('pact:transaction-id-conflict')
    return prior
  }
  if(pactWeaponPendingSeparationInstance(owner))throw Error('pact:lifecycle-settlement-required')
  // Receipts are durable. Reaching the bound rejects new work rather than dropping
  // old receipts and making a replay issue a second physical weapon.
  if ((authority?.summons.length ?? 0) >= 10_000) throw Error('pact:receipt-capacity-reached')
  const state = authority?.state ?? emptyPactWeaponState(owner.id)
  const inventory: PactInventoryDocument = authority?.inventory ?? { schemaVersion: 1, ownerId: owner.id, revision: 0, stowed: [], receipts: [] }
  const inCombat = combat?.active === true
  if (inCombat && (combat.mapId !== map.id || combat.flowPause)) throw Error('pact:combat-unavailable')
  const economy = inCombat ? combat.dnd5eTurnEconomyByToken?.[token.id] : undefined
  if (inCombat && !economy) throw Error('pact:turn-economy-unavailable')
  const plan = planPactWeaponSummon({ characters: characters.characters, map, document: inventory, state,
    actorTokenId: token.id, templateId: command.templateId, expectedRevision: command.expectedPactRevision,
    expectedInventoryRevision: normalizeDnd5eInventory(owner).revision!, transactionId: command.transactionId,
    hostClockRevision:revision(clock,'campaign-time'),worldSecond: clock.worldMinute * 60 + (clock.worldSecondRemainder ?? 0), hostEntitlements: { improvedPactWeapon: pactWeaponHasImprovedInvocation(owner) },
    combat: inCombat ? { currentTokenId: combat.initiativeOrder[combat.initiativeIndex]?.tokenId ?? '', turnEconomy: economy! } : undefined })
  if (!plan.ok) throw Error(`pact:${plan.reason}`)
  if (!plan.state?.binding) throw Error('pact:binding-result-missing')
  const receipt: Receipt = { transactionId: command.transactionId, command: fingerprint,
    inventoryInstanceId: plan.state.binding.inventoryInstanceId, pactRevision: plan.state.revision }
  const nextCharacters = plan.characters.map(row => row.id !== owner.id ? row : { ...row,
    dnd5ePactWeaponAuthority: { schemaVersion: 1 as const, state: plan.state!, inventory: plan.document,
      summons: [...(authority?.summons ?? []), receipt],...(authority?.lifecycle?{lifecycle:authority.lifecycle}:{}) } })
  const writes = [
    { name: 'characters', expectedRevision: revision(characters, 'characters'), data: { ...characters, characters: nextCharacters } },
    { name: 'maps', expectedRevision: revision(maps, 'maps'), data: { ...maps, maps: maps.maps.map(row => row.id === map.id ? plan.map : row) } },
    ...(inCombat ? [{ name: 'combat', expectedRevision: revision(combat, 'combat'), data: { ...combat,
      dnd5eTurnEconomyByToken: { ...combat.dnd5eTurnEconomyByToken, [token.id]: plan.turnEconomy! } } }] : []),
  ]
  guard()
  try {
    await gateway.saveResourcesAtomically(writes, { transactionId: `pact-summon:${command.transactionId}`,
      readRevisions: { 'campaign-time': revision(clock, 'campaign-time'), 'map-geometry':geometry?revision(geometry,'map-geometry'):0, ...(!inCombat ? { combat: combat ? revision(combat, 'combat') : 0 } : {}) },
      undoLabel: '创造契约武器' })
    guard()
    return receipt
  } catch (error) {
    guard()
    if (/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))) {
      const saved = await gateway.loadResource<Revisioned<{ characters: PactAuthorityCharacter[] }>>('characters')
      guard()
      const persisted = saved?.characters.find(row => row.id === owner.id)?.dnd5ePactWeaponAuthority?.summons.find(row => row.transactionId === command.transactionId)
      if (JSON.stringify(persisted) === JSON.stringify(receipt)) return receipt
    }
    throw error
  }
}


import type { Token } from '../../store/maps'
import type { SceneInteractionPointReward } from '../../lib/sceneOrchestration'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eInventoryItemTemplate } from './items'
import { dnd5eMapPhysicalItemTemplate } from './mapInventoryItemAuthoring'
import { dnd5eCompanionCarriedWeightPounds, normalizeDnd5eCompanionCarriedObjects, type Dnd5eCompanionCarriedObject } from './companionCarriedObjects'
import { dnd5eCarriedLoadCapacityPounds } from './carryingCapacity'

/** Host-owned rewards. Prepare the entire delivery before spending resources or applying outcomes. */
export function prepareDnd5eCompanionSceneRewards(token: Token, actor: Dnd5eCombatant,
  rewards: readonly SceneInteractionPointReward[], receiptId: string): Dnd5eCompanionCarriedObject[] | undefined {
  const existing = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)
  if (token.dnd5eCarriedObjects?.length && !existing) return undefined
  const carried = [...(existing ?? [])]
  for (const [index, reward] of rewards.entries()) {
    const template = dnd5eInventoryItemTemplate(reward.templateId)
    if (!template || !dnd5eMapPhysicalItemTemplate(template) || typeof reward.identified !== 'boolean' ||
      !Number.isSafeInteger(reward.quantity) || reward.quantity < 1 || carried.length + reward.quantity > 1000) return undefined
    for (let unit = 0; unit < reward.quantity; unit++) {
      const pickupReceipt = `${receiptId}:reward:${index}:${unit}`
      if (pickupReceipt.length > 300 || carried.some(item => item.pickupReceipt === pickupReceipt)) return undefined
      carried.push({ id: crypto.randomUUID(), pickupReceipt, label: template.name,
        objectState: { schemaVersion: 1, wornOrCarried: true,
          inventoryItem: { templateId: template.id, quantity: 1, receiptId: pickupReceipt, identified: reward.identified } } })
    }
  }
  const capacity = dnd5eCarriedLoadCapacityPounds(actor)
  if (!Number.isFinite(capacity) || dnd5eCompanionCarriedWeightPounds(carried) > capacity * 2) return undefined
  return carried
}

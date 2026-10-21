import type { Character } from '../../types/character'
import type { Dnd5eInventoryMutation } from '../../types/inventory'
import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { reconcileDnd5eInventoryEffectBindings } from './inventoryEffectBindings'

/** Called only after a successful inventory transaction, never for attack consumption. */
export function settleDnd5eAmmunitionDrawQuota(
  before: readonly Character[], after: readonly Character[], mutation: Dnd5eInventoryMutation,
): Character[] {
  if (mutation.type !== 'set-container' && mutation.type !== 'transfer') return [...after]
  const owner = before.find(character => character.id === mutation.characterId)
  const entry = owner?.dnd5eInventory?.entries.find(item => item.instanceId === mutation.instanceId)
  if (!entry || !['arrow', 'crossbow-bolt'].includes(entry.item.ammunitionKind ?? '')) return [...after]
  const existingDraw = owner?.dnd5eCombatState?.activeEffects?.find(candidate =>
    candidate.modifiers?.weaponEnchantment?.ammunitionStack && candidate.modifiers.weaponEnchantment.inventoryInstanceId === entry.instanceId)
  if (existingDraw && mutation.type === 'set-container') return [...after]
  if (!entry.containerInstanceId && !existingDraw) return [...after]
  if (mutation.type === 'set-container' && mutation.containerInstanceId === entry.containerInstanceId) return [...after]
  const quantity = mutation.type === 'transfer' ? mutation.quantity : entry.quantity
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > entry.quantity) return [...after]
  const effect = existingDraw ?? effectiveDnd5eActiveEffects(owner?.dnd5eCombatState?.activeEffects)
    .filter(candidate => candidate.modifiers?.weaponEnchantment?.consumeOnDraw &&
      candidate.modifiers.weaponEnchantment.inventoryInstanceId === entry.containerInstanceId)
    .sort((left, right) => left.id.localeCompare(right.id))[0]
  const binding = effect?.modifiers?.weaponEnchantment
  if (!effect || !binding?.remainingAttacks) return [...after]
  const remaining = binding.remainingAttacks - quantity
  const concentration = !binding.ammunitionStack && remaining <= 0 && effect.duration.type === 'concentration' ? effect.duration : undefined
  const sourceCharacterId = effect.source.characterId ?? effect.source.actorId
  const recipientId = mutation.type === 'transfer' ? mutation.targetCharacterId : mutation.characterId
  const recipient = after.find(character => character.id === recipientId)
  const previousRecipient = before.find(character => character.id === recipientId)
  const destination = mutation.type === 'set-container' ? recipient?.dnd5eInventory?.entries.find(item => item.instanceId === entry.instanceId)
    : recipient?.dnd5eInventory?.entries.find(item => item.templateId === entry.templateId &&
      item.quantity - (previousRecipient?.dnd5eInventory?.entries.find(old => old.instanceId === item.instanceId)?.quantity ?? 0) >= quantity)
  const sourceEffectId = binding.drawSourceEffectId ?? effect.id
  const drawId = destination ? `${sourceEffectId}:draw:${destination.instanceId}` : undefined
  const drawnCount = Math.min(quantity, binding.remainingAttacks)
  const result = after.map(character => {
    const state = character.dnd5eCombatState ?? { schemaVersion: 2 as const }
    const activeEffects: Dnd5eActiveEffectInstance[] = state.activeEffects?.flatMap(candidate => {
      if (candidate.id === effect.id) return remaining > 0 ? [{ ...candidate, modifiers: {
        ...candidate.modifiers, weaponEnchantment: { ...binding, remainingAttacks: remaining },
      } }] : []
      if (concentration?.sourceActorId && candidate.duration.type === 'concentration' &&
        candidate.duration.sourceActorId === concentration.sourceActorId &&
        (candidate.duration.concentrationId ?? candidate.source.rulesId) ===
          (concentration.concentrationId ?? effect.source.rulesId)) return []
      return [candidate]
    }) ?? []
    if (destination && drawId && character.id === recipientId && !concentration) {
      const alreadyDrawn = activeEffects.find(candidate => candidate.id === drawId)
      const child: Dnd5eActiveEffectInstance = { ...structuredClone(effect), id: drawId,
        stackingKey: drawId, grantedActivities: undefined,
        modifiers: { weaponEnchantment: { ...binding, weaponId: `ammunition:${destination.instanceId}`,
          inventoryInstanceId: destination.instanceId, ammunitionContainer: undefined, consumeOnDraw: undefined,
          ammunitionStack: true, drawSourceEffectId: sourceEffectId,
          remainingAttacks: (alreadyDrawn?.modifiers?.weaponEnchantment?.remainingAttacks ?? 0) + drawnCount,
        } },
      }
      const index = activeEffects.findIndex(candidate => candidate.id === drawId)
      if (index < 0) activeEffects.push(child)
      else activeEffects[index] = child
    }
    const endsConcentration = !!concentration && character.id === sourceCharacterId &&
      state.concentrationSpellId === (concentration.concentrationId ?? effect.source.rulesId)
    return { ...character, ...(endsConcentration ? { concentrating: false } : {}), dnd5eCombatState: {
      ...state, activeEffects,
      ...(endsConcentration ? { concentrationSpellId: undefined, concentrationSpellLevel: undefined,
        concentrationRoundsRemaining: undefined, concentrationTargetIds: undefined } : {}),
    } }
  })
  return reconcileDnd5eInventoryEffectBindings(result)
}

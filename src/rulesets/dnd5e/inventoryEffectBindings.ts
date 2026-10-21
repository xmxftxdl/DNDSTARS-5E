import {ammunitionContainerSnapshots, ammunitionKindForWeaponId, dnd5eAmmunitionEntryAccessible} from './ammunitionBindings'
import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { dnd5eDestroyedMapObject } from './mapObjectCombatProfile'
import { removeDnd5eActiveEffectsByIds, projectDnd5eActiveEffectState, type Dnd5eActiveEffectInstance } from './activeEffects'

const instanceId = (effect: Dnd5eActiveEffectInstance) => effect.modifiers?.armorEnchantment?.inventoryInstanceId ?? effect.modifiers?.weaponEnchantment?.inventoryInstanceId

const suspension = 'inventory-binding:not-held'
const sourceWielderSuspension = 'inventory-binding:not-source-wielder'
/** Bind to the physical instance, including transfers; never to another copy of its template. */
export function dnd5eMapInventoryLifetimeEntries(maps: readonly BattleMap[]): Dnd5eInventoryEntry[] {
  return maps.flatMap(map => map.tokens.flatMap(token => {
    const entry = token.dnd5eObjectState?.inventoryItem?.instance
    return [
      ...(entry ? [dnd5eDestroyedMapObject(token)
        ? { ...entry, condition: { ...entry.condition, destroyed: true } } : entry,
        ...(token.dnd5eObjectState?.inventoryItem?.contents ?? [])] : []),
      ...(token.dnd5eCarriedObjects ?? []).flatMap(held => {
        const instance = held.objectState.inventoryItem?.instance
        return instance ? [instance, ...(held.objectState.inventoryItem?.contents ?? [])] : []
      }),
    ]
  }))
}

export function reconcileDnd5eInventoryEffectBindings(
  characters: readonly Character[], mapEntries: readonly Dnd5eInventoryEntry[] = [],
): Character[] {
  // A missing item may be on the ground or on an unloaded owner. Only an
  // unambiguous authoritative destroyed instance proves this lifetime ended.
  const entries = new Map<string, NonNullable<Character['dnd5eInventory']>['entries']>()
  for (const character of characters) for (const entry of character.dnd5eInventory?.entries ?? []) {
    entries.set(entry.instanceId, [...(entries.get(entry.instanceId) ?? []), entry])
  }
  for (const entry of mapEntries) entries.set(entry.instanceId, [...(entries.get(entry.instanceId) ?? []), entry])
  characters = characters.map(character => {
    const effects = character.dnd5eCombatState?.activeEffects ?? []
    const removed = effects.filter(effect => {
      const id = effect.removal?.onInventoryInstanceDestroyed
      const matches = id ? entries.get(id) : undefined
      return matches?.length === 1 && matches[0].condition?.destroyed === true
    })
    if (!removed.length) return character
    const remaining = removeDnd5eActiveEffectsByIds({effects,ids:removed.map(effect=>effect.id),allowProtectedLifecycle:true}).effects
    const projection = projectDnd5eActiveEffectState(remaining)
    return {...character,conditions:projection.conditions,dnd5eCombatState:{...character.dnd5eCombatState,schemaVersion:2,activeEffects:projection.activeEffects}}
  })
  const bindings: Dnd5eActiveEffectInstance[] = []
  const seen = new Set<string>()
  for (const character of characters) for (const effect of character.dnd5eCombatState?.activeEffects ?? []) {
    if (!instanceId(effect) || seen.has(effect.id)) continue
    seen.add(effect.id)
    bindings.push(effect)
  }
  if (!bindings.length) return [...characters]
  return characters.map(character => {
    const ordinary = (character.dnd5eCombatState?.activeEffects ?? []).filter(effect => !instanceId(effect))
    const attached = bindings.flatMap<Dnd5eActiveEffectInstance>(effect => {
      const entry = character.dnd5eInventory?.entries.find(item => item.instanceId === instanceId(effect))
      if (!entry || entry.quantity <= 0 || entry.condition?.destroyed) return []
      if (effect.modifiers?.armorEnchantment) {
        const worn = entry.equippedSlot === 'armor'
        const suspendedBy = [...(effect.suspendedBy ?? []).filter(id => id !== suspension), ...worn ? [] : [suspension]]
        return [{ ...effect, modifiers: { ...effect.modifiers, armorEnchantment: { ...effect.modifiers.armorEnchantment } }, targetId: character.id, suspendedBy: suspendedBy.length ? suspendedBy : undefined }]
      }
      const binding=effect.modifiers!.weaponEnchantment!
      if (binding.ammunitionStack) {
        const weapons = [...(character.dnd5eInventory?.entries ?? []).flatMap(item => item.item.equipment ? [item.item.equipment] : []), ...Object.values(character.equipment ?? {}).filter(item => item != null)]
        const held = dnd5eAmmunitionEntryAccessible(entry, character.dnd5eInventory!.entries)
        const suspendedBy = [...(effect.suspendedBy ?? []).filter(id => id !== suspension), ...held ? [] : [suspension]]
        return [{ ...effect, targetId: character.id, suspendedBy: suspendedBy.length ? suspendedBy : undefined,
          modifiers: { ...effect.modifiers, weaponEnchantment: { ...binding,
            remainingAttacks: Math.min(binding.remainingAttacks ?? 0, entry.quantity),
            weaponIds: [...new Set(weapons.filter(weapon => ammunitionKindForWeaponId(weapon.baseEquipmentId ?? weapon.id) === entry.item.ammunitionKind).map(weapon => weapon.id))],
          } } }]
      }
      const ammunition=binding.ammunitionContainer?ammunitionContainerSnapshots(character).find(container=>container.instanceId===entry.instanceId):undefined
      const held = binding.ammunitionContainer ? !!ammunition : entry.equippedSlot === 'mainWeapon' || entry.equippedSlot === 'offHand'
      const sourceMatches = effect.source.characterId != null
        ? effect.source.characterId === character.id : effect.source.actorId === character.id
      const suspendedBy = [...(effect.suspendedBy ?? []).filter(id => id !== suspension && id !== sourceWielderSuspension),
        ...held ? [] : [suspension], ...binding.sourceWielderOnly && !sourceMatches ? [sourceWielderSuspension] : []]
      return [{ ...effect, modifiers:{...effect.modifiers,weaponEnchantment:{...binding,...(binding.ammunitionContainer?{weaponIds:ammunition?.weaponIds??[]}: {})}}, targetId: character.id, suspendedBy: suspendedBy.length ? suspendedBy : undefined }]
    })
    if (!attached.length && ordinary.length === (character.dnd5eCombatState?.activeEffects?.length ?? 0)) return character
    return { ...character, dnd5eCombatState: { ...character.dnd5eCombatState, schemaVersion: 2, activeEffects: [...ordinary, ...attached] } }
  })
}

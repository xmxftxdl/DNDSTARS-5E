import type { Character } from '../../../types/character'
import { normalizeDnd5eInventory, dnd5eInventoryItemTemplate } from '../items'
import { dnd5eWeaponDamageSource } from '../equipment'
import type { Dnd5eActivityEquipmentSnapshotV1, Dnd5eActivityInventoryItemSnapshotV1 } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from './dnd5eActivityChoices'
import type { Dnd5eEffectModifierV1 } from './dnd5eEffectContracts'
import type { BattleMap } from '../../../store/maps'
import { restoreDnd5eInventoryItem } from '../inventoryItemAlteration'
import { expireDnd5eGroundInventoryAlterations } from '../mapInventoryAlteration'

/** Selection-only projection; it never changes the live roster or its revisions.
 * Host independently restores only leases actually ended by the committed cast. */
export function dnd5eActivityInventoryRenewalPreview(activity: Dnd5eActivityDefinitionV1, choices: Readonly<Record<string,string>> | undefined,
  actor: Character, characters: readonly Character[], map: BattleMap | undefined, sourceRulesId: string) {
  const sourceIds = new Set(dnd5eActivityInventoryAlterations(activity, choices).flatMap(operation => {
    const definition = activity.effects?.find(effect => effect.id === operation.sourceEffectId)
    return definition?.stacking === 'replace' ? [definition.id] : []
  }))
  const replacing = (actor.dnd5eCombatState?.activeEffects ?? []).filter(effect => effect.source.rulesId === sourceRulesId &&
    [...sourceIds].some(id => effect.definitionId.endsWith(`:${id}:marker`) || effect.definitionId.endsWith(`:${id}`) || effect.definitionId.includes(`:${id}:modifiers:`)))
  const tags = new Set(replacing.flatMap(effect => effect.tags?.filter(tag => tag.startsWith('item-lease:')) ?? []))
  if (!tags.size) return { characters, map }
  const projected = characters.map(character => {
    let current = character
    for (const entry of character.dnd5eInventory?.entries ?? []) {
      if (entry.sourceEffectOwnerId !== actor.id || !entry.sourceEffectTag || !tags.has(entry.sourceEffectTag)) continue
      const restored = restoreDnd5eInventoryItem(current, entry.instanceId, entry.sourceEffectTag)
      if (restored.ok) current = restored.character
    }
    return current === character ? character : { ...current, dnd5eInventory: { ...current.dnd5eInventory!, revision: character.dnd5eInventory?.revision ?? 0 } }
  })
  const projectedActor = { ...actor, dnd5eCombatState: { ...actor.dnd5eCombatState,
    activeEffects: actor.dnd5eCombatState?.activeEffects?.filter(effect => !replacing.includes(effect)) } }
  return { characters: projected, map: map ? expireDnd5eGroundInventoryAlterations(map, [projectedActor]) : map }
}

function selectedOutcomes(activity: Dnd5eActivityDefinitionV1, choices?: Readonly<Record<string, string>>) {
  const selected = Object.fromEntries((activity.choices ?? []).flatMap(choice => {
    const value = choices?.[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id
    return value == null ? [] : [[choice.id, value]]
  }))
  return activity.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, selected))
}

export function dnd5eActivityInventoryAlterations(activity: Dnd5eActivityDefinitionV1, choices?: Readonly<Record<string, string>>) {
  return selectedOutcomes(activity, choices).flatMap(outcome => outcome.operations.filter(operation => operation.kind === 'alter-inventory-item'))
}

function inventoryBindingOperations(activity: Dnd5eActivityDefinitionV1, choices?: Readonly<Record<string, string>>) {
  return selectedOutcomes(activity, choices)
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'apply-effect'
      ? (activity.effects?.find(effect => effect.id === operation.effectId)?.modifiers ?? [])
        .filter((modifier): modifier is Extract<Dnd5eEffectModifierV1, {kind:'weapon-enchantment'|'armor-enchantment'}> =>
          modifier.kind === 'weapon-enchantment' && modifier.weaponSlot === 'inventory-item' ||
          modifier.kind === 'armor-enchantment' && modifier.itemSelection === 'inventory-item')
        .map(modifier => ({target:operation.target, modifier})) : []))
}

export function dnd5eActivitySelectsInventoryItem(activity: Dnd5eActivityDefinitionV1, choices?: Readonly<Record<string, string>>): boolean {
  return dnd5eActivitySelectsEquipmentItem(activity, choices) || dnd5eActivityInventoryAlterations(activity, choices).length > 0
}

export function dnd5eActivitySelectsEquipmentItem(activity: Dnd5eActivityDefinitionV1, choices?: Readonly<Record<string, string>>): boolean {
  return inventoryBindingOperations(activity, choices).length > 0
}

/** UI candidates follow the same chosen outcome and effect recipient as execution. */
export function dnd5eActivityInventorySelectionOptions(activity: Dnd5eActivityDefinitionV1, choices: Readonly<Record<string,string>> | undefined, actor: Character, targets: readonly Character[]) {
  const candidates = inventoryBindingOperations(activity, choices).flatMap(({target,modifier}) => {
    const owners = target === 'actor' ? [actor] : targets
    return owners.flatMap(owner => {
      const inventory = normalizeDnd5eInventory(owner)
      const eligible = dnd5eActivityInventorySnapshot(owner).items.filter(item => item.kind === (modifier.kind === 'weapon-enchantment' ? 'weapon' : 'armor'))
      const local = eligible.map(item => {
        const entry = inventory.entries.find(candidate => candidate.instanceId === item.inventoryInstanceId)!
        return {id:JSON.stringify([owner.id,entry.instanceId]), ownerId:owner.id, instanceId:entry.instanceId,
          revision:inventory.revision??0, label:`${owner.name} · ${entry.item.name}`, equipped:entry.equippedSlot != null}
      })
      // Public hints expose no templates, names, bonuses or private inventory.
      // Only the selected identity/revision travels back; Host resolves real facts.
      const hints = (owner.dnd5eExposedEnchantmentItems ?? []).filter(item =>
        item.kind === (modifier.kind === 'weapon-enchantment' ? 'weapon' : 'armor') &&
        !local.some(option => option.instanceId === item.instanceId))
      return [...local, ...hints.map((item,index) => ({id:JSON.stringify([owner.id,item.instanceId]),ownerId:owner.id,
        instanceId:item.instanceId,revision:item.revision,equipped:item.equipped,
        label:`${owner.name} · 出示的${item.kind === 'armor' ? '护甲' : '武器'} ${index+1}`}))]
    })
  })
  const alterations = dnd5eActivityInventoryAlterations(activity, choices)
  if (alterations.length) {
    const owners = [...new Map(alterations.flatMap(operation => operation.target === 'actor' && operation.selectionRangeFeet == null ? [actor] : targets)
      .map(owner => [owner.id, owner])).values()]
    for (const owner of owners) {
      const ownerAlterations = alterations.filter(operation => operation.target === 'actor' && operation.selectionRangeFeet == null ? owner.id === actor.id : targets.some(target => target.id === owner.id))
      const inventory = normalizeDnd5eInventory(owner)
      for (const entry of inventory.entries) {
        const original = owner.dnd5eInventory?.entries.find(candidate => candidate.instanceId === entry.instanceId)
        if (entry.quantity < 1 || entry.condition?.destroyed || entry.spellAlteration || entry.sourceEffectTag ||
            entry.linkedSpellAuthorityRecordId || entry.linkedSpellFocusAuthorityRecordId || entry.item.category === 'container' ||
            Object.keys(entry.resources ?? {}).length || entry.remainingCharges != null || original?.remainingCharges != null || entry.attuned || entry.attunementPending ||
            !ownerAlterations.every(operation => operation.originalTemplateIds.includes(entry.templateId) &&
              (operation.quantity.kind !== 'constant' || entry.quantity >= operation.quantity.value &&
                (!entry.equippedSlot || entry.quantity === operation.quantity.value)))) continue
        candidates.push({ id: JSON.stringify([owner.id, entry.instanceId]), ownerId: owner.id, instanceId: entry.instanceId,
          revision: inventory.revision ?? 0, label: `${owner.name} · ${entry.item.name} × ${entry.quantity}`, equipped: entry.equippedSlot != null })
      }
    }
  }
  return [...new Map(candidates.map(candidate => [candidate.id,candidate])).values()]
}

/** Project only usable physical equipment, never trust an item description in an action. */
export function dnd5eActivityInventorySnapshot(character: Character): NonNullable<Dnd5eActivityEquipmentSnapshotV1['inventory']> {
  const inventory = normalizeDnd5eInventory(character)
  const items = inventory.entries.flatMap<Omit<Dnd5eActivityInventoryItemSnapshotV1, 'ownerActorId'>>(entry => {
    const equipment = entry.item.equipment
    const kind = equipment?.dnd5e?.kind
    if (!equipment || (kind !== 'weapon' && kind !== 'armor') || entry.quantity < 1 || entry.condition?.destroyed) return []
    // Only physical simple/martial weapons have inventory enchantment identity.
    // Natural/unarmed profiles are attacks, not selectable inventory equipment.
    if (equipment.dnd5e?.kind === 'weapon' && !['simple', 'martial'].includes(equipment.dnd5e.category)) return []
    return [{kind, itemId: equipment.id, inventoryInstanceId: entry.instanceId,
      weaponId: kind === 'weapon' ? equipment.id : undefined,
      ...(kind === 'weapon' ? { weaponBaseId: equipment.baseEquipmentId ?? equipment.id, intrinsicAttackBonus: equipment.effects?.weaponAttackBonus ?? 0, intrinsicDamageBonus: equipment.effects?.weaponDamageBonus ?? 0 } : {}),
      roles: kind === 'weapon' ? ['weapon'] : ['other'],
      magical: entry.item.magicItem != null || entry.item.category === 'magic-item' ||
        (kind === 'weapon' ? dnd5eWeaponDamageSource(equipment)?.magical === true : equipment.dnd5e?.kind === 'armor' && equipment.dnd5e.magical === true),
    }]
  })
  return {revision: inventory.revision ?? 0, items}
}

export function dnd5eActivityExchangeOutputAllowed(id: string,
  source: import('../inventoryExchange').Dnd5eInventoryExchangeTemplateSource,
  policy: import('../inventoryExchange').Dnd5eInventoryExchangePolicy): boolean {
  const item = dnd5eInventoryItemTemplate(id)
  return !!item && !item.magicItem && !item.headlessEffects?.length &&
    policy.outputTags.every(tag => item.spellcastingMaterial?.tags.includes(tag)) &&
    (source === 'registered-ammunition' ? !!item.ammunitionKind : !item.ammunitionKind)
}

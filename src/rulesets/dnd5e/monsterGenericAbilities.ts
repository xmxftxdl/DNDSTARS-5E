import type {
  Dnd5eDamageType,
  Dnd5eMonsterAction,
  Dnd5eMonsterStatBlock,
  Dnd5eMonsterTrait,
  Dnd5eMonsterWeaponAttack,
} from './monsters'

export type Dnd5eMonsterGenericAbilityId =
  | 'pack-tactics'
  | 'multiattack'
  | 'legendary-resistance'
  | 'legendary-actions'
  | 'regeneration'
  | 'swarm'
  | 'recharge'
  | 'spellcasting'

export interface Dnd5eMonsterGenericAbility {
  id: Dnd5eMonsterGenericAbilityId
  name: string
  automation: 'headless' | 'dm-adjudication'
}

const DEFINITIONS: Record<Dnd5eMonsterGenericAbilityId, Omit<Dnd5eMonsterGenericAbility, 'id'>> = {
  'pack-tactics': { name: '集群战术', automation: 'headless' },
  multiattack: { name: '多重攻击', automation: 'headless' },
  'legendary-resistance': { name: '传奇抗性', automation: 'headless' },
  'legendary-actions': { name: '传奇动作', automation: 'headless' },
  regeneration: { name: '再生', automation: 'headless' },
  swarm: { name: '群集', automation: 'headless' },
  recharge: { name: '充能能力', automation: 'headless' },
  spellcasting: { name: '施法', automation: 'headless' },
}

function traitMatches(monster: Dnd5eMonsterStatBlock, pattern: RegExp): boolean {
  return monster.traits.some((trait) => pattern.test(trait.name))
}

export function dnd5eMonsterHasGenericAbility(
  monster: Dnd5eMonsterStatBlock,
  abilityId: Dnd5eMonsterGenericAbilityId,
): boolean {
  if (abilityId === 'pack-tactics') return traitMatches(monster, /集群战术|pack tactics/i)
  if (abilityId === 'multiattack') return monster.actions.some((action) => action.kind === 'multiattack')
  if (abilityId === 'legendary-resistance') {
    return (monster.legendaryResistanceUses ?? 0) > 0 || traitMatches(monster, /传奇抗性|legendary resistance/i)
  }
  if (abilityId === 'legendary-actions') return (monster.legendaryActions?.length ?? 0) > 0
  if (abilityId === 'regeneration') return monster.capabilities?.regeneration === true || traitMatches(monster, /再生|regeneration/i)
  if (abilityId === 'swarm') return monster.capabilities?.swarm === true || /群集|swarm/i.test(monster.creatureType)
  if (abilityId === 'recharge') {
    return [...monster.actions, ...monster.legendaryActions ?? [], ...monster.lairActions ?? []]
      .some((action) => /充能|recharge/i.test(`${action.name} ${action.description}`))
  }
  return monster.spellcasting != null || monster.capabilities?.spellcaster === true
}

export function dnd5eMonsterGenericAbilities(monster: Dnd5eMonsterStatBlock): readonly Dnd5eMonsterGenericAbility[] {
  return (Object.keys(DEFINITIONS) as Dnd5eMonsterGenericAbilityId[])
    .filter((id) => dnd5eMonsterHasGenericAbility(monster, id))
    .map((id) => ({ id, ...DEFINITIONS[id] }))
}

export function dnd5eMonsterRegenerationRule(
  monster: Dnd5eMonsterStatBlock | undefined,
): Extract<NonNullable<Dnd5eMonsterTrait['rule']>, { kind: 'regeneration' }> | undefined {
  return monster?.traits.find((trait) => trait.rule?.kind === 'regeneration')?.rule as
    Extract<NonNullable<Dnd5eMonsterTrait['rule']>, { kind: 'regeneration' }> | undefined
}

export function dnd5eMonsterIsSwarm(monster: Dnd5eMonsterStatBlock | undefined): boolean {
  return monster?.traits.some((trait) => trait.rule?.kind === 'swarm') === true
}

export function dnd5eMonsterEffectiveWeaponAttack(
  attack: Dnd5eMonsterWeaponAttack,
  currentHp: number,
  maxHp: number,
): Dnd5eMonsterWeaponAttack {
  return attack.damageAtHalfHp && currentHp <= maxHp / 2
    ? { ...attack, damage: attack.damageAtHalfHp }
    : attack
}

export function dnd5eMonsterHasMagicResistance(
  monster: Dnd5eMonsterStatBlock | undefined,
): boolean {
  return monster?.traits.some((trait) =>
    trait.rule?.kind === 'magic-resistance' ||
    /魔法抗性|magic resistance/i.test(trait.name)) === true
}

export function dnd5eMonsterWeaponAttackAgainstConditions(
  monster: Dnd5eMonsterStatBlock,
  attack: Dnd5eMonsterWeaponAttack,
  targetConditions: readonly string[],
): Dnd5eMonsterWeaponAttack {
  const normalizedConditions = new Set(targetConditions.map((condition) => condition.trim().toLowerCase()))
  const bonuses = monster.traits.flatMap((trait) =>
    trait.rule?.kind === 'conditional-target-bonus' &&
    trait.rule.targetConditions.some((condition) => normalizedConditions.has(condition.toLowerCase()))
      ? [trait.rule]
      : [])
  if (bonuses.length === 0) return attack
  const attackBonus = bonuses.reduce((sum, bonus) => sum + bonus.attackBonus, 0)
  const damageBonus = bonuses.reduce((sum, bonus) => sum + bonus.damageBonus, 0)
  return {
    ...attack,
    toHit: attack.toHit + attackBonus,
    damage: attack.damage.map((component, index) =>
      index === 0 ? { ...component, bonus: component.bonus + damageBonus } : component),
  }
}

export function dnd5eMonsterRechargeActions(monster: Dnd5eMonsterStatBlock | undefined): readonly Dnd5eMonsterAction[] {
  if (!monster) return []
  return [
    ...monster.actions,
    ...monster.bonusActions ?? [],
    ...monster.reactions ?? [],
    ...monster.legendaryActions ?? [],
    ...monster.lairActions ?? [],
  ]
    .filter((action) => action.usage?.kind === 'recharge')
}

export function dnd5eMonsterRegenerationSuppressed(
  monster: Dnd5eMonsterStatBlock | undefined,
  damageTypes: readonly Dnd5eDamageType[] | undefined,
): boolean {
  const rule = dnd5eMonsterRegenerationRule(monster)
  return !!rule && (damageTypes ?? []).some((type) => rule.suppressedByDamageTypes.includes(type))
}

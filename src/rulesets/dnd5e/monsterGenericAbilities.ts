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
  | 'magic-weapons'

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
  'magic-weapons': { name: '魔法武器', automation: 'headless' },
}

function traitMatches(monster: Dnd5eMonsterStatBlock, pattern: RegExp): boolean {
  return monster.traits.some((trait) => pattern.test(trait.name))
}

export function dnd5eMonsterHasGenericAbility(
  monster: Dnd5eMonsterStatBlock,
  abilityId: Dnd5eMonsterGenericAbilityId,
): boolean {
  if (abilityId === 'pack-tactics') {
    return dnd5eMonsterPackTacticsRule(monster) != null ||
      traitMatches(monster, /集群战术|pack tactics/i)
  }
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
  if (abilityId === 'magic-weapons') return dnd5eMonsterWeaponAttacksAreMagical(monster)
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

export type Dnd5eMonsterPackTacticsRule = Extract<
  NonNullable<Dnd5eMonsterTrait['rule']>,
  { kind: 'pack-tactics' }
>

export interface Dnd5eMonsterPackTacticsCandidate {
  id: string
  alliedWithActor: boolean
  currentHp: number
  incapacitated: boolean
  distanceFeetToTarget: number
}

export function dnd5eMonsterPackTacticsRule(
  monster: Dnd5eMonsterStatBlock | undefined,
): Dnd5eMonsterPackTacticsRule | undefined {
  const structured = monster?.traits.find((trait) => trait.rule?.kind === 'pack-tactics')?.rule as
    Dnd5eMonsterPackTacticsRule | undefined
  if (structured) return structured
  return monster?.traits.some((trait) => /集群战术|pack tactics/i.test(trait.name))
    ? {
        kind: 'pack-tactics',
        allyDistanceFeet: 5,
        requiresAllyNotIncapacitated: true,
      }
    : undefined
}

export function dnd5eMonsterPackTacticsApplies(input: {
  monster: Dnd5eMonsterStatBlock | undefined
  actorId: string
  targetId: string
  candidates: readonly Dnd5eMonsterPackTacticsCandidate[]
}): boolean {
  const rule = dnd5eMonsterPackTacticsRule(input.monster)
  if (!rule) return false
  return input.candidates.some((candidate) =>
    candidate.id !== input.actorId &&
    candidate.id !== input.targetId &&
    candidate.alliedWithActor &&
    candidate.currentHp > 0 &&
    (!rule.requiresAllyNotIncapacitated || !candidate.incapacitated) &&
    Number.isFinite(candidate.distanceFeetToTarget) &&
    candidate.distanceFeetToTarget <= rule.allyDistanceFeet)
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

export interface Dnd5eMonsterAttackTraitContext {
  combatId: string
  round: number
  targetCurrentHp: number
  targetMaxHp: number
  targetSurprisedCombatId?: string
  targetSurpriseResolvedCombatId?: string
  /** Set only after the authoritative turn-start lifecycle activates Reckless. */
  actorRecklessActive?: boolean
}

function dnd5eMonsterTargetIsCurrentlySurprised(
  context: Dnd5eMonsterAttackTraitContext,
): boolean {
  return context.targetSurprisedCombatId === context.combatId &&
    context.targetSurpriseResolvedCombatId !== context.combatId
}

export type Dnd5eMonsterRecklessRule = Extract<
  NonNullable<Dnd5eMonsterTrait['rule']>,
  { kind: 'reckless' }
>

export function dnd5eMonsterRecklessRule(
  monster: Dnd5eMonsterStatBlock | undefined,
): Dnd5eMonsterRecklessRule | undefined {
  return monster?.traits.find((trait) =>
    trait.automation === 'headless' && trait.rule?.kind === 'reckless')?.rule as
    Dnd5eMonsterRecklessRule | undefined
}

/**
 * Returns authoritative advantage granted by target-dependent SRD traits.
 * The attack must already be reduced from `melee-or-ranged` to its concrete
 * distance-specific mode.
 */
export function dnd5eMonsterAttackTraitAdvantage(
  monster: Dnd5eMonsterStatBlock | undefined,
  attack: Dnd5eMonsterWeaponAttack,
  context: Dnd5eMonsterAttackTraitContext,
): boolean {
  if (!monster) return false
  const currentlySurprised = context.round === 1 &&
    dnd5eMonsterTargetIsCurrentlySurprised(context)
  return monster.traits.some((trait) => {
    if (trait.automation !== 'headless') return false
    if (trait.rule?.kind === 'blood-frenzy') {
      return attack.mode === trait.rule.attackMode &&
        context.targetCurrentHp < context.targetMaxHp
    }
    if (trait.rule?.kind === 'ambusher-attack-advantage') {
      return context.round === trait.rule.requiredRound && currentlySurprised
    }
    if (trait.rule?.kind === 'reckless') {
      return context.actorRecklessActive === true &&
        attack.mode === trait.rule.outgoing.mode
    }
    return false
  })
}

/**
 * Appends target-triggered damage components without mutating catalog data.
 * Surprise Attack intentionally applies to every qualifying hit; Multiattack
 * callers invoke this once for each concrete child attack.
 */
export function dnd5eMonsterWeaponAttackWithTriggeredTraits(
  monster: Dnd5eMonsterStatBlock | undefined,
  attack: Dnd5eMonsterWeaponAttack,
  context: Dnd5eMonsterAttackTraitContext,
): Dnd5eMonsterWeaponAttack {
  if (
    !monster ||
    context.round !== 1 ||
    !dnd5eMonsterTargetIsCurrentlySurprised(context)
  ) return attack
  const rules = monster.traits.flatMap((trait) =>
    trait.automation === 'headless' &&
    trait.rule?.kind === 'surprise-attack' &&
    context.round === trait.rule.requiredRound
      ? [trait.rule]
      : [])
  if (rules.length === 0) return attack
  const inheritedType = attack.damage[0]?.type
  if (!inheritedType) return attack
  return {
    ...attack,
    damage: [
      ...attack.damage,
      ...rules.map((rule) => ({
        average: rule.extraDamage.average,
        count: rule.extraDamage.count,
        sides: rule.extraDamage.sides,
        bonus: rule.extraDamage.bonus,
        type: inheritedType,
      })),
    ],
  }
}

export type Dnd5eMonsterParryRule = Extract<
  NonNullable<Dnd5eMonsterAction['rule']>,
  { kind: 'parry' }
>

export function dnd5eMonsterParryRule(
  monster: Dnd5eMonsterStatBlock | undefined,
): Dnd5eMonsterParryRule | undefined {
  return monster?.reactions?.find((reaction) =>
    reaction.automation === 'headless' &&
    reaction.id === 'parry' &&
    reaction.rule?.kind === 'parry')?.rule as Dnd5eMonsterParryRule | undefined
}

export function dnd5eMonsterHasReactive(
  monster: Dnd5eMonsterStatBlock | undefined,
): boolean {
  return monster?.traits.some((trait) =>
    trait.automation === 'headless' &&
    trait.rule?.kind === 'reactive' &&
    trait.rule.reactionRefresh === 'every-turn-start') === true
}

/**
 * Resolves a hybrid weapon attack to the concrete mode used at an
 * authoritative distance, unless a parent Multiattack explicitly restricts
 * its hybrid child attacks to one mode. Call this after HP-dependent damage
 * selection and before target-condition modifiers so every consumer validates
 * and rolls the same damage expression.
 */
export function dnd5eMonsterWeaponAttackAtDistance(
  attack: Dnd5eMonsterWeaponAttack,
  distanceFeet: number,
  forcedMode?: 'melee' | 'ranged',
): Dnd5eMonsterWeaponAttack {
  if (attack.mode !== 'melee-or-ranged') return attack
  const usesRangedAttack = forcedMode
    ? forcedMode === 'ranged'
    : Number.isFinite(distanceFeet) && distanceFeet > (attack.reachFeet ?? 5)
  const { rangedDamage, ...baseAttack } = attack
  return {
    ...baseAttack,
    mode: usesRangedAttack ? 'ranged' : 'melee',
    damage: usesRangedAttack && rangedDamage ? rangedDamage : attack.damage,
  }
}

export function dnd5eMonsterHasMagicResistance(
  monster: Dnd5eMonsterStatBlock | undefined,
): boolean {
  return monster?.traits.some((trait) =>
    trait.rule?.kind === 'magic-resistance' ||
    trait.rule?.kind === 'limited-magic-immunity' ||
    /魔法抗性|magic resistance/i.test(trait.name)) === true
}

export type Dnd5eLimitedMagicImmunityRule = Extract<
  NonNullable<Dnd5eMonsterStatBlock['traits'][number]['rule']>,
  { kind: 'limited-magic-immunity' }
>

export type Dnd5eLimitedMagicImmunitySpellTarget = 'hostile' | 'ally' | 'creature' | 'area'

export function dnd5eMonsterLimitedMagicImmunityRule(
  monster: Dnd5eMonsterStatBlock | undefined,
): Dnd5eLimitedMagicImmunityRule | undefined {
  return monster?.traits
    .map((trait) => trait.rule)
    .find((rule): rule is Dnd5eLimitedMagicImmunityRule =>
      rule?.kind === 'limited-magic-immunity')
}

export function dnd5eLimitedMagicImmunityNegatesSpell(input: {
  rule: Dnd5eLimitedMagicImmunityRule | undefined
  spellLevel: number
  target: Dnd5eLimitedMagicImmunitySpellTarget
  /** Must be inferred by the authoritative host, never accepted from a hostile client payload. */
  willing: boolean
}): boolean {
  if (!input.rule || input.spellLevel > input.rule.maximumSpellLevel) return false
  const mayBeWilling = input.target === 'ally' || input.target === 'creature'
  return !(input.rule.allowsWilling && input.willing && mayBeWilling)
}

export function dnd5eMonsterWeaponAttacksAreMagical(
  monster: Dnd5eMonsterStatBlock | undefined,
): boolean {
  return monster?.traits.some((trait) =>
    trait.rule?.kind === 'magic-weapons' ||
    /^(?:魔法武器|天使武器|地狱武器|炼狱武器|magic weapons|angelic weapons|hellish weapons)$/i
      .test(trait.name.trim())) === true
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

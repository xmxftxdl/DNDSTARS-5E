import type { Dnd5eMonsterStatBlock } from './monsters'

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
  'legendary-actions': { name: '传奇动作', automation: 'dm-adjudication' },
  regeneration: { name: '再生', automation: 'dm-adjudication' },
  swarm: { name: '群集', automation: 'dm-adjudication' },
  recharge: { name: '充能能力', automation: 'dm-adjudication' },
  spellcasting: { name: '施法', automation: 'dm-adjudication' },
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

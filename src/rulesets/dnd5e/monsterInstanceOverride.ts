import type { Token } from '../../store/maps'
import { creatureSizeToTokenSize } from '../../lib/monsterTypes'
import { DND5E_SRD_MONSTERS, dnd5eMonsterWeaponAttackAbility, type Dnd5eMonsterAction, type Dnd5eMonsterDamage, type Dnd5eMonsterStatBlock } from './monsters'

function updateAttackDescription(description: string, oldAction: Dnd5eMonsterAction, action: Dnd5eMonsterAction): string {
  if (!oldAction.attack || !action.attack) return description
  const hit = action.attack.toHit
  return description
    .replace(/(命中\s*)[+-]?\d+/, `$1${hit >= 0 ? '+' : ''}${hit}`)
    .replace(/[+-]?\d+(\s+to hit)/i, `${hit >= 0 ? '+' : ''}${hit}$1`)
    .replace(/\d+\s*[（(]\s*(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\s*[）)]/g,
      (text, count, sides, sign, bonus) => {
        const oldDamage = [...oldAction.attack!.damage, ...(oldAction.attack!.rangedDamage ?? []), ...(oldAction.attack!.damageAtHalfHp ?? [])]
        const newDamage = [...action.attack!.damage, ...(action.attack!.rangedDamage ?? []), ...(action.attack!.damageAtHalfHp ?? [])]
        const index = oldDamage.findIndex(damage => damage.count === Number(count) && damage.sides === Number(sides) &&
          damage.bonus === (bonus ? Number(bonus) * (sign === '-' ? -1 : 1) : 0))
        const damage = newDamage[index]
        return damage ? `${damage.average} (${damage.count}d${damage.sides}${damage.bonus ? ` ${damage.bonus > 0 ? '+' : '-'} ${Math.abs(damage.bonus)}` : ''})` : text
      })
}

export type Dnd5eMonsterOverrideScope = 'instance' | 'same-template'

const OVERRIDE_PREFIX = 'room-monster:dm-override-'
const LEGACY_OVERRIDE_PREFIX = 'room-monster:dm-override:'

/** Inline edits always fork by token, including formerly shared overrides. */
export function updateDnd5eMonsterInstanceAbility(
  monster: Dnd5eMonsterStatBlock,
  tokenId: string,
  ability: keyof Dnd5eMonsterStatBlock['abilities'],
  score: number,
): Dnd5eMonsterStatBlock {
  if (!Number.isInteger(score) || score < 1 || score > 30) throw new Error('属性值须为 1–30 的整数。')
  const key = safeOverrideKey(`token-${tokenId}`)
  const original = isDnd5eMonsterInstanceOverride(monster.id)
    ? DND5E_SRD_MONSTERS.find(candidate => candidate.englishName === monster.englishName)
    : undefined
  const updateActions = (actions: readonly Dnd5eMonsterAction[] | undefined, originals?: readonly Dnd5eMonsterAction[]) => actions?.map(action => {
    if (!action.attack) return action
    // Recover untouched attacks from overrides saved before derived numbers
    // were updated; their stored ability score already differs from the SRD.
    const originalAction = originals?.find(candidate => candidate.id === action.id)
    const basis = original && originalAction && JSON.stringify(originalAction.attack) === JSON.stringify(action.attack) ? original : monster
    const attackAbility = dnd5eMonsterWeaponAttackAbility(basis, action.attack)
    const delta = Math.floor((score - 10) / 2) - Math.floor((basis.abilities[ability] - 10) / 2)
    const updateDamage = (damage: readonly Dnd5eMonsterDamage[] | undefined) => damage?.map((part, index) => {
      const change = part.modifierFormula
        ? part.modifierFormula.terms.reduce((sum, term) => sum + (term.kind === 'ability-modifier' && term.ability === ability ? delta * (term.multiplier ?? 1) : 0), 0)
        : index === 0 && attackAbility === ability ? delta : 0
      return change ? { ...part, bonus: part.bonus + change, average: Math.max(0, Math.floor(part.count * (part.sides + 1) / 2 + part.bonus + change)) } : part
    })
    const next = { ...action, attack: {
      ...action.attack,
      attackAbility,
      toHit: action.attack.toHit + (attackAbility === ability ? delta : 0),
      damage: updateDamage(action.attack.damage)!,
      rangedDamage: updateDamage(action.attack.rangedDamage),
      damageAtHalfHp: updateDamage(action.attack.damageAtHalfHp),
    } }
    return { ...next, description: updateAttackDescription(action.description, action, next) }
  })
  return {
    ...structuredClone(monster),
    id: `${OVERRIDE_PREFIX}${key}`,
    slug: `dm-override-${key}`,
    source: 'DM 自定义',
    abilities: { ...monster.abilities, [ability]: score },
    actions: updateActions(monster.actions, original?.actions)!,
    bonusActions: updateActions(monster.bonusActions, original?.bonusActions),
    reactions: updateActions(monster.reactions, original?.reactions),
    legendaryActions: updateActions(monster.legendaryActions, original?.legendaryActions),
    lairActions: updateActions(monster.lairActions, original?.lairActions),
  }
}

function safeOverrideKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return (normalized || 'monster').slice(0, 80)
}

export function isDnd5eMonsterInstanceOverride(monsterId: string | undefined): boolean {
  return monsterId?.startsWith(OVERRIDE_PREFIX) === true ||
    monsterId?.startsWith(LEGACY_OVERRIDE_PREFIX) === true
}

export function dnd5eMonsterOverrideSaveMatchesEditRequest(input: {
  requestedMonsterId: string
  savedMonsterId: string
}): boolean {
  return input.requestedMonsterId === input.savedMonsterId
}

export function createDnd5eMonsterInstanceOverride(input: {
  monster: Dnd5eMonsterStatBlock
  tokenId: string
  scope: Dnd5eMonsterOverrideScope
}): Dnd5eMonsterStatBlock {
  if (input.monster.id.startsWith(OVERRIDE_PREFIX)) return structuredClone(input.monster)
  if (input.monster.id.startsWith(LEGACY_OVERRIDE_PREFIX)) {
    const key = safeOverrideKey(input.monster.id.slice(LEGACY_OVERRIDE_PREFIX.length))
    return {
      ...structuredClone(input.monster),
      id: `${OVERRIDE_PREFIX}${key}`,
      slug: `dm-override-${key}`,
      source: 'DM 自定义',
    }
  }
  const identity = input.scope === 'instance'
    ? `token-${input.tokenId}`
    : `template-${input.monster.id}-anchor-${input.tokenId}`
  const key = safeOverrideKey(identity)
  return {
    ...structuredClone(input.monster),
    id: `${OVERRIDE_PREFIX}${key}`,
    slug: `dm-override-${key}`,
    source: 'DM 自定义',
  }
}

export function dnd5eMonsterOverrideTargets(input: {
  tokens: readonly Token[]
  selectedTokenId: string
  sourceMonsterId: string
  scope: Dnd5eMonsterOverrideScope
}): Token[] {
  if (input.scope === 'instance') {
    const selected = input.tokens.find((token) => token.id === input.selectedTokenId)
    return selected ? [selected] : []
  }
  return input.tokens.filter((token) =>
    token.type === 'enemy' && token.poolId === input.sourceMonsterId)
}

export interface Dnd5eMonsterOverrideTokenPatch {
  poolId: string
  hp: number
  maxHp: number
  creatureSize: Dnd5eMonsterStatBlock['size']
  size: number
}

export function dnd5eMonsterOverrideTokenPatch(input: {
  monster: Dnd5eMonsterStatBlock
  currentHp: number
}): Dnd5eMonsterOverrideTokenPatch {
  const maxHp = input.monster.hitPoints.average
  return {
    poolId: input.monster.id,
    hp: Math.max(0, Math.min(Math.floor(input.currentHp), maxHp)),
    maxHp,
    creatureSize: input.monster.size,
    size: creatureSizeToTokenSize(input.monster.size),
  }
}

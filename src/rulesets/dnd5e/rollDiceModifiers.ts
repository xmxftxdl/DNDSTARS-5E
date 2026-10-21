import {normalizeDnd5eRollDiceModifiers, type Dnd5eRollDiceKind, type Dnd5eRollDiceModifier} from '../../../shared/roll-dice-modifiers.mjs'
export {normalizeDnd5eRollDiceModifiers}
export type {Dnd5eRollDiceKind, Dnd5eRollDiceModifier}

const kinds = new Set(['attack', 'ability-check', 'saving-throw', 'concentration-save'])

export interface Dnd5eRollDiceRecipe extends Dnd5eRollDiceModifier {
  id: string
  effectId: string
}

interface EffectWithRollDice {
  id: string
  appliedAt?: number
  suspendedBy?: readonly string[]
  modifiers?: { rollDiceModifiers?: readonly Dnd5eRollDiceModifier[] }
}

/** The caller supplies a Host-owned event identity, unique for each actual d20 roll. */
export function dnd5eRollDiceRecipes(input: {
  effects: readonly EffectWithRollDice[] | undefined
  actorId: string
  eventId: string
  kind: Dnd5eRollDiceKind
}): readonly Dnd5eRollDiceRecipe[] {
  if (!input.actorId || !input.eventId || !kinds.has(input.kind)) throw new RangeError('roll-dice-context-invalid')
  const ids = new Set<string>()
  const recipes: Dnd5eRollDiceRecipe[] = []
  for (const effect of input.effects ?? []) {
    if (effect.suspendedBy?.length || effect.modifiers?.rollDiceModifiers == null) continue
    if (!effect.id || ids.has(effect.id)) throw new RangeError('roll-dice-effect-id-invalid')
    ids.add(effect.id)
    const modifiers = normalizeDnd5eRollDiceModifiers(effect.modifiers.rollDiceModifiers)
    if (!modifiers) throw new RangeError('roll-dice-modifiers-invalid')
    modifiers.forEach((modifier, index) => {
      const applies = modifier.appliesTo.includes(input.kind) ||
        input.kind === 'concentration-save' && modifier.appliesTo.includes('saving-throw')
      if (!applies) return
      recipes.push({...modifier, effectId: effect.id,
        id: JSON.stringify(['effect-roll-dice', input.actorId, input.eventId, input.kind, effect.id,
          effect.appliedAt ?? null, index, modifier])})
    })
  }
  return recipes
}

/** Rebuild from current Host effects; reject missing, stale, extra or malformed dice atomically. */
export function resolveDnd5eRollDiceModifiers(
  input: Parameters<typeof dnd5eRollDiceRecipes>[0],
  rolls: Readonly<Record<string, readonly number[]>> | undefined,
): { modifier: number; audit: readonly {id: string; effectId: string; values: readonly number[]; amount: number}[] } {
  const recipes = dnd5eRollDiceRecipes(input)
  const expected = new Set(recipes.map(recipe => recipe.id))
  if (rolls != null && (typeof rolls !== 'object' || Array.isArray(rolls) ||
    Object.keys(rolls).some(id => !expected.has(id)))) throw new RangeError('roll-dice-unexpected')
  const audit = recipes.map(recipe => {
    const values = rolls && Object.hasOwn(rolls, recipe.id) ? rolls[recipe.id] : undefined
    if (!Array.isArray(values) || values.length !== recipe.count ||
      values.some(value => !Number.isInteger(value) || value < 1 || value > recipe.sides)) {
      throw new RangeError('roll-dice-missing-or-invalid')
    }
    return {id: recipe.id, effectId: recipe.effectId, values: [...values],
      amount: values.reduce((sum, value) => sum + value, 0) * (recipe.direction === 'add' ? 1 : -1)}
  })
  return {modifier: audit.reduce((sum, item) => sum + item.amount, 0), audit}
}

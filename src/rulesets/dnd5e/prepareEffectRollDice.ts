import {captureDnd5eMissingEffectDice} from './rollDiceTransaction'
import type {Dnd5eRollDiceRecipe} from './rollDiceModifiers'

/**
 * Re-run a pure Host resolver against the same snapshot and transaction id.
 * No state is committed here; the caller still performs revision-checked commit.
 */
export async function prepareDnd5eEffectRollDice<T extends {ok:boolean}>(input: {
  resolve: (rolls: Readonly<Record<string,readonly number[]>>) => T
  roll: (recipe: Dnd5eRollDiceRecipe) => Promise<readonly number[] | undefined>
  maximumRequests?: number
}): Promise<{
  status:'ready'|'rejected'|'cancelled'|'invalid-dice'|'limit-exceeded'
  rolls: Readonly<Record<string,readonly number[]>>
  result: T
}> {
  const maximum = input.maximumRequests ?? 128
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1024) throw new RangeError('effect-dice-request-limit-invalid')
  const rolls: Record<string,readonly number[]> = {}
  let requested = 0
  for (;;) {
    const {result,requests} = captureDnd5eMissingEffectDice(() => input.resolve(structuredClone(rolls)))
    if (result.ok) return {status:'ready',rolls,result}
    if (!requests.length || requests.some(recipe => Object.hasOwn(rolls, recipe.id))) return {status:'rejected',rolls,result}
    for (const recipe of requests) {
      if (requested >= maximum) return {status:'limit-exceeded',rolls,result}
      requested += 1
      const values = await input.roll(recipe)
      if (values == null) return {status:'cancelled',rolls,result}
      if (values.length !== recipe.count || values.some(value => !Number.isInteger(value) || value < 1 || value > recipe.sides)) {
        return {status:'invalid-dice',rolls,result}
      }
      rolls[recipe.id] = [...values]
    }
  }
}
